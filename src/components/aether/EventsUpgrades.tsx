'use client'

import { useMemo, useState } from 'react'
import { Check, ClipboardCopy, Gauge, ShieldCheck, Timer, TrendingUp } from 'lucide-react'
import { fmt } from '@/lib/aether/ledger'
import { Badge, CircularGauge, Num, useCopy } from '@/components/aether/ui'

type Lang = 'ar' | 'en'
type RiskSeverity = 'critical' | 'high' | 'medium'
type RiskKind = 'weather' | 'power' | 'fees' | 'moci' | 'other'

const KIND_LABEL: Record<RiskKind, { en: string; ar: string }> = {
  weather: { en: 'Weather force majeure', ar: 'القوة القاهرة والطقس' },
  power: { en: '3-Phase power', ar: 'الكهرباء ثلاثية الطور' },
  fees: { en: 'Hidden service fees', ar: 'رسوم خدمات مخفية' },
  moci: { en: 'MOCI / Municipality compliance', ar: 'اشتراطات التجارة والبلدية' },
  other: { en: 'Commercial term', ar: 'بند تجاري' },
}

const SEVERITY_LABEL: Record<RiskSeverity, { en: string; ar: string; tone: 'rose' | 'amber' | 'sky'; weight: number }> = {
  critical: { en: 'Critical', ar: 'حرج', tone: 'rose', weight: 16 },
  high: { en: 'High', ar: 'مرتفع', tone: 'amber', weight: 11 },
  medium: { en: 'Medium', ar: 'متوسط', tone: 'sky', weight: 6 },
}

/** Keyword classifier for a contract risk clause (bilingual). */
export function classifyRisk(text: string): { kind: RiskKind; severity: RiskSeverity } {
  const t = text.toLowerCase()
  if (/(force majeure|weather|rain|dust|storm|non-refundable|القوة القاهرة|الأحوال الجوية|الأمطار|الغبار|عدم استرداد)/i.test(t)) return { kind: 'weather', severity: 'critical' }
  if (/(uncapped|hidden|service charge|service fee|cleaning|open-ended|رسوم خدمات|غير مسقفة|النظافة|مخفية)/i.test(t)) return { kind: 'fees', severity: 'high' }
  if (/(3-phase|three-phase|amp|breaker|power|electric|ثلاثي الطور|كهرباء|قاطع)/i.test(t)) return { kind: 'power', severity: 'high' }
  if (/(moci|municipality|permit|licen|penalt|health certificate|بلدية|ترخيص|تراخيص|غرامة|الشهادات الصحية|وزارة التجارة)/i.test(t)) return { kind: 'moci', severity: 'medium' }
  return { kind: 'other', severity: 'medium' }
}

export function RiskTags({ text, lang }: { text: string; lang: Lang }) {
  const { kind, severity } = classifyRisk(text)
  const s = SEVERITY_LABEL[severity]
  return (
    <span className="mb-1 flex flex-wrap items-center gap-1.5">
      <Badge tone={s.tone}>{lang === 'ar' ? s.ar : s.en}</Badge>
      <Badge tone="slate">{lang === 'ar' ? KIND_LABEL[kind].ar : KIND_LABEL[kind].en}</Badge>
    </span>
  )
}

/**
 * 0–100 Contract Legal & Commercial Safety Score.
 * Legal: each flagged clause deducts by severity; protective counter-clauses ready to send restore part of it.
 * Commercial: base-case ROI, payback timing and break-even safety margin from the live simulator.
 */
