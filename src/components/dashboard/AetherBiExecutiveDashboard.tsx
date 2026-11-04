'use client'

import React, { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'

/* =========================================================================
   Ordable-style executive summary + recommendations engine.
   Pure SVG / CSS (no chart library) and no AI calls: every number is static
   data defined below, so browsing costs no tokens.
   Bilingual (ar | en) with matching direction (rtl | ltr).
   ========================================================================= */

// ---- Headline figures (as supplied) ---------------------------------------
const NET_SALES = 167092.16
const ORDERS = 30540
const NET_PROFIT = 42441.48
const MARGIN = 25.4
const COGS = 41438.856
const CUSTODY = 51154.95
const SALARIES_RENT_COMMISSION = 32056.874
const RECS_TOTAL = 6840

// Sampled every 3 days (11 points), not the full month.
const DAILY_TREND = [
  { day: '01 Oct', sales: 4920, profit: 1240, orders: 895, cogs: 1220 },
  { day: '04 Oct', sales: 5380, profit: 1370, orders: 980, cogs: 1334 },
  { day: '07 Oct', sales: 5110, profit: 1295, orders: 930, cogs: 1267 },
  { day: '10 Oct', sales: 5890, profit: 1510, orders: 1075, cogs: 1460 },
  { day: '13 Oct', sales: 5240, profit: 1320, orders: 960, cogs: 1299 },
  { day: '16 Oct', sales: 6120, profit: 1580, orders: 1120, cogs: 1517 },
  { day: '19 Oct', sales: 5490, profit: 1390, orders: 1005, cogs: 1361 },
  { day: '22 Oct', sales: 5760, profit: 1465, orders: 1050, cogs: 1428 },
  { day: '25 Oct', sales: 6340, profit: 1640, orders: 1165, cogs: 1572 },
  { day: '28 Oct', sales: 5680, profit: 1440, orders: 1040, cogs: 1408 },
  { day: '31 Oct', sales: 6490, profit: 1675, orders: 1190, cogs: 1609 },
]
type Metric = 'sales' | 'profit' | 'orders' | 'cogs'
const METRIC_COLOR: Record<Metric, string> = { sales: '#2563EB', profit: '#10B981', orders: '#6366F1', cogs: '#F59E0B' }

const PNL = [
  { en: 'Net operating profit', ar: 'صافي الربح التشغيلي', value: 42441.48, pct: 25.4, color: '#10B981' },
  { en: 'Custody & operating expenses', ar: 'العهد والمصروفات التشغيلية', value: 51154.95, pct: 30.6, color: '#3B82F6' },
  { en: 'Food cost (COGS)', ar: 'تكلفة الأغذية (COGS)', value: 41438.86, pct: 24.8, color: '#F59E0B' },
  { en: 'Salaries, rent & commissions', ar: 'الرواتب والإيجارات والعمولات', value: 32056.87, pct: 19.2, color: '#6366F1' },
]
const CHANNEL_MIX = [
  { en: 'Shop Sales', ar: 'مبيعات المحل', value: 58972.29, pct: 35.3, color: '#2563EB' },
  { en: 'Talabat (Go + MP)', ar: 'طلبات (جو + ماركت)', value: 62603.46, pct: 37.5, color: '#F97316' },
  { en: 'Keeta', ar: 'كيتا', value: 35607.98, pct: 21.3, color: '#10B981' },
  { en: 'Deliveroo, Ordable & others', ar: 'ديليفرو وأوردابل وباقي القنوات', value: 9908.43, pct: 5.9, color: '#8B5CF6' },
]

type Priority = 'top' | 'high' | 'medium'
const RECS: {
  id: string
  priority: Priority
  deptEn: string; deptAr: string
  issueEn: string; issueAr: string
  fixEn: string; fixAr: string
  impact: number
}[] = [
  {
    id: 'REC-01', priority: 'top',
    deptEn: 'Delivery apps (Keeta & Talabat)', deptAr: 'تطبيقات التوصيل (كيتا وطلبات)',
    issueEn: 'Drink attach rate on Keeta (6,267 orders) is only 4.8% and on Talabat Go 12.7%, against 41.2% in the shop.',
    issueAr: 'نسبة طلب المشروبات في كيتا (6,267 طلباً) 4.8% فقط وفي طلبات جو 12.7% مقابل 41.2% في المحل.',
    fixEn: 'Add a mandatory drink choice to combo meals on both platforms to lift the rate to 25%.',
    fixAr: 'إضافة خطوة اختيار مشروب إجبارية ضمن وجبات الكومبو في المنصتين لرفع النسبة إلى 25%.',
    impact: 2450,
  },
  {
    id: 'REC-02', priority: 'top',
    deptEn: 'Promotional discount control', deptAr: 'ضبط الخصومات التسويقية',
    issueEn: 'Keeta runs an 8.2% discount rate: KWD 3,180 of the KWD 4,152 total company discounts.',
    issueAr: 'كيتا تستهلك خصومات بنسبة 8.2% (3,180 د.ك من أصل 4,152 د.ك إجمالي خصومات الشركة).',
    fixEn: 'Stop the open menu-wide discount on Keeta and replace it with bundle offers capped at 3.5%.',
    fixAr: 'إيقاف الخصم المفتوح على المنيو في كيتا واستبداله بعروض وجبات مجمّعة بسقف خصم 3.5%.',
    impact: 1620,
  },
  {
    id: 'REC-03', priority: 'high',
    deptEn: 'Qurain central kitchen (food cost)', deptAr: 'المطبخ المركزي بالقرين (تكلفة الأغذية)',
    issueEn: 'Food cost drifted to 24.8% (KWD 41,438.856) from 24.0% because of chicken marinade waste.',
    issueAr: 'انحراف تكلفة الأغذية إلى 24.8% (41,438.856 د.ك) بدلاً من 24.0% نتيجة هدر تتبيل الدجاج.',
    fixEn: 'Pre-weigh marinade portions (140 g) and tie central-kitchen issues to daily POS sales.',
    fixAr: 'تطبيق وزن معياري مسبق لحصص التتبيل (140 جم) وربط صرف المطبخ المركزي بمبيعات نقاط البيع يومياً.',
    impact: 1336,
  },
  {
    id: 'REC-04', priority: 'high',
    deptEn: 'Maintenance & custody (Rabih)', deptAr: 'الصيانة والعهد (عهدة ربيع)',
    issueEn: 'Maintenance and custody spend reached KWD 10,707.930 from repeated fridge failures at Al-Kout and Salmiya.',
    issueAr: 'وصول مصاريف الصيانة والعهد إلى 10,707.930 د.ك بسبب تكرار أعطال ثلاجات فرعي الكوت والسالمية.',
    fixEn: 'Stop repeated cash repairs and approve a capital replacement (CapEx) of both fridges.',
    fixAr: 'إيقاف الصرف النقدي المتكرر على التصليح واعتماد استبدال رأسمالي (CapEx) للثلاجتين.',
    impact: 850,
  },
  {
    id: 'REC-05', priority: 'medium',
    deptEn: 'Menu engineering (364 items)', deptAr: 'هندسة المنيو (364 صنفاً)',
    issueEn: 'Only 32 items make 80% of sales while 332 items make 20% and add prep and storage waste.',
    issueAr: '32 صنفاً فقط تحقق 80% من المبيعات بينما 332 صنفاً تحقق 20% وترفع هدر التحضير والتخزين.',
    fixEn: 'Delist the weakest 45 items (under 20 orders a month) to ease prep pressure in Qurain and the branches.',
    fixAr: 'إلغاء أضعف 45 صنفاً (أقل من 20 طلباً بالشهر) لتخفيف ضغط التحضير في مطبخ القرين والفروع.',
    impact: 584,
  },
]
const PRIORITY_STYLE: Record<Priority, { cls: string; en: string; ar: string }> = {
  top: { cls: 'bg-rose-50 text-rose-700 border-rose-200', en: 'Top priority', ar: 'أولوية قصوى' },
  high: { cls: 'bg-amber-50 text-amber-800 border-amber-200', en: 'High', ar: 'عالية' },
  medium: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', en: 'Medium', ar: 'متوسطة' },
}

const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmt3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function Num({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span dir="ltr" className={`inline-block tabular-nums ${className}`}>{children}</span>
}

// Smooth path through points (Catmull-Rom converted to cubic Béziers)
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`
  }
  return d
}

export function AetherBiExecutiveDashboard({ locale: _unused }: { locale?: string }) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const T = (en: string, arText: string) => (ar ? arText : en)
  const kwd = (s: string) => (ar ? `${s} د.ك` : `KWD ${s}`)

  const [metric, setMetric] = useState<Metric>('sales')
  const [donut, setDonut] = useState<'pnl' | 'channels'>('pnl')

  const color = METRIC_COLOR[metric]
  const geo = useMemo(() => {
    const vals = DAILY_TREND.map((d) => d[metric])
    const maxV = Math.max(...vals) * 1.1
    const minV = Math.min(...vals) * 0.85
    const W = 760
    const H = 210
    const pts = DAILY_TREND.map((d, i) => ({
      x: (i / (DAILY_TREND.length - 1)) * W,
      y: H - ((d[metric] - minV) / (maxV - minV)) * (H - 34) - 16,
      label: d.day,
      value: d[metric],
    }))
    const line = smoothPath(pts)
    return { pts, line, area: `${line} L ${W},${H} L 0,${H} Z`, W, H }
  }, [metric])

  const donutData = donut === 'pnl' ? PNL : CHANNEL_MIX
  const segments = useMemo(() => {
    const r = 68
    const c = 2 * Math.PI * r
    let acc = 0
    return donutData.map((s) => {
      const seg = { ...s, r, dash: `${(s.pct / 100) * c} ${c}`, offset: -((acc / 100) * c) }
      acc += s.pct
      return seg
    })
  }, [donutData])

  const metricTabs: { id: Metric; en: string; ar: string }[] = [
    { id: 'sales', en: 'Sales', ar: 'المبيعات' },
    { id: 'profit', en: 'Net profit', ar: 'صافي الربح' },
    { id: 'orders', en: 'Orders', ar: 'الطلبات' },
    { id: 'cogs', en: 'Food cost', ar: 'تكلفة الأغذية' },
  ]
  const maxImpact = Math.max(...RECS.map((r) => r.impact))
  const boxed = 'rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm'
  const badge = 'rounded-full border px-2.5 py-0.5 text-xs font-bold'

  return (
    <div dir={ar ? 'rtl' : 'ltr'} lang={locale} className="mx-auto w-full max-w-[1550px] space-y-6 text-slate-900" style={ar ? { fontFamily: 'Cairo, Inter, system-ui, sans-serif' } : undefined}>
      {/* Header */}
      <div className={`${boxed} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>{T('Venture Foods Restaurant Management W.L.L. · Odoo data (2,213 journal entries)', 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م. · بيانات أودو (2,213 قيد يومي)')}</span>
          </div>
          <h1 className="mt-1 text-xl font-extrabold !text-slate-900 md:text-2xl">{T('Financial & Analytical Report and Recommendations', 'التقرير المالي والتحليلي ومحرك التوصيات')}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{T('6 brands, 11 sales channels and the Qurain central kitchen. Static data: browsing uses no AI tokens.', '6 علامات تجارية و11 قناة بيع ومطبخ القرين المركزي. بيانات ثابتة: التصفح لا يستهلك أي توكنات.')}</p>
        </div>
        <span className="self-start rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm lg:self-auto" style={{ color: '#FFFFFF' }}>{T('October 2026', 'أكتوبر 2026')}</span>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={boxed}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">{T('Net sales', 'صافي المبيعات المعتمدة')}</span>
            <span className={`${badge} border-emerald-200 bg-emerald-50 text-emerald-700`}><Num>▲ +14.8%</Num></span>
          </div>
          <div className="mt-2 text-2xl font-extrabold"><Num>{kwd(fmt3(NET_SALES))}</Num></div>
          <div className="mt-1 text-[12px] text-slate-500">
            <Num>{fmt0(ORDERS)}</Num> {T('orders', 'طلب')} · {T('average', 'المتوسط')} <Num>{kwd('5.471')}</Num>
          </div>
        </div>

        <div className={boxed}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">{T('Net operating profit', 'صافي الربح التشغيلي')}</span>
            <span className={`${badge} border-emerald-200 bg-emerald-50 text-emerald-700`}>{T('Margin', 'هامش')} <Num>{MARGIN}%</Num></span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600"><Num>{kwd(fmt3(NET_PROFIT))}</Num></div>
          <div className="mt-1 text-[12px] text-slate-500">{T('After food cost, custody and overheads', 'بعد خصم الأغذية والعهد والمصروفات')}</div>
        </div>

        <div className={boxed}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">{T('Food cost & custody', 'تكلفة الأغذية والعهد')}</span>
            <span className={`${badge} border-amber-200 bg-amber-50 text-amber-700`}>COGS <Num>24.8%</Num></span>
          </div>
          <div className="mt-2 text-2xl font-extrabold"><Num>{kwd(fmt3(COGS + CUSTODY))}</Num></div>
          <div className="mt-1 space-y-0.5 text-[12px] text-slate-500">
            <div>{T('Food cost (COGS)', 'تكلفة الأغذية')}: <Num>{kwd(fmt3(COGS))}</Num></div>
            <div>{T('Custody & expenses', 'عهد ومصروفات')}: <Num>{kwd(fmt3(CUSTODY))}</Num></div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 shadow-sm" style={{ color: '#FFFFFF' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: '#DBEAFE' }}>{T('Extra profit and savings from recommendations', 'إجمالي الربح والوفر المتاح من التوصيات')}</span>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold" style={{ color: '#FFFFFF' }}>{T('5 ready', '5 توصيات')}</span>
          </div>
          <div className="mt-2 text-2xl font-extrabold" style={{ color: '#FFFFFF' }}><Num>+{kwd(fmt3(RECS_TOTAL))}</Num></div>
          <div className="mt-1 text-[12px]" style={{ color: '#DBEAFE' }}>{T('per month', 'شهرياً')} · {T('profit would reach', 'يرفع الربح إلى')} <Num>{kwd(fmt3(NET_PROFIT + RECS_TOTAL))}</Num></div>
        </div>
      </div>

      {/* Area chart + donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={`${boxed} lg:col-span-2`}>
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold !text-slate-900">{T('Performance trend', 'منحنى الأداء المالي والطلبات')}</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{T('Sampled every 3 days (11 points), KWD', 'عينة كل 3 أيام (11 نقطة) بالدينار الكويتي')}</p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {metricTabs.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  className={`rounded-lg px-3 py-1.5 transition ${metric === m.id ? 'bg-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  style={metric === m.id ? { color: METRIC_COLOR[m.id] } : undefined}
                >
                  {T(m.en, m.ar)}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4" dir="ltr">
            <svg viewBox={`0 0 ${geo.W} ${geo.H + 28}`} className="h-56 w-full overflow-visible">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.2, 0.5, 0.8].map((r) => (
                <line key={r} x1={0} y1={geo.H * r} x2={geo.W} y2={geo.H * r} stroke="#F1F5F9" strokeWidth="1" />
              ))}
              <path d={geo.area} fill="url(#trendFill)" />
              <path d={geo.line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {geo.pts.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4.5" fill="#FFFFFF" stroke={color} strokeWidth="2.5" />
                  <text x={p.x} y={p.y - 10} textAnchor="middle" className="fill-slate-700 text-[10px] font-bold">{p.value.toLocaleString('en-US')}</text>
                  <text x={p.x} y={geo.H + 18} textAnchor="middle" className="fill-slate-400 text-[10px]">{p.label}</text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className={`${boxed} flex flex-col justify-between`}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-extrabold !text-slate-900">{T('Distribution', 'التوزيع النسبي')}</h2>
              <p className="text-[11px] text-slate-400">{T('Income statement or channels', 'حسب قائمة الدخل أو القنوات')}</p>
            </div>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button onClick={() => setDonut('pnl')} className={`rounded-lg px-2.5 py-1 ${donut === 'pnl' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{T('P&L', 'قائمة الدخل')}</button>
              <button onClick={() => setDonut('channels')} className={`rounded-lg px-2.5 py-1 ${donut === 'channels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{T('Channels', 'القنوات')}</button>
            </div>
          </div>
          <div className="relative my-2 flex items-center justify-center">
            <svg width="175" height="175" viewBox="0 0 180 180" className="-rotate-90">
              {segments.map((s, i) => (
                <circle key={i} cx="90" cy="90" r={s.r} fill="transparent" stroke={s.color} strokeWidth="20" strokeDasharray={s.dash} strokeDashoffset={s.offset} />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold text-slate-400">{T('Approved total', 'الإجمالي المعتمد')}</span>
              <span className="text-sm font-extrabold"><Num>{fmt0(NET_SALES)} KWD</Num></span>
              <span className="text-[10px] font-bold text-emerald-600"><Num>100%</Num></span>
            </div>
          </div>
          <div className="space-y-2">
            {donutData.map((s) => (
              <div key={s.en} className="flex items-center justify-between rounded-xl bg-slate-50/70 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold text-slate-700">{T(s.en, s.ar)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Num className="text-[11px] text-slate-500">{fmt0(s.value)} KWD</Num>
                  <Num className="w-12 text-end font-extrabold">{s.pct}%</Num>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className={`${boxed} space-y-4`}>
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold !text-slate-900">{T('Executive recommendations and profit levers', 'التوصيات التنفيذية وحلول رفع الربحية')}</h2>
            <p className="text-xs text-slate-500">
              {T('Ranked by monthly financial impact: profit from', 'مرتبة حسب الأثر المالي الشهري: رفع صافي الربح من')} <Num>{kwd(fmt3(NET_PROFIT))}</Num> {T('to', 'إلى')} <Num>{kwd(fmt3(NET_PROFIT + RECS_TOTAL))}</Num>
            </p>
          </div>
          <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-extrabold text-emerald-700">
            {T('Total extra profit and savings', 'إجمالي الوفر والربح الإضافي')}: <Num>+{fmt0(RECS_TOTAL)} {ar ? 'د.ك' : 'KWD'}</Num> {T('/ month', '/ شهرياً')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 font-bold text-slate-400">
                {[['Priority', 'الأولوية'], ['Area', 'القطاع / القسم'], ['Problem (with numbers)', 'المشكلة المرصودة بالأرقام'], ['Recommended action', 'الحل والتوصية التنفيذية'], ['Monthly impact', 'الأثر المالي الشهري']].map(([en, arT]) => (
                  <th key={en} className="px-2 py-2.5 text-start">{T(en, arT)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RECS.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-2 py-3"><span className={`${badge} ${PRIORITY_STYLE[r.priority].cls}`}>{T(PRIORITY_STYLE[r.priority].en, PRIORITY_STYLE[r.priority].ar)}</span></td>
                  <td className="whitespace-nowrap px-2 py-3 font-bold">{T(r.deptEn, r.deptAr)}</td>
                  <td className="max-w-md px-2 py-3 leading-relaxed text-slate-600">{T(r.issueEn, r.issueAr)}</td>
                  <td className="max-w-md px-2 py-3 font-semibold leading-relaxed text-slate-800">{T(r.fixEn, r.fixAr)}</td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-extrabold text-emerald-600"><Num>+{kwd(fmt0(r.impact))}</Num></span>
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((r.impact / maxImpact) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500">
          {T(
            'Monthly impact figures are management estimates, not values computed from Odoo; they assume each action is fully achieved.',
            'أرقام الأثر الشهري تقديرات إدارية وليست قيماً محسوبة من أودو، وتفترض تحقق كل إجراء بالكامل.',
          )}
        </p>
      </div>
    </div>
  )
}
