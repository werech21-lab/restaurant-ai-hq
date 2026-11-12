'use client'

import { LanguageSwitch, useI18n } from '@/lib/i18n'

export function LoginHero() {
  const { t, companyName, locale } = useI18n()
  const isAr = locale === 'ar'

  return (
    <section className="relative hidden min-w-0 flex-col justify-between overflow-hidden border-s border-slate-200/80 bg-[#0B141B] px-10 py-12 text-slate-100 xl:px-14 lg:flex dark:border-white/[0.07]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(16,185,129,0.14),transparent_48%),radial-gradient(ellipse_at_90%_80%,rgba(14,165,233,0.10),transparent_45%)]" />

      <div className="relative z-10 min-w-0">
        <div className="mb-8 flex items-center justify-between gap-4">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium tabular-nums text-emerald-300">
            Aether BI v2.6 Enterprise
          </span>
          <LanguageSwitch />
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/venture-foods-logo-dark.svg"
          alt="Venture Foods"
          className="h-16 w-auto"
        />

        <h1 className="mt-8 text-3xl font-bold leading-snug tracking-tight text-white">
          {companyName}
        </h1>
        <p className="mt-2 text-xs font-semibold tracking-wider text-emerald-400" dir="ltr">
          {locale === 'en' ? t('panel.company.ar') : t('panel.company.en')}
        </p>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
          {t('login.heroLead')}
        </p>
      </div>

      <div className="relative z-10 mt-10 grid grid-cols-2 gap-3.5 text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium text-slate-400">
            {t('login.coverage')}
          </p>
          <p className="mt-1.5 font-bold tabular-nums text-emerald-300">
            {isAr
              ? '6 مطاعم • 7 فروع • 8 قنوات'
              : '6 Brands • 7 Branches • 8 Channels'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium text-slate-400">
            {t('login.currency')}
          </p>
          <p className="mt-1.5 font-bold tabular-nums text-slate-100">
            {t('login.currencyVal')}
          </p>
        </div>
      </div>
    </section>
  )
}
