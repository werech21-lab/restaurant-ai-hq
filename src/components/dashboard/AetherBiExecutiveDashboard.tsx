'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { LineChartV2 } from '@/components/aether/ui'
import { RECS, type Priority } from '@/lib/analytics/recommendations'
import { DAILY_TREND_SAMPLE, SALES_TABS, salesTabHref, type SalesTabId } from '@/lib/analytics/sales-tabs'
import { CHANNELS, LEDGER, LEVERS_MONTHLY_TOTAL } from '@/lib/aether/ledger'

/* =========================================================================
   Ordable-style executive summary + recommendations engine.
   Pure SVG / CSS (no chart library) and no AI calls: every number is static
   data defined below, so browsing costs no tokens.
   Bilingual (ar | en) with matching direction (rtl | ltr).
   ========================================================================= */

// ---- Headline figures: live Odoo sync (whitelisted registers + posted accounting) ----
const NET_SALES = LEDGER.netSales
const ORDERS = LEDGER.orders
const AOV = LEDGER.aov
const NET_PROFIT = LEDGER.netProfit
const MARGIN = LEDGER.marginPct
const COGS = LEDGER.cogs
const COGS_PCT = LEDGER.cogsPct
const CUSTODY = LEDGER.opex
const MAINT_CUSTODY = LEDGER.maintCustody
const SALARIES_RENT_COMMISSION = LEDGER.depreciation
const SALARIES_PCT = Math.round((LEDGER.depreciation / LEDGER.revenue) * 1000) / 10
const DISCOUNTS = LEDGER.discounts
const DISCOUNTS_PCT = LEDGER.discountsPct
const RECS_TOTAL = LEVERS_MONTHLY_TOTAL

const REC_TAB_MAP: Record<string, SalesTabId> = {
  'REC-01': 'customer-channel',
  'REC-02': 'promotions',
  'REC-03': 'operation-performance',
  'REC-04': 'branches',
  'REC-05': 'products',
}

// Real Odoo daily sales and orders; profit and COGS apply the month's Odoo ratios to each day.
const DAILY_TREND = DAILY_TREND_SAMPLE.map((d) => ({
  day: d.day,
  sales: d.sales,
  orders: d.orders,
  profit: Math.round(d.sales * (LEDGER.marginPct / 100)),
  cogs: Math.round(d.sales * (LEDGER.cogsPct / 100)),
}))
type Metric = 'sales' | 'profit' | 'orders' | 'cogs'
const METRIC_COLOR: Record<Metric, string> = { sales: '#0284C7', profit: '#059669', orders: '#0F172A', cogs: '#D97706' }

