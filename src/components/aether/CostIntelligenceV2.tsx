'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChefHat, FlaskConical, Gauge, Receipt, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { BRANDS, LEDGER, QUADRANTS, feryalHref, fmt, kwd, pct } from '@/lib/aether/ledger'
import {
  PRICE_CREEP_ALERT_PCT,
  SUPPLIER_ITEMS,
  cogsVarianceMatrix,
  marginErosion,
  priceCreep,
  type IngredientId,
} from '@/lib/enterprise-giants-engine'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, Num, ReorderableTable, SectionHeader, Sparkline, StatsCardV2, TONE_HEX, useLang, type ReorderColumn } from '@/components/aether/ui'

const LEVEL = {
  stable: { en: 'Stable', ar: 'مستقر', tone: 'emerald' as const },
  watch: { en: 'Watch', ar: 'مراقبة', tone: 'amber' as const },
  spike: { en: 'Price spike', ar: 'ارتفاع حاد', tone: 'rose' as const },
}

const MOVE = {
  renegotiate: { en: 'Renegotiate / dual-source supplier', ar: 'إعادة التفاوض أو مورد بديل', tone: 'sky' as const },
  reprice: { en: 'Re-price menu item', ar: 'تعديل سعر الصنف', tone: 'amber' as const },
  portion: { en: 'Trim portion 5%', ar: 'تخفيض الحصة 5%', tone: 'emerald' as const },
  none: { en: 'No exposure', ar: 'لا تأثير', tone: 'slate' as const },
}

