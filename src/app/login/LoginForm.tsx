'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

export default function LoginScreen({ ready, next }: { ready: boolean; next: string }) {
  const { t } = useI18n()
  return (
    <>
      <p dir="ltr" className="text-[11px] font-semibold tracking-[0.18em] text-gold-400">
        Aether BI
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-100">{t('admin.loginTitle')}</h1>
      <p className="mt-2 text-sm leading-7 text-gray-400">{ready ? t('admin.loginHint') : t('admin.missing')}</p>
      {ready ? <LoginForm next={next} /> : null}
      <Link href="/" className="mt-5 inline-block text-sm text-blue-400 hover:text-blue-300">
        {t('admin.back')}
      </Link>
    </>
  )
}

function LoginForm({ next }: { next: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const supabase = createClient()
    if (!supabase) return
    setPending(true)
    setError('')
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setPending(false)
    if (signInError) {
      setError(t('admin.loginFailed'))
      return
    }
    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        <span className="text-gray-400">{t('admin.email')}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
        />
      </label>
      <label className="block text-sm">
        <span className="text-gray-400">{t('admin.password')}</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {t('admin.login')}
      </button>
    </form>
  )
}
