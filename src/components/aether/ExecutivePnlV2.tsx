'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Building2, Download, FileBarChart, Printer, Scale, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { BRANDS, BRANCHES, LEDGER, ROADMAP, feryalHref, fmt, kwd, pct } from '@/lib/aether/ledger'
import { HORIZONS, executivePnl, horizonFromPeriod, pnlUnitReconciliation, type Horizon, type PnlRow } from '@/lib/enterprise-giants-engine'
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
  const recon = useMemo(() => pnlUnitReconciliation(), [])
  const basisLabel =
    pnl.basis === 'odoo-group'
      ? T('Odoo posted accounting · whitelisted locations', 'محاسبة أودو المرحّلة · المواقع المعتمدة')
      : pnl.basis === 'odoo-location'
        ? T('Odoo location cost centre (Branches analytic plan)', 'مركز تكلفة الموقع في أودو (خطة الفروع التحليلية)')
        : T('Allocated by the exact Odoo POS sales of the slice', 'موزّع حسب مبيعات نقاط بيع أودو الفعلية للشريحة')

  const scopeLabel = useMemo(() => {
    const parts: string[] = []
    const b = BRANDS.find((x) => x.id === filters.brand)
    const br = BRANCHES.find((x) => x.id === filters.branch)
    if (b) parts.push(isAr ? b.ar : b.en)
    if (br) parts.push(isAr ? br.ar : br.en)
    return parts.length ? parts.join(' · ') : T(`Consolidated group · ${LEDGER.brands} brands · ${LEDGER.branches} restaurant locations`, `المجموعة الموحدة · ${LEDGER.brands} علامات · ${LEDGER.branches} مواقع مطاعم`)
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
            <Badge tone={pnl.basis.startsWith('odoo') ? 'sky' : 'amber'}>{basisLabel}</Badge>
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

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<Building2 className="h-4 w-4" />}
          title={T('Group P&L reconciliation by Odoo operating unit · month', 'مطابقة قائمة دخل المجموعة حسب وحدات التشغيل في أودو · الشهر')}
          subtitle={T(
            'Restaurant locations, Exhibitions & Booths (EXB, registers 26–29) and school canteens from the Branches analytic plan, shared cost centres, and the remainder posted without a location cost centre. Totals tie to the whitelisted Odoo ledger.',
            'مواقع المطاعم والمعارض والأجنحة (EXB، الأجهزة 26–29) ومقاصف المدارس من خطة الفروع التحليلية، ومراكز التكلفة المشتركة، والمتبقي المرحّل دون مركز تكلفة موقع. الإجماليات تطابق دفتر أودو للمواقع المعتمدة.',
          )}
        />
        <div className="w-full overflow-x-auto rounded-xl">
          <table className="w-full min-w-[860px] text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-2.5 text-start font-semibold">{T('Operating unit', 'وحدة التشغيل')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('POS net', 'صافي نقاط البيع')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Orders', 'الطلبات')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Revenue', 'الإيراد')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('COGS', 'التكلفة')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Opex', 'المصروفات')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Depreciation', 'الإهلاك')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Operating profit', 'الربح التشغيلي')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { key: 'restaurants', label: T(`Restaurant locations (${recon.restaurants.length})`, `مواقع المطاعم (${recon.restaurants.length})`), rows: recon.restaurants, sub: recon.subtotals.restaurants },
                { key: 'exhibitions', label: T('Exhibitions & Booths (EXB)', 'المعارض والأجنحة (EXB)'), rows: recon.exhibitions, sub: recon.subtotals.exhibitions },
                { key: 'canteens', label: T(`School canteens (${recon.canteens.length})`, `مقاصف المدارس (${recon.canteens.length})`), rows: recon.canteens, sub: recon.subtotals.canteens },
                { key: 'shared', label: T('Shared cost centres', 'مراكز التكلفة المشتركة'), rows: recon.shared, sub: recon.subtotals.shared },
              ].map((g) => (
                <Fragment key={g.key}>
                  <tr key={`${g.key}-h`} className="bg-slate-50/80 dark:bg-white/5">
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white" colSpan={8}>{g.label}</td>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 ps-7 font-medium text-slate-700 dark:text-slate-200">{isAr ? r.ar : r.en}</td>
                      <td className="px-3 py-2 text-end"><Num>{r.posNet ? fmt(r.posNet, 3) : '—'}</Num></td>
                      <td className="px-3 py-2 text-end"><Num className="text-slate-500">{r.orders ? fmt(r.orders) : '—'}</Num></td>
                      <td className="px-3 py-2 text-end"><Num>{fmt(r.revenue, 3)}</Num></td>
                      <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(r.cogs, 3)}</Num></td>
                      <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(r.opex, 3)}</Num></td>
                      <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(r.depreciation, 3)}</Num></td>
                      <td className="px-3 py-2 text-end"><Num className={r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{fmt(r.profit, 3)}</Num></td>
                    </tr>
                  ))}
                  <tr key={`${g.key}-s`}>
                    <td className="px-3 py-2 ps-7 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{T('Subtotal', 'المجموع الفرعي')}</td>
                    <td className="px-3 py-2" colSpan={2} />
                    <td className="px-3 py-2 text-end"><Num className="font-semibold">{fmt(g.sub.revenue, 3)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className="font-semibold">{fmt(g.sub.cogs, 3)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className="font-semibold">{fmt(g.sub.opex, 3)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className="font-semibold">{fmt(g.sub.depreciation, 3)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className={`font-semibold ${g.sub.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(g.sub.profit, 3)}</Num></td>
                  </tr>
                </Fragment>
              ))}
              <tr>
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{isAr ? recon.remainder.ar : recon.remainder.en}</td>
                <td className="px-3 py-2 text-end"><Num>{fmt(recon.remainder.posNet, 3)}</Num></td>
                <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(recon.remainder.orders)}</Num></td>
                <td className="px-3 py-2 text-end"><Num>{fmt(recon.remainder.revenue, 3)}</Num></td>
                <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(recon.remainder.cogs, 3)}</Num></td>
                <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(recon.remainder.opex, 3)}</Num></td>
                <td className="px-3 py-2 text-end"><Num className="text-slate-500">{fmt(recon.remainder.depreciation, 3)}</Num></td>
                <td className="px-3 py-2 text-end"><Num className={recon.remainder.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{fmt(recon.remainder.profit, 3)}</Num></td>
              </tr>
              <tr className="bg-slate-50/80 text-sm dark:bg-white/5">
                <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{T('Whitelisted group (Odoo)', 'المجموعة المعتمدة (أودو)')}</td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold">{fmt(LEDGER.netSales, 3)}</Num></td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold">{fmt(LEDGER.orders)}</Num></td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold">{fmt(recon.group.revenue, 3)}</Num></td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold">{fmt(recon.group.cogs, 3)}</Num></td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold">{fmt(recon.group.opex, 3)}</Num></td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold">{fmt(recon.group.depreciation, 3)}</Num></td>
                <td className="px-3 py-2.5 text-end"><Num className="font-bold text-emerald-700 dark:text-emerald-400">{fmt(recon.group.profit, 3)}</Num></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {T(
            `Posted company ledger: income ${fmt(recon.company.income, 3)} · COGS ${fmt(recon.company.cogs, 3)} · opex ${fmt(recon.company.expense, 3)} · depreciation ${fmt(recon.company.depreciation, 3)} KWD. Non-whitelisted locations' analytic share removed: income ${fmt(recon.excludedLocations.income, 3)} · COGS ${fmt(recon.excludedLocations.cogs, 3)} · opex ${fmt(recon.excludedLocations.expense, 3)} · depreciation ${fmt(recon.excludedLocations.depreciation, 3)} KWD.`,
            `دفتر الشركة المرحّل: الإيراد ${fmt(recon.company.income, 3)} · التكلفة ${fmt(recon.company.cogs, 3)} · المصروفات ${fmt(recon.company.expense, 3)} · الإهلاك ${fmt(recon.company.depreciation, 3)} د.ك. تم استبعاد الحصة التحليلية للمواقع غير المعتمدة: الإيراد ${fmt(recon.excludedLocations.income, 3)} · التكلفة ${fmt(recon.excludedLocations.cogs, 3)} · المصروفات ${fmt(recon.excludedLocations.expense, 3)} · الإهلاك ${fmt(recon.excludedLocations.depreciation, 3)} د.ك.`,
          )}
        </p>
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
          'Actuals are the October 2026 Odoo ledger (whitelisted locations). A selected location uses its own Odoo cost centre; brand and channel filters, which Odoo does not post as P&L, are allocated by the exact Odoo POS sales of the slice. Commissions apply contract rates to Odoo channel payments; maintenance custody is a management estimate. Budget lines apply the approved levers (Keeta cap → discounts, central-kitchen yield → COGS, chiller overhaul → maintenance, beverage and menu matrix → sales at target COGS and blended commission) and ramp to the approved trajectory.',
          'الفعلي هو دفتر أودو لشهر أكتوبر 2026 (المواقع المعتمدة). عند اختيار موقع يُستخدم مركز تكلفته في أودو؛ أما فلاتر العلامة والقناة التي لا يرحّلها أودو كقائمة دخل فتُوزّع حسب مبيعات نقاط البيع الفعلية للشريحة. العمولات تطبق نسب العقود على مدفوعات قنوات أودو؛ وعهدة الصيانة تقدير إداري. بنود الموازنة تطبق الروافع المعتمدة (سقف كيتا ← الخصومات، إنتاجية المطبخ المركزي ← التكلفة، تجديد المبردات ← الصيانة، المشروب ومصفوفة المنيو ← المبيعات بتكلفة مستهدفة وعمولة متوسطة) وتتدرج حتى المسار المعتمد.',
        )}
      </p>
    </div>
  )
}