export function computeSafetyScore(input: {
  risks: string[]
  counterClauses: string[]
  baseRoiPct: number
  paybackDay: number
  durationDays: number
  safetyMarginPct: number
}) {
  const legalDeductions = input.risks.reduce((s, r) => s + SEVERITY_LABEL[classifyRisk(r).severity].weight, 0)
  const mitigation = Math.min(legalDeductions * 0.35, input.counterClauses.length * 4)
  const legal = Math.max(0, 100 - legalDeductions + mitigation)
  const roiScore = Math.max(0, Math.min(100, (input.baseRoiPct / 175) * 100))
  const paybackScore = input.durationDays > 0 ? Math.max(0, Math.min(100, 100 - (input.paybackDay / input.durationDays) * 100 + 20)) : 0
  const marginScore = Math.max(0, Math.min(100, input.safetyMarginPct * 1.6))
  const commercial = roiScore * 0.45 + paybackScore * 0.3 + marginScore * 0.25
  const score = Math.round(legal * 0.55 + commercial * 0.45)
  return { score, legal: Math.round(legal), commercial: Math.round(commercial), legalDeductions, mitigation: Math.round(mitigation) }
}

export function ContractSafetyScoreCard({
  lang,
  risks,
  counterClauses,
  baseRoiPct,
  paybackDay,
  durationDays,
  safetyMarginPct,
}: {
  lang: Lang
  risks: string[]
  counterClauses: string[]
  baseRoiPct: number
  paybackDay: number
  durationDays: number
  safetyMarginPct: number
}) {
  const isAr = lang === 'ar'
  const T = (en: string, ar: string) => (isAr ? ar : en)
  const { copied, copy } = useCopy()
  const r = useMemo(
    () => computeSafetyScore({ risks, counterClauses, baseRoiPct, paybackDay, durationDays, safetyMarginPct }),
    [risks, counterClauses, baseRoiPct, paybackDay, durationDays, safetyMarginPct],
  )
  const grade =
    r.score >= 80
      ? { en: 'Safe to sign', ar: 'آمن للتوقيع', color: '#059669', tone: 'emerald' as const }
      : r.score >= 60
        ? { en: 'Sign after negotiation', ar: 'يوقّع بعد التفاوض', color: '#D97706', tone: 'amber' as const }
        : { en: 'High risk — renegotiate', ar: 'مخاطرة عالية — أعد التفاوض', color: '#E11D48', tone: 'rose' as const }
  const counts = risks.reduce<Record<RiskSeverity, number>>(
    (acc, x) => {
      acc[classifyRisk(x).severity] += 1
      return acc
    },
    { critical: 0, high: 0, medium: 0 },
  )

  return (
    <div className="ae-tile grid grid-cols-1 items-center gap-5 p-5 md:grid-cols-12">
      <div className="flex justify-center md:col-span-3">
        <CircularGauge
          value={r.score}
          color={grade.color}
          size={148}
          stroke={13}
          label={
            <>
              <Num className="text-3xl text-slate-900 dark:text-white">{r.score}</Num>
              <span className="text-[10px] font-semibold text-slate-500">/ 100</span>
            </>
          }
          caption={T('Contract legal & commercial safety score', 'مؤشر الأمان القانوني والتجاري للعقد')}
        />
      </div>
      <div className="space-y-3 md:col-span-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ae-icon-badge">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <h3 className="ae-h text-base text-slate-900 dark:text-white">{T('Safety verdict', 'حكم الأمان')}</h3>
          <Badge tone={grade.tone}>{isAr ? grade.ar : grade.en}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="ae-tile-soft p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{T('Legal protection', 'الحماية القانونية')}</span>
              <Gauge className="h-3.5 w-3.5" />
            </div>
            <Num className="text-lg text-slate-900 dark:text-white">{r.legal}</Num>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
              <div className="h-full rounded-full bg-sky-600" style={{ width: `${r.legal}%` }} />
            </div>
          </div>
          <div className="ae-tile-soft p-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{T('Commercial strength', 'القوة التجارية')}</span>
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <Num className="text-lg text-slate-900 dark:text-white">{r.commercial}</Num>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${r.commercial}%` }} />
            </div>
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          {T(
            `${risks.length} flagged clauses deduct ${r.legalDeductions} pts; ${counterClauses.length} copy-ready counter-clauses restore ${r.mitigation} pts. Commercial score blends base ROI ${fmt(baseRoiPct, 0)}%, payback on day ${paybackDay} of ${durationDays} and a ${fmt(safetyMarginPct, 1)}% break-even safety margin.`,
            `${risks.length} بنود مرصودة تخصم ${r.legalDeductions} نقطة؛ و${counterClauses.length} صيغ تفاوضية جاهزة تعيد ${r.mitigation} نقطة. المؤشر التجاري يجمع العائد ${fmt(baseRoiPct, 0)}% والاسترداد في اليوم ${paybackDay} من ${durationDays} وهامش أمان ${fmt(safetyMarginPct, 1)}% فوق التعادل.`,
          )}
        </p>
      </div>
      <div className="space-y-2 md:col-span-3">
        {(['critical', 'high', 'medium'] as RiskSeverity[]).map((s) => (
          <div key={s} className="ae-tile-soft flex items-center justify-between px-3 py-2 text-xs">
            <Badge tone={SEVERITY_LABEL[s].tone}>{isAr ? SEVERITY_LABEL[s].ar : SEVERITY_LABEL[s].en}</Badge>
            <Num className="text-slate-900 dark:text-white">{counts[s]}</Num>
          </div>
        ))}
        <button type="button" onClick={() => copy('all', counterClauses.join('\n\n'))} className="ae-pill-dark ae-pill-sm w-full justify-center">
          {copied === 'all' ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
          {copied === 'all' ? T('All clauses copied', 'تم نسخ كل البنود') : T('Copy all counter-clauses', 'نسخ كل الصيغ التفاوضية')}
        </button>
      </div>
    </div>
  )
}

/** Cumulative net cashflow curve across event days for the 3 scenarios, pinpointing each payback day. */
export function EventCashflowCurve({
  lang,
  durationDays,
  upfrontKwd,
  staffLogisticsKwd,
  aovKwd,
  dailyOrders,
}: {
  lang: Lang
  durationDays: number
  upfrontKwd: number
  staffLogisticsKwd: number
  aovKwd: number
  dailyOrders: number
}) {
  const isAr = lang === 'ar'
  const T = (en: string, ar: string) => (isAr ? ar : en)
  const [hoverDay, setHoverDay] = useState<number | null>(null)
  const contributionPerOrder = aovKwd * (1 - 0.214 - 0.036)
  const days = Math.max(1, durationDays)
  const scenarios = [
    { key: 'conservative', en: 'Conservative 75%', ar: 'متحفظ 75%', mult: 0.75, color: '#94A3B8' },
    { key: 'base', en: 'Base case 100%', ar: 'الأساسي 100%', mult: 1, color: '#0284C7' },
    { key: 'optimistic', en: 'Optimistic peak 130%', ar: 'الذروة المتفائلة 130%', mult: 1.3, color: '#059669' },
  ].map((s) => {
    const ordersPerDay = Math.round(dailyOrders * s.mult)
    const dailyNet = ordersPerDay * contributionPerOrder - staffLogisticsKwd / days
    const series = Array.from({ length: days + 1 }, (_, d) => -upfrontKwd + dailyNet * d)
    const payback = dailyNet > 0 ? Math.ceil(upfrontKwd / dailyNet) : null
    return { ...s, ordersPerDay, dailyNet, series, payback: payback && payback <= days ? payback : null, final: series[days] }
  })

  const W = 760
  const H = 260
  const padX = 44
  const padY = 22
  const all = scenarios.flatMap((s) => s.series)
  const minV = Math.min(0, ...all)
  const maxV = Math.max(0, ...all)
  const span = maxV - minV || 1
  const x = (d: number) => padX + (d / days) * (W - padX * 2)
  const y = (v: number) => padY + (1 - (v - minV) / span) * (H - padY * 2)
  const path = (series: number[]) => series.map((v, d) => `${d === 0 ? 'M' : 'L'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const base = scenarios[1]
  const hd = hoverDay ?? base.payback ?? Math.round(days / 2)

  return (
    <div className="ae-tile space-y-4 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="ae-icon-badge">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="ae-h text-sm text-slate-900 dark:text-white">{T('Break-even & cumulative cashflow curve', 'منحنى التعادل والتدفق النقدي التراكمي')}</h3>
            <p className="text-[11px] text-slate-500">
              {T(`Upfront rent + setup ${fmt(upfrontKwd)} KWD recovered day by day across ${days} event days`, `استرداد الإيجار والتجهيز ${fmt(upfrontKwd)} د.ك يوماً بيوم عبر ${days} يوماً`)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <span key={s.key} className="ae-tile-soft inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {isAr ? s.ar : s.en}
              <Num className="text-slate-500">{s.payback ? (isAr ? `· يوم ${s.payback}` : `· day ${s.payback}`) : isAr ? '· لا استرداد' : '· no payback'}</Num>
            </span>
          ))}
        </div>
      </div>
      <div dir="ltr" className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          onMouseLeave={() => setHoverDay(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
            const px = ((e.clientX - rect.left) / rect.width) * W
            const d = Math.round(((px - padX) / (W - padX * 2)) * days)
            setHoverDay(Math.max(0, Math.min(days, d)))
          }}
        >
          <rect x={padX} y={y(0)} width={W - padX * 2} height={Math.max(0, H - padY - y(0))} fill="#E11D48" fillOpacity="0.04" />
          <rect x={padX} y={padY} width={W - padX * 2} height={Math.max(0, y(0) - padY)} fill="#059669" fillOpacity="0.04" />
          <line x1={padX} x2={W - padX} y1={y(0)} y2={y(0)} stroke="#64748B" strokeDasharray="5 4" />
          <text x={W - padX} y={y(0) - 6} textAnchor="end" className="fill-slate-500 text-[11px] font-semibold">
            {T('Break-even', 'نقطة التعادل')}
          </text>
          {scenarios.map((s) => (
            <path key={s.key} d={path(s.series)} fill="none" stroke={s.color} strokeWidth={s.key === 'base' ? 3 : 2} strokeLinecap="round" strokeDasharray={s.key === 'conservative' ? '6 4' : undefined} />
          ))}
          {scenarios.map((s) =>
            s.payback ? (
              <g key={`${s.key}-pb`}>
                <circle cx={x(s.payback)} cy={y(s.series[s.payback])} r={5} fill="#FFFFFF" stroke={s.color} strokeWidth={2.5} />
              </g>
            ) : null,
          )}
          {base.payback ? (
            <g>
              <line x1={x(base.payback)} x2={x(base.payback)} y1={padY} y2={H - padY} stroke="#0284C7" strokeOpacity="0.35" />
              <rect x={x(base.payback) - 46} y={padY - 4} width={92} height={20} rx={10} fill="#0F172A" />
              <text x={x(base.payback)} y={padY + 10} textAnchor="middle" fill="#FFFFFF" className="text-[11px] font-bold">
                {T(`Payback day ${base.payback}`, `الاسترداد يوم ${base.payback}`)}
              </text>
            </g>
          ) : null}
          <line x1={x(hd)} x2={x(hd)} y1={padY} y2={H - padY} stroke="#94A3B8" strokeOpacity="0.5" />
          {[0, Math.round(days / 4), Math.round(days / 2), Math.round((3 * days) / 4), days].map((d) => (
            <text key={d} x={x(d)} y={H - 4} textAnchor="middle" className="fill-slate-400 text-[10px]">
              {T(`D${d}`, `ي${d}`)}
            </text>
          ))}
          <text x={4} y={y(maxV) + 4} className="fill-slate-400 text-[10px]">{fmt(maxV)}</text>
          <text x={4} y={y(minV)} className="fill-slate-400 text-[10px]">{fmt(minV)}</text>
        </svg>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="ae-tile-soft p-3">
          <div className="text-[11px] text-slate-500">{T('Inspecting day', 'اليوم المحدد')}</div>
          <Num className="text-base text-slate-900 dark:text-white">{hd}</Num>
        </div>
        {scenarios.map((s) => (
          <div key={s.key} className="ae-tile-soft p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {isAr ? s.ar : s.en}
            </div>
            <Num className={`text-base ${s.series[hd] >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {fmt(s.series[hd])} {isAr ? 'د.ك' : 'KWD'}
            </Num>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface ExbCardItem {
  id: string
  itemAr: string
  itemEn: string
  brandAr: string
  brandEn: string
  categoryAr: string
  categoryEn: string
  branchPriceKwd: number
  exbPriceKwd: number
  cogsPct: number
  prepTimeSec: number
  unitMarginKwd: number
}

/** Admin V2 4-column visual moderation cards for the EXB booth menu. */
export function ExbModerationCards({ items, lang }: { items: ExbCardItem[]; lang: Lang }) {
  const isAr = lang === 'ar'
  const T = (en: string, ar: string) => (isAr ? ar : en)
  const [approved, setApproved] = useState<Record<string, boolean>>({})
  const [adjust, setAdjust] = useState<Record<string, number>>({})
  const approvedCount = items.filter((i) => approved[i.id]).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {T('Approved for booth', 'معتمد للبوث')}: <Num className="text-emerald-600">{approvedCount}</Num> / <Num>{items.length}</Num>
        </span>
        <span>{T('Target: under 90 s prep · 21.4% COGS · +10% event pricing', 'المستهدف: تحضير أقل من 90 ثانية · تكلفة 21.4% · تسعير المعارض +10%')}</span>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((it) => {
          const step = adjust[it.id] ?? 0
          const price = it.exbPriceKwd * (1 + step / 100)
          const unitCost = it.exbPriceKwd * (it.cogsPct / 100)
          const margin = price - unitCost
          const cogsNow = (unitCost / price) * 100
          const fast = it.prepTimeSec < 90
          return (
            <article key={it.id} className={`ae-tile ae-lift flex flex-col justify-between gap-3 p-4 ${approved[it.id] ? 'ring-2 ring-emerald-400/70' : ''}`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="slate">{isAr ? it.brandAr : it.brandEn}</Badge>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${fast ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                    <Timer className="h-3 w-3" />
                    <Num>{it.prepTimeSec}</Num>
                    {T('s', ' ث')}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{isAr ? it.itemAr : it.itemEn}</p>
                <p className="text-[11px] text-slate-500">{isAr ? it.categoryAr : it.categoryEn}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="ae-tile-soft p-2">
                  <div className="text-[10px] text-slate-500">{T('COGS', 'التكلفة')}</div>
                  <Num className={`text-xs ${cogsNow <= 21.4 ? 'text-emerald-600' : 'text-amber-600'}`}>{fmt(cogsNow, 1)}%</Num>
                </div>
                <div className="ae-tile-soft p-2">
                  <div className="text-[10px] text-slate-500">{T('Margin', 'الهامش')}</div>
                  <Num className="text-xs text-emerald-600">{fmt(margin, 3)}</Num>
                </div>
                <div className="ae-tile-soft p-2">
                  <div className="text-[10px] text-slate-500">{T('Booth price', 'سعر البوث')}</div>
                  <Num className={`text-xs ${step ? 'text-sky-600' : 'text-slate-900 dark:text-white'}`}>{fmt(price, 3)}</Num>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>{T('Branch price', 'سعر الفرع')}</span>
                <Num>{fmt(it.branchPriceKwd, 3)}</Num>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setApproved((s) => ({ ...s, [it.id]: !s[it.id] }))} className={approved[it.id] ? 'ae-pill-light ae-pill-sm' : 'ae-pill-dark ae-pill-sm'}>
                  <Check className="h-3 w-3" />
                  {approved[it.id] ? T('Approved', 'معتمد') : T('Approve for Booth', 'اعتماد للبوث')}
                </button>
                <button type="button" onClick={() => setAdjust((s) => ({ ...s, [it.id]: ((s[it.id] ?? 0) + 5) % 15 }))} className="ae-pill-light ae-pill-sm">
                  {step ? T(`Adjust Price (+${step}%)`, `تعديل السعر (+${step}%)`) : T('Adjust Price', 'تعديل السعر')}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
