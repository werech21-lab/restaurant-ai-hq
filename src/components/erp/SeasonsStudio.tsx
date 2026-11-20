'use client'

/**
 * /erp/seasons — owner-editable seasons calendar + the Seasons advisor's comparison and prep plan.
 * Figures come only from the stored advisor report (Odoo daily sales); a season whose previous
 * window is not in Odoo shows the data gap instead of a number.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  localizeDecisionProseAr,
  localizeEstimateFormulaAr,
  localizeEstimateFormulaEn,
} from '@/components/erp/KpiProvenanceBadge'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useLang } from '@/components/aether/ui'
import { StateBlock, UnavailableState } from '@/components/ui'
import { CompactInfoTooltip } from '@/components/ui/compact-info-tooltip'
import { SALARY_WINDOW_DAYS } from '@/lib/aether/salary-window'
import { SEASON_KINDS, seasonLiftsFromDaily, type SeasonEvent, type SeasonKind } from '@/lib/council/advisors/seasons'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { AdvisorReport } from '@/lib/council/types'

const KIND_LABEL: Record<SeasonKind, { ar: string; en: string }> = {
  ramadan: { ar: 'رمضان', en: 'Ramadan' },
  'eid-al-fitr': { ar: 'عيد الفطر', en: 'Eid al-Fitr' },
  'eid-al-adha': { ar: 'عيد الأضحى', en: 'Eid al-Adha' },
  'school-start': { ar: 'بداية الدراسة', en: 'School start' },
  'school-holiday': { ar: 'عطلة مدرسية', en: 'School holiday' },
  summer: { ar: 'الصيف', en: 'Summer' },
  winter: { ar: 'الشتاء', en: 'Winter' },
  'national-day': { ar: 'العيد الوطني', en: 'National Day' },
  'salary-days': { ar: `أيام الرواتب ${SALARY_WINDOW_DAYS.start}–${SALARY_WINDOW_DAYS.end}`, en: `Salary days ${SALARY_WINDOW_DAYS.start}–${SALARY_WINDOW_DAYS.end}` },
  custom: { ar: 'مناسبة أخرى', en: 'Other occasion' },
}

const EMPTY: SeasonEvent = { id: '', kind: 'custom', nameAr: '', nameEn: '', startsOn: '', endsOn: '', recurrence: 'yearly', approximate: true }

export interface SeasonsStudioViewProps {
  locale: 'ar' | 'en'
  loading?: boolean
  events: SeasonEvent[] | null
  suggested: boolean
  report: AdvisorReport | null
  liveSummary?: OdooLiveSummary | null
  canEdit: boolean
  onSave?: (ev: SeasonEvent) => void
  onDelete?: (id: string) => void
}

export function SeasonsStudioView({ locale, loading = false, events, suggested, report, liveSummary = null, canEdit, onSave, onDelete }: SeasonsStudioViewProps) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const [draft, setDraft] = useState<SeasonEvent>(EMPTY)
  const findingFor = (ev: SeasonEvent) => report?.findings.find((f) => f.fingerprint === `seasons:${ev.id}:${ev.startsOn}`) ?? null
  const lifts = events ? seasonLiftsFromDaily(liveSummary ?? null, events) : []
  const liftFor = (ev: SeasonEvent) => lifts.find((row) => row.eventId === ev.id) ?? null
  const input = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 dark:border-white/15 dark:bg-white/[0.06] dark:text-white'
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-w-0 space-y-5 p-3 sm:p-5" data-seasons-studio="true">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">{t('Seasons & Occasions', 'المواسم والمناسبات')}</h2>
          <p className="text-[13px] text-slate-600 dark:text-slate-400">
            {t('Owner-editable calendar. For each upcoming season the Seasons advisor compares the previous occurrence in Odoo with normal days and proposes a prep plan.', 'تقويم يعدّله المالك. لكل موسم قادم يقارن مستشار المواسم المرة السابقة في أودو بالأيام العادية ويقترح خطة تحضير.')}
          </p>
        </div>
        {suggested ? (
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200 dark:ring-white/15">
            <span>{t('Suggested calendar', 'تقويم مقترح')}</span>
            <CompactInfoTooltip
              isAr={isAr}
              label={t('Approximate Hijri dates', 'تواريخ هجرية تقريبية')}
              text={t('Suggested calendar — Hijri dates are approximate; save your own dates to replace it.', 'تقويم مقترح — التواريخ الهجرية تقريبية؛ احفظ تواريخك لتحل محله.')}
            />
          </div>
        ) : null}
      </header>

      {loading ? (
        <StateBlock
          state="loading"
          locale={locale}
          skeletonRows={3}
          title={t('Loading seasons calendar from Odoo…', 'جارٍ تحميل تقويم المواسم ومقارنات أودو...')}
        />
      ) : !events ? (
        <UnavailableState locale={locale} reason={t('The seasons calendar could not be read.', 'تعذّر قراءة تقويم المواسم.')} />
      ) : events.length === 0 ? (
        <StateBlock
          state="empty"
          locale={locale}
          title={t('No seasons configured yet.', 'لا توجد مواسم مضافة حالياً.')}
          description={t('Add a season below to compare its historical lift in Odoo.', 'أضف موسماً أدناه لمقارنة أثره التاريخي في أودو.')}
        />
      ) : (
        <ul className={`grid grid-cols-1 gap-3 ${events.length === 1 ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
          {events.map((ev) => {
            const f = findingFor(ev)
            const lift = liftFor(ev)
            return (
              <li key={ev.id} data-season={ev.id} className="relative overflow-visible min-w-0 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-slate-900 dark:text-white" title={isAr ? ev.nameAr : ev.nameEn}>{isAr ? ev.nameAr : ev.nameEn}</p>
                    <p className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400" dir={isAr ? 'rtl' : 'ltr'}>
                      {ev.kind === 'salary-days' ? (
                        t(
                          `Days ${SALARY_WINDOW_DAYS.start}–${SALARY_WINDOW_DAYS.end} of each month, Kuwait time`,
                          `أيام ${SALARY_WINDOW_DAYS.start}–${SALARY_WINDOW_DAYS.end} من كل شهر، بتوقيت الكويت`,
                        )
                      ) : (
                        <>
                          <bdi dir="ltr">{`${ev.startsOn} → ${ev.endsOn}`}</bdi>
                          {` · ${isAr ? KIND_LABEL[ev.kind].ar : KIND_LABEL[ev.kind].en}${ev.approximate ? ` · ${t('approximate', 'تقريبي')}` : ''}`}
                        </>
                      )}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 gap-1.5 whitespace-nowrap text-[12px]">
                      <button type="button" className="cursor-pointer rounded-lg px-2.5 py-1 font-semibold ring-1 ring-slate-300 transition hover:bg-slate-50 dark:ring-white/15 dark:hover:bg-white/10" onClick={() => setDraft(ev)}>{t('Edit', 'تعديل')}</button>
                      {!suggested ? <button type="button" className="cursor-pointer rounded-lg px-2.5 py-1 font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40" onClick={() => onDelete?.(ev.id)}>{t('Delete', 'حذف')}</button> : null}
                    </div>
                  ) : null}
                </div>
                {lift ? (
                  <div data-season-lift={ev.id} className="space-y-1 text-[12.5px] tabular-nums text-slate-700 dark:text-slate-300">
                    <p>
                      {ev.kind === 'salary-days'
                        ? t(
                            `Days ${SALARY_WINDOW_DAYS.start}–${SALARY_WINDOW_DAYS.end} vs the other days of the same months`,
                            `أيام ${SALARY_WINDOW_DAYS.start}–${SALARY_WINDOW_DAYS.end} مقابل بقية أيام نفس الأشهر`,
                          )
                        : t('Last occurrence', 'آخر مرة')}{' '}
                      {ev.kind === 'salary-days' ? null : <bdi dir="ltr">{`${lift.window.from} → ${lift.window.to}`}</bdi>}
                      {' · '}
                      {t('avg day', 'متوسط اليوم')} <bdi dir="ltr">{lift.avgDailyKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</bdi>
                      {' · '}
                      {t('normal day', 'يوم عادي')} <bdi dir="ltr">{lift.baselineDailyKwd.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</bdi>
                      {' · '}
                      <bdi dir="ltr">{`${lift.liftPct >= 0 ? '+' : ''}${lift.liftPct.toFixed(1)}%`}</bdi>
                    </p>
                    {lift.topBranches.length > 0 ? (
                      <p>
                        {t('Top branches', 'أكثر الفروع تأثراً')}: {lift.topBranches.map((b) => `${isAr ? b.nameAr : b.nameEn} ${b.liftPct >= 0 ? '+' : ''}${b.liftPct.toFixed(1)}%`).join(' · ')}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {f ? (
                  <div className="space-y-1.5 text-[12.5px] text-slate-700 dark:text-slate-300">
                    <p className="min-w-0 break-words font-semibold text-slate-900 dark:text-white">{isAr ? localizeDecisionProseAr(f.titleAr) : f.titleEn}</p>
                    <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400" dir={isAr ? 'rtl' : 'ltr'}>
                      {f.evidence
                        .filter((e) => e.unit === 'KWD')
                        .map((e, idx) => (
                          <span key={`${e.labelEn}-${e.period.from}-${idx}`}>
                            {idx > 0 ? ' · ' : ''}
                            {isAr ? localizeDecisionProseAr(e.labelAr) : e.labelEn}
                            {': '}
                            <bdi dir="ltr">
                              {e.value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </bdi>
                            {` ${t('KWD', 'د.ك')} `}
                            <bdi dir="ltr">{`(${e.period.from} → ${e.period.to})`}</bdi>
                          </span>
                        ))}
                    </p>
                    <p className="font-semibold">{t('Prep plan', 'خطة التحضير')}</p>
                    <ul className="list-disc space-y-1 ps-5">
                      {f.proposals.map((p, i) => (
                        <li key={i}>
                          {isAr ? `${localizeDecisionProseAr(p.who.ar)}: ${localizeDecisionProseAr(p.what.ar)} — ${localizeDecisionProseAr(p.when.ar)}` : `${p.who.en}: ${p.what.en} — ${p.when.en}`}
                          {p.expectedImpact ? (
                            <span
                              data-season-estimate="true"
                              dir={isAr ? 'rtl' : 'ltr'}
                              className="block text-xs tabular-nums text-sky-800 dark:text-sky-200"
                            >
                              {`${t('Estimate', 'تقدير')}: `}
                              <bdi dir="ltr">
                                {p.expectedImpact.value.toLocaleString('en-US', {
                                  minimumFractionDigits: 3,
                                  maximumFractionDigits: 3,
                                })}
                              </bdi>
                              {` ${t('KWD over the event week', 'د.ك خلال أسبوع الموسم')} = ${
                                isAr
                                  ? localizeEstimateFormulaAr(p.expectedImpact.formula)
                                  : localizeEstimateFormulaEn(p.expectedImpact.formula)
                              }`}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {canEdit ? (
        <form
          className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-white/[0.03]"
          onSubmit={(e) => {
            e.preventDefault()
            onSave?.({ ...draft, id: draft.id || `${draft.kind}-${draft.startsOn}` })
            setDraft(EMPTY)
          }}
        >
          <p className="text-[13px] font-semibold sm:col-span-3">{draft.id ? t('Edit season', 'تعديل الموسم') : t('Add a season', 'إضافة موسم')}</p>
          <select className={input} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as SeasonKind })}>
            {SEASON_KINDS.map((k) => <option key={k} value={k}>{isAr ? KIND_LABEL[k].ar : KIND_LABEL[k].en}</option>)}
          </select>
          <input className={input} placeholder={t('Name (Arabic)', 'الاسم بالعربي')} value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} required />
          <input className={input} placeholder={t('Name (English)', 'الاسم بالإنجليزي')} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} required />
          <label className="text-[12px]">{t('Starts', 'يبدأ')}<input type="date" dir="ltr" className={`${input} tabular-nums`} value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} required /></label>
          <label className="text-[12px]">{t('Ends', 'ينتهي')}<input type="date" dir="ltr" className={`${input} tabular-nums`} value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} required /></label>
          <label className="text-[12px]">{t('Repeats', 'يتكرر')}
            <select className={input} value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value as SeasonEvent['recurrence'] })}>
              <option value="yearly">{t('Yearly', 'سنوياً')}</option>
              <option value="monthly">{t('Monthly', 'شهرياً')}</option>
              <option value="none">{t('Once', 'مرة واحدة')}</option>
            </select>
          </label>
          <label className="text-[12px]">{t('Last year starts (if different)', 'بداية السنة الماضية (إن اختلفت)')}<input type="date" dir="ltr" className={`${input} tabular-nums`} value={draft.previousStartsOn ?? ''} onChange={(e) => setDraft({ ...draft, previousStartsOn: e.target.value || null })} /></label>
          <label className="text-[12px]">{t('Last year ends', 'نهاية السنة الماضية')}<input type="date" dir="ltr" className={`${input} tabular-nums`} value={draft.previousEndsOn ?? ''} onChange={(e) => setDraft({ ...draft, previousEndsOn: e.target.value || null })} /></label>
          <label className="flex cursor-pointer items-center gap-2 text-[12px]"><input type="checkbox" checked={draft.approximate} onChange={(e) => setDraft({ ...draft, approximate: e.target.checked })} />{t('Approximate dates', 'تواريخ تقريبية')}</label>
          <button type="submit" className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-emerald-700 sm:col-span-3 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400">{t('Save', 'حفظ')}</button>
        </form>
      ) : null}

    </div>
  )
}

export function SeasonsStudio() {
  const { isAr } = useLang()
  const { sessionRole, isAuditor, liveSummary } = useGlobalFilter()
  const [state, setState] = useState<{ loading: boolean; events: SeasonEvent[] | null; suggested: boolean; report: AdvisorReport | null }>({ loading: true, events: null, suggested: false, report: null })
  const load = useCallback(() => {
    fetch('/api/erp/seasons', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { events?: SeasonEvent[]; suggested?: boolean; report?: AdvisorReport | null } | null) => setState({ loading: false, events: b?.events ?? null, suggested: Boolean(b?.suggested), report: b?.report ?? null }))
      .catch(() => setState({ loading: false, events: null, suggested: false, report: null }))
  }, [])
  useEffect(() => load(), [load])
  const send = (method: 'POST' | 'DELETE', body?: SeasonEvent, id?: string) =>
    fetch(`/api/erp/seasons${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(load)
  return (
    <SeasonsStudioView
      locale={isAr ? 'ar' : 'en'}
      loading={state.loading}
      events={state.events}
      suggested={state.suggested}
      report={state.report}
      liveSummary={liveSummary}
      canEdit={sessionRole === 'admin' && !isAuditor}
      onSave={(ev) => void send('POST', ev)}
      onDelete={(id) => void send('DELETE', undefined, id)}
    />
  )
}
