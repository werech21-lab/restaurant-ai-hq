'use client'

/**
 * /erp/decisions — Decision Room.
 *
 * Turns the advisor council's findings into decisions: an executive summary, ranked proposals with
 * their Odoo evidence and Estimates, Accept / Test / Reject (executives), a decision log with the
 * measured outcome, and four analysis views computed in the browser from the same Odoo payload with the
 * council's own engines (sales drivers, branch benchmark, forecast & unusual days). Every figure is an
 * Odoo value or a labelled Estimate; a view without data says what is missing instead of 0.000.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { ADVISOR_LABEL, estimateValue, evidenceValue, syncLabel } from '@/components/aether/TodaysDiscoveries'
import { useLang } from '@/components/aether/ui'
import { branchKpis, weekdayMatrix } from '@/lib/council/advisors/benchmark'
import { contributions, driverWindows } from '@/lib/council/advisors/drivers'
import { detectAnomalies, forecastNext7, marketWideDays } from '@/lib/council/advisors/forecast'
import { splitOrdersAov } from '@/lib/council/analytics'
import type { DecisionRecord, DecisionStatus } from '@/lib/council/decisions'
import type { ExecutiveSummary } from '@/lib/council/executive-summary'
import { WEEKDAY_AR, WEEKDAY_EN, branchLabel } from '@/lib/council/helpers'
import { findingImpactScore } from '@/lib/council/runner'
import { completedDailyByBranch } from '@/lib/council/series'
import type { AdvisorId, AdvisorReport, CouncilFinding } from '@/lib/council/types'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export type DecisionRoomTab = 'all' | 'drivers' | 'menu' | 'benchmark' | 'forecast' | 'log'

const TAB_ADVISORS: Record<Exclude<DecisionRoomTab, 'all' | 'log'>, AdvisorId[]> = {
  drivers: ['drivers', 'cfo'],
  menu: ['menu'],
  benchmark: ['benchmark'],
  forecast: ['forecast', 'seasons'],
}

const STATUS_LABEL: Record<DecisionStatus, { ar: string; en: string; cls: string }> = {
  accepted: { ar: 'معتمد', en: 'Accepted', cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20' },
  testing: { ar: 'قيد الاختبار', en: 'Testing', cls: 'bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-400/20' },
  rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15' },
}

const CARD = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5'
const fmt = (n: number, d = 3) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const signed = (n: number, d = 1) => `${n > 0 ? '+' : ''}${n.toFixed(d)}`

export interface DecisionRoomViewProps {
  locale: 'ar' | 'en'
  loading?: boolean
  generatedAt: string | null
  reports: AdvisorReport[]
  summary: ExecutiveSummary | null
  decisions: DecisionRecord[]
  canDecide: boolean
  liveSummary: OdooLiveSummary | null
  initialTab?: DecisionRoomTab
  onDecide?: (fingerprint: string, status: DecisionStatus) => void
  busyFingerprint?: string | null
}

/* ------------------------------------------------------------------ finding card */

