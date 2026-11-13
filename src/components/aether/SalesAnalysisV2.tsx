'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Grid2x2, LayoutGrid, Search, SlidersHorizontal, Sparkles, Table2, Tag, Timer, TrendingUp } from 'lucide-react'
import {
  BRANDS,
  CATEGORIES,
  LEDGER,
  MENU_ITEMS,
  MENU_THRESHOLDS,
  QUADRANTS,
  feryalHref,
  fmt,
  kwd,
  pct,
  sliceShares,
  type BrandId,
  type CategoryId,
  type MenuItem,
  type Quadrant,
} from '@/lib/aether/ledger'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, Num, ReorderableTable, SectionHeader, StatsCardV2, TONE_HEX, useLang, type ReorderColumn } from '@/components/aether/ui'

type View = 'matrix' | 'cards' | 'table'

export function SalesAnalysisV2() {
  const { lang, isAr, T } = useLang()
  const { filters, view, setBrand } = useBiFilters()
  const [mode, setMode] = useState<View>('matrix')
  const [category, setCategory] = useState<CategoryId | 'all'>('all')
  const [quadrant, setQuadrant] = useState<Quadrant | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [cardLimit, setCardLimit] = useState(16)
  const [approved, setApproved] = useState<Record<string, boolean>>({})
  const [repriced, setRepriced] = useState<Record<string, boolean>>({})

  // Deep link from the command palette: /erp/sales-analysis?item=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('item')
    if (!id) return
    const item = MENU_ITEMS.find((m) => m.id === id)
    if (item) {
      setSelected(item.id)
      setMode('cards')
      setQuery(lang === 'ar' ? item.ar : item.en)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Items scale with the global branch × channel × period slice (brand is a hard filter).
  const slice = sliceShares({ brand: 'all', branch: filters.branch, channel: filters.channel })
  const scale = slice.branchShare * slice.channelShare * view.periodFactor

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MENU_ITEMS.filter((m) => {
      if (filters.brand !== 'all' && m.brand !== filters.brand) return false
      if (category !== 'all' && m.category !== category) return false
      if (quadrant !== 'all' && m.quadrant !== quadrant) return false
      if (q && !m.en.toLowerCase().includes(q) && !m.ar.includes(q)) return false
      return true
    })
  }, [filters.brand, category, quadrant, query])

  const scopeItems = useMemo(() => MENU_ITEMS.filter((m) => filters.brand === 'all' || m.brand === filters.brand), [filters.brand])
  const scopeRevenue = scopeItems.reduce((s, m) => s + m.revenue, 0)
  const quadrantStats = QUADRANTS.map((q) => {
    const list = scopeItems.filter((m) => m.quadrant === q.id)
    const revenue = list.reduce((s, m) => s + m.revenue, 0)
    return { ...q, count: list.length, revenue, share: scopeRevenue ? (revenue / scopeRevenue) * 100 : 0 }
  })
  const top32 = MENU_ITEMS.filter((m) => m.top32)
  const top32Share = (top32.reduce((s, m) => s + m.revenue, 0) / LEDGER.netSales) * 100
  const purge = MENU_ITEMS.filter((m) => m.purgeCandidate)
  const reprice = MENU_ITEMS.filter((m) => m.repriceCandidate)
  const selectedItem = selected ? MENU_ITEMS.find((m) => m.id === selected) ?? null : null
  const brandName = (id: BrandId) => {
    const b = BRANDS.find((x) => x.id === id)!
    return isAr ? b.ar : b.en
  }
  const catName = (id: CategoryId) => {
    const c = CATEGORIES.find((x) => x.id === id)!
    return isAr ? c.ar : c.en
  }
  const qMeta = (id: Quadrant) => QUADRANTS.find((q) => q.id === id)!

  // Scatter geometry (log popularity × unit margin)
  const maxUnits = Math.max(...MENU_ITEMS.map((m) => m.units))
  const minUnits = Math.max(1, Math.min(...MENU_ITEMS.map((m) => m.units)))
  const maxMargin = Math.max(...MENU_ITEMS.map((m) => m.unitMargin))
  /** Percent positions inside the scatter frame (4–96% horizontally, 6–92% vertically). */
  const xPct = (u: number) => 4 + ((Math.log(Math.max(u, minUnits)) - Math.log(minUnits)) / (Math.log(maxUnits) - Math.log(minUnits))) * 92
  const yPct = (mg: number) => 92 - (mg / (maxMargin * 1.05)) * 86

  const columns: ReorderColumn<MenuItem>[] = [
    { key: 'rank', en: 'Rank', ar: 'الترتيب', render: (r) => <Num className="text-slate-400">#{r.rank}</Num>, csv: (r) => r.rank },
    { key: 'item', en: 'Item', ar: 'الصنف', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{isAr ? r.ar : r.en}</span>, csv: (r) => (isAr ? r.ar : r.en) },
    { key: 'brand', en: 'Brand', ar: 'العلامة', render: (r) => brandName(r.brand), csv: (r) => brandName(r.brand) },
    { key: 'category', en: 'Category', ar: 'الفئة', render: (r) => catName(r.category), csv: (r) => catName(r.category) },
    { key: 'quadrant', en: 'Quadrant', ar: 'التصنيف', render: (r) => <Badge tone={qMeta(r.quadrant).tone}>{isAr ? qMeta(r.quadrant).ar : qMeta(r.quadrant).en}</Badge>, csv: (r) => (isAr ? qMeta(r.quadrant).ar : qMeta(r.quadrant).en) },
    { key: 'price', en: 'Price', ar: 'السعر', align: 'end', render: (r) => <Num>{fmt(r.price, 3)}</Num>, csv: (r) => r.price.toFixed(3) },
    { key: 'cogs', en: 'COGS %', ar: 'نسبة التكلفة', align: 'end', render: (r) => <Num className={r.cogsPct > 28 ? 'text-rose-600' : ''}>{pct(r.cogsPct)}</Num>, csv: (r) => r.cogsPct.toFixed(1) },
    { key: 'margin', en: 'Unit margin', ar: 'هامش الوحدة', align: 'end', render: (r) => <Num className="text-emerald-600">{fmt(r.unitMargin, 3)}</Num>, csv: (r) => r.unitMargin.toFixed(3) },
    { key: 'units', en: 'Units', ar: 'الوحدات', align: 'end', render: (r) => <Num>{fmt(r.units * scale)}</Num>, csv: (r) => Math.round(r.units * scale) },
    { key: 'revenue', en: 'Revenue', ar: 'الإيراد', align: 'end', render: (r) => <Num className="text-slate-900 dark:text-white">{kwd(r.revenue * scale, lang, filters.period === 'daily' ? 3 : 0)}</Num>, csv: (r) => (r.revenue * scale).toFixed(3) },
    { key: 'share', en: 'Revenue share', ar: 'حصة الإيراد', align: 'end', render: (r) => <Num>{pct((r.revenue / LEDGER.netSales) * 100, 2)}</Num>, csv: (r) => ((r.revenue / LEDGER.netSales) * 100).toFixed(2) },
    {
      key: 'flags',
      en: 'Action',
      ar: 'الإجراء',
      render: (r) =>
        r.purgeCandidate ? <Badge tone="rose">{T('Purge', 'استبعاد')}</Badge> : r.repriceCandidate ? <Badge tone="sky">{T('+5% price', 'رفع 5%')}</Badge> : r.top32 ? <Badge tone="emerald">{T('Top 32', 'ضمن الأعلى 32')}</Badge> : <span className="text-slate-400">—</span>,
      csv: (r) => (r.purgeCandidate ? 'purge' : r.repriceCandidate ? 'reprice+5%' : r.top32 ? 'top32' : ''),
    },
  ]

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <Badge tone="sky">{T('Kasavana & Smith menu engineering', 'هندسة المنيو بمنهجية كاسافانا وسميث')}</Badge>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('Sales & Items Analysis', 'تحليل المبيعات والأصناف')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {T(
              `${fmt(LEDGER.menuItems)} active items across 6 brands. The top ${LEDGER.topItems} items generate ${pct(top32Share)} of revenue.`,
              `${fmt(LEDGER.menuItems)} صنفاً نشطاً عبر 6 مطاعم. أعلى ${LEDGER.topItems} صنفاً تحقق ${pct(top32Share)} من الإيراد.`,
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/erp/sales-scorecard" className="ae-pill-light">
            {T('Sales scorecard (8 sections)', 'سجل المبيعات (8 أقسام)')}
          </Link>
          <Link href={feryalHref(T('Which 18 Dog items should we purge and which 4 Plowhorses should get +5% pricing?', 'ما الأصناف الـ 18 التي نستبعدها والأصناف الأربعة التي نرفع سعرها 5%؟'))} className="ae-pill-dark">
            <Sparkles className="h-3.5 w-3.5" />
            {T('Ask Feryal', 'اسأل فريال')}
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2 icon={<Tag className="h-4 w-4" />} label={T('Active menu items', 'الأصناف النشطة')} value={fmt(scopeItems.length)} sub={T(`of ${fmt(LEDGER.menuItems)} group items`, `من ${fmt(LEDGER.menuItems)} صنفاً للمجموعة`)} />
        <StatsCardV2 icon={<TrendingUp className="h-4 w-4" />} label={T('Top 32 concentration', 'تركيز أعلى 32 صنفاً')} value={pct(top32Share)} valueTone="sky" target={{ label: T('Share of revenue', 'حصة الإيراد'), progress: top32Share, tone: 'sky' }} />
        <StatsCardV2 icon={<SlidersHorizontal className="h-4 w-4" />} label={T('Matrix actions', 'إجراءات المصفوفة')} value={`${purge.length} + ${reprice.length}`} sub={T('Dogs to purge + Plowhorses to re-price', 'أصناف للاستبعاد + أصناف لرفع السعر')} valueTone="amber" />
        <StatsCardV2 icon={<Check className="h-4 w-4" />} label={T('Monthly profit gain', 'الربح الشهري الإضافي')} value={`+${kwd(LEDGER.menuMatrixGain, lang, 0)}`} valueTone="emerald" sub={T('Approved menu-matrix lever', 'رافعة المصفوفة المعتمدة')} />
      </section>

      {/* Filters + mode toggle */}
      <section className="ae-tile flex flex-wrap items-center gap-2.5 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 ltr:left-3 rtl:right-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T('Search items…', 'ابحث في الأصناف…')} className="ae-input ae-input-icon" />
        </div>
        <select className="ae-select" value={filters.brand} onChange={(e) => setBrand(e.target.value as BrandId | 'all')} aria-label={T('Brand', 'العلامة')}>
          <option value="all">{T('All brands', 'كل العلامات')}</option>
          {BRANDS.map((b) => (
            <option key={b.id} value={b.id}>
              {isAr ? b.ar : b.en}
            </option>
          ))}
        </select>
        <select className="ae-select" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | 'all')} aria-label={T('Category', 'الفئة')}>
          <option value="all">{T('All categories', 'كل الفئات')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {isAr ? c.ar : c.en}
            </option>
          ))}
        </select>
        <div className="ae-seg">
          <button type="button" data-active={quadrant === 'all'} onClick={() => setQuadrant('all')}>
            {T('All', 'الكل')}
          </button>
          {QUADRANTS.map((q) => (
            <button key={q.id} type="button" data-active={quadrant === q.id} onClick={() => setQuadrant(q.id)}>
              {isAr ? q.ar : q.en}
            </button>
          ))}
        </div>
        <div className="ae-seg ms-auto">
          <button type="button" data-active={mode === 'matrix'} onClick={() => setMode('matrix')} className="inline-flex items-center gap-1.5">
            <Grid2x2 className="h-3.5 w-3.5" />
            {T('Matrix', 'المصفوفة')}
          </button>
          <button type="button" data-active={mode === 'cards'} onClick={() => setMode('cards')} className="inline-flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" />
            {T('Moderation cards', 'بطاقات المراجعة')}
          </button>
          <button type="button" data-active={mode === 'table'} onClick={() => setMode('table')} className="inline-flex items-center gap-1.5">
            <Table2 className="h-3.5 w-3.5" />
            {T('Table', 'الجدول')}
          </button>
        </div>
      </section>

      {mode === 'matrix' ? (
        <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-8">
            <SectionHeader
              icon={<Grid2x2 className="h-4 w-4" />}
              title={T('4-quadrant menu engineering matrix', 'مصفوفة هندسة المنيو الرباعية')}
              subtitle={T(`${fmt(items.length)} items · popularity (log units) × unit contribution margin`, `${fmt(items.length)} صنفاً · الشعبية (لوغاريتمي) × هامش مساهمة الوحدة`)}
            />
            {/* Height-bounded HTML scatter: dots and labels never scale with container width */}
            <div className="relative h-[340px] w-full overflow-hidden rounded-xl lg:h-[380px]" dir="ltr" role="img" aria-label={T('Menu engineering scatter', 'مخطط هندسة المنيو')}>
              <div className="absolute rounded-tr-xl" style={{ left: `${xPct(MENU_THRESHOLDS.popularity)}%`, right: '4%', top: '6%', height: `${yPct(MENU_THRESHOLDS.unitMargin) - 6}%`, backgroundColor: 'rgba(5,150,105,0.06)' }} />
              <div className="absolute" style={{ left: `${xPct(MENU_THRESHOLDS.popularity)}%`, right: '4%', top: `${yPct(MENU_THRESHOLDS.unitMargin)}%`, bottom: '8%', backgroundColor: 'rgba(2,132,199,0.06)' }} />
              <div className="absolute" style={{ left: '4%', width: `${xPct(MENU_THRESHOLDS.popularity) - 4}%`, top: '6%', height: `${yPct(MENU_THRESHOLDS.unitMargin) - 6}%`, backgroundColor: 'rgba(217,119,6,0.06)' }} />
              <div className="absolute" style={{ left: '4%', width: `${xPct(MENU_THRESHOLDS.popularity) - 4}%`, top: `${yPct(MENU_THRESHOLDS.unitMargin)}%`, bottom: '8%', backgroundColor: 'rgba(225,29,72,0.06)' }} />
              <div className="absolute border-l border-dashed border-slate-400/70" style={{ left: `${xPct(MENU_THRESHOLDS.popularity)}%`, top: '6%', bottom: '8%' }} />
              <div className="absolute border-t border-dashed border-slate-400/70" style={{ top: `${yPct(MENU_THRESHOLDS.unitMargin)}%`, left: '4%', right: '4%' }} />
              <span className="absolute text-[11px] font-semibold text-emerald-600" style={{ right: '5%', top: '8%' }}>{T('Stars', 'النجوم')}</span>
              <span className="absolute text-[11px] font-semibold text-sky-600" style={{ right: '5%', bottom: '10%' }}>{T('Plowhorses', 'الأحصنة العاملة')}</span>
              <span className="absolute text-[11px] font-semibold text-amber-600" style={{ left: '5%', top: '8%' }}>{T('Puzzles', 'الألغاز')}</span>
              <span className="absolute text-[11px] font-semibold text-rose-600" style={{ left: '5%', bottom: '10%' }}>{T('Dogs', 'الأصناف الضعيفة')}</span>
              {items.map((m) => {
                const isSel = selected === m.id
                const size = isSel ? 14 : m.top32 ? 10 : 7
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m.id)}
                    title={`${isAr ? m.ar : m.en} · ${fmt(m.units)} · ${fmt(m.unitMargin, 3)}`}
                    className="absolute rounded-full transition-transform hover:scale-150"
                    style={{
                      left: `${xPct(m.units)}%`,
                      top: `${yPct(m.unitMargin)}%`,
                      width: size,
                      height: size,
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: TONE_HEX[qMeta(m.quadrant).tone],
                      opacity: isSel ? 1 : m.top32 ? 0.9 : 0.5,
                      boxShadow: isSel ? '0 0 0 2px #0F172A' : m.purgeCandidate ? '0 0 0 1.5px #E11D48' : 'none',
                    }}
                  />
                )
              })}
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] text-slate-400">{T('Popularity (units sold, log scale) →', 'الشعبية (الوحدات المباعة) ←')}</span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-[11px] text-slate-400" style={{ transformOrigin: 'left center' }}>{T('Unit margin (KWD)', 'هامش الوحدة (د.ك)')}</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="grid flex-1 grid-cols-2 gap-3">
              {quadrantStats.map((q) => (
                <button key={q.id} type="button" onClick={() => setQuadrant(quadrant === q.id ? 'all' : q.id)} className={`ae-tile ae-lift flex flex-col justify-between gap-2 p-4 text-start ${quadrant === q.id ? 'ring-2 ring-sky-500' : ''}`}>
                  <Badge tone={q.tone}>{isAr ? q.ar : q.en}</Badge>
                  <Num className="text-xl text-slate-900 dark:text-white">{fmt(q.count)}</Num>
                  <div className="text-[11px] text-slate-500">
                    <Num>{pct(q.share)}</Num> {T('of revenue', 'من الإيراد')}
                  </div>
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{isAr ? q.actionAr : q.actionEn}</div>
                </button>
              ))}
            </div>
            <div className="ae-tile space-y-2 p-4">
              {selectedItem ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? selectedItem.ar : selectedItem.en}</p>
                      <p className="ae-meta">{brandName(selectedItem.brand)} · {catName(selectedItem.category)}</p>
                    </div>
                    <Badge tone={qMeta(selectedItem.quadrant).tone}>{isAr ? qMeta(selectedItem.quadrant).ar : qMeta(selectedItem.quadrant).en}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="ae-tile-soft p-2">
                      <div className="ae-meta">{T('Price', 'السعر')}</div>
                      <Num className="text-sm">{fmt(selectedItem.price, 3)}</Num>
                    </div>
                    <div className="ae-tile-soft p-2">
                      <div className="ae-meta">{T('COGS', 'التكلفة')}</div>
                      <Num className="text-sm">{pct(selectedItem.cogsPct)}</Num>
                    </div>
                    <div className="ae-tile-soft p-2">
                      <div className="ae-meta">{T('Revenue', 'الإيراد')}</div>
                      <Num className="text-sm">{fmt(selectedItem.revenue * scale)}</Num>
                    </div>
                  </div>
                  <Link href={feryalHref(isAr ? `حللي أداء الصنف ${selectedItem.ar} وتوصيتك بشأن سعره وموقعه في المنيو.` : `Analyse ${selectedItem.en} and recommend its price and menu placement.`)} className="ae-pill-dark ae-pill-sm">
                    <Sparkles className="h-3 w-3" />
                    {T('Ask Feryal about this item', 'اسأل فريال عن هذا الصنف')}
                  </Link>
                </>
              ) : (
                <p className="text-xs text-slate-500">{T('Select any point on the matrix to inspect the item.', 'اختر أي نقطة على المصفوفة لعرض تفاصيل الصنف.')}</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {mode === 'cards' ? (
        <section className="space-y-4">
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.slice(0, cardLimit).map((m) => {
              const q = qMeta(m.quadrant)
              const priced = repriced[m.id]
              const price = priced ? m.price * 1.05 : m.price
              const unitMargin = price - m.price * (m.cogsPct / 100)
              return (
                <article key={m.id} className={`ae-tile ae-lift flex flex-col justify-between gap-3 p-4 ${selected === m.id ? 'ring-2 ring-sky-500' : ''}`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={q.tone}>{isAr ? q.ar : q.en}</Badge>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        <Timer className="h-3 w-3" />
                        <Num>{m.prepSec}</Num>
                        {T('s prep', ' ث تحضير')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{isAr ? m.ar : m.en}</p>
                    <p className="ae-meta">
                      {brandName(m.brand)} · {catName(m.category)} · <Num>#{m.rank}</Num>
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="ae-tile-soft p-2 text-center">
                      <div className="text-[10px] text-slate-500">{T('COGS', 'التكلفة')}</div>
                      <Num className={`text-xs ${m.cogsPct > 28 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{pct(m.cogsPct)}</Num>
                    </div>
                    <div className="ae-tile-soft p-2 text-center">
                      <div className="text-[10px] text-slate-500">{T('Margin', 'الهامش')}</div>
                      <Num className="text-xs text-emerald-600">{fmt(unitMargin, 3)}</Num>
                    </div>
                    <div className="ae-tile-soft p-2 text-center">
                      <div className="text-[10px] text-slate-500">{T('Price', 'السعر')}</div>
                      <Num className={`text-xs ${priced ? 'text-sky-600' : 'text-slate-900 dark:text-white'}`}>{fmt(price, 3)}</Num>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{T('Revenue', 'الإيراد')}</span>
                    <Num className="text-slate-900 dark:text-white">{kwd(m.revenue * scale, lang, filters.period === 'daily' ? 3 : 0)}</Num>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setApproved((s) => ({ ...s, [m.id]: !s[m.id] }))} className={approved[m.id] ? 'ae-pill-light ae-pill-sm' : 'ae-pill-dark ae-pill-sm'}>
                      <Check className="h-3 w-3" />
                      {approved[m.id] ? T('Approved', 'معتمد') : T('Approve', 'اعتماد')}
                    </button>
                    <button type="button" onClick={() => setRepriced((s) => ({ ...s, [m.id]: !s[m.id] }))} className="ae-pill-light ae-pill-sm">
                      {priced ? T('Revert price', 'إلغاء التعديل') : T('Adjust price +5%', 'تعديل السعر +5%')}
                    </button>
                  </div>
                  {m.purgeCandidate || m.repriceCandidate ? (
                    <div className="text-[11px] font-semibold">
                      {m.purgeCandidate ? <span className="text-rose-600">{T('Recommended for purge', 'مرشح للاستبعاد')}</span> : <span className="text-sky-600">{T('Recommended +5% re-price', 'مرشح لرفع السعر 5%')}</span>}
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
          {items.length > cardLimit ? (
            <div className="flex justify-center">
              <button type="button" className="ae-pill-light" onClick={() => setCardLimit((n) => n + 16)}>
                {T(`Show more (${fmt(items.length - cardLimit)} remaining)`, `عرض المزيد (${fmt(items.length - cardLimit)} متبقية)`)}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === 'table' ? (
        <ReorderableTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          csvName={`aetherbi-menu-engineering-${filters.period}.csv`}
          toolbar={<span className="ae-meta">{T(`${fmt(items.length)} items in view`, `${fmt(items.length)} صنفاً معروضاً`)}</span>}
        />
      ) : null}
    </div>
  )
}
