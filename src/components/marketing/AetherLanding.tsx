'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

const features = [
  { title: 'المحاسبة والمالية', body: 'فواتير، قيود مزدوجة، تحصيل، ومحاسبة تحليلية بالدينار الكويتي (0.000 د.ك).' },
  { title: 'المخزون والتصنيع', body: 'مخازن، وصفات BOM، خصم تلقائي للمواد، وهدر محسوب بدقة.' },
  { title: 'الكاشير POS والمبيعات', body: 'نقاط بيع، عروض أسعار، وتحويل عرض إلى فاتورة بضغطة واحدة.' },
  { title: 'الموارد البشرية', body: '165 موظفاً حقيقياً، مسيرات رواتب، حضور، وإقامات مربوطة بالحوكمة.' },
  { title: 'CRM وعروض الأسعار', body: 'فرص بيع، عملاء، واقتباسات ضريبية صحيحة حتى التحويل إلى نقد.' },
  { title: 'الذكاء الاصطناعي والحوكمة', body: 'محرك قرارات حتمي، رادار التطبيقات، وبوابة إيقاف رقابي.' },
] as const

const plans: readonly { name: string; price: string; detail: string; cta: string; featured?: boolean }[] = [
  {
    name: 'Starter',
    price: '149',
    detail: 'فرع واحد · حتى 25 مستخدماً · محاسبة ومخزون أساسية',
    cta: 'ابدأ التجربة',
  },
  {
    name: 'Growth',
    price: '399',
    detail: 'حتى 5 فروع · POS + CRM + HR · رادار التطبيقات',
    cta: 'الأنسب للمجموعات',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'مخصص',
    detail: 'فروع غير محدودة · حوكمة كاملة · تكامل أودو · دعم أولوية',
    cta: 'تحدث مع المبيعات',
  },
]

