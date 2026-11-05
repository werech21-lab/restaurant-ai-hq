'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import {
  ACTION_PLAYBOOKS,
  CATEGORY_BREAKDOWN,
  OCTOBER_BRAND_SCORECARDS,
  SLOW_MOVERS_LIST,
  TOP_BEST_SELLERS,
  type MenuItemAnalytics,
} from '@/lib/analytics/brand-sales-october-data'

/* =========================================================================
   Menu engineering (Kasavana & Smith) for October 2026.
   Every table is read from src/lib/analytics/brand-sales-october-data.ts,
   the project's October dataset. Nothing here is typed in by hand except the
   headline figures that match /dashboard. No AI calls, no CDN scripts.
   ========================================================================= */

// Headline figures, identical to /dashboard
const NET_SALES = 167092.16
const ORDERS = 30540
const AOV = 5.471
const ITEMS_SOLD = 79740
const DISCOUNTS = 4152
const COGS_PCT = 24.8
const COGS_KWD = 41438.856
const NET_PROFIT = 42441.48
const NET_MARGIN_PCT = 25.4
const CUSTODY = 51154.95
const SALARIES_RENT_COMMISSION = 32056.874

type Quad = 'star' | 'plowhorse' | 'puzzle' | 'dog'
const QUAD_OF: Record<MenuItemAnalytics['classification'], Quad> = {
  TopPerformer: 'star',
  HighDemand: 'plowhorse',
  HighMargin: 'puzzle',
  SlowMover: 'dog',
}
const QUAD_STYLE: Record<Quad, { en: string; ar: string; descEn: string; descAr: string; box: string; pill: string }> = {
  star: {
    en: 'Stars', ar: 'النجوم',
    descEn: 'High popularity and high margin. Keep at the top of the menu and protect quality.',
    descAr: 'شعبية عالية وهامش مرتفع. ثبّتها في أعلى القائمة واحمِ جودتها.',
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900', pill: 'bg-emerald-100 text-emerald-800',
  },
  plowhorse: {
    en: 'Plowhorses', ar: 'خيول العمل',
    descEn: 'High popularity, lower margin. Pair with cheap add-ons in a combo to lift the margin.',
    descAr: 'شعبية عالية وهامش أقل. اجمعها مع إضافات رخيصة التكلفة في كومبو لرفع الهامش.',
    box: 'border-sky-200 bg-sky-50 text-sky-900', pill: 'bg-sky-100 text-sky-800',
  },
  puzzle: {
    en: 'Puzzles', ar: 'الألغاز',
    descEn: 'High margin, low demand. Promote them and suggest them at checkout.',
    descAr: 'هامش مرتفع وطلب منخفض. روّج لها واقترحها عند الدفع.',
    box: 'border-amber-200 bg-amber-50 text-amber-900', pill: 'bg-amber-100 text-amber-800',
  },
  dog: {
    en: 'Dogs', ar: 'الأصناف الراكدة',
    descEn: 'Weak sales and added kitchen complexity. Bundle, refresh or remove.',
    descAr: 'مبيعات ضعيفة وتعقيد إضافي في المطبخ. اجمعها أو جدّد عرضها أو احذفها.',
    box: 'border-rose-200 bg-rose-50 text-rose-900', pill: 'bg-rose-100 text-rose-800',
  },
}

const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmt1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function Num({ children }: { children: React.ReactNode }) {
  return <span dir="ltr" className="inline-block tabular-nums">{children}</span>
}

const card = 'rounded-md border border-[#E5E7EB] bg-white p-4'
const th = 'px-2 py-1.5 text-start text-[11px] font-semibold text-slate-600 bg-slate-50 border-b border-[#E5E7EB] whitespace-nowrap'
const td = 'px-2 py-1.5 border-b border-[#F1F5F9] whitespace-nowrap'
const tdn = td + ' tabular-nums'