export function CostIntelligenceV2() {
  const { lang, isAr, T } = useLang()
  const { filters } = useBiFilters()
  const creep = useMemo(() => priceCreep(filters), [filters])
  const [ingredient, setIngredient] = useState<IngredientId>('poultry-breast')
  const defaultPct = creep.find((c) => c.id === ingredient)?.creepPct ?? 0
  const [increase, setIncrease] = useState<number | null>(null)
  const pctUsed = increase ?? Math.round(defaultPct * 10) / 10
  const erosion = useMemo(() => marginErosion(ingredient, pctUsed, filters), [ingredient, pctUsed, filters])
  const matrix = useMemo(() => cogsVarianceMatrix(filters), [filters])

  const flagged = creep.filter((c) => c.level !== 'stable')
  const creepImpact = creep.reduce((s, c) => s + c.impact, 0)
  const digits = filters.period === 'daily' ? 3 : 0
  const actualPct = matrix.salesTotal ? (matrix.actualTotal / matrix.salesTotal) * 100 : LEDGER.cogsPct
  const theoPct = LEDGER.cogsTargetPct

  const brandName = (id: string) => {
    const b = BRANDS.find((x) => x.id === id)
    return b ? (isAr ? b.ar : b.en) : id
  }

  const matrixColumns: ReorderColumn<(typeof matrix.rows)[number]>[] = [
    { key: 'branch', en: 'Branch', ar: 'الفرع', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{isAr ? r.ar : r.en}</span>, csv: (r) => (isAr ? r.ar : r.en) },
    { key: 'sales', en: 'Net sales', ar: 'صافي المبيعات', align: 'end', render: (r) => <Num>{fmt(r.sales, digits)}</Num>, csv: (r) => r.sales.toFixed(3) },
    { key: 'theo', en: 'Theoretical COGS (24.0%)', ar: 'التكلفة النظرية (24.0%)', align: 'end', render: (r) => <Num>{fmt(r.theoretical, digits)}</Num>, csv: (r) => r.theoretical.toFixed(3) },
    { key: 'actual', en: 'Actual COGS', ar: 'التكلفة الفعلية', align: 'end', render: (r) => <Num className="text-slate-900 dark:text-white">{fmt(r.actual, digits)}</Num>, csv: (r) => r.actual.toFixed(3) },
    { key: 'actualPct', en: 'Actual %', ar: 'النسبة الفعلية', align: 'end', render: (r) => <Num className={r.actualPct > LEDGER.cogsPct ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}>{pct(r.actualPct, 2)}</Num>, csv: (r) => r.actualPct.toFixed(2) },
    { key: 'ck', en: 'Central kitchen shrinkage', ar: 'فاقد المطبخ المركزي', align: 'end', render: (r) => <Num className="text-rose-600">{fmt(r.ckShrink, 2)}</Num>, csv: (r) => r.ckShrink.toFixed(3) },
    { key: 'portion', en: 'Over-portioning', ar: 'زيادة الحصص', align: 'end', render: (r) => <Num className="text-amber-600">{fmt(r.overPortion, 2)}</Num>, csv: (r) => r.overPortion.toFixed(3) },
    { key: 'waste', en: 'Unrecorded waste', ar: 'هدر غير مسجل', align: 'end', render: (r) => <Num className="text-sky-600">{fmt(r.unrecorded, 2)}</Num>, csv: (r) => r.unrecorded.toFixed(3) },
    { key: 'gap', en: 'Total gap', ar: 'إجمالي الفجوة', align: 'end', render: (r) => <Num className="text-slate-900 dark:text-white">{fmt(r.gap, 2)}</Num>, csv: (r) => r.gap.toFixed(3) },
  ]

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <Badge tone="rose">{T('Supplier price creep · COGS intelligence', 'ارتفاع أسعار الموردين · ذكاء التكلفة')}</Badge>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('Cost Intelligence', 'ذكاء التكلفة')}</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {T(
              `Vendor invoices against contracted baselines, recipe margin erosion across the top 32 items, and the ${pct(LEDGER.cogsTargetPct)} theoretical vs ${pct(LEDGER.cogsPct)} actual food-cost gap (${kwd(LEDGER.cogs, 'en', 3)}).`,
              `فواتير الموردين مقابل الأسعار المتعاقد عليها، وتآكل هامش الوصفات لأعلى 32 صنفاً، وفجوة تكلفة الأغذية النظرية ${pct(LEDGER.cogsTargetPct)} مقابل الفعلية ${pct(LEDGER.cogsPct)} (${kwd(LEDGER.cogs, 'ar', 3)}).`,
            )}
          </p>
        </div>
        <Link href={feryalHref(T('Which supplier price increases threaten our margin most and what counter-moves do you recommend?', 'أي ارتفاعات أسعار الموردين تهدد هامشنا أكثر وما الإجراءات المضادة التي توصين بها؟'))} className="ae-pill-dark">
          <Sparkles className="h-3.5 w-3.5" />
          {T('Ask Feryal', 'اسأل فريال')}
        </Link>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2 icon={<AlertTriangle className="h-4 w-4" />} label={T('Ingredients above contract', 'مواد فوق السعر المتعاقد')} value={`${flagged.length} / ${SUPPLIER_ITEMS.length}`} valueTone="rose" sub={T(`Alert threshold ${PRICE_CREEP_ALERT_PCT}% over baseline`, `حد التنبيه ${PRICE_CREEP_ALERT_PCT}% فوق الأساس`)} />
        <StatsCardV2 icon={<TrendingUp className="h-4 w-4" />} label={T('Price-creep cost exposure', 'تكلفة ارتفاع الأسعار')} value={kwd(creepImpact, lang, digits)} valueTone="amber" sub={T('At current purchase volumes', 'بأحجام الشراء الحالية')} />
        <StatsCardV2 icon={<Gauge className="h-4 w-4" />} label={T('Theoretical vs actual COGS', 'التكلفة النظرية مقابل الفعلية')} value={`${pct(theoPct)} → ${pct(actualPct)}`} valueTone="rose" target={{ label: T('Gap recovered by the Ardiya lever', 'الفجوة المستردة برافعة العارضية'), progress: 100, tone: 'emerald' }} />
        <StatsCardV2 icon={<TrendingDown className="h-4 w-4" />} label={T('Recoverable food-cost gap', 'فجوة التكلفة القابلة للاسترداد')} value={`+${kwd(matrix.gapTotal, lang, digits)}`} valueTone="emerald" sub={T(`${fmt(LEDGER.cogsEntries)} central-kitchen entries`, `${fmt(LEDGER.cogsEntries)} قيداً للمطبخ المركزي`)} />
      </section>

      <section className="space-y-3">
        <SectionHeader icon={<Receipt className="h-4 w-4" />} title={T('Live supplier invoice price-creep radar', 'رادار ارتفاع أسعار فواتير الموردين')} subtitle={T('Latest invoice vs contracted baseline · last six weekly invoices', 'آخر فاتورة مقابل السعر المتعاقد · آخر ست فواتير أسبوعية')} />
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {creep.map((c) => {
            const lv = LEVEL[c.level]
            return (
              <article key={c.id} className={`ae-tile ae-lift flex flex-col justify-between gap-3 p-4 ${ingredient === c.id ? 'ring-2 ring-sky-500' : ''}`}>
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{isAr ? c.ar : c.en}</p>
                    <Badge tone={lv.tone}>{isAr ? lv.ar : lv.en}</Badge>
                  </div>
                  <p className="ae-meta">{isAr ? c.vendorAr : c.vendorEn}</p>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500">
                      {T('Contract', 'المتعاقد')} <Num>{fmt(c.contract, 3)}</Num> → {T('invoice', 'الفاتورة')}
                    </div>
                    <Num className={`text-lg ${c.creepPct >= PRICE_CREEP_ALERT_PCT ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                      {fmt(c.latest, 3)} <span className="text-[11px] font-semibold text-slate-500">/ {isAr ? c.unitAr : c.unitEn}</span>
                    </Num>
                  </div>
                  <Sparkline data={c.invoices} color={TONE_HEX[lv.tone]} width={84} height={30} />
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <Num className={c.creepPct > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {c.creepPct > 0 ? '+' : ''}
                    {pct(c.creepPct)}
                  </Num>
                  <span className="text-slate-500">
                    <Num className="text-slate-900 dark:text-white">{kwd(c.impact, lang, digits || 1)}</Num>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIngredient(c.id)
                    setIncrease(null)
                  }}
                  className={ingredient === c.id ? 'ae-pill-dark ae-pill-sm' : 'ae-pill-light ae-pill-sm'}
                >
                  <FlaskConical className="h-3 w-3" />
                  {T('Simulate margin impact', 'محاكاة أثر الهامش')}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<FlaskConical className="h-4 w-4" />}
          title={T('Recipe margin erosion simulator', 'محاكي تآكل هامش الوصفات')}
          subtitle={T('Impact on unit food cost and margin across the top 32 revenue items (Stars & Plowhorses)', 'الأثر على تكلفة الوحدة والهامش لأعلى 32 صنفاً إيراداً (النجوم والأحصنة العاملة)')}
          actions={
            <Link
              href={feryalHref(
                isAr
                  ? `حللي أثر ارتفاع سعر ${erosion.supplier.ar} بنسبة ${fmt(pctUsed, 1)}% على هامش أعلى 32 صنفاً (تآكل ${fmt(erosion.totalErosion)} د.ك) والإجراءات المضادة.`
                  : `Analyse a ${fmt(pctUsed, 1)}% price increase on ${erosion.supplier.en} across our top 32 items (${fmt(erosion.totalErosion)} KWD erosion) and the counter-moves.`,
              )}
              className="ae-pill-dark"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {T('Ask Feryal', 'اسأل فريال')}
            </Link>
          }
        />
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
          <div className="ae-tile-soft space-y-4 p-4 lg:col-span-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{T('Ingredient', 'المادة')}</span>
              <select
                className="ae-select w-full !max-w-none"
                value={ingredient}
                onChange={(e) => {
                  setIngredient(e.target.value as IngredientId)
                  setIncrease(null)
                }}
              >
                {SUPPLIER_ITEMS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {isAr ? s.ar : s.en}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>{T('Vendor price increase', 'زيادة سعر المورد')}</span>
                <Num className="text-base text-slate-900 dark:text-white">+{pct(pctUsed)}</Num>
              </div>
              <input type="range" min={0} max={25} step={0.5} value={pctUsed} onChange={(e) => setIncrease(Number(e.target.value))} className="w-full accent-rose-600" aria-label={T('Vendor price increase', 'زيادة سعر المورد')} />
              <div className="flex justify-between text-[10px] text-slate-400">
                <Num>0%</Num>
                <button type="button" className="font-semibold text-sky-600 hover:underline" onClick={() => setIncrease(null)}>
                  {T('Use live invoice creep', 'استخدم الارتفاع الفعلي')}
                </button>
                <Num>25%</Num>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="ae-tile p-3">
                <div className="text-[10px] text-slate-500">{T('Margin erosion', 'تآكل الهامش')}</div>
                <Num className="text-lg text-rose-600">−{kwd(erosion.totalErosion, lang, digits || 1)}</Num>
              </div>
              <div className="ae-tile p-3">
                <div className="text-[10px] text-slate-500">{T('Items exposed', 'الأصناف المتأثرة')}</div>
                <Num className="text-lg text-slate-900 dark:text-white">{erosion.affected} / 32</Num>
              </div>
            </div>
          </div>
          <div className="w-full min-w-0 overflow-x-auto rounded-xl lg:col-span-8">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-3 py-2 text-start font-semibold">{T('Menu item', 'الصنف')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('Unit cost +', 'زيادة تكلفة الوحدة')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('COGS %', 'نسبة التكلفة')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('Erosion', 'التآكل')}</th>
                  <th className="px-3 py-2 text-start font-semibold">{T('Counter-move', 'الإجراء المضاد')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {erosion.rows.slice(0, 12).map((r) => {
                  const q = QUADRANTS.find((x) => x.id === r.item.quadrant)!
                  const mv = MOVE[r.move]
                  return (
                    <tr key={r.item.id} className={r.qty === 0 ? 'opacity-50' : ''}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900 dark:text-white">{isAr ? r.item.ar : r.item.en}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          {brandName(r.item.brand)} · <Badge tone={q.tone} className="!py-0">{isAr ? q.ar : q.en}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-end"><Num>{fmt(r.deltaUnit, 3)}</Num></td>
                      <td className="px-3 py-2 text-end">
                        <Num className={r.newCogsPct > r.baseCogsPct ? 'text-rose-600' : ''}>{`${pct(r.baseCogsPct)} → ${pct(r.newCogsPct)}`}</Num>
                      </td>
                      <td className="px-3 py-2 text-end"><Num className="text-rose-600">{fmt(r.erosion, 1)}</Num></td>
                      <td className="px-3 py-2">
                        <Badge tone={mv.tone}>{isAr ? mv.ar : mv.en}</Badge>
                        {r.move === 'reprice' ? <Num className="ms-1 text-[10px] text-slate-500">+{pct(r.priceToRestore)}</Num> : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<ChefHat className="h-4 w-4" />}
          title={T('Theoretical vs actual COGS variance matrix', 'مصفوفة انحراف التكلفة النظرية مقابل الفعلية')}
          subtitle={T(`${pct(LEDGER.cogsTargetPct)} target vs ${pct(LEDGER.cogsPct)} actual · ${kwd(LEDGER.cogs, 'en', 3)} · 9 active branches`, `المستهدف ${pct(LEDGER.cogsTargetPct)} مقابل الفعلي ${pct(LEDGER.cogsPct)} · ${kwd(LEDGER.cogs, 'ar', 3)} · 9 فروع نشطة`)}
        />
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-4">
          <div className="ae-tile-soft flex flex-col justify-between p-4">
            <div className="ae-meta">{T('Gap to theoretical', 'الفجوة عن النظري')}</div>
            <Num className="text-2xl text-rose-600">{kwd(matrix.gapTotal, lang, digits || 3)}</Num>
            <div className="mt-2 flex h-2.5 overflow-hidden rounded-full" dir="ltr">
              {matrix.causes.map((c) => (
                <div key={c.id} style={{ width: `${c.share * 100}%`, backgroundColor: TONE_HEX[c.tone] }} />
              ))}
            </div>
          </div>
          {matrix.causes.map((c) => (
            <div key={c.id} className="ae-tile-soft flex flex-col justify-between p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TONE_HEX[c.tone] }} />
                {isAr ? c.ar : c.en}
              </div>
              <Num className="text-xl text-slate-900 dark:text-white">{kwd(c.value, lang, digits || 2)}</Num>
              <Num className="text-[11px] text-slate-500">{pct(c.share * 100, 0)}</Num>
            </div>
          ))}
        </div>
        <ReorderableTable columns={matrixColumns} rows={matrix.rows} rowKey={(r) => r.id} csvName={`aetherbi-cogs-variance-${filters.period}.csv`} maxHeight={460} />
      </section>
    </div>
  )
}
