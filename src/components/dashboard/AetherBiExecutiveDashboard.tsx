'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { LineChartV2 } from '@/components/aether/ui'
import { RECS, type Priority } from '@/lib/analytics/recommendations'
import { SALES_TABS, salesTabHref, type SalesTabId } from '@/lib/analytics/sales-tabs'

/* =========================================================================
   Ordable-style executive summary + recommendations engine.
   Pure SVG / CSS (no chart library) and no AI calls: every number is static
   data defined below, so browsing costs no tokens.
   Bilingual (ar | en) with matching direction (rtl | ltr).
   ========================================================================= */

// ---- Headline figures (as supplied) ---------------------------------------
const NET_SALES = 167092.16
const ORDERS = 30540
const AOV = 5.471
const NET_PROFIT = 42441.48
const MARGIN = 25.4
const COGS = 41438.856
const COGS_PCT = 24.8
const CUSTODY = 51154.95
const MAINT_CUSTODY = 10707.93
const SALARIES_RENT_COMMISSION = 32056.874
const SALARIES_PCT = 19.2
const DISCOUNTS = 4152
const DISCOUNTS_PCT = 2.4
const RECS_TOTAL = 6840

const REC_TAB_MAP: Record<string, SalesTabId> = {
  'REC-01': 'customer-channel',
  'REC-02': 'promotions',
  'REC-03': 'operation-performance',
  'REC-04': 'branches',
  'REC-05': 'products',
}

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
const METRIC_COLOR: Record<Metric, string> = { sales: '#0284C7', profit: '#059669', orders: '#0F172A', cogs: '#D97706' }

const PNL = [
  { en: 'Net operating profit', ar: 'صافي الربح التشغيلي', value: 42441.48, pct: 25.4, color: '#059669' },
  { en: 'Custody & operating expenses', ar: 'العهد والمصروفات التشغيلية', value: 51154.95, pct: 30.6, color: '#0284C7' },
  { en: 'Food cost (COGS)', ar: 'تكلفة الأغذية (COGS)', value: 41438.856, pct: 24.8, color: '#D97706' },
  { en: 'Salaries, rent & commissions', ar: 'الرواتب والإيجارات والعمولات', value: 32056.874, pct: 19.2, color: '#0F172A' },
]
const CHANNEL_MIX = [
  { en: 'Shop Sales', ar: 'مبيعات المحل', value: 58953.09, pct: 35.3, color: '#0F172A' },
  { en: 'Talabat (Tgo + TMP)', ar: 'طلبات (Tgo + TMP)', value: 62603.46, pct: 37.5, color: '#D97706' },
  { en: 'Keeta', ar: 'كيتا', value: 35607.98, pct: 21.3, color: '#059669' },
  { en: 'Deliveroo, Ordable & others', ar: 'ديليفرو وأوردابل وباقي القنوات', value: 9927.63, pct: 5.9, color: '#0284C7' },
]