const pctOfRev = (v: number) => Math.round((v / LEDGER.revenue) * 1000) / 10
const PNL = [
  { en: 'Net operating profit', ar: 'صافي الربح التشغيلي', value: LEDGER.netProfit, pct: pctOfRev(LEDGER.netProfit), color: '#059669' },
  { en: 'Operating expenses', ar: 'المصروفات التشغيلية', value: LEDGER.opex, pct: pctOfRev(LEDGER.opex), color: '#0284C7' },
  { en: 'Food cost (COGS)', ar: 'تكلفة الأغذية', value: LEDGER.cogs, pct: pctOfRev(LEDGER.cogs), color: '#D97706' },
  { en: 'Depreciation', ar: 'الإهلاك', value: LEDGER.depreciation, pct: pctOfRev(LEDGER.depreciation), color: '#0F172A' },
]
const chSum = (ids: string[]) => CHANNELS.filter((c) => ids.includes(c.id)).reduce((x, c) => x + c.sales, 0)
const CH_SHOP = chSum(['shop', 'staff'])
const CH_TALABAT = chSum(['talabat-tgo', 'talabat-tmp'])
const CH_KEETA = chSum(['keeta'])
const CH_OTHER = LEDGER.netSales - CH_SHOP - CH_TALABAT - CH_KEETA
const pctOfNet = (v: number) => Math.round((v / LEDGER.netSales) * 1000) / 10
const CHANNEL_MIX = [
  { en: 'Shop Sales', ar: 'مبيعات المحل', value: CH_SHOP, pct: pctOfNet(CH_SHOP), color: '#0F172A' },
  { en: 'Talabat (Tgo + TMP)', ar: 'طلبات (Tgo و TMP)', value: CH_TALABAT, pct: pctOfNet(CH_TALABAT), color: '#D97706' },
  { en: 'Keeta', ar: 'كيتا', value: CH_KEETA, pct: pctOfNet(CH_KEETA), color: '#059669' },
  { en: 'Deliveroo, Jahez, Snoonu & online links', ar: 'ديليفرو وجاهز وسنونو وروابط الدفع', value: CH_OTHER, pct: pctOfNet(CH_OTHER), color: '#0284C7' },
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
            <span>{T('Venture Foods Restaurant Management W.L.L. · live Odoo sync (whitelisted POS registers)', 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م. · مزامنة أودو المباشرة (سجلات نقاط البيع المعتمدة)')}</span>
          </div>
          <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-50 md:text-2xl">{T('Financial & Analytical Report and Recommendations', 'التقرير المالي والتحليلي ومحرك التوصيات')}</h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{T(`6 Brands • ${LEDGER.branches} Branches • ${LEDGER.channels} Channels plus exhibitions and school canteens. Browsing uses no AI tokens.`, `6 مطاعم • ${LEDGER.branches} فروع • ${LEDGER.channels} قنوات إضافة إلى المعارض والمقاصف المدرسية. التصفح لا يستهلك أي توكنات.`)}</p>
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
            <span className={`${badge} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300`}><Num>Odoo POS</Num></span>
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
            <div>{T('Posted Odoo revenue after food cost, operating expenses and depreciation', 'الإيراد المرحّل في أودو بعد تكلفة الأغذية والمصروفات والإهلاك')}</div>
            <div>{T('Depreciation', 'الإهلاك')}: <Num>{kwd(fmt3(SALARIES_RENT_COMMISSION))}</Num> (<Num>{SALARIES_PCT}%</Num>)</div>
          </div>
        </div>

        <div className={boxed}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{T('Food cost & operating expenses', 'تكلفة الأغذية والمصروفات')}</span>
            <span className={`${badge} bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300`}>COGS <Num>{COGS_PCT}%</Num></span>
          </div>
          <div className="mt-2 break-words text-lg font-extrabold leading-tight sm:text-xl xl:text-[22px]"><Num>{kwd(fmt3(COGS + CUSTODY))}</Num></div>
          <div className="mt-1 space-y-0.5 text-[12px] text-slate-500 dark:text-slate-400">
            <div>{T('Food cost (COGS)', 'تكلفة الأغذية (COGS)')}: <Num>{kwd(fmt3(COGS))}</Num> (<Num>{COGS_PCT}%</Num>)</div>
            <div>{T('Operating expenses', 'المصروفات التشغيلية')}: <Num>{kwd(fmt3(CUSTODY))}</Num></div>
            <div>{T('Maintenance custody (expense records)', 'عهدة الصيانة (سجلات المصروفات)')}: <Num>{kwd(fmt3(MAINT_CUSTODY))}</Num></div>
          </div>
        </div>

        <div className="ae-hero-ocean ae-lift min-w-0 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="ae-hero-muted text-xs font-semibold">{T('Extra profit and savings from recommendations', 'إجمالي الربح والوفر المتاح من التوصيات')}</span>
            <span className="ae-hero-chip whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold">{T(`${RECS.length} ready`, `${RECS.length} توصيات`)}</span>
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
              <p className="mt-0.5 text-xs text-slate-400">{T(`Odoo daily totals (${DAILY_TREND.length} days), KWD`, `إجماليات أودو اليومية (${DAILY_TREND.length} يوماً) بالدينار الكويتي`)}</p>
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
              <p className="text-xs text-slate-400">{T('Income statement or channels', 'حسب قائمة الدخل أو القنوات')}</p>
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
              <span className="text-xs font-semibold text-slate-400">{T('Approved total', 'الإجمالي المعتمد')}</span>
              <span className="text-xs font-extrabold"><Num>{kwd(fmt3(NET_SALES))}</Num></span>
              <span className="text-xs font-bold text-emerald-600"><Num>100%</Num></span>
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
                  <Num className="text-xs text-slate-500 dark:text-slate-400">{kwd(fmt3(s.value))}</Num>
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
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {T(
            'Monthly impact figures are management estimates, not values computed from Odoo; they assume each action is fully achieved.',
            'أرقام الأثر الشهري تقديرات إدارية وليست قيماً محسوبة من أودو، وتفترض تحقق كل إجراء بالكامل.',
          )}
        </p>
      </div>
    </div>
  )
}
