'use client'

import { useMemo, useState } from 'react'
import { Calculator, Sparkles } from 'lucide-react'
import { LEDGER, LEVERS, LEVERS_MONTHLY_TOTAL, ROADMAP, fmt, leverImpact, type LeverId } from '@/lib/aether/ledger'
import { Num, TONE_HEX } from '@/components/aether/ui'

type Status = 'planned' | 'in-progress' | 'approved'

const STATUS_LABEL: Record<Status, { en: string; ar: string }> = {
  planned: { en: 'Planned', ar: 'مخطط' },
  'in-progress': { en: 'In Progress', ar: 'قيد التنفيذ' },
  approved: { en: 'Approved', ar: 'معتمد' },
}

const DEFAULT_STATUS: Record<LeverId, Status> = {
  'beverage-attach': 'approved',
  'keeta-cap': 'in-progress',
  'ardiya-yield': 'in-progress',
  'chiller-overhaul': 'planned',
  'menu-matrix': 'planned',
}

/**
 * Live What-If Profit Impact Calculator: toggle each approved lever (and its execution status)
 * and watch the monthly, Q1, H1 and full-year KWD profit recompute against the approved trajectory.
 */
export function FeryalWhatIfCalculator({ lang, onAsk }: { lang: 'ar' | 'en'; onAsk?: (query: string) => void }) {
  const isAr = lang === 'ar'
  const T = (en: string, ar: string) => (isAr ? ar : en)
  const kwd = (n: number, d = 0) => (isAr ? `${fmt(n, d)} د.ك` : `${fmt(n, d)} KWD`)
  const [enabled, setEnabled] = useState<Record<LeverId, boolean>>(() => Object.fromEntries(LEVERS.map((l) => [l.id, true])) as Record<LeverId, boolean>)
  const [status, setStatus] = useState<Record<LeverId, Status>>(DEFAULT_STATUS)

  const impact = useMemo(() => leverImpact(enabled), [enabled])
  const approvedOnly = useMemo(() => {
    const e = Object.fromEntries(LEVERS.map((l) => [l.id, status[l.id] === 'approved'])) as Record<LeverId, boolean>
    return leverImpact(e)
  }, [status])

  const preset = (kind: 'all' | 'none' | 'approved' | 'cost' | 'growth') => {
    setEnabled(
      Object.fromEntries(
        LEVERS.map((l) => [
          l.id,
          kind === 'all' ? true : kind === 'none' ? false : kind === 'approved' ? status[l.id] === 'approved' : l.kind === kind,
        ]),
      ) as Record<LeverId, boolean>,
    )
  }

  const scenarioQuery = () => {
    const names = LEVERS.filter((l) => enabled[l.id]).map((l) => (isAr ? l.ar : l.en))
    return isAr
      ? `حللي سيناريو تنفيذ الروافع التالية: ${names.join('، ')}. الأثر الشهري ${fmt(impact.monthly)} د.ك والربح السنوي المتوقع ${fmt(impact.fyTotal)} د.ك. ما المخاطر وترتيب التنفيذ الأمثل؟`
      : `Analyse this execution scenario: ${names.join(', ')}. Monthly impact ${fmt(impact.monthly)} KWD and projected full-year profit ${fmt(impact.fyTotal)} KWD. What are the risks and the optimal execution order?`
  }

  return (
    <div className="ae-tile-soft space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="ae-icon-badge">
            <Calculator className="h-4 w-4" />
          </span>
          <div>
            <h4 className="ae-h text-sm text-slate-900 dark:text-white">{T('Live What-If Profit Impact Calculator', 'محاكي أثر الربح المباشر')}</h4>
            <p className="text-[11px] text-slate-500">{T('Toggle recommendations and execution status — KWD impact updates instantly', 'فعّل التوصيات وحدد حالة التنفيذ — يتحدث الأثر بالدينار فوراً')}</p>
          </div>
        </div>
        <div className="ae-seg flex-wrap">
          <button type="button" onClick={() => preset('all')} data-active={impact.monthly === LEVERS_MONTHLY_TOTAL}>
            {T('All 5', 'الكل')}
          </button>
          <button type="button" onClick={() => preset('approved')}>{T('Approved only', 'المعتمد فقط')}</button>
          <button type="button" onClick={() => preset('cost')}>{T('Cost levers', 'روافع التكلفة')}</button>
          <button type="button" onClick={() => preset('growth')}>{T('Growth levers', 'روافع النمو')}</button>
          <button type="button" onClick={() => preset('none')} data-active={impact.monthly === 0}>
            {T('None', 'لا شيء')}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {LEVERS.map((l) => {
          const on = enabled[l.id]
          return (
            <div key={l.id} className={`ae-tile flex flex-col gap-3 p-3 transition-opacity sm:flex-row sm:items-center sm:justify-between ${on ? '' : 'opacity-55'}`}>
              <label className="flex min-w-0 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setEnabled((s) => ({ ...s, [l.id]: !s[l.id] }))}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-emerald-600"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE_HEX[l.tone] }} />
                    {isAr ? l.ar : l.en}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{isAr ? l.detailAr : l.detailEn}</span>
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-3">
                <div className="ae-seg" role="group" aria-label={T('Execution status', 'حالة التنفيذ')}>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((st) => (
                    <button key={st} type="button" data-active={status[l.id] === st} onClick={() => setStatus((s) => ({ ...s, [l.id]: st }))}>
                      {isAr ? STATUS_LABEL[st].ar : STATUS_LABEL[st].en}
                    </button>
                  ))}
                </div>
                <Num className={`w-24 text-end text-sm ${on ? 'text-emerald-600' : 'text-slate-400 line-through'}`}>+{kwd(l.monthly)}</Num>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="ae-tile p-3">
          <div className="text-[11px] text-slate-500">{T('Monthly profit added', 'الربح الشهري المضاف')}</div>
          <Num className="text-lg text-emerald-600">+{kwd(impact.monthly)}</Num>
          <div className="text-[11px] text-slate-500">
            {T('Profit', 'الربح')} <Num>{kwd(LEDGER.netProfit + impact.monthly)}</Num>
          </div>
        </div>
        <div className="ae-tile p-3">
          <div className="text-[11px] text-slate-500">{T('Annual incremental', 'الزيادة السنوية')}</div>
          <Num className="text-lg text-emerald-600">+{kwd(impact.fy)}</Num>
          <div className="text-[11px] text-slate-500">{T(`of ${fmt(ROADMAP[3].incremental)} approved`, `من ${fmt(ROADMAP[3].incremental)} معتمدة`)}</div>
        </div>
        <div className="ae-tile p-3">
          <div className="text-[11px] text-slate-500">{T('Q1 total profit', 'ربح الربع الأول')}</div>
          <Num className="text-lg text-slate-900 dark:text-white">{kwd(impact.q1Total)}</Num>
          <Num className="text-[11px] text-emerald-600">+{kwd(impact.q1)}</Num>
        </div>
        <div className="ae-tile p-3">
          <div className="text-[11px] text-slate-500">{T('H1 total profit', 'ربح النصف الأول')}</div>
          <Num className="text-lg text-slate-900 dark:text-white">{kwd(impact.h1Total)}</Num>
          <Num className="text-[11px] text-emerald-600">+{kwd(impact.h1)}</Num>
        </div>
        <div className="ae-tile col-span-2 p-3 ring-2 ring-emerald-400/50 lg:col-span-1">
          <div className="text-[11px] text-slate-500">{T('Full-year profit', 'ربح السنة الكاملة')}</div>
          <Num className="text-lg text-emerald-700 dark:text-emerald-400">{kwd(impact.fyTotal)}</Num>
          <Num className="text-[11px] text-emerald-600">+{kwd(impact.fy)}</Num>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>{T('Share of the approved 6,840 KWD monthly programme', 'النسبة من البرنامج الشهري المعتمد 6,840 د.ك')}</span>
          <Num className="font-bold text-slate-700 dark:text-slate-200">{fmt(impact.share * 100, 0)}%</Num>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10" dir="ltr">
          <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${impact.share * 100}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-800/50 transition-[width] duration-300" style={{ width: `${approvedOnly.share * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {T('Approved-status levers lock in', 'الروافع المعتمدة تثبت')} <Num className="text-emerald-700 dark:text-emerald-400">+{kwd(approvedOnly.monthly)}</Num> {T('/ month', '/ شهرياً')}
          </span>
          {onAsk ? (
            <button type="button" onClick={() => onAsk(scenarioQuery())} disabled={impact.monthly === 0} className="ae-pill-dark ae-pill-sm">
              <Sparkles className="h-3 w-3" />
              {T('Ask Feryal about this scenario', 'اسأل فريال عن هذا السيناريو')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
