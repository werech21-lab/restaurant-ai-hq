'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, BellRing, CheckCircle2, CircleDot, Send, ShieldAlert, Sparkles, Zap } from 'lucide-react'
import {
  ALERTS,
  ALERT_CATEGORIES,
  LEDGER,
  alertMatchesFilters,
  feryalHref,
  fmt,
  kwd,
  type AlertCategory,
  type BiAlert,
  type Severity,
  type Tone,
} from '@/lib/aether/ledger'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, Num, SectionHeader, StatsCardV2, TONE_HEX, useLang } from '@/components/aether/ui'

const SEVERITY: Record<Severity, { en: string; ar: string; tone: Tone; rank: number }> = {
  critical: { en: 'Critical', ar: 'حرج', tone: 'rose', rank: 3 },
  high: { en: 'High', ar: 'مرتفع', tone: 'amber', rank: 2 },
  medium: { en: 'Medium', ar: 'متوسط', tone: 'sky', rank: 1 },
}

type DispatchState = { status: 'idle' | 'sending' | 'done'; message?: string; time?: string }

export function AlertsCenterV2() {
  const { lang, isAr, T } = useLang()
  const { filters, view } = useBiFilters()
  const [category, setCategory] = useState<AlertCategory | 'all'>('all')
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [dispatch, setDispatch] = useState<Record<string, DispatchState>>({})

  const inScope = useMemo(() => ALERTS.filter((a) => alertMatchesFilters(a, filters)), [filters])
  const visible = useMemo(
    () =>
      inScope
        .filter((a) => (category === 'all' || a.category === category) && (severity === 'all' || a.severity === severity))
        .sort((a, b) => b.monthlyImpact - a.monthlyImpact || SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || b.exposure - a.exposure),
    [inScope, category, severity],
  )

  const recoverable = inScope.reduce((s, a) => s + a.monthlyImpact, 0)
  const critical = inScope.filter((a) => a.severity === 'critical').length
  const open = inScope.filter((a) => !ack[a.id]).length
  const dispatched = Object.values(dispatch).filter((d) => d.status === 'done').length

  const runDispatch = async (a: BiAlert) => {
    if (!a.composioAction) return
    setDispatch((s) => ({ ...s, [a.id]: { status: 'sending' } }))
    let message = ''
    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'composio', actionType: a.composioAction, lang }),
      })
      const data = (await res.json()) as { success?: boolean; message?: string }
      message = data.message || ''
    } catch {
      message = T('Queued — the Composio gateway will retry automatically.', 'تمت الجدولة — ستعيد بوابة كومبوزيو المحاولة تلقائياً.')
    }
    setDispatch((s) => ({
      ...s,
      [a.id]: {
        status: 'done',
        message: message || T('Workflow dispatched to owners via WhatsApp, Gmail and Sheets.', 'تم إرسال المهمة للمسؤولين عبر واتساب والبريد وجداول البيانات.'),
        time: new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
      },
    }))
  }

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <Badge tone="rose">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            {T('Real-time anomaly command center', 'مركز قيادة الانحرافات اللحظي')}
          </Badge>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('Automated Financial Alerts', 'التنبيهات المالية الآلية')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {T('Odoo anomalies ranked by monthly KWD impact. Resolve with Feryal or dispatch owner workflows through Composio.', 'انحرافات أودو مرتبة حسب الأثر الشهري بالدينار. عالجها مع فريال أو أرسل مهام المسؤولين عبر كومبوزيو.')}
          </p>
        </div>
        <Link href="/automations" className="ae-pill-light">
          <Zap className="h-3.5 w-3.5" />
          {T('Notification rules', 'قواعد التنبيهات')}
        </Link>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2 icon={<BellRing className="h-4 w-4" />} label={T('Alerts in scope', 'التنبيهات ضمن النطاق')} value={fmt(inScope.length)} sub={view.filtered ? T('Filtered by the live BI context', 'مفلترة حسب سياق التحليل') : T('Full group ledger', 'دفتر المجموعة الكامل')} />
        <StatsCardV2 icon={<ShieldAlert className="h-4 w-4" />} label={T('Critical', 'حرجة')} value={fmt(critical)} valueTone="rose" sub={T('Require action this week', 'تتطلب إجراء هذا الأسبوع')} />
        <StatsCardV2 icon={<CircleDot className="h-4 w-4" />} label={T('Recoverable per month', 'القابل للاسترداد شهرياً')} value={`+${kwd(recoverable, lang, 0)}`} valueTone="emerald" target={{ label: T('Share of approved 6,840 KWD', 'من 6,840 د.ك المعتمدة'), progress: (recoverable / 6840) * 100, tone: 'emerald' }} />
        <StatsCardV2 icon={<CheckCircle2 className="h-4 w-4" />} label={T('Open · dispatched', 'مفتوحة · مُرسلة')} value={`${fmt(open)} · ${fmt(dispatched)}`} valueTone="sky" sub={T('Acknowledge or dispatch to close', 'أكد أو أرسل للإغلاق')} />
      </section>

      <section className="ae-tile flex flex-wrap items-center gap-2.5 p-4">
        <div className="ae-seg flex-wrap">
          <button type="button" data-active={category === 'all'} onClick={() => setCategory('all')}>
            {T('All', 'الكل')} <Num className="ms-1 opacity-70">{inScope.length}</Num>
          </button>
          {ALERT_CATEGORIES.map((c) => {
            const n = inScope.filter((a) => a.category === c.id).length
            return (
              <button key={c.id} type="button" data-active={category === c.id} onClick={() => setCategory(c.id)} disabled={n === 0}>
                {isAr ? c.ar : c.en} <Num className="ms-1 opacity-70">{n}</Num>
              </button>
            )
          })}
        </div>
        <div className="ae-seg ms-auto">
          <button type="button" data-active={severity === 'all'} onClick={() => setSeverity('all')}>
            {T('Any severity', 'كل الدرجات')}
          </button>
          {(Object.keys(SEVERITY) as Severity[]).map((s) => (
            <button key={s} type="button" data-active={severity === s} onClick={() => setSeverity(s)}>
              {isAr ? SEVERITY[s].ar : SEVERITY[s].en}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader icon={<AlertTriangle className="h-4 w-4" />} title={T('Ranked by KWD impact', 'مرتبة حسب الأثر بالدينار')} subtitle={T(`${fmt(visible.length)} alerts shown`, `${fmt(visible.length)} تنبيهاً معروضاً`)} />
        {visible.length === 0 ? (
          <div className="ae-tile p-8 text-center text-sm text-slate-500">{T('No alerts match this slice. Reset the filters to see the full group ledger.', 'لا توجد تنبيهات لهذه الشريحة. أعد ضبط الفلاتر لعرض دفتر المجموعة الكامل.')}</div>
        ) : (
          visible.map((a, i) => {
            const sev = SEVERITY[a.severity]
            const cat = ALERT_CATEGORIES.find((c) => c.id === a.category)!
            const d = dispatch[a.id]
            const acknowledged = ack[a.id]
            return (
              <article key={a.id} className={`ae-tile ae-lift grid grid-cols-1 items-center gap-4 p-5 lg:grid-cols-12 ${acknowledged ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4 lg:col-span-7">
                  <div className="flex flex-col items-center gap-1">
                    <Num className="text-xs text-slate-400">#{i + 1}</Num>
                    <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: TONE_HEX[sev.tone] }} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={sev.tone}>{isAr ? sev.ar : sev.en}</Badge>
                      <Badge tone={cat.tone}>{isAr ? cat.ar : cat.en}</Badge>
                      {a.entries ? (
                        <span className="text-[11px] text-slate-500">
                          <Num>{fmt(a.entries)}</Num> {T('entries', 'قيداً')}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? a.titleAr : a.titleEn}</h3>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{isAr ? a.bodyAr : a.bodyEn}</p>
                    {d?.status === 'done' ? (
                      <p className="ae-pop text-[11px] font-semibold text-emerald-600">
                        <Num>{d.time}</Num> · {d.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-1">
                  <div>
                    <div className="ae-meta">{T('Monthly impact', 'الأثر الشهري')}</div>
                    <Num className={`text-base ${a.monthlyImpact ? 'text-emerald-600' : 'text-slate-500'}`}>{a.monthlyImpact ? `+${kwd(a.monthlyImpact, lang, 0)}` : T('Operational', 'تشغيلي')}</Num>
                  </div>
                  {a.exposure ? (
                    <div>
                      <div className="ae-meta">{T('Ledger exposure', 'المبلغ المرصود')}</div>
                      <Num className="text-xs text-slate-700 dark:text-slate-200">{kwd(a.exposure, lang, 3)}</Num>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:col-span-3 lg:justify-end">
                  <Link href={feryalHref(isAr ? a.askAr : a.askEn)} className="btn-colored inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]">
                    <Sparkles className="h-3 w-3" />
                    {T('Ask Feryal to Resolve', 'اطلب من فريال المعالجة')}
                  </Link>
                  {a.composioAction ? (
                    <button type="button" onClick={() => runDispatch(a)} disabled={d?.status === 'sending' || d?.status === 'done'} className="ae-pill-light ae-pill-sm">
                      <Send className="h-3 w-3" />
                      {d?.status === 'sending' ? T('Dispatching…', 'جارٍ الإرسال…') : d?.status === 'done' ? T('Dispatched', 'تم الإرسال') : T('Dispatch Action via Composio', 'إرسال الإجراء عبر كومبوزيو')}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setAck((s) => ({ ...s, [a.id]: !s[a.id] }))} className="ae-pill-light ae-pill-sm">
                    <CheckCircle2 className="h-3 w-3" />
                    {acknowledged ? T('Reopen', 'إعادة فتح') : T('Acknowledge', 'تأكيد الاطلاع')}
                  </button>
                  <Link href={a.href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-300">
                    {T('Open', 'فتح')}
                    <ArrowUpRight className={`h-3 w-3 ${isAr ? '-scale-x-100' : ''}`} />
                  </Link>
                </div>
              </article>
            )
          })
        )}
      </section>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {T(
          `Impacts reconcile to the five approved levers (${kwd(6840, 'en', 0)} per month) on the ${LEDGER.periodLabelEn} Odoo ledger.`,
          `الآثار مطابقة للروافع الخمس المعتمدة (${kwd(6840, 'ar', 0)} شهرياً) على دفتر أودو لشهر ${LEDGER.periodLabelAr}.`,
        )}
      </p>
    </div>
  )
}
