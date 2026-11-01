'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'
import { Alert, btnPrimary, fieldClass, labelClass } from '@/components/erp-ui'
import { LanguageSwitch, useI18n, type MessageKey } from '@/lib/i18n'

const demos: Array<{ email: string; password: string; name: MessageKey; role: MessageKey; desc: MessageKey }> = [
  {
    email: 'admin@aetherbi.com',
    password: 'AetherAdmin#2026!',
    name: 'login.demo.aether',
    role: 'login.demo.aetherRole',
    desc: 'login.demo.aetherDesc',
  },
  { email: 'admin@erp.com', password: '123456', name: 'login.demo.admin', role: 'login.demo.adminRole', desc: 'login.demo.adminDesc' },
  { email: 'accountant@erp.com', password: '123456', name: 'login.demo.acc', role: 'login.demo.accRole', desc: 'login.demo.accDesc' },
  { email: 'store@erp.com', password: '123456', name: 'login.demo.store', role: 'login.demo.storeRole', desc: 'login.demo.storeDesc' },
  { email: 'sales@erp.com', password: '123456', name: 'login.demo.sales', role: 'login.demo.salesRole', desc: 'login.demo.salesDesc' },
]

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  const { t, locale } = useI18n()

  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-900/80 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-mist-100">{t('login.title')}</h2>
        <LanguageSwitch />
      </div>
      <p className="mt-1 text-sm text-mist-400">{t('login.lead')}</p>
      <form action={action} className="mt-5 space-y-4">
        {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
        <div>
          <label className={labelClass} htmlFor="email">
            {t('login.email')}
          </label>
          <input id="email" name="email" type="email" required dir="ltr" className={`${fieldClass} text-left`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="password">
            {t('login.password')}
          </label>
          <input id="password" name="password" type="password" required dir="ltr" className={`${fieldClass} text-left`} />
        </div>
        <button className={`${btnPrimary} w-full`} disabled={pending}>
          {pending ? '…' : t('login.submit')}
        </button>
      </form>
      <div className="mt-6">
        <p className="text-sm font-bold text-mist-100">{t('login.demo')}</p>
        <p className="mt-1 text-xs text-mist-400" dir="ltr">
          {locale === 'en'
            ? 'Official: admin@aetherbi.com · Demo users: password 123456'
            : 'الرسمي: admin@aetherbi.com · التجريبي: كلمة المرور 123456'}
        </p>
        <div className="mt-3 grid gap-2">
          {demos.map((demo) => (
            <button
              key={demo.email}
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-ink-900/80 px-3 py-3 text-start hover:border-[#8cc63f]/50"
              onClick={() => {
                const email = document.getElementById('email') as HTMLInputElement | null
                const password = document.getElementById('password') as HTMLInputElement | null
                if (!email || !password) return
                email.value = demo.email
                password.value = demo.password
                email.form?.requestSubmit()
              }}
            >
              <span>
                <span className="block text-sm font-bold text-mist-100">{t(demo.name)}</span>
                <span className="block text-xs text-mist-400">{t(demo.desc)}</span>
              </span>
              <span className="rounded-full bg-[#00a99d] px-2.5 py-1 text-xs font-bold text-white">{t(demo.role)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
