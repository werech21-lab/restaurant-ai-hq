'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Num, PageHeader, SectionCard } from '@/components/ui'
import { useI18n, type Locale } from '@/lib/i18n'
import { useTheme, type Theme } from '@/lib/theme'

type Prefs = {
  finance: boolean
  quality: boolean
  daily: boolean
  inbox: boolean
}

const defaults: Prefs = {
  finance: true,
  quality: true,
  daily: false,
  inbox: true,
}

const storageKey = 'ai-hq-settings'

export default function Settings() {
  const { locale, setLocale, t } = useI18n()
  const { theme, setTheme } = useTheme()
  const [prefs, setPrefs] = useState<Prefs>(defaults)
  const [saved, setSaved] = useState(false)

  const resolvedLocale: 'ar' | 'en' = locale === 'en' ? 'en' : 'ar'
  const dir = resolvedLocale === 'en' ? 'ltr' : 'rtl'

  const toggles: { key: keyof Prefs; label: string; hint: string }[] = [
    { key: 'finance', label: t('settings.finance'), hint: t('settings.financeHint') },
    { key: 'quality', label: t('settings.quality'), hint: t('settings.qualityHint') },
    { key: 'daily', label: t('settings.daily'), hint: t('settings.dailyHint') },
    { key: 'inbox', label: t('settings.inbox'), hint: t('settings.inboxHint') },
  ]
  const permissions = [
    t('settings.view'),
    t('settings.approve'),
    t('settings.contracts'),
    t('settings.export'),
  ]
  const languages: { id: Locale; title: string; hint: string }[] = [
    { id: 'ar', title: t('settings.arabic'), hint: t('settings.arabicHint') },
    { id: 'en', title: t('settings.english'), hint: t('settings.englishHint') },
  ]
  const appearances: { id: Theme; title: string; hint: string; swatch: string }[] = [
    { id: 'dark', title: t('settings.dark'), hint: t('settings.darkHint'), swatch: '#0d1015' },
    { id: 'light', title: t('settings.light'), hint: t('settings.lightHint'), swatch: '#fbf7f1' },
  ]

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<Prefs>
      setPrefs({ ...defaults, ...parsed })
    } catch {
      window.localStorage.removeItem(storageKey)
    }
  }, [])

  function toggle(key: keyof Prefs) {
    setPrefs((current) => ({ ...current, [key]: !current[key] }))
    setSaved(false)
  }

  function save() {
    window.localStorage.setItem(storageKey, JSON.stringify(prefs))
    setSaved(true)
  }

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader title={t('page.settings.title')} subtitle={t('page.settings.subtitle')} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title={t('settings.account')} locale={resolvedLocale} headerDivider>
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--ds-text-muted)]">{t('settings.name')}</dt>
              <dd className="font-semibold text-[var(--ds-text-primary)]">{t('owner')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--ds-text-muted)]">{t('settings.role')}</dt>
              <dd className="font-semibold text-[var(--ds-text-primary)]">{t('settings.roleValue')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--ds-text-muted)]">{t('settings.scope')}</dt>
              <dd className="font-semibold text-[var(--ds-text-primary)]">{t('settings.scopeValue')}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--ds-text-muted)]">{t('settings.session')}</dt>
              <dd>
                <Badge tone="good">{t('settings.active')}</Badge>
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title={t('settings.permissions')} locale={resolvedLocale} headerDivider>
          <ul className="space-y-2.5 text-sm">
            {permissions.map((item) => (
              <li
                key={item}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-3.5 py-3 text-[var(--ds-text-primary)]"
              >
                <span className="font-medium">{item}</span>
                <Badge tone="gold">{t('settings.enabled')}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t('settings.alerts')} locale={resolvedLocale} headerDivider>
          <div className="space-y-2">
            {toggles.map((item) => {
              const on = prefs[item.key]
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={item.label}
                  onClick={() => toggle(item.key)}
                  className="ds-focus-ring flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-transparent px-3 py-3 text-start transition hover:border-[var(--ds-border-hairline)] hover:bg-[var(--ds-bg-hover)] active:scale-[0.99]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[var(--ds-text-primary)]">
                      {item.label}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--ds-text-muted)]">
                      {item.key === 'daily' ? (
                        <>
                          {t('settings.dailyHint')} <Num>07:30</Num>
                        </>
                      ) : (
                        item.hint
                      )}
                    </span>
                  </span>
                  <span
                    dir="ltr"
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      on ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-400/50 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ring-1 ring-black/10 transition-all ${
                        on ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={save}>
              {t('settings.save')}
            </Button>
            {saved ? (
              <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {t('settings.saved')}
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title={t('settings.look')}
          subtitle={t('settings.lookHint')}
          locale={resolvedLocale}
          className="lg:col-span-2"
          headerDivider
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-bold text-[var(--ds-accent)]">{t('language')}</h3>
              <div className="mt-3 space-y-3">
                {languages.map((language) => {
                  const active = locale === language.id
                  return (
                    <button
                      key={language.id}
                      type="button"
                      aria-pressed={active}
                      aria-label={language.title}
                      onClick={() => setLocale(language.id)}
                      className={`ds-focus-ring flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition duration-200 ${
                        active
                          ? 'border-emerald-500/45 bg-[var(--ds-accent-soft)]'
                          : 'border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] hover:border-[var(--ds-border-strong)]'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[var(--ds-text-primary)]">
                          {language.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--ds-text-muted)]">
                          {language.hint}
                        </span>
                      </span>
                      {active ? <Badge tone="gold">{t('settings.on')}</Badge> : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--ds-accent)]">
                {t('settings.appearance')}
              </h3>
              <div className="mt-3 space-y-3">
                {appearances.map((appearance) => {
                  const active = theme === appearance.id
                  return (
                    <button
                      key={appearance.id}
                      type="button"
                      aria-pressed={active}
                      aria-label={appearance.title}
                      onClick={() => setTheme(appearance.id)}
                      className={`ds-focus-ring flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition duration-200 ${
                        active
                          ? 'border-emerald-500/45 bg-[var(--ds-accent-soft)]'
                          : 'border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] hover:border-[var(--ds-border-strong)]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className="h-9 w-9 shrink-0 rounded-lg border border-[var(--ds-border-strong)]"
                          style={{ background: appearance.swatch }}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[var(--ds-text-primary)]">
                            {appearance.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--ds-text-muted)]">
                            {appearance.hint}
                          </span>
                        </span>
                      </span>
                      {active ? <Badge tone="gold">{t('settings.on')}</Badge> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