export default function MenuEngineeringPage() {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const T = (en: string, arText: string) => (ar ? arText : en)

  const [brand, setBrand] = useState('ALL')
  const [quad, setQuad] = useState<'ALL' | Quad>('ALL')
  const [query, setQuery] = useState('')

  const brandAr = (b: string) => OCTOBER_BRAND_SCORECARDS.find((x) => x.brand === b)?.brandAr ?? b

  const rows = useMemo(() => {
    const best = TOP_BEST_SELLERS.map((i) => ({
      key: i.id,
      nameEn: i.nameEn, nameAr: i.nameAr, brand: i.brand as string,
      catEn: i.categoryEn as string, catAr: i.categoryAr as string,
      price: i.priceKwd, units: i.unitsSold, sales: i.salesKwd,
      cost: i.costPriceKwd as number | null, shareOfBrand: i.shareOfBrandPercent as number | null,
      quad: QUAD_OF[i.classification],
    }))
    const slow = SLOW_MOVERS_LIST.map((i) => ({
      key: i.id,
      nameEn: i.nameEn, nameAr: i.nameAr, brand: i.brand as string,
      catEn: i.categoryEn, catAr: i.categoryAr,
      price: i.priceKwd, units: i.unitsSold, sales: i.salesKwd,
      cost: null as number | null, shareOfBrand: null as number | null,
      quad: 'dog' as Quad,
    }))
    return [...best, ...slow]
  }, [])

  const counts = useMemo(() => {
    const c: Record<Quad, number> = { star: 0, plowhorse: 0, puzzle: 0, dog: 0 }
    rows.forEach((r) => { c[r.quad]++ })
    return c
  }, [rows])

  const filtered = rows.filter((r) => {
    if (brand !== 'ALL' && r.brand !== brand) return false
    if (quad !== 'ALL' && r.quad !== quad) return false
    const q = query.trim().toLowerCase()
    if (q && !r.nameEn.toLowerCase().includes(q) && !r.nameAr.includes(q) && !r.catEn.toLowerCase().includes(q)) return false
    return true
  })
  const maxCat = Math.max(...CATEGORY_BREAKDOWN.map((c) => c.salesKwd))

  return (
    <div dir={ar ? 'rtl' : 'ltr'} lang={locale} className="mx-auto w-full max-w-[1550px] space-y-4 text-xs text-slate-800" style={ar ? { fontFamily: 'Cairo, Inter, system-ui, sans-serif' } : undefined}>
      {/* Header */}
      <div className={`${card} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight !text-slate-900">{T('Menu engineering · October 2026', 'هندسة المنيو · أكتوبر 2026')}</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {T(
              'Kasavana & Smith matrix built from the October item data: popularity, recipe cost and margin per item.',
              'مصفوفة كاسافانا وسميث مبنية على بيانات الأصناف لشهر أكتوبر: الشعبية وتكلفة الوصفة والهامش لكل صنف.',
            )}
          </p>
        </div>
        <Link href="/dashboard" className="self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 lg:self-auto">
          {ar ? '→ العودة إلى الملخص المالي' : '← Back to financial summary'}
        </Link>
      </div>

      {/* Confirmed October figures */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {[
          [T('Net sales', 'صافي المبيعات'), <Num key="a">{ar ? `${fmt3(NET_SALES)} د.ك` : `KWD ${fmt3(NET_SALES)}`}</Num>],
          [T('Orders', 'عدد الطلبات'), <Num key="b">{fmt0(ORDERS)}</Num>],
          [T('Average order value', 'متوسط قيمة الطلب'), <Num key="c">{ar ? `${fmt3(AOV)} د.ك` : `KWD ${fmt3(AOV)}`}</Num>],
          [T('Items sold', 'الأصناف المباعة'), <Num key="d">{fmt0(ITEMS_SOLD)}</Num>],
          [T('Discounts given', 'الخصومات الممنوحة'), <Num key="e">{ar ? `${fmt0(DISCOUNTS)} د.ك` : `KWD ${fmt0(DISCOUNTS)}`}</Num>],
        ].map(([label, value], i) => (
          <div key={i} className={card + ' !p-3'}>
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="mt-0.5 text-lg font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Terminology: contribution margin vs net operating profit */}
      <section className={card}>
        <h2 className="text-sm font-semibold !text-slate-900">{T('Two different margins on the dashboard', 'هامشان مختلفان في لوحة التحكم')}</h2>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold">{T('Contribution margin after food and commission', 'هامش المساهمة بعد الطعام والعمولة')}</div>
            <p className="mt-1 text-slate-600">
              {T(
                'Net sales minus food cost minus platform commission. It ignores custody, salaries and rent, so it is always higher than net profit. It judges a channel or an item, not the company.',
                'صافي المبيعات ناقص تكلفة الأغذية وعمولة المنصات. يتجاهل العهد والرواتب والإيجارات، لذلك هو دائماً أعلى من صافي الربح. يُستخدم للحكم على قناة أو صنف، لا على الشركة.',
              )}
            </p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="font-semibold">{T('Net operating profit (official)', 'صافي الربح التشغيلي (المعتمد)')}</div>
            <p className="mt-1 text-slate-700">
              {T(
                `Net sales minus food cost (${COGS_PCT}% = KWD ${fmt3(COGS_KWD)}), custody and expenses (KWD ${fmt3(CUSTODY)}) and salaries, rent and commissions (KWD ${fmt3(SALARIES_RENT_COMMISSION)}) = KWD ${fmt3(NET_PROFIT)} (${NET_MARGIN_PCT}%).`,
                `صافي المبيعات ناقص تكلفة الأغذية (${COGS_PCT}% = ${fmt3(COGS_KWD)} د.ك) والعهد والمصروفات (${fmt3(CUSTODY)} د.ك) والرواتب والإيجارات والعمولات (${fmt3(SALARIES_RENT_COMMISSION)} د.ك) = ${fmt3(NET_PROFIT)} د.ك (${NET_MARGIN_PCT}%).`,
              )}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {T(
            'Item-level recipe cost below is per item and differs from the group food cost of 24.8%; do not compare them directly.',
            'تكلفة الوصفة لكل صنف أدناه تخص الصنف وتختلف عن تكلفة الأغذية الإجمالية للمجموعة البالغة 24.8%؛ لا تقارنهما مباشرة.',
          )}
        </p>
      </section>

      {/* Quadrant cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(QUAD_STYLE) as Quad[]).map((k) => (
          <button
            key={k}
            onClick={() => setQuad((cur) => (cur === k ? 'ALL' : k))}
            className={`rounded-md border p-3 text-start ${QUAD_STYLE[k].box} ${quad === k ? 'ring-2 ring-slate-900' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{T(QUAD_STYLE[k].en, QUAD_STYLE[k].ar)}</span>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold"><Num>{counts[k]}</Num></span>
            </div>
            <p className="mt-1">{T(QUAD_STYLE[k].descEn, QUAD_STYLE[k].descAr)}</p>
          </button>
        ))}
      </div>

      {/* Category bars + item table */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className={card}>
          <h2 className="text-sm font-semibold !text-slate-900">{T('Sales by category', 'المبيعات حسب الفئة')}</h2>
          <div className="mt-3 space-y-1.5">
            {CATEGORY_BREAKDOWN.map((c) => (
              <div key={c.nameEn} className="grid grid-cols-[8.5rem_1fr] items-center gap-2">
                <span className="truncate text-slate-700">{ar ? c.nameAr : c.nameEn}</span>
                <div className="flex items-center gap-1.5">
                  <div style={{ height: 16, width: `${(c.salesKwd / maxCat) * 75}%`, minWidth: 2, background: '#9CA3AF' }} />
                  <Num>{fmt0(c.salesKwd)} <span className="text-slate-400">({c.sharePercent}%)</span></Num>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {T('Categories follow the menu-engineering dataset, which groups items differently from the sales scorecard.', 'الفئات تتبع بيانات هندسة المنيو، وهي تجمّع الأصناف بشكل مختلف عن بطاقة أداء المبيعات.')}
          </p>
        </section>

        <section className={`${card} xl:col-span-2`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold !text-slate-900">{T('Item matrix', 'مصفوفة الأصناف')}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={T('Search item or category', 'ابحث عن صنف أو فئة')}
                className="rounded border border-[#E5E7EB] px-2 py-1 text-xs"
              />
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="rounded border border-[#E5E7EB] bg-white px-2 py-1 text-xs">
                <option value="ALL">{T('All brands', 'كل العلامات التجارية')}</option>
                {OCTOBER_BRAND_SCORECARDS.map((b) => <option key={b.brand} value={b.brand}>{ar ? b.brandAr : b.brand}</option>)}
              </select>
              {(brand !== 'ALL' || quad !== 'ALL' || query) && (
                <button onClick={() => { setBrand('ALL'); setQuad('ALL'); setQuery('') }} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100">
                  {T('Clear filters', 'إلغاء التصفية')}
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10"><tr>
                {[
                  ['Item', 'الصنف'], ['Brand', 'العلامة'], ['Category', 'الفئة'], ['Units', 'الكمية'], ['Sales (KWD)', 'المبيعات (د.ك)'],
                  ['Price', 'السعر'], ['Recipe cost %', 'تكلفة الوصفة %'], ['Unit margin', 'هامش الوحدة'], ['Matrix class', 'تصنيف المصفوفة'],
                ].map(([en, arT]) => <th key={en} className={th}>{T(en, arT)}</th>)}
              </tr></thead>
              <tbody>
                {filtered.length === 0 && <tr><td className={td} colSpan={9}>{T('No items match the filters.', 'لا توجد أصناف مطابقة للتصفية.')}</td></tr>}
                {filtered.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50">
                    <td className={td + ' font-semibold'}>{ar ? r.nameAr : r.nameEn}</td>
                    <td className={td}>{ar ? brandAr(r.brand) : r.brand}</td>
                    <td className={td}>{ar ? r.catAr : r.catEn}</td>
                    <td className={tdn}>{fmt0(r.units)}</td>
                    <td className={tdn}>{fmt2(r.sales)}</td>
                    <td className={tdn}>{fmt2(r.price)}</td>
                    <td className={tdn}>{r.cost != null ? `${fmt1((r.cost / r.price) * 100)}%` : '—'}</td>
                    <td className={tdn}>{r.cost != null ? fmt2(r.price - r.cost) : '—'}</td>
                    <td className={td}><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${QUAD_STYLE[r.quad].pill}`}>{T(QUAD_STYLE[r.quad].en, QUAD_STYLE[r.quad].ar)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {T(
              'The dataset lists the 15 best sellers and 7 slow movers; recipe cost is available for the best sellers only.',
              'تضم البيانات أعلى 15 صنفاً مبيعاً و7 أصناف بطيئة؛ وتكلفة الوصفة متاحة للأصناف الأكثر مبيعاً فقط.',
            )}
          </p>
        </section>
      </div>

      {/* Slow movers with playbook */}
      <section className={card}>
        <h2 className="text-sm font-semibold !text-slate-900">{T('Slow movers and the recommended action', 'الأصناف البطيئة والإجراء الموصى به')}</h2>
        <div className="mt-3 max-h-96 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0"><tr>
              {[['Item', 'الصنف'], ['Brand', 'العلامة'], ['Category', 'الفئة'], ['Price', 'السعر'], ['Units', 'الكمية'], ['Sales (KWD)', 'المبيعات (د.ك)'], ['Recommended playbook', 'الإجراء الموصى به']].map(([en, arT]) => <th key={en} className={th}>{T(en, arT)}</th>)}
            </tr></thead>
            <tbody>
              {SLOW_MOVERS_LIST.filter((s) => brand === 'ALL' || s.brand === brand).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className={td + ' font-semibold'}>{ar ? s.nameAr : s.nameEn}</td>
                  <td className={td}>{ar ? brandAr(s.brand) : s.brand}</td>
                  <td className={td}>{ar ? s.categoryAr : s.categoryEn}</td>
                  <td className={tdn}>{fmt2(s.priceKwd)}</td>
                  <td className={tdn}>{fmt0(s.unitsSold)}</td>
                  <td className={tdn}>{fmt2(s.salesKwd)}</td>
                  <td className={td}>{ar ? s.playbookTitleAr : s.playbookTitleEn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Playbooks */}
      <section className={card}>
        <h2 className="text-sm font-semibold !text-slate-900">{T('Action playbooks', 'أدلة الإجراءات')}</h2>
        <p className="text-[11px] text-slate-500">{T('Expected effects are planning estimates from the dataset, not measured results.', 'الأثر المتوقع تقديرات تخطيطية من البيانات وليست نتائج مقاسة.')}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ACTION_PLAYBOOKS.map((p) => (
            <div key={p.id} className="rounded-md border border-[#E5E7EB] border-s-[3px] border-s-gray-900 p-3">
              <div className="font-semibold text-slate-900">{ar ? p.titleAr : p.titleEn}</div>
              <div className="mt-0.5 text-slate-500">{ar ? p.taglineAr : p.taglineEn}</div>
              <p className="mt-1.5 text-slate-700">{ar ? p.descriptionAr : p.descriptionEn}</p>
              <div className="mt-1.5 text-[11px] font-semibold text-emerald-700">{T('Expected', 'المتوقع')}: {ar ? p.expectedImpactAr : p.expectedImpactEn}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
