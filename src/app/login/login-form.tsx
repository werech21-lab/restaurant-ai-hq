'use client'

import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { VentureFoodsEmblem } from '@/app/login/login-hero'
import {
  resolveLoginErrorMessage,
  type LoginErrorMessage,
  type LoginErrorPayload,
} from '@/app/login/login-error-message'
import { useI18n } from '@/lib/i18n'

type LoginFormProps = {
  nextPath?: string
}

type LoginApiResponse = LoginErrorPayload & {
  ok?: boolean
  redirectTo?: string
}

export function LoginForm({ nextPath = '' }: LoginFormProps) {
  const { t, locale, companyName } = useI18n()
  const isAr = locale === 'ar'
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<LoginErrorMessage | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const password = String(formData.get('password') || '').trim()

    let next = nextPath || ''
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
        setErrorMsg(resolveLoginErrorMessage(res.status, data))
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
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-md min-w-0 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-8 dark:border-white/[0.09] dark:bg-[#101815]"
    >
      {/* Mobile-only Venture Foods header & official scope (zero overflow on 360px) */}
      <div className="mb-5 min-w-0 border-b border-slate-200/80 pb-4 lg:hidden dark:border-white/[0.08]">
        <div className="flex min-w-0 items-start gap-3">
          <VentureFoodsEmblem className="h-10 w-10 shrink-0 rounded-xl shadow-sm ring-1 ring-emerald-900/15" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold tracking-wide text-emerald-700 dark:text-emerald-400">
              {isAr
                ? 'فنتشر فودز · إيثر لذكاء الأعمال'
                : 'Venture Foods · Aether BI'}
            </div>
            <p className="mt-0.5 min-w-0 break-words whitespace-normal text-xs font-bold leading-snug text-slate-900 sm:text-sm dark:text-slate-100">
              {companyName}
            </p>
          </div>
        </div>
        <p className="mt-2 min-w-0 break-words whitespace-normal text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
          {isAr
            ? '6 علامات تجارية • 7 فروع • 8 قنوات'
            : '6 Brands • 7 Branches • 8 Channels'}
        </p>
      </div>

      {/* Desktop & mobile card header with high-contrast emerald emblem */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {isAr ? 'وصول تنفيذي محمي' : 'Protected Executive Access'}
            </span>
          </div>
          <h1 className="mt-3 min-w-0 break-words whitespace-normal text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-50">
            {t('login.title')}
          </h1>
        </div>
        <VentureFoodsEmblem className="hidden h-11 w-11 shrink-0 rounded-2xl shadow-sm ring-1 ring-emerald-900/15 lg:block" />
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {t('login.lead')}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate={false}>
        {errorMsg ? (
          <div
            id="login-error-alert"
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-medium text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/60 dark:text-rose-200"
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
            aria-label={t('login.email')}
            aria-invalid={Boolean(errorMsg)}
            aria-describedby={errorMsg ? 'login-error-alert' : undefined}
            dir="ltr"
            disabled={submitting}
            className="ds-focus-ring min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60 dark:border-white/15 dark:bg-[#090E0C] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {t('login.password')}
          </label>
          <div className="relative" dir="ltr">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              aria-label={t('login.password')}
              aria-invalid={Boolean(errorMsg)}
              aria-describedby={errorMsg ? 'login-error-alert' : undefined}
              dir="ltr"
              disabled={submitting}
              className="ds-focus-ring min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pe-12 ps-3.5 text-left text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60 dark:border-white/15 dark:bg-[#090E0C] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-pressed={showPassword}
              aria-label={
                showPassword
                  ? isAr
                    ? 'إخفاء كلمة المرور'
                    : 'Hide password'
                  : isAr
                    ? 'إظهار كلمة المرور'
                    : 'Show password'
              }
              className="ds-focus-ring absolute end-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-label={submitting ? t('login.submitting') : t('login.submit')}
          className="ds-focus-ring mt-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          <span>{submitting ? t('login.submitting') : t('login.submit')}</span>
        </button>
      </form>

      <div className="mt-6 flex items-center gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-600 dark:border-white/[0.08] dark:text-slate-300">
        <ShieldCheck
          className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
          aria-hidden="true"
        />
        <span>{t('login.securityNote')}</span>
      </div>
    </div>
  )
}