function FindingCard({ f, locale, decision, canDecide, onDecide, busy }: { f: CouncilFinding; locale: 'ar' | 'en'; decision: DecisionRecord | null; canDecide: boolean; onDecide?: DecisionRoomViewProps['onDecide']; busy: boolean }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const est = f.weeklyImpact ?? f.proposals[0]?.expectedImpact ?? null
  return (
    <li data-room-finding={f.fingerprint} className={`${CARD} flex min-w-0 flex-col gap-2.5`}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-400/20">{isAr ? ADVISOR_LABEL[f.advisorId].ar : ADVISOR_LABEL[f.advisorId].en}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-white/10 dark:text-slate-300">
          {f.severity === 'high' ? t('High priority', 'أولوية عالية') : f.severity === 'medium' ? t('Medium priority', 'أولوية متوسطة') : t('Low priority', 'أولوية منخفضة')}
        </span>
        {decision ? <span data-decision-status={decision.status} className={`rounded-full px-2 py-0.5 ring-1 ${STATUS_LABEL[decision.status].cls}`}>{isAr ? STATUS_LABEL[decision.status].ar : STATUS_LABEL[decision.status].en}</span> : null}
      </div>
      <h3 className="text-[15px] font-bold leading-snug text-slate-900 dark:text-white">{isAr ? f.titleAr : f.titleEn}</h3>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] text-slate-700 sm:grid-cols-2 dark:text-slate-300">
        {f.evidence.slice(0, 6).map((e) => (
          <div key={`${e.labelEn}-${e.period.from}-${e.domain}`} className="flex min-w-0 flex-wrap justify-between gap-x-2 border-b border-slate-100 py-1 dark:border-white/5">
            <dt className="min-w-0 text-slate-500 dark:text-slate-400">{isAr ? e.labelAr : e.labelEn}</dt>
            <dd className="font-semibold tabular-nums" dir="ltr">{evidenceValue(e, locale)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400" dir="ltr">
        {`Odoo · ${f.evidence[0]?.odooModel ?? '—'} · ${f.evidence[0]?.period.from ?? ''} → ${f.evidence[0]?.period.to ?? ''} · ${t('sync', 'مزامنة')} ${syncLabel(f.evidence[0]?.syncAt ?? null, locale)}`}
      </p>
      <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
        <span className="font-semibold">{t('Why: ', 'لماذا: ')}</span>
        {isAr ? f.rootCause.ar : f.rootCause.en}
      </p>
      {f.proposals.length > 0 ? (
        <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-800 dark:text-slate-200">
          {f.proposals.map((p, i) => (
            <li key={i} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
              <span className="font-semibold">{isAr ? p.who.ar : p.who.en}</span>
              {`: ${isAr ? p.what.ar : p.what.en} — ${isAr ? p.when.ar : p.when.en}`}
            </li>
          ))}
        </ul>
      ) : null}
      {est ? (
        <details data-room-estimate="true" className="rounded-xl bg-sky-50/70 px-3 py-2 text-xs text-sky-950 ring-1 ring-sky-200/70 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-300/20">
          <summary className="cursor-pointer font-semibold">{`${t('Estimate', 'تقدير')}: ${estimateValue(est, locale)}`}</summary>
          <p className="mt-1 [overflow-wrap:anywhere]" dir="ltr">{est.formula}</p>
          <p className="mt-1 [overflow-wrap:anywhere] tabular-nums" dir="ltr">{Object.entries(est.inputs).map(([k, v]) => `${k} = ${v}`).join(' · ')}</p>
        </details>
      ) : null}
      {canDecide && onDecide ? (
        <div className="mt-auto flex flex-wrap gap-2 pt-1" role="group" aria-label={t('Decision', 'القرار')}>
          {(['accepted', 'testing', 'rejected'] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              data-decide={s}
              aria-pressed={decision?.status === s}
              onClick={() => onDecide(f.fingerprint, s)}
              className={`min-h-9 rounded-xl px-3 text-[13px] font-semibold ring-1 transition-colors disabled:opacity-60 ${
                decision?.status === s ? STATUS_LABEL[s].cls : 'bg-white text-slate-800 ring-slate-300 hover:bg-slate-50 dark:bg-white/[0.04] dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/10'
              }`}
            >
              {s === 'accepted' ? t('Accept', 'اعتماد') : s === 'testing' ? t('Test first', 'اختبار أولاً') : t('Reject', 'رفض')}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ analysis views */

function DriversView({ summary, locale }: { summary: OdooLiveSummary | null; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const w = useMemo(() => driverWindows({ summary }), [summary])
  if (!w) return null
  const rows = contributions(w, 'branch')
  const split = splitOrdersAov(w.total.a, w.total.b)
  const total = w.total.a.netFils - w.total.b.netFils
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.deltaFils)))
  return (
    <section data-room-view="drivers" className={`${CARD} space-y-3`}>
      <header>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Why did sales move? Contribution by branch', 'لماذا تغيّرت المبيعات؟ مساهمة كل فرع')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">{`pos.order · ${w.a.from} → ${w.a.to} vs ${w.b.from} → ${w.b.to}`}</p>
      </header>
      <div className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
        <p className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]"><span className="block text-xs text-slate-500">{t('Company change', 'تغيّر الشركة')}</span><b className="tabular-nums" dir="ltr">{`${signed(total / 1000, 3)} ${t('KWD', 'د.ك')}`}</b></p>
        <p className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]"><span className="block text-xs text-slate-500">{t('Orders effect', 'أثر عدد الطلبات')}</span><b className="tabular-nums" dir="ltr">{split ? `${signed(split.ordersEffectFils / 1000, 3)} ${t('KWD', 'د.ك')}` : '—'}</b></p>
        <p className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.03]"><span className="block text-xs text-slate-500">{t('Basket effect', 'أثر متوسط الفاتورة')}</span><b className="tabular-nums" dir="ltr">{split ? `${signed(split.basketEffectFils / 1000, 3)} ${t('KWD', 'د.ك')}` : '—'}</b></p>
      </div>
      <ul className="space-y-1.5" aria-label={t('Contribution by branch', 'المساهمة حسب الفرع')}>
        {rows.map((r) => {
          const lbl = branchLabel(r.id)
          const pct = (Math.abs(r.deltaFils) / max) * 50
          const neg = r.deltaFils < 0
          return (
            <li key={r.id} data-driver-row={r.id} className="grid grid-cols-[7.5rem_1fr_6.5rem] items-center gap-2 text-[13px] sm:grid-cols-[9rem_1fr_8rem]">
              <span className="truncate font-semibold text-slate-800 dark:text-slate-200">{isAr ? lbl.ar : lbl.en}</span>
              <span className="relative h-4 rounded bg-slate-100 dark:bg-white/[0.06]" dir="ltr" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400/60" />
                <span className={`absolute inset-y-0 rounded ${neg ? 'right-1/2 bg-red-500/80' : 'left-1/2 bg-emerald-600/80'}`} style={{ width: `${pct}%` }} />
              </span>
              <span className={`text-end font-semibold tabular-nums ${neg ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`} dir="ltr">{signed(r.deltaFils / 1000, 3)}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('Branch contributions add up exactly to the company change. Orders effect + basket effect = the change.', 'مساهمات الفروع تساوي تغيّر الشركة بالضبط، وأثر الطلبات + أثر الفاتورة = التغيّر.')}</p>
    </section>
  )
}

function BenchmarkView({ summary, locale }: { summary: OdooLiveSummary | null; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const d = useMemo(() => completedDailyByBranch(summary), [summary])
  const k = useMemo(() => (d ? branchKpis(d) : null), [d])
  const m = useMemo(() => (d ? weekdayMatrix(d) : null), [d])
  if (!d || !k) return null
  const order = [0, 1, 2, 3, 4, 5, 6]
  return (
    <section data-room-view="benchmark" className={`${CARD} space-y-4`}>
      <header>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Branches against their peers', 'الفروع مقابل بعضها')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">{`pos.order · ${k.from} → ${k.to} · ${t('peer = median of the other branches', 'المقارنة = وسيط باقي الفروع')}`}</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              <th className="px-2 py-2 text-start">{t('Branch', 'الفرع')}</th>
              <th className="px-2 py-2 text-end">{t('Net / day', 'الصافي / يوم')}</th>
              <th className="px-2 py-2 text-end">{t('Orders / day', 'الطلبات / يوم')}</th>
              <th className="px-2 py-2 text-end">{t('Avg ticket', 'متوسط الفاتورة')}</th>
              <th className="px-2 py-2 text-end">{t('Ticket vs peers', 'الفاتورة مقابل الفروع')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {k.rows.map((r) => (
              <tr key={r.branchId} data-benchmark-row={r.branchId}>
                <td className="px-2 py-2 font-semibold">{isAr ? branchLabel(r.branchId).ar : branchLabel(r.branchId).en}</td>
                <td className="px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{`${fmt(r.netPerDayKwd)} ${t('KWD', 'د.ك')}`}</bdi></td>
                <td className="px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{fmt(r.ordersPerDay, 1)}</bdi></td>
                <td className="px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{r.aovKwd === null ? '—' : `${fmt(r.aovKwd)} ${t('KWD', 'د.ك')}`}</bdi></td>
                <td className={`px-2 py-2 text-end font-semibold tabular-nums ${r.aovVsPeersPct !== null && r.aovVsPeersPct < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}><bdi dir="ltr">{r.aovVsPeersPct === null ? '—' : `${signed(r.aovVsPeersPct)}%`}</bdi></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {m ? (
        <div className="space-y-1.5">
          <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">{t('Weekday share of weekly sales vs peers (points, last 8 weeks)', 'نصيب كل يوم من مبيعات الأسبوع مقابل الفروع (نقاط، آخر 8 أسابيع)')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs" data-weekday-heatmap="true">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="px-1.5 py-1.5 text-start">{t('Branch', 'الفرع')}</th>
                  {order.map((wd) => <th key={wd} className="px-1.5 py-1.5 text-center">{isAr ? WEEKDAY_AR[wd] : WEEKDAY_EN[wd].slice(0, 3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r) => (
                  <tr key={r.branchId}>
                    <td className="px-1.5 py-1 font-semibold text-slate-800 dark:text-slate-200">{isAr ? branchLabel(r.branchId).ar : branchLabel(r.branchId).en}</td>
                    {order.map((wd) => {
                      const g = r.gapPts[wd]
                      const a = Math.min(1, Math.abs(g) / 6)
                      return (
                        <td key={wd} className="px-1 py-1 text-center">
                          <span className="block rounded-md px-1 py-1 font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr" style={{ backgroundColor: g < 0 ? `rgba(220,38,38,${0.08 + a * 0.32})` : `rgba(5,150,105,${0.08 + a * 0.32})` }}>
                            {signed(g)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Red: the branch sells a smaller share of its week on that day than the peer median — a candidate day for a local offer or crew change.', 'الأحمر: الفرع يبيع في ذلك اليوم نصيباً أقل من أسبوعه مقارنة بوسيط الفروع — يوم مرشّح لعرض محلي أو تعديل الطاقم.')}</p>
        </div>
      ) : null}
    </section>
  )
}

function ForecastView({ summary, locale }: { summary: OdooLiveSummary | null; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const d = useMemo(() => completedDailyByBranch(summary), [summary])
  const fc = useMemo(() => (d ? forecastNext7(d, null) : null), [d])
  const anomalies = useMemo(() => (d ? detectAnomalies(d) : []), [d])
  const market = useMemo(() => marketWideDays(anomalies), [anomalies])
  if (!d || (!fc && anomalies.length === 0)) return null
  const max = fc ? Math.max(...fc.next7.map((p) => p.highKwd), 1) : 1
  return (
    <section data-room-view="forecast" className={`${CARD} space-y-4`}>
      <header>
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Next 7 days and unusual days', 'الأيام السبعة القادمة والأيام غير المعتادة')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">{`pos.order · ${d.days[0]} → ${d.days[d.days.length - 1]} · ${t('completed days only', 'أيام مكتملة فقط')}`}</p>
      </header>
      {fc ? (
        <div className="space-y-2">
          <p className="text-[13px] text-slate-700 dark:text-slate-300">
            {t('Expected', 'المتوقع')} <b className="tabular-nums" dir="ltr">{`${fmt(fc.totalKwd)} ${t('KWD', 'د.ك')}`}</b> · {t('same days last week', 'نفس الأيام الأسبوع الماضي')} <b className="tabular-nums" dir="ltr">{`${fmt(fc.lastWeekActualKwd)} ${t('KWD', 'د.ك')}`}</b> · {t('model error in backtest (MAPE)', 'خطأ النموذج في الاختبار الرجعي (MAPE)')} <b className="tabular-nums" dir="ltr">{`${fc.backtest.mapePct.toFixed(1)}%`}</b>
          </p>
          <ol className="grid grid-cols-7 items-end gap-1.5" data-forecast-bars="true" aria-label={t('Forecast by day', 'التوقع حسب اليوم')}>
            {fc.next7.map((p) => {
              const wd = new Date(`${p.day}T00:00:00Z`).getUTCDay()
              return (
                <li key={p.day} className="flex min-w-0 flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300" dir="ltr">{fmt(p.forecastKwd / 1000, 1)}{t('k', ' ألف')}</span>
                  <span className="relative w-full rounded-md bg-slate-100 dark:bg-white/[0.06]" style={{ height: '7rem' }} title={`${fmt(p.lowKwd)} – ${fmt(p.highKwd)}`}>
                    <span className="absolute inset-x-0 bottom-0 rounded-md bg-sky-200/70 dark:bg-sky-400/20" style={{ height: `${(p.highKwd / max) * 100}%` }} />
                    <span className="absolute inset-x-1 bottom-0 rounded-md bg-sky-600/85" style={{ height: `${(p.forecastKwd / max) * 100}%` }} />
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{isAr ? WEEKDAY_AR[wd] : WEEKDAY_EN[wd].slice(0, 3)}</span>
                </li>
              )
            })}
          </ol>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('Thousands of KWD. Dark bar: forecast. Light band: upper end of the range (± the backtest error). The model does not know upcoming offers or events.', 'بآلاف الدنانير. العمود الداكن: التوقع. الشريط الفاتح: الحد الأعلى للمدى (± خطأ الاختبار الرجعي). النموذج لا يعرف العروض أو المناسبات القادمة.')}</p>
        </div>
      ) : null}
      {anomalies.length > 0 ? (
      <div className="space-y-1.5">
        <h4 className="text-[13px] font-bold text-slate-900 dark:text-white">{t('Unusual days (last 7 completed days)', 'أيام غير معتادة (آخر 7 أيام مكتملة)')}</h4>
        {market.length > 0 ? (
          <p data-market-wide="true" className="rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-800 ring-1 ring-slate-200 dark:bg-white/[0.03] dark:text-slate-200 dark:ring-white/10">
            {market.map((mw) => `${mw.day}: ${mw.anomalies.length} ${t('branches moved together — a market-wide cause', 'فروع تحركت معاً — سبب عام')}`).join(' · ')}
          </p>
        ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <th className="px-2 py-2 text-start">{t('Branch', 'الفرع')}</th>
                  <th className="px-2 py-2 text-start">{t('Day', 'اليوم')}</th>
                  <th className="px-2 py-2 text-end">{t('Actual', 'الفعلي')}</th>
                  <th className="px-2 py-2 text-end">{t('Normal', 'المعتاد')}</th>
                  <th className="px-2 py-2 text-end">{t('Gap', 'الفارق')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {anomalies.map((a) => (
                  <tr key={`${a.branchId}-${a.day}`} data-anomaly={`${a.branchId}:${a.day}`}>
                    <td className="px-2 py-1.5 font-semibold">{isAr ? branchLabel(a.branchId).ar : branchLabel(a.branchId).en}</td>
                    <td className="px-2 py-1.5"><bdi dir="ltr">{a.day}</bdi></td>
                    <td className="px-2 py-1.5 text-end tabular-nums"><bdi dir="ltr">{fmt(a.actualKwd)}</bdi></td>
                    <td className="px-2 py-1.5 text-end tabular-nums"><bdi dir="ltr">{fmt(a.expectedKwd)}</bdi></td>
                    <td className={`px-2 py-1.5 text-end font-semibold tabular-nums ${a.gapPct < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}><bdi dir="ltr">{`${signed(a.gapPct)}%`}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
      ) : null}
    </section>
  )
}

/** Which analysis views have data in this payload (a view without data is not offered at all). */
export function analysisAvailability(summary: OdooLiveSummary | null): { drivers: boolean; benchmark: boolean; forecast: boolean } {
  const d = completedDailyByBranch(summary)
  return {
    drivers: driverWindows({ summary }) !== null,
    benchmark: Boolean(d && branchKpis(d)),
    forecast: Boolean(d && (forecastNext7(d, null) || detectAnomalies(d).length > 0)),
  }
}

function DecisionLog({ decisions, locale }: { decisions: DecisionRecord[]; locale: 'ar' | 'en' }) {
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  if (decisions.length === 0) return null

  return (
    <section data-decision-log="true" className={`${CARD} overflow-x-auto`}>
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
            <th className="px-2 py-2 text-start">{t('Proposal', 'المقترح')}</th>
            <th className="px-2 py-2 text-start">{t('Decision', 'القرار')}</th>
            <th className="px-2 py-2 text-end">{t('Expected / week', 'المتوقع / أسبوع')}</th>
            <th className="px-2 py-2 text-end">{t('Change after', 'التغيّر بعد')}</th>
            <th className="px-2 py-2 text-end">{t('Peers', 'الفروع الأخرى')}</th>
            <th className="px-2 py-2 text-end">{t('Measured lift / week', 'الأثر المقاس / أسبوع')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {decisions.map((d) => {
            const o = d.outcome
            const measured = o?.state === 'measured'
            const pending = !o ? t('Measured nightly', 'يُقاس ليلاً') : o.state === 'too-early' ? t(`Too early (${o.daysAfter} of 7 days)`, `مبكر (${o.daysAfter} من 7 أيام)`) : o.state === 'no-data' ? t('No data for this scope', 'لا بيانات لهذا النطاق') : ''
            return (
              <tr key={d.id} data-decision-row={d.fingerprint}>
                <td className="max-w-[22rem] px-2 py-2 font-semibold text-slate-800 dark:text-slate-200">{isAr ? d.titleAr : d.titleEn}<span className="block text-xs font-normal text-slate-500" dir="ltr">{d.decidedDay}</span></td>
                <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STATUS_LABEL[d.status].cls}`}>{isAr ? STATUS_LABEL[d.status].ar : STATUS_LABEL[d.status].en}</span></td>
                <td className="px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{d.expectedWeeklyKwd === null ? '—' : fmt(d.expectedWeeklyKwd)}</bdi></td>
                {measured ? (
                  <>
                    <td className="px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{`${signed(o.changePct ?? 0)}%`}</bdi></td>
                    <td className="px-2 py-2 text-end tabular-nums"><bdi dir="ltr">{o.peersChangePct === null ? '—' : `${signed(o.peersChangePct)}%`}</bdi></td>
                    <td className={`px-2 py-2 text-end font-semibold tabular-nums ${(o.weeklyLiftKwd ?? 0) < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}><bdi dir="ltr">{o.weeklyLiftKwd === null ? '—' : signed(o.weeklyLiftKwd, 3)}</bdi></td>
                  </>
                ) : (
                  <td colSpan={3} className="px-2 py-2 text-end text-xs text-slate-500 dark:text-slate-400">{d.status === 'rejected' ? t('Not measured (rejected)', 'لا يُقاس (مرفوض)') : pending}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('Measured on equal, weekday-aligned windows before and after the decision day; for a branch, the other branches over the same weeks are the control. This is before vs after on the same scope, not proof of cause.', 'يُقاس على فترتين متساويتين ومتطابقتين في أيام الأسبوع قبل يوم القرار وبعده؛ وللفرع تكون الفروع الأخرى في نفس الأسابيع هي المرجع. هذه مقارنة قبل وبعد على نفس النطاق، وليست إثباتاً للسبب.')}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ view */

export function DecisionRoomView(props: DecisionRoomViewProps) {
  const { locale, loading = false, generatedAt, reports, summary, decisions, canDecide, liveSummary, onDecide, busyFingerprint = null } = props
  const isAr = locale === 'ar'
  const t = (en: string, ar: string) => (isAr ? ar : en)
  const avail = useMemo(() => analysisAvailability(liveSummary), [liveSummary])
  const hasMenu = reports.some((r) => r.advisorId === 'menu' && r.findings.length > 0)
  const showCouncil = reports.length > 0
  const tabHasContent = (id: DecisionRoomTab): boolean =>
    id === 'all' ? showCouncil : id === 'log' ? decisions.length > 0 : id === 'menu' ? hasMenu : avail[id]
  const [chosenTab, setTab] = useState<DecisionRoomTab>(props.initialTab ?? 'all')
  // A tab with nothing to show falls back to "all" (an empty section is never rendered).
  const fallbackTab: DecisionRoomTab = tabHasContent('all')
    ? 'all'
    : avail.drivers
      ? 'drivers'
      : avail.benchmark
        ? 'benchmark'
        : avail.forecast
          ? 'forecast'
          : 'all'
  const tab: DecisionRoomTab = tabHasContent(chosenTab) ? chosenTab : fallbackTab
  const decisionBy = useMemo(() => new Map(decisions.map((d) => [d.fingerprint, d])), [decisions])
  const findings = useMemo(() => {
    const all = reports.flatMap((r) => r.findings).filter((f) => f.proposals.length > 0 || f.kind === 'company-split' || f.kind === 'forecast-next7')
    const scoped = tab === 'all' || tab === 'log' ? all : all.filter((f) => TAB_ADVISORS[tab].includes(f.advisorId))
    return [...scoped].sort((a, b) => findingImpactScore(b) - findingImpactScore(a) || a.fingerprint.localeCompare(b.fingerprint))
  }, [reports, tab])
  const gaps = useMemo(() => {
    const ids = tab === 'all' || tab === 'log' ? null : TAB_ADVISORS[tab]
    return reports.filter((r) => !ids || ids.includes(r.advisorId)).flatMap((r) => r.dataGaps.map((g) => ({ advisorId: r.advisorId, g })))
  }, [reports, tab])
  const sized = findings.filter((f) => f.weeklyImpact?.unit === 'KWD')
  const sizedCount = sized.length
  const totalWeekly = sized.reduce((s, f) => s + (f.weeklyImpact?.value ?? 0), 0)
  const allTabs: { id: DecisionRoomTab; ar: string; en: string }[] = [
    { id: 'all', ar: 'كل المقترحات', en: 'All proposals' },
    { id: 'drivers', ar: 'محرّكات المبيعات', en: 'Sales drivers' },
    { id: 'menu', ar: 'المنيو والخصومات', en: 'Menu & discounts' },
    { id: 'benchmark', ar: 'الفروع والساعات', en: 'Branches & hours' },
    { id: 'forecast', ar: 'التوقع والأيام غير المعتادة', en: 'Forecast & unusual days' },
    { id: 'log', ar: `سجل القرارات (${decisions.length})`, en: `Decision log (${decisions.length})` },
  ]
  const tabs = allTabs.filter((x) => tabHasContent(x.id))
  const openCount = reports.flatMap((r) => r.findings).filter((f) => f.proposals.length > 0 && !decisionBy.has(f.fingerprint)).length
  const measuringCount = decisions.filter((d) => d.status !== 'rejected').length
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} data-decision-room="true" className="space-y-5 p-3 sm:p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl dark:text-white">{t('Decision Room', 'غرفة القرار')}</h1>
          <p className="max-w-3xl text-[13px] text-slate-600 dark:text-slate-400">
            {t('What changed, why, what to do and what it is worth — from Odoo data analysed by nine advisors. Decide here; the outcome is measured from Odoo afterwards.', 'ما الذي تغيّر، ولماذا، وماذا نفعل، وكم يساوي — من بيانات Odoo بتحليل تسعة مستشارين. قرّر هنا، وتُقاس النتيجة من Odoo بعدها.')}
          </p>
        </div>
        {generatedAt ? <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">{`${t('Council run', 'تشغيل المجلس')}: ${syncLabel(generatedAt, locale)}`}</p> : null}
      </header>

      {loading ? (
        <div className={`${CARD} text-[13px] text-slate-500`} aria-busy="true">{t('Loading the advisor reports…', 'جاري تحميل تقارير المستشارين…')}</div>
      ) : (
        <>
          {showCouncil && summary && summary.ar.length > 0 ? (
            <section data-executive-summary={summary.source} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm sm:p-5 dark:border-sky-400/20 dark:bg-sky-400/[0.07]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{t('Executive summary', 'الملخص التنفيذي')}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 ring-1 ring-blue-200 dark:bg-white/10 dark:text-sky-100 dark:ring-sky-400/20">
                  {summary.source === 'ai' ? t('Feryal — written only from the council figures (number-checked)', 'ملخص فريال — مبني على أرقام المجلس فقط (أرقام مُتحقق منها)') : t('Built from the council findings', 'مبني من نتائج المجلس')}
                </span>
              </div>
              <ol className="list-decimal space-y-1.5 ps-5 text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
                {(isAr || summary.source === 'ai' ? summary.ar : summary.en).map((line, i) => <li key={i}>{line}</li>)}
              </ol>
              {summary.source === 'ai' && !isAr ? <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Feryal writes the summary in Arabic.</p> : null}
            </section>
          ) : null}

          {showCouncil && (openCount > 0 || sizedCount > 0 || measuringCount > 0) ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-room-tiles="true">
              {openCount > 0 ? <p className={CARD}><span className="block text-xs text-slate-500 dark:text-slate-400">{t('Open proposals', 'المقترحات المفتوحة')}</span><b className="text-xl tabular-nums" dir="ltr">{openCount}</b></p> : null}
              {sizedCount > 0 ? (
                <p className={CARD} data-room-sized="true"><span className="block text-xs text-slate-500 dark:text-slate-400">{t('Sized opportunity in this view', 'الفرصة المقدّرة في هذا العرض')}</span><b className="text-xl tabular-nums" dir="ltr">{`${fmt(totalWeekly)} ${t('KWD / week', 'د.ك / أسبوع')}`}</b><span className="block text-xs text-slate-500">{t(`Sum of ${sizedCount} Estimates — not a certain figure`, `مجموع ${sizedCount} تقديرات — ليس رقماً مؤكداً`)}</span></p>
              ) : null}
              {measuringCount > 0 ? <p className={CARD}><span className="block text-xs text-slate-500 dark:text-slate-400">{t('Decisions being measured', 'قرارات قيد القياس')}</span><b className="text-xl tabular-nums" dir="ltr">{measuringCount}</b></p> : null}
            </div>
          ) : null}

          {tabs.length > 0 ? (
          <nav role="tablist" aria-label={t('Decision Room sections', 'أقسام غرفة القرار')} className="flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.05]">
            {tabs.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} data-room-tab={x.id} onClick={() => setTab(x.id)}
                className={`min-h-9 shrink-0 rounded-xl px-3 text-[13px] font-semibold transition-colors ${tab === x.id ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}>
                {isAr ? x.ar : x.en}
              </button>
            ))}
          </nav>
          ) : null}

          {tab === 'drivers' ? <DriversView summary={liveSummary} locale={locale} /> : null}
          {tab === 'benchmark' ? <BenchmarkView summary={liveSummary} locale={locale} /> : null}
          {tab === 'forecast' ? <ForecastView summary={liveSummary} locale={locale} /> : null}

          {tab === 'log' ? (
            <DecisionLog decisions={decisions} locale={locale} />
          ) : showCouncil && findings.length > 0 ? (
            <ol className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {findings.map((f) => (
                <FindingCard key={f.fingerprint} f={f} locale={locale} decision={decisionBy.get(f.fingerprint) ?? null} canDecide={canDecide} onDecide={onDecide} busy={busyFingerprint === f.fingerprint} />
              ))}
            </ol>
          ) : null}

          {showCouncil && tab !== 'log' && gaps.length > 0 ? (
            <section data-room-gaps="true" className="space-y-1.5 text-[13px] text-slate-600 dark:text-slate-400">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">{t('What Odoo does not record yet (and what to record)', 'ما لا يسجله Odoo بعد (وما يجب تسجيله)')}</h2>
              <ul className="list-disc space-y-1 ps-5">
                {gaps.map(({ advisorId, g }, i) => (
                  <li key={i}><span className="font-semibold">{isAr ? ADVISOR_LABEL[advisorId].ar : ADVISOR_LABEL[advisorId].en}:</span> {isAr ? `${g.missingAr} ← ${g.recordAr}` : `${g.missingEn} → ${g.recordEn}`}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {showCouncil ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('Today’s top three also appear on ', 'أهم ثلاثة اكتشافات تظهر أيضاً في ')}
            <Link href="/erp" className="font-semibold underline underline-offset-2">{t('the Executive Dashboard', 'لوحة القيادة التنفيذية')}</Link>.
          </p>
          ) : null}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ demand forecast page */

/** /erp/demand-forecast: the forecast & unusual-days view on its own (same engine as the Decision Room). */
export function DemandForecastPanel() {
  const { isAr } = useLang()
  const { liveSummary } = useGlobalFilter()
  const locale = isAr ? 'ar' : 'en'
  const available = useMemo(() => analysisAvailability(liveSummary).forecast, [liveSummary])
  if (!available) return null
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} data-demand-forecast-panel="true" className="space-y-3">
      <ForecastView summary={liveSummary} locale={locale} />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {isAr ? 'القرارات المبنية على هذا التوقع تُتخذ في ' : 'Decisions based on this forecast are taken in the '}
        <Link href="/erp/decisions" className="font-semibold underline underline-offset-2">{isAr ? 'غرفة القرار' : 'Decision Room'}</Link>.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ container */

export function DecisionRoomStudio({ initialTab }: { initialTab?: DecisionRoomTab }) {
  const { isAr } = useLang()
  const { liveSummary } = useGlobalFilter()
  const [room, setRoom] = useState<{ loading: boolean; generatedAt: string | null; reports: AdvisorReport[]; summary: ExecutiveSummary | null; canDecide: boolean }>({ loading: true, generatedAt: null, reports: [], summary: null, canDecide: false })
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDecisions = useCallback(() => {
    fetch('/api/erp/council/decisions', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { decisions?: DecisionRecord[] } | null) => setDecisions(b?.decisions ?? []))
      .catch(() => setDecisions([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/erp/council/room', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { generatedAt?: string | null; reports?: AdvisorReport[]; summary?: ExecutiveSummary | null; canDecide?: boolean } | null) => {
        if (!cancelled) setRoom({ loading: false, generatedAt: b?.generatedAt ?? null, reports: b?.reports ?? [], summary: b?.summary ?? null, canDecide: Boolean(b?.canDecide) })
      })
      .catch(() => {
        if (!cancelled) setRoom((s) => ({ ...s, loading: false }))
      })
    loadDecisions()
    return () => {
      cancelled = true
    }
  }, [loadDecisions])

  const onDecide = useCallback(
    (fingerprint: string, status: DecisionStatus) => {
      setBusy(fingerprint)
      setError(null)
      fetch('/api/erp/council/decisions', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fingerprint, status }) })
        .then(async (r) => {
          if (!r.ok) {
            const b = (await r.json().catch(() => null)) as { errorAr?: string; error?: string } | null
            setError((isAr ? b?.errorAr : b?.error) ?? (isAr ? 'تعذّر حفظ القرار.' : 'The decision could not be saved.'))
          }
          loadDecisions()
        })
        .catch(() => setError(isAr ? 'تعذّر حفظ القرار.' : 'The decision could not be saved.'))
        .finally(() => setBusy(null))
    },
    [isAr, loadDecisions],
  )

  return (
    <>
      {error ? <p role="alert" className="mx-3 mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-800 ring-1 ring-red-200 sm:mx-5 dark:bg-red-500/10 dark:text-red-200">{error}</p> : null}
      <DecisionRoomView
        locale={isAr ? 'ar' : 'en'}
        loading={room.loading}
        generatedAt={room.generatedAt}
        reports={room.reports}
        summary={room.summary}
        decisions={decisions}
        canDecide={room.canDecide}
        liveSummary={liveSummary}
        initialTab={initialTab}
        onDecide={onDecide}
        busyFingerprint={busy}
      />
    </>
  )
}
