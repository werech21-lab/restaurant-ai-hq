'use client'

import { LanguageSwitch, useI18n } from '@/lib/i18n'

export function LoginHero() {
  const { t, companyName, locale } = useI18n()
  return (
    <section className="relative hidden flex-col justify-between overflow-hidden border-s border-gold-300/15 bg-gradient-to-br from-ink-900 via-ink-950 to-[#0a1412] px-12 py-12 lg:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(140,198,63,0.18),transparent_42%),radial-gradient(ellipse_at_90%_30%,rgba(0,169,157,0.16),transparent_45%)]" />
      <div className="relative z-10">
        <div className="mb-6 flex justify-end">
          <LanguageSwitch />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/venture-foods-logo-dark.svg" alt="Venture Foods" className="h-20 w-auto" />
        <h1 className="mt-8 text-3xl font-bold leading-snug text-mist-100">{companyName}</h1>
        <p className="mt-2 text-sm font-semibold text-[#8cc63f]" dir="ltr">
          {locale === 'en' ? t('panel.company.ar') : t('panel.company.en')}
        </p>
        <p className="mt-4 max-w-md text-mist-300">{t('login.heroLead')}</p>
      </div>
      <div className="relative z-10 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-gold-300/20 bg-ink-900/60 p-4">
          <p className="text-mist-400">{t('login.currency')}</p>
          <p className="mt-1 font-bold text-gold-300">{t('login.currencyVal')}</p>
        </div>
        <div className="rounded-2xl border border-gold-300/20 bg-ink-900/60 p-4">
          <p className="text-mist-400">{t('login.coverage')}</p>
          <p className="mt-1 font-bold text-[#00a99d]">{t('login.coverageVal')}</p>
        </div>
      </div>
    </section>
  )
}