export default function AetherLanding({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n()
  const erpHref = signedIn ? '/erp' : '/login'
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitTrial(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/marketing/trial-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fullName, phone, companyName: companyName || undefined, notes: notes || undefined }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const message =
          typeof body === 'object' && body && 'error' in body && typeof (body as { error: { message?: string } }).error?.message === 'string'
            ? (body as { error: { message: string } }).error.message
            : t('land.trial.error')
        throw new Error(message)
      }
      setDone(true)
      setFullName('')
      setPhone('')
      setCompanyName('')
      setNotes('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('land.trial.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-mist-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(201,161,90,0.18),transparent_42%),radial-gradient(ellipse_at_90%_20%,rgba(56,78,110,0.22),transparent_45%),linear-gradient(180deg,#07090f_0%,#0d121c_55%,#07090f_100%)]" />

      <header className="relative z-10 border-b border-gold-300/15 bg-ink-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="font-cairo text-2xl font-black tracking-tight text-gold-300 sm:text-3xl">
            AetherBI
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <a href="#features" className="rounded-lg px-3 py-2 text-sm text-mist-300 hover:text-white">{t('land.nav.features')}</a>
            <a href="#pricing" className="rounded-lg px-3 py-2 text-sm text-mist-300 hover:text-white">{t('land.nav.pricing')}</a>
            <a href="#trial" className="rounded-lg px-3 py-2 text-sm text-mist-300 hover:text-white">{t('land.nav.trial')}</a>
            <Link href="/download" className="rounded-xl border border-gold-300/30 px-3 py-2 text-sm text-gold-200 hover:border-gold-300/60">
              {t('land.nav.download')}
            </Link>
            <Link href={erpHref} className="rounded-xl bg-gold-400 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-gold-300">
              {signedIn ? t('land.nav.openErp') : t('land.nav.login')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid min-h-[78vh] max-w-6xl items-end gap-10 px-4 pb-16 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
          <div className="space-y-6">
            <p className="text-sm uppercase tracking-[0.25em] text-gold-300/80">Venture Foods · Kuwait</p>
            <h1 className="max-w-xl font-cairo text-4xl font-black leading-[1.15] text-white sm:text-5xl lg:text-6xl">
              AetherBI
            </h1>
            <p className="max-w-xl text-lg leading-8 text-mist-300">{t('land.hero.lead')}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={erpHref} className="rounded-xl bg-gold-400 px-5 py-3 text-sm font-bold text-ink-950 hover:bg-gold-300">
                {signedIn ? t('land.nav.openErp') : t('land.nav.login')}
              </Link>
              <Link href="/download" className="rounded-xl border border-white/20 px-5 py-3 text-sm text-white hover:border-gold-300/50">
                {t('land.nav.download')}
              </Link>
              <a href="#trial" className="rounded-xl border border-gold-300/30 px-5 py-3 text-sm text-gold-200">
                {t('land.hero.trialCta')}
              </a>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-gold-300/20 bg-gradient-to-br from-[#1a2233] via-[#121826] to-[#0a0e16] p-8 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            <div className="absolute -end-10 -top-10 h-40 w-40 rounded-full bg-gold-400/10 blur-2xl" />
            <p className="text-sm text-mist-400">{t('land.hero.panelLabel')}</p>
            <p className="mt-4 text-3xl font-bold text-white">Enterprise ERP & BI</p>
            <ul className="mt-6 space-y-3 text-sm text-mist-200">
              <li>· 6 أقسام أودو متكاملة</li>
              <li>· 6 براندات × 10 فروع</li>
              <li>· محرك AI حتمي + بوابة حوكمة</li>
            </ul>
          </div>
        </section>

        <section id="features" className="border-t border-white/5 bg-black/20 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-white">{t('land.features.title')}</h2>
            <p className="mt-3 max-w-2xl text-mist-400">{t('land.features.lead')}</p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="rounded-2xl border border-gold-300/10 bg-ink-900/50 p-5">
                  <h3 className="text-lg font-semibold text-gold-300">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-mist-300">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-bold text-white">{t('land.pricing.title')}</h2>
            <p className="mt-3 max-w-2xl text-mist-400">{t('land.pricing.lead')}</p>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-2xl border p-6 ${plan.featured ? 'border-gold-300/50 bg-gold-400/10' : 'border-white/10 bg-ink-900/40'}`}
                >
                  <p className="text-sm text-gold-300">{plan.name}</p>
                  <p className="mt-3 text-4xl font-black text-white">
                    {plan.price}
                    {plan.price !== 'مخصص' ? <span className="ms-1 text-base font-medium text-mist-400">د.ك / شهر</span> : null}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-mist-300">{plan.detail}</p>
                  <a href="#trial" className={`mt-6 inline-flex rounded-xl px-4 py-2 text-sm font-semibold ${plan.featured ? 'bg-gold-400 text-ink-950' : 'border border-white/20 text-white'}`}>
                    {plan.cta}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="trial" className="border-t border-white/5 bg-black/25 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-white">{t('land.trial.title')}</h2>
              <p className="mt-3 text-mist-400">{t('land.trial.lead')}</p>
            </div>
            <form onSubmit={(event) => void submitTrial(event)} className="space-y-3 rounded-2xl border border-gold-300/20 bg-ink-900/60 p-6">
              <label className="block text-sm text-mist-300">
                {t('land.trial.name')}
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold-300/50" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
              <label className="block text-sm text-mist-300">
                {t('land.trial.phone')}
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold-300/50" required value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" placeholder="+965xxxxxxxx" />
              </label>
              <label className="block text-sm text-mist-300">
                {t('land.trial.company')}
                <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold-300/50" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
              </label>
              <label className="block text-sm text-mist-300">
                {t('land.trial.notes')}
                <textarea className="mt-1 min-h-24 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-gold-300/50" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              {done ? <p className="text-sm text-emerald-300">{t('land.trial.success')}</p> : null}
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-gold-400 px-4 py-3 text-sm font-bold text-ink-950 disabled:opacity-60">
                {busy ? t('land.trial.sending') : t('land.trial.submit')}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-sm text-mist-500">
        © {new Date().getFullYear()} AetherBI · www.aetherbi.com
      </footer>
    </div>
  )
}
