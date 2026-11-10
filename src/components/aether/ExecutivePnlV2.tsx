'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Download, FileBarChart, Printer, Scale, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { BRANDS, BRANCHES, LEDGER, ROADMAP, feryalHref, fmt, kwd, pct } from '@/lib/aether/ledger'
import { HORIZONS, executivePnl, horizonFromPeriod, type Horizon, type PnlRow } from '@/lib/enterprise-giants-engine'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, Num, SectionHeader, StatsCardV2, downloadCsv, useLang } from '@/components/aether/ui'

export function ExecutivePnlV2() {
  const { lang, isAr, T } = useLang()
  const { filters, view } = useBiFilters()
  const [horizon, setHorizon] = useState<Horizon>(() => horizonFromPeriod(filters.period))

  // Keep the horizon aligned with the global Daily / Monthly / Annual period selector.
  useEffect(() => {
    setHorizon(horizonFromPeriod(filters.period))
  }, [filters.period])

  const pnl = useMemo(() => executivePnl(filters, horizon), [filters, horizon])
  const h = HORIZONS.find((x) => x.id === horizon)!
  const line = (id: string) => pnl.lines.find((l) => l.id === id)!
  const net = line('net')
  const profit = line('profit')
  const unfavourable = pnl.lines.filter((l) => !l.favourable && l.kind !== 'subtotal' && l.kind !== 'profit')
  const unfavourableTotal = unfavourable.reduce((s, l) => s + Math.abs(l.variance), 0)
  const digits = horizon === 'day' ? 3 : 0

  const scopeLabel = useMemo(() => {
    const parts: string[] = []
    const b = BRANDS.find((x) => x.id === filters.brand)
    const br = BRANCHES.find((x) => x.id === filters.branch)
    if (b) parts.push(isAr ? b.ar : b.en)
    if (br) parts.push(isAr ? br.ar : br.en)
    return parts.length ? parts.join(' · ') : T('Consolidated group · 7 brands · 9 branches', 'المجموعة الموحدة · 7 علامات · 9 فروع')
  }, [filters.brand, filters.branch, isAr, T])

  const askVariance = (l: PnlRow) =>
    feryalHref(
      isAr
        ? `اشرحي انحراف بند "${l.ar}" في قائمة الدخل (${h.ar}، ${scopeLabel}): الفعلي ${fmt(l.actual, 3)} د.ك مقابل الموازنة ${fmt(l.budget, 3)} د.ك، بفارق ${fmt(l.variance, 3)} د.ك (${fmt(l.variancePct, 1)}%). ما الأسباب والإجراءات التصحيحية؟`
        : `Explain the "${l.en}" P&L variance (${h.en}, ${scopeLabel}): actual ${fmt(l.actual, 3)} KWD vs budget ${fmt(l.budget, 3)} KWD, variance ${fmt(l.variance, 3)} KWD (${fmt(l.variancePct, 1)}%). What drives it and what corrective actions do you recommend?`,
    )

  const exportCsv = () => {
    downloadCsv(`aetherbi-executive-pnl-${horizon}.csv`, [
      [T('Line', 'البند'), T('Actual KWD', 'الفعلي د.ك'), T('Budget KWD', 'الموازنة د.ك'), T('Variance KWD', 'الانحراف د.ك'), T('Variance %', 'الانحراف %'), T('Status', 'الحالة'), T('% of net sales', 'النسبة من صافي المبيعات')],
      ...pnl.lines.map((l) => [
        isAr ? l.ar : l.en,
        l.actual.toFixed(3),
        l.budget.toFixed(3),
        l.variance.toFixed(3),
        l.variancePct.toFixed(2),
        l.favourable ? T('Favourable', 'إيجابي') : T('Unfavourable', 'سلبي'),
        ((l.actual / net.actual) * 100).toFixed(2),
      ]),
    ])
  }

  const maxAbsVar = Math.max(1, ...pnl.lines.filter((l) => l.kind !== 'subtotal').map((l) => Math.abs(l.variance)))

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="emerald">{T('Board-ready controllable P&L', 'قائمة دخل قابلة للتحكم جاهزة للمجلس')}</Badge>
            <span className="ae-chip">{scopeLabel}</span>
          </div>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('Executive P&L & Rolling Budget Variance', 'قائمة الدخل التنفيذية وانحراف الموازنة المتجددة')}</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {T(
              'Every line of the consolidated P&L against the approved budget plan, which embeds the five profit levers and ties to the Q1, H1 and full-year trajectory.',
              'كل بند في قائمة الدخل الموحدة مقابل الموازنة المعتمدة التي تتضمن روافع الربح الخمس وترتبط بمسار الربع الأول والنصف الأول والسنة الكاملة.',
            )}
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="ae-seg">
            {HORIZONS.map((x) => (
              <button key={x.id} type="button" data-active={horizon === x.id} onClick={() => setHorizon(x.id)}>
                {isAr ? x.ar : x.en}
              </button>
            ))}
          </div>
          <button type="button" onClick={exportCsv} className="ae-pill-light">
            <Download className="h-3.5 w-3.5" />
            {T('Export CSV', 'تصدير الجدول')}
          </button>
          <button type="button" onClick={() => window.print()} className="ae-pill-dark">
            <Printer className="h-3.5 w-3.5" />
            {T('Print Board Pack', 'طباعة حقيبة المجلس')}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2
          icon={<FileBarChart className="h-4 w-4" />}
          label={T('Net sales · actual vs budget', 'صافي المبيعات · فعلي مقابل موازنة')}
          value={kwd(net.actual, lang, digits)}
          sub={T(`Budget ${kwd(net.budget, 'en', digits)}`, `الموازنة ${kwd(net.budget, 'ar', digits)}`)}
          delta={pct(net.variancePct)}
          deltaTone={net.favourable ? 'emerald' : 'rose'}
          deltaDown={!net.favourable}
        />
        <StatsCardV2
          icon={<TrendingUp className="h-4 w-4" />}
          label={T('Net operating profit', 'صافي الربح التشغيلي')}
          value={kwd(profit.actual, lang, digits)}
          valueTone="emerald"
          sub={T(`Budget ${kwd(profit.budget, 'en', digits)}`, `الموازنة ${kwd(profit.budget, 'ar', digits)}`)}
          delta={pct(profit.variancePct)}
          deltaTone={profit.favourable ? 'emerald' : 'rose'}
          deltaDown={!profit.favourable}
        />
        <StatsCardV2
          icon={<Target className="h-4 w-4" />}
          label={T('Operating margin', 'هامش التشغيل')}
          value={pct((profit.actual / net.actual) * 100)}
          sub={T(`Budget ${pct((profit.budget / net.budget) * 100)}`, `الموازنة ${pct((profit.budget / net.budget) * 100)}`)}
          target={{ label: T('Actual vs budget margin', 'الهامش الفعلي مقابل الموازنة'), progress: ((profit.actual / net.actual) / (profit.budget / net.budget)) * 100, tone: 'emerald' }}
        />
        <StatsCardV2
          icon={<TrendingDown className="h-4 w-4" />}
          label={T('Unfavourable variances', 'الانحرافات السلبية')}
          value={kwd(unfavourableTotal, lang, digits)}
          valueTone="rose"
          sub={T(`${unfavourable.length} lines need action`, `${unfavourable.length} بنود تتطلب إجراء`)}
        />
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<Scale className="h-4 w-4" />}
          title={T(`Controllable P&L statement · ${h.en}`, `قائمة الدخل القابلة للتحكم · ${h.ar}`)}
          subtitle={T('Click an unfavourable line to ask Feryal for the variance explanation', 'اضغط على أي بند سلبي لتطلب من فريال تفسير الانحراف')}
        />
        <div className="w-full overflow-x-auto rounded-xl">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-2.5 text-start font-semibold">{T('Line', 'البند')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Actual', 'الفعلي')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Budget', 'الموازنة')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Variance', 'الانحراف')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">%</th>
                <th className="px-3 py-2.5 text-start font-semibold">{T('Variance bar', 'مؤشر الانحراف')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('% of net sales', 'من صافي المبيعات')}</th>
                <th className="no-print px-3 py-2.5 text-end font-semibold">{T('Action', 'الإجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pnl.lines.map((l) => {
                const strong = l.kind === 'subtotal' || l.kind === 'profit'
                const tone = l.favourable ? 'emerald' : 'rose'
                return (
                  <tr key={l.id} className={`${strong ? 'bg-slate-50/80 dark:bg-white/5' : ''} ${l.kind === 'profit' ? 'text-sm' : ''}`}>
                    <td className={`px-3 py-2.5 ${l.indent ? 'ps-7' : ''} ${strong ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>{isAr ? l.ar : l.en}</td>
                    <td className="px-3 py-2.5 text-end"><Num className={strong ? 'text-slate-900 dark:text-white' : ''}>{fmt(l.actual, 3)}</Num></td>
                    <td className="px-3 py-2.5 text-end"><Num className="text-slate-500">{fmt(l.budget, 3)}</Num></td>
                    <td className="px-3 py-2.5 text-end">
                      <Num className={l.favourable ? 'text-emerald-600' : 'text-rose-600'}>
                        {l.variance > 0 ? '+' : ''}
                        {fmt(l.variance, 3)}
                      </Num>
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <Badge tone={tone}>
                        {l.variancePct > 0 ? '+' : ''}
                        {pct(l.variancePct)} · {l.favourable ? T('Fav.', 'إيجابي') : T('Unfav.', 'سلبي')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="relative h-2 w-32 rounded-full bg-slate-100 dark:bg-white/10" dir="ltr">
                        <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                        <span
                          className="absolute inset-y-0 rounded-full"
                          style={{
                            backgroundColor: l.favourable ? '#059669' : '#E11D48',
                            width: `${(Math.abs(l.variance) / maxAbsVar) * 50}%`,
                            left: l.favourable ? '50%' : `${50 - (Math.abs(l.variance) / maxAbsVar) * 50}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-end"><Num className="text-slate-500">{pct((l.actual / net.actual) * 100)}</Num></td>
                    <td className="no-print px-3 py-2.5 text-end">
                      {!l.favourable && l.kind !== 'subtotal' ? (
                        <Link href={askVariance(l)} className="ae-pill-dark ae-pill-sm">
                          <Sparkles className="h-3 w-3" />
                          {T('Ask Feryal to Explain Variance', 'اطلب تفسير الانحراف من فريال')}
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
        {ROADMAP.slice(1).map((m) => {
          const runRate = LEDGER.netProfit * view.salesShare * m.months
          const plan = m.total * view.salesShare
          const gap = plan - runRate
          return (
            <div key={m.id} className={`ae-tile ae-lift flex flex-col justify-between gap-3 p-5 ${m.id === 'fy' ? 'ring-2 ring-emerald-400/50' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="ae-h text-sm text-slate-900 dark:text-white">{T(`${m.en} rolling forecast`, `التوقع المتجدد · ${m.ar}`)}</span>
                <Badge tone="emerald">{T('Approved', 'معتمد')}</Badge>
              </div>
              <div>
                <div className="ae-meta">{T('Budget plan (with remedies)', 'الموازنة (مع الحلول)')}</div>
                <Num className="text-xl text-emerald-700 dark:text-emerald-400">{kwd(plan, lang, 0)}</Num>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="ae-tile-soft p-2.5">
                  <div className="text-[10px] text-slate-500">{T('Run-rate (no action)', 'المعدل الحالي (دون إجراء)')}</div>
                  <Num className="text-slate-900 dark:text-white">{kwd(runRate, lang, 0)}</Num>
                </div>
                <div className="ae-tile-soft p-2.5">
                  <div className="text-[10px] text-slate-500">{T('Gap closed by levers', 'الفجوة المغلقة بالروافع')}</div>
                  <Num className="text-emerald-600">+{kwd(gap, lang, 0)}</Num>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" dir="ltr">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(runRate / plan) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {T(
          'Actuals are the October 2026 Odoo ledger. Budget lines apply the approved levers to their P&L line (Keeta cap → discounts, Ardiya yield → COGS, chiller overhaul → maintenance, beverage and menu matrix → sales at target COGS and blended commission) and ramp to the approved trajectory. Brand and branch filters allocate proportionally.',
          'الفعلي هو دفتر أودو لشهر أكتوبر 2026. بنود الموازنة تطبق الروافع المعتمدة على بنودها (سقف كيتا ← الخصومات، إنتاجية العارضية ← التكلفة، تجديد المبردات ← الصيانة، المشروب ومصفوفة المنيو ← المبيعات بتكلفة مستهدفة وعمولة متوسطة) وتتدرج حتى المسار المعتمد. فلاتر العلامة والفرع توزع نسبياً.',
        )}
      </p>
    </div>
  )
}
