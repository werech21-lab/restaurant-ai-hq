'use client'

/**
 * «اكتشافات اليوم / Today's Discoveries» — the top 3 cross-advisor findings (impact × novelty,
 * nothing repeated from the last 7 days). Every figure shown is an Odoo evidence value or a labelled
 * Estimate with its formula; with no stored council run the card shows the unavailable state.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { AdvisorId, CouncilDiscovery, CouncilEstimate, CouncilEvidence } from '@/lib/council/types'

export const ADVISOR_LABEL: Record<AdvisorId, { ar: string; en: string }> = {
  cfo: { ar: 'المالية', en: 'Finance' },
  delivery: { ar: 'منصات التوصيل', en: 'Delivery platforms' },
  hr: { ar: 'الموارد البشرية', en: 'HR' },
  inventory: { ar: 'المخزون', en: 'Inventory' },
  seasons: { ar: 'المواسم', en: 'Seasons' },
  drivers: { ar: 'محرّكات المبيعات', en: 'Sales drivers' },
  menu: { ar: 'هندسة المنيو', en: 'Menu engineering' },
  benchmark: { ar: 'مقارنة الفروع', en: 'Branch benchmark' },
  forecast: { ar: 'التوقع', en: 'Forecast' },
}

function fmt(n: number, locale: 'ar' | 'en', digits: number): string {
  return n.toLocaleString(locale === 'ar' ? 'en-US' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function evidenceValue(e: CouncilEvidence, locale: 'ar' | 'en'): string {
  const kwd = locale === 'ar' ? 'د.ك' : 'KWD'
  if (e.unit === 'KWD') return `${fmt(e.value, locale, 3)} ${kwd}`
  if (e.unit === 'KWD/order') return `${fmt(e.value, locale, 3)} ${kwd}`
  if (e.unit === 'KWD/unit') return `${fmt(e.value, locale, 3)} ${kwd}${locale === 'ar' ? ' للوحدة' : ' / unit'}`
  if (e.unit === 'pct') return `${fmt(e.value, locale, 1)}%`
  if (e.unit === 'hours') return `${fmt(e.value, locale, 1)} ${locale === 'ar' ? 'ساعة' : 'h'}`
  return fmt(e.value, locale, 0)
}

export function estimateValue(est: CouncilEstimate, locale: 'ar' | 'en'): string {
  if (est.unit === 'KWD') return `${fmt(est.value, locale, 3)} ${locale === 'ar' ? 'د.ك / أسبوع' : 'KWD / week'}`
  if (est.unit === 'hours') return `${fmt(est.value, locale, 1)} ${locale === 'ar' ? 'ساعة / أسبوع' : 'h / week'}`
  return fmt(est.value, locale, 1)
}

export function syncLabel(iso: string | null, locale: 'ar' | 'en'): string {
  if (!iso) return locale === 'ar' ? 'غير متاح' : 'Unavailable'
  const d = new Date(Date.parse(iso) + 3 * 3_600_000)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`
}

export function TodaysDiscoveriesView({ locale, discoveries, loading = false }: { locale: 'ar' | 'en'; discoveries: CouncilDiscovery[] | null; loading?: boolean }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  // No stored council run (or nothing to show): the section is not rendered at all — no empty card.
  if (!loading && (!discoveries || discoveries.length === 0)) return null
  return (
    <section data-todays-discoveries="true" dir={isAr ? 'rtl' : 'ltr'} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900 sm:text-base dark:text-white">{t("Today's Discoveries", 'اكتشافات اليوم')}</h2>
        <p className="text-[12px] text-slate-500 dark:text-slate-400">
          {t('Advisor council · ranked by impact × novelty · no repeats from the last 7 days · ', 'مجلس المستشارين · مرتبة حسب الأثر × الجِدّة · بلا تكرار من آخر 7 أيام · ')}
          <Link href="/erp/decisions" data-decision-room-link="true" className="font-semibold text-blue-700 underline underline-offset-2 dark:text-blue-300">{t('All proposals in the Decision Room', 'كل المقترحات في غرفة القرار')}</Link>
        </p>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-[13px] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400" aria-busy="true">
          {t('Loading the advisor reports…', 'جاري تحميل تقارير المستشارين…')}
        </div>
      ) : !discoveries ? null : (
        <ol className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {discoveries.map((d, i) => {
            const f = d.finding
            const p = f.proposals[0]
            const est = p?.expectedImpact ?? f.weeklyImpact
            const ev = f.evidence.slice(0, 2)
            return (
              <li key={f.fingerprint} data-discovery={f.fingerprint} className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white dark:bg-white dark:text-slate-900">{i + 1}</span>
                  {[f.advisorId, ...d.linkedAdvisors].map((a) => (
                    <span key={a} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/20">
                      {isAr ? ADVISOR_LABEL[a].ar : ADVISOR_LABEL[a].en}
                    </span>
                  ))}
                </div>
                <h3 className="text-[14px] font-bold leading-snug text-slate-900 dark:text-white">{isAr ? f.titleAr : f.titleEn}</h3>
                <dl className="space-y-1 text-[12.5px] text-slate-700 dark:text-slate-300">
                  {ev.map((e) => (
                    <div key={`${e.labelEn}-${e.period.from}`} className="flex flex-wrap justify-between gap-x-2">
                      <dt className="text-slate-500 dark:text-slate-400">{isAr ? e.labelAr : e.labelEn}</dt>
                      <dd className="font-semibold tabular-nums" dir="ltr">{evidenceValue(e, locale)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[11.5px] text-slate-500 dark:text-slate-400" dir="ltr">
                  {`Odoo · ${ev[0]?.odooModel} · ${ev[0]?.period.from} → ${ev[0]?.period.to} · ${t('sync', 'مزامنة')} ${syncLabel(ev[0]?.syncAt ?? null, locale)}`}
                </p>
                <p className="text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{t('Why: ', 'لماذا: ')}</span>
                  {isAr ? f.rootCause.ar : f.rootCause.en}
                </p>
                {p ? (
                  <p className="text-[12.5px] leading-relaxed text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">{t('Do: ', 'المقترح: ')}</span>
                    {isAr ? `${p.who.ar}: ${p.what.ar} — ${p.when.ar}` : `${p.who.en}: ${p.what.en} — ${p.when.en}`}
                  </p>
                ) : null}
                {est ? (
                  <p data-estimate="true" className="mt-auto rounded-xl bg-amber-50/70 px-3 py-2 text-[11.5px] text-amber-900 ring-1 ring-amber-200/70 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-300/20">
                    <span className="font-bold">{t('Estimate', 'تقدير')}</span>
                    {`: ${estimateValue(est, locale)} = ${est.formula}`}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/** Fetches the latest stored council snapshot. */
export function TodaysDiscoveries({ locale }: { locale: 'ar' | 'en' }) {
  const [state, setState] = useState<{ loading: boolean; discoveries: CouncilDiscovery[] | null }>({ loading: true, discoveries: null })
  useEffect(() => {
    let cancelled = false
    fetch('/api/erp/council/discoveries', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { discoveries?: CouncilDiscovery[] } | null) => {
        if (!cancelled) setState({ loading: false, discoveries: body?.discoveries ?? null })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, discoveries: null })
      })
    return () => {
      cancelled = true
    }
  }, [])
  // Nothing while loading or when no snapshot is stored: the Home shows the section only with content.
  if (state.loading) return null
  return <TodaysDiscoveriesView locale={locale} discoveries={state.discoveries} />
}