const PRIORITY_STYLE: Record<Priority, { cls: string; en: string; ar: string }> = {
  top: { cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', en: 'Top priority', ar: 'أولوية قصوى' },
  high: { cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300', en: 'High', ar: 'عالية' },
  medium: { cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300', en: 'Medium', ar: 'متوسطة' },
}

const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmt3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function Num({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span dir="ltr" className={`inline-block tabular-nums ${className}`}>{children}</span>
}


export function AetherBiExecutiveDashboard({ locale: _unused }: { locale?: string }) {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  const T = (en: string, arText: string) => (ar ? arText : en)
  const kwd = (s: string) => (ar ? `${s} د.ك` : `KWD ${s}`)

  const [metric, setMetric] = useState<Metric>('sales')
  const [donut, setDonut] = useState<'pnl' | 'channels'>('pnl')

  const color = METRIC_COLOR[metric]

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
  const boxed = 'ae-tile min-w-0 rounded-2xl p-5'
  const badge = 'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold'

  return (
    <div dir={ar ? 'rtl' : 'ltr'} lang={locale} className="ae-stagger w-full min-w-0 space-y-6 text-slate-900 dark:text-slate-100" style={ar ? { fontFamily: 'Cairo, Inter, system-ui, sans-serif' } : undefined}>
      {/* Header */}
      <div className="ae-masthead flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>{T('Venture Foods Restaurant Management W.L.L. · Odoo data (2,213 journal entries)', 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م. · بيانات أودو (2,213 قيد يومي)')}</span>
          </div>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-50 md:text-2xl">{T('Financial & Analytical Report and Recommendations', 'التقرير المالي والتحليلي ومحرك التوصيات')}</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{T('6 brands, 11 sales channels, 9 active branches and the central kitchen. Static data: browsing uses no AI tokens.', '6 علامات تجارية و11 قناة بيع و9 فروع نشطة والمطبخ المركزي. بيانات ثابتة: التصفح لا يستهلك أي توكنات.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <Link href="/erp/sales-scorecard" className="ae-pill-light ae-pill-sm">
            {T('Sales & items analyses (8 sections)', 'تحليل المبيعات والأصناف (8 أقسام)')}
          </Link>
          <Link href="/erp/menu-engineering" className="ae-pill-light ae-pill-sm">
            {T('Menu engineering', 'هندسة المنيو')}
          </Link>
          <span className="ae-pill-dark ae-pill-sm">{T('October 2026', 'أكتوبر 2026')}</span>
        </div>
      </div>

      {/* Quick navigation: segmented pills to the 8 tabs of /erp/sales-scorecard */}
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{T('Quick access', 'انتقال سريع')}</span>
        <nav aria-label={T('Sales analysis sections', 'أقسام تحليل المبيعات')} className="ae-tabs">
          {SALES_TABS.map((t) => (
            <Link key={t.id} href={salesTabHref(t.id)}>
              {ar ? t.ar : t.en}
            </Link>
          ))}
        </nav>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
        <div className={boxed}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{T('Net sales', 'صافي المبيعات المعتمدة')}</span>
            <span className={`${badge} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300`}><Num>▲ +14.8%</Num></span>
          </div>
          <div className="mt-2 break-words text-lg font-extrabold leading-tight sm:text-xl xl:text-[22px]"><Num>{kwd(fmt3(NET_SALES))}</Num></div>
          <div className="mt-1 space-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            <div><Num>{fmt0(ORDERS)}</Num> {T('orders', 'طلباً')} · {T('average', 'متوسط الطلب')} <Num>{kwd(fmt3(AOV))}</Num></div>
            <div>{T('Discounts', 'الخصومات')}: <Num>{kwd(fmt0(DISCOUNTS))}</Num> (<Num>{DISCOUNTS_PCT}%</Num>)</div>
          </div>
        </div>

        <div className={boxed}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{T('Net operating profit', 'صافي الربح التشغيلي')}</span>
            <span className={`${badge} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300`}>{T('Margin', 'هامش')} <Num>{MARGIN}%</Num></span>
          </div>
          <div className="mt-2 break-words text-lg font-extrabold leading-tight text-emerald-600 sm:text-xl xl:text-[22px]"><Num>{kwd(fmt3(NET_PROFIT))}</Num></div>
          <div className="mt-1 space-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            <div>{T('After food cost, custody and overheads', 'بعد خصم الأغذية والعهد والمصروفات')}</div>
            <div>{T('Salaries, rent & commissions', 'الرواتب والإيجارات والعمولات')}: <Num>{kwd(fmt3(SALARIES_RENT_COMMISSION))}</Num> (<Num>{SALARIES_PCT}%</Num>)</div>
          </div>
        </div>

        <div className={boxed}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{T('Food cost & custody', 'تكلفة الأغذية والعهد')}</span>
            <span className={`${badge} bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300`}>COGS <Num>{COGS_PCT}%</Num></span>
          </div>
          <div className="mt-2 break-words text-lg font-extrabold leading-tight sm:text-xl xl:text-[22px]"><Num>{kwd(fmt3(COGS + CUSTODY))}</Num></div>
          <div className="mt-1 space-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            <div>{T('Food cost (COGS)', 'تكلفة الأغذية (COGS)')}: <Num>{kwd(fmt3(COGS))}</Num> (<Num>{COGS_PCT}%</Num>)</div>
            <div>{T('Custody & operating expenses', 'العهد والمصروفات التشغيلية')}: <Num>{kwd(fmt3(CUSTODY))}</Num></div>
            <div>{T('Incl. maintenance custody', 'شاملة عهدة الصيانة')}: <Num>{kwd(fmt3(MAINT_CUSTODY))}</Num></div>
          </div>
        </div>

        <div className="ae-hero-ocean ae-lift min-w-0 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="ae-hero-muted text-xs font-semibold">{T('Extra profit and savings from recommendations', 'إجمالي الربح والوفر المتاح من التوصيات')}</span>
            <span className="ae-hero-chip whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold">{T('5 ready', '5 توصيات')}</span>
          </div>
          <div className="mt-2 break-words text-lg font-extrabold leading-tight sm:text-xl xl:text-[22px]"><Num>+{kwd(fmt3(RECS_TOTAL))}</Num></div>
          <div className="ae-hero-muted mt-1 text-[12px]">{T('per month', 'شهرياً')} · {T('profit would reach', 'يرفع الربح إلى')} <Num>{kwd(fmt3(NET_PROFIT + RECS_TOTAL))}</Num></div>
        </div>
      </div>

      {/* Area chart + donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className={`${boxed} lg:col-span-2`}>
          <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-700 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50">{T('Performance trend', 'منحنى الأداء المالي والطلبات')}</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{T('Sampled every 3 days (11 points), KWD', 'عينة كل 3 أيام (11 نقطة) بالدينار الكويتي')}</p>
            </div>
            <div className="ae-seg flex-wrap" role="group">
              {metricTabs.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  data-active={metric === m.id ? 'true' : 'false'}
                  aria-pressed={metric === m.id}
                >
                  {T(m.en, m.ar)}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <LineChartV2
              series={[{ key: metric, color, values: DAILY_TREND.map((d) => d[metric]), area: true }]}
              xLabels={DAILY_TREND.map((d) => d.day)}
              heightClass="h-[230px] lg:h-[260px]"
              pointLabels
              formatValue={(n) => fmt0(n)}
              maxTicks={11}
            />
          </div>
        </div>

        <div className={`${boxed} flex flex-col justify-between`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-50">{T('Distribution', 'التوزيع النسبي')}</h2>
              <p className="text-[11px] text-slate-400">{T('Income statement or channels', 'حسب قائمة الدخل أو القنوات')}</p>
            </div>
            <div className="ae-seg" role="group">
              <button type="button" onClick={() => setDonut('pnl')} data-active={donut === 'pnl' ? 'true' : 'false'} aria-pressed={donut === 'pnl'}>{T('P&L', 'قائمة الدخل')}</button>
              <button type="button" onClick={() => setDonut('channels')} data-active={donut === 'channels' ? 'true' : 'false'} aria-pressed={donut === 'channels'}>{T('Channels', 'القنوات')}</button>
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
              <span className="text-xs font-extrabold"><Num>{kwd(fmt3(NET_SALES))}</Num></span>
              <span className="text-[10px] font-bold text-emerald-600"><Num>100%</Num></span>
            </div>
          </div>
          <div className="space-y-2">
            {donutData.map((s) => (
              <div key={s.en} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl bg-slate-50/70 dark:bg-slate-900/60 px-3 py-1.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{T(s.en, s.ar)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Num className="text-[11px] text-slate-500 dark:text-slate-400">{kwd(fmt3(s.value))}</Num>
                  <Num className="w-12 text-end font-extrabold">{s.pct}%</Num>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className={`${boxed} space-y-4`}>
        <div className="flex flex-col gap-2 border-b border-slate-100 dark:border-slate-700 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">{T('Executive recommendations and profit levers', 'التوصيات التنفيذية وحلول رفع الربحية')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {T('Ranked by monthly financial impact: profit from', 'مرتبة حسب الأثر المالي الشهري: رفع صافي الربح من')} <Num>{kwd(fmt3(NET_PROFIT))}</Num> {T('to', 'إلى')} <Num>{kwd(fmt3(NET_PROFIT + RECS_TOTAL))}</Num>
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            {T('Total extra profit and savings', 'إجمالي الوفر والربح الإضافي')}: <Num>+{fmt0(RECS_TOTAL)} {ar ? 'د.ك' : 'KWD'}</Num> {T('/ month', '/ شهرياً')}
          </span>
        </div>
        <div className="w-full overflow-x-auto rounded-xl ring-1 ring-slate-200/70 dark:ring-slate-800">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-500 dark:text-slate-300">
                {[['Priority', 'الأولوية'], ['Area', 'القطاع / القسم'], ['Problem (with numbers)', 'المشكلة المرصودة بالأرقام'], ['Recommended action', 'الحل والتوصية التنفيذية'], ['Monthly impact', 'الأثر المالي الشهري'], ['Analysis', 'التحليل']].map(([en, arT]) => (
                  <th key={en} className="whitespace-nowrap px-3.5 py-3 text-start">{T(en, arT)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {RECS.map((r) => (
                <tr key={r.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/60">
                  <td className="whitespace-nowrap px-3.5 py-3"><span className={`${badge} ${PRIORITY_STYLE[r.priority].cls}`}>{T(PRIORITY_STYLE[r.priority].en, PRIORITY_STYLE[r.priority].ar)}</span></td>
                  <td className="whitespace-nowrap px-3.5 py-3 font-bold">{T(r.deptEn, r.deptAr)}</td>
                  <td className="min-w-[260px] max-w-md px-3.5 py-3 leading-relaxed text-slate-600 dark:text-slate-300">{T(r.issueEn, r.issueAr)}</td>
                  <td className="min-w-[260px] max-w-md px-3.5 py-3 font-semibold leading-relaxed text-slate-800 dark:text-slate-100">{T(r.fixEn, r.fixAr)}</td>
                  <td className="whitespace-nowrap px-3.5 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-extrabold text-emerald-600"><Num>+{kwd(fmt0(r.impact))}</Num></span>
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((r.impact / maxImpact) * 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3">
                    <Link
                      href={salesTabHref(REC_TAB_MAP[r.id] ?? 'core-sales')}
                      className="ae-pill-light ae-pill-sm"
                    >
                      {T('Open tab', 'عرض القسم')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {T(
            'Monthly impact figures are management estimates, not values computed from Odoo; they assume each action is fully achieved.',
            'أرقام الأثر الشهري تقديرات إدارية وليست قيماً محسوبة من أودو، وتفترض تحقق كل إجراء بالكامل.',
          )}
        </p>
      </div>
    </div>
  )
}
