'use client'

import React, { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { LineChartV2 } from '@/components/aether/ui'
import { DAILY_TREND_SAMPLE } from '@/lib/analytics/sales-tabs'
import { RECS, RECS_TOTAL_KWD } from '@/lib/analytics/recommendations'
import { BRANDS_DATA } from '@/lib/analytics/sales-core-data'
import { ALL_BRANDS, ALL_CHANNELS, PAYMENT_SPLIT, TOTAL_NET, TOTAL_ORDERS, WEEKDAYS, channelDeliveryMode, computeBranches, computeHeat, hourShare, weekdayLabelAr, type SalesFilter, type SalesView } from '@/lib/analytics/sales-view'

/* Tab bodies for /erp/sales-scorecard. Pure CSS/SVG, no chart library, no AI calls.
   Where the project has no data for something the request asked for, the panel
   says so instead of showing an invented chart. */

const BLUE = '#0284C7'
const GREY = '#9CA3AF'
const card = 'bg-white dark:bg-[#111827] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-none ring-1 ring-slate-200/70 dark:ring-slate-800 p-5 min-w-0 overflow-x-auto transition-all'
const thc = 'py-3.5 px-4 text-start text-xs md:text-[13px] font-bold text-slate-700 dark:text-slate-200 tracking-tight bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800 whitespace-nowrap'
const tdc = 'py-3.5 px-4 text-start text-[13.5px] md:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed'
const tdn = 'py-3.5 px-4 text-end text-[13.5px] md:text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100 leading-relaxed whitespace-nowrap'

const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmt1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

export function ChannelModeBadge({ channel }: { channel: string }) {
  const mode = channelDeliveryMode(channel)
  if (mode === 'Tgo') {
    return (
      <span
        dir="ltr"
        title="Talabat Go (Platform Delivery / توصيل المنصة)"
        className="inline-flex items-center bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 ring-1 ring-amber-500/20 px-2.5 py-0.5 rounded-md font-bold text-xs"
      >
        Tgo
      </span>
    )
  }
  if (mode === 'TMP' || mode === 'M') {
    return (
      <span
        dir="ltr"
        title="Marketplace (Restaurant Delivery / توصيل المطعم)"
        className="inline-flex items-center bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 ring-1 ring-sky-500/20 px-2.5 py-0.5 rounded-md font-bold text-xs"
      >
        TMP
      </span>
    )
  }
  return null
}

function Num({ children }: { children: React.ReactNode }) {
  return <span dir="ltr" className="inline-block tabular-nums">{children}</span>
}

function useT() {
  const { locale } = useI18n()
  const ar = locale === 'ar'
  return { ar, locale, T: (en: string, arText: string) => (ar ? arText : en) }
}

function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3">
      <div className="text-[15px] md:text-base font-bold text-slate-900">{title}</div>
      {sub && <div className="text-xs font-semibold text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function Kpi({ label, value, note, tone = 'text-slate-900' }: { label: string; value: React.ReactNode; note?: string; tone?: string }) {
  return (
    <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className={`text-lg sm:text-xl xl:text-[22px] font-extrabold mt-1 tabular-nums break-words leading-tight ${tone}`}>{value}</div>
      {note && <div className="text-xs font-semibold text-slate-500 mt-1">{note}</div>}
    </div>
  )
}

function Pending({ title, body }: { title: string; body: string }) {
  return (
    <div className="ae-tile-soft rounded-2xl p-4">
      <div className="text-sm font-bold text-slate-800">{title}</div>
      <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">{body}</p>
    </div>
  )
}

interface Tip { title: string; lines: string[] }
interface Row { key: string; label: string; badge?: React.ReactNode; value: number; text: string; color: string; sub?: string; tip?: Tip }
function Bars({ rows, labelW = 155 }: { rows: Row[]; labelW?: number }) {
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.key} tabIndex={r.tip ? 0 : undefined} className="group relative grid items-center gap-2.5 text-[13px] font-medium outline-none hover:z-50 focus:z-50" style={{ gridTemplateColumns: `${labelW}px 1fr` }}>
          {r.tip && <HoverTip title={r.tip.title} lines={r.tip.lines} />}
          <span className="flex items-center justify-between gap-1.5 truncate text-slate-800 font-semibold">
            <span className="truncate">{r.label}</span>
            {r.badge}
          </span>
          <div className="flex items-center gap-2">
            <div style={{ height: 18, width: `${(r.value / max) * 78}%`, minWidth: 2, background: r.color }} className="rounded-xs" />
            <span className="font-bold text-slate-900 text-[13px]"><Num>{r.text}</Num></span>
            {r.sub && <span className="text-slate-600 font-semibold text-xs"><Num>{r.sub}</Num></span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function RecTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="ae-table-wrap w-full overflow-x-auto rounded-xl ring-1 ring-slate-200/70 dark:ring-slate-800">
      <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
        <thead className="bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800">
          <tr>{head.map((h) => <th key={h} className={thc}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150">
              {r.map((c, j) => <td key={j} className={j === 0 ? tdc + ' font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap' : tdc}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


/* ------------------------------------------------------------------ core */
export function HoverTip({ title, lines }: Tip) {
  // "Label: value" lines are split so the label is muted and the number is bold and dark
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute start-28 top-full z-[9999] mt-1 hidden min-w-[215px] rounded-xl bg-white px-3.5 py-2.5 text-xs opacity-100 shadow-xl ring-1 ring-slate-200 group-hover:block group-focus:block"
      style={{ backgroundColor: '#FFFFFF', color: '#0F172A', opacity: 1, zIndex: 9999 }}
    >
      <div className="mb-1.5 border-b border-slate-100 pb-1.5 text-xs font-bold text-slate-950" style={{ color: '#0F172A', borderColor: '#F1F5F9' }}>{title}</div>
      {lines.map((l) => {
        const i = l.indexOf(': ')
        const label = i > 0 ? l.slice(0, i) : l
        const value = i > 0 ? l.slice(i + 2) : ''
        return (
          <div key={l} className="mt-1 flex items-baseline justify-between gap-4">
            <span className="text-xs font-medium text-slate-600" style={{ color: '#475569' }}>{label}</span>
            {value && <span dir="ltr" className="font-bold tabular-nums text-slate-950" style={{ color: '#0F172A' }}>{value}</span>}
          </div>
        )
      })}
    </div>
  )
}

const seriesOf = (k: 'sales' | 'orders' | 'aov') => DAILY_TREND_SAMPLE.map((d) => (k === 'sales' ? d.sales : k === 'orders' ? d.orders : d.sales / d.orders))

export function Spark({ series, color = BLUE }: { series: 'sales' | 'orders' | 'aov'; color?: string }) {
  const pts = seriesOf(series)
  const W = 260, H = 36
  const max = Math.max(...pts), min = Math.min(...pts), range = Math.max(1e-9, max - min)
  const coords = pts.map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * (H - 10) - 5).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-9 w-full overflow-visible" aria-hidden style={{ direction: "ltr" }}>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" points={coords} />
    </svg>
  )
}

type Gran = 'day' | 'week' | 'month'
export function DailyCurve({ ratio = 1 }: { ratio?: number }) {
  const { T, ar } = useT()
  const [gran, setGran] = React.useState<Gran>('day')
  const series = useMemo(() => {
    if (gran === 'day') return DAILY_TREND_SAMPLE.map((d) => ({ l: d.day, v: Math.round(d.sales * ratio) }))
    const buckets = new Map<number, number[]>()
    DAILY_TREND_SAMPLE.forEach((d) => {
      const w = Math.floor((parseInt(d.day, 10) - 1) / 7)
      buckets.set(w, [...(buckets.get(w) ?? []), d.sales * ratio])
    })
    return [...buckets.entries()].map(([w, vs]) => ({
      l: `${w * 7 + 1}–${Math.min(w * 7 + 7, 31)} Oct`,
      v: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length),
    }))
  }, [gran, ratio])
  const all = DAILY_TREND_SAMPLE.map((d) => d.sales * ratio)
  const avg = all.reduce((a, b) => a + b, 0) / all.length
  const tabs: [Gran, string, string][] = [['day', 'Day', 'يوم'], ['week', 'Week', 'أسبوع'], ['month', 'Month', 'شهر']]
  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Title
          title={T('Sales trend', 'منحنى المبيعات')}
          sub={T('Sampled every 3 days (11 points), KWD. Week and month views average the sampled days; they are not totals.', 'عينة كل 3 أيام (11 نقطة) بالدينار. عرض الأسبوع والشهر متوسط للأيام المعروضة وليس إجمالياً.')}
        />
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[11px] font-semibold">
          {tabs.map(([k, en, arT]) => (
            <button key={k} type="button" onClick={() => setGran(k)} className={`rounded-md px-3 py-1 ${gran === k ? 'bg-white shadow-sm' : 'text-gray-500'}`} style={gran === k ? { color: BLUE } : undefined}>
              {T(en, arT)}
            </button>
          ))}
        </div>
      </div>
      {gran === 'month' ? (
        <div className="grid grid-cols-3 gap-3 py-6 text-center">
          <div><div className="text-[11px] text-gray-500">{T('Average per sampled day', 'متوسط اليوم المعروض')}</div><div className="mt-1 text-xl font-bold text-gray-900"><Num>{fmt0(avg)} {ar ? 'د.ك' : 'KWD'}</Num></div></div>
          <div><div className="text-[11px] text-gray-500">{T('Lowest sampled day', 'أدنى يوم معروض')}</div><div className="mt-1 text-xl font-bold text-gray-900"><Num>{fmt0(Math.min(...all))} {ar ? 'د.ك' : 'KWD'}</Num></div></div>
          <div><div className="text-[11px] text-gray-500">{T('Highest sampled day', 'أعلى يوم معروض')}</div><div className="mt-1 text-xl font-bold text-gray-900"><Num>{fmt0(Math.max(...all))} {ar ? 'د.ك' : 'KWD'}</Num></div></div>
        </div>
      ) : (
        <LineChartV2
          series={[{ key: 'sales', color: BLUE, values: series.map((p) => p.v), area: true }]}
          xLabels={series.map((p) => p.l)}
          heightClass="h-[220px] lg:h-[250px]"
          pointLabels
          formatValue={(n) => fmt0(n)}
          maxTicks={11}
        />
      )}
    </div>
  )
}

export function RevenueConcentration() {
  const { T } = useT()
  return (
    <div className={card}>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-medium text-gray-500">{T('Revenue concentration', 'تركّز الإيرادات')}</span>
        <span className="font-bold text-gray-900">{T('Top 32 of 364 items = 80% of sales', 'أعلى 32 صنفاً من أصل 364 = 80% من المبيعات')}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100" dir="ltr">
        <div className="h-full rounded-full" style={{ width: '80%', background: BLUE }} />
      </div>
      <div className="mt-1 text-[10px] text-gray-400">{T('332 items generate only the remaining 20% of sales.', '332 صنفاً فقط تحقق الـ 20% المتبقية من المبيعات.')}</div>
    </div>
  )
}

export function NeedsAttention() {
  const { T, ar } = useT()
  const sorted = [...RECS].sort((a, b) => b.impact - a.impact)
  return (
    <div className={card}>
      <Title
        title={T('Needs attention', 'توصيات تتطلب الانتباه')}
        sub={T(`Ranked by monthly impact, total +KWD ${fmt0(RECS_TOTAL_KWD)} (management estimates)`, `مرتبة حسب الأثر الشهري، الإجمالي +${fmt0(RECS_TOTAL_KWD)} د.ك (تقديرات إدارية)`)}
      />
      <ul className="space-y-2">
        {sorted.map((r) => (
          <li key={r.id} className="rounded-md border border-gray-100 border-s-[3px] border-s-rose-600 bg-rose-50/40 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold text-gray-900">{ar ? r.deptAr : r.deptEn}</span>
              <span className="whitespace-nowrap text-[11px] font-bold text-emerald-700"><Num>+{fmt0(r.impact)} {ar ? 'د.ك' : 'KWD'}</Num></span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-gray-600">{ar ? r.issueAr : r.issueEn}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------ customer by channel */
export interface ChannelView { key: string; label: string; orders: number; sales: number; discPct: number; drinksPct: number }
const DONUT = ['#0F172A', '#0284C7', '#059669', '#D97706', '#E11D48', '#0891B2', '#0F766E', '#64748B', '#38BDF8', '#94A3B8', '#CBD5E1']

export function ChannelMix({ channels, selectedChannel = ALL_CHANNELS }: { channels: ChannelView[]; selectedChannel?: string }) {
  const { T } = useT()
  const total = channels.reduce((a, c) => a + c.sales, 0)
  const segs = useMemo(() => {
    const r = 60, c = 2 * Math.PI * r
    let acc = 0
    return channels.map((ch, i) => {
      const pct = (ch.sales / total) * 100
      const s = { ch, pct, color: DONUT[i % DONUT.length], dash: `${(pct / 100) * c} ${c}`, off: -(acc / 100) * c, r }
      acc += pct
      return s
    })
  }, [channels, total])
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className={card}>
        <Title
          title={T('Orders by channel', 'عدد الطلبات حسب القناة')}
          sub={T('Customer counts per channel are not in the dataset, so orders are shown. Grey = fewer than 200 orders.', 'أعداد العملاء لكل قناة غير متوفرة في البيانات، لذلك تُعرض الطلبات. الرمادي = أقل من 200 طلب.')}
        />
        <Bars
          labelW={170}
          rows={channels.map((c) => ({
            key: c.key,
            label: c.label,
            badge: <ChannelModeBadge channel={c.key} />,
            value: c.orders,
            text: fmt0(c.orders),
            color: selectedChannel !== ALL_CHANNELS ? (c.key === selectedChannel ? '#1D4ED8' : '#BFDBFE') : c.orders < 200 ? GREY : BLUE,
            tip: {
              title: c.label,
              lines: [
                `${T('Orders', 'الطلبات')}: ${fmt0(c.orders)}`,
                `${T('Net sales', 'صافي المبيعات')}: ${fmt0(c.sales)} ${T('KWD', 'د.ك')}`,
                `${T('Discount rate', 'نسبة الخصم')}: ${c.discPct.toFixed(1)}%`,
                `${T('Drinks %', 'المشروبات %')}: ${c.drinksPct.toFixed(1)}%`,
              ],
            },
          }))}
        />
      </div>
      <div className={card}>
        <Title title={T('Share of net sales by channel', 'حصة كل قناة من صافي المبيعات')} sub={T('Share of the channel rows shown (Tgo & TMP separated)', 'من مجموع صفوف القنوات المعروضة (مع فصل Tgo و TMP)')} />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90 shrink-0">
            {segs.map((s) => <circle key={s.ch.key} cx="75" cy="75" r={s.r} fill="none" stroke={s.color} strokeWidth="22" strokeDasharray={s.dash} strokeDashoffset={s.off} />)}
          </svg>
          <ul className="w-full space-y-1.5 text-[13px]">
            {segs.map((s) => (
              <li key={s.ch.key} className={`flex items-center justify-between gap-2 ${selectedChannel !== ALL_CHANNELS ? (s.ch.key === selectedChannel ? 'font-bold text-slate-900' : 'opacity-50') : ''}`}>
                <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span>{s.ch.label}</span>
                  <ChannelModeBadge channel={s.ch.key} />
                </span>
                <span className="font-bold text-slate-900"><Num>{s.pct.toFixed(1)}%</Num></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function ChannelRecs({ channels }: { channels: ChannelView[] }) {
  const { T, ar } = useT()
  const shop = channels.find((c) => c.key === 'Shop Sales')
  const target = ['Keeta', 'Talabat Go']
  const rows = channels.filter((c) => target.includes(c.key)).map((c) => [
    <span key="lbl" className="inline-flex items-center gap-1.5">{c.label} <ChannelModeBadge channel={c.key} /></span>,
    <Num key="a">{c.drinksPct.toFixed(1)}%</Num>,
    <Num key="b">{shop ? shop.drinksPct.toFixed(1) : '—'}%</Num>,
    <Num key="c">{shop ? fmt1(shop.drinksPct - c.drinksPct) : '—'}</Num>,
    c.key === 'Keeta'
      ? T('Add a mandatory drink choice to combo meals and feature the combo at the top of the menu.', 'أضف خطوة اختيار مشروب إجبارية ضمن الكومبو واعرض الكومبو في أعلى القائمة.')
      : T('Show a drink add-on in the cart step and pair the best-selling combos with a drink.', 'اعرض إضافة مشروب في سلة الطلب واربط الكومبو الأكثر مبيعاً بمشروب.'),
  ])
  return (
    <div className={card}>
      <Title title={T('Drinks attach-rate recommendation', 'توصية رفع المشروبات')} sub={T('Gap against the shop baseline, in percentage points. The target of 25% is a management assumption.', 'الفجوة مقابل المحل بالنقاط المئوية. الهدف 25% افتراض إداري.')} />
      <RecTable head={[T('Channel', 'القناة'), T('Drinks %', 'المشروبات %'), T('Shop baseline %', 'مرجع المحل %'), T('Gap (pts)', 'الفجوة (نقطة)'), T('Action', 'الإجراء')]} rows={rows} />
      <p className="mt-2 text-xs font-medium text-slate-600">{ar ? 'الأثر المالي المقدّر لهذه التوصية موجود في الملخص المالي (تقدير إداري).' : 'The estimated financial impact of this action is on the financial summary (management estimate).'}</p>
    </div>
  )
}

/* ---------------------------------------------------------- new customers */
export function NewCustomerTab({ view }: { view: SalesView }) {
  const { T, ar } = useT()
  // Customer figures were supplied for the whole group; with a filter on they are scaled pro rata to the selection's orders.
  const f = view.ratioOrders
  const active = Math.round(21480 * f)
  const fresh = Math.round(6874 * f)
  const repeat = active - fresh
  const groupAov = TOTAL_NET / TOTAL_ORDERS
  const aovF = groupAov > 0 && view.avgOrder > 0 ? view.avgOrder / groupAov : 1
  const aovNew = 5.12 * aovF
  const aovRep = 5.68 * aovF
  const newPct = active > 0 ? (fresh / active) * 100 : 0
  const money = (n: number) => (ar ? `${fmt3(n)} د.ك` : `KWD ${fmt3(n)}`)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-4 items-stretch">
        <Kpi label={T('Active customers', 'إجمالي العملاء النشطين')} value={<Num>{fmt0(active)}</Num>} note={T('Customers', 'عميل')} />
        <Kpi label={T('First-time customers', 'العملاء الجدد لأول مرة')} value={<Num>{fmt0(fresh)}</Num>} note={T(`${fmt1(newPct)}% of active`, `${fmt1(newPct)}% من النشطين`)} />
        <Kpi label={T('Repeat customers', 'العملاء المتكررون')} value={<Num>{fmt0(repeat)}</Num>} note={T(`${fmt1(100 - newPct)}% of active`, `${fmt1(100 - newPct)}% من النشطين`)} />
        <Kpi label={T('New customer avg order', 'متوسط طلب العميل الجديد')} value={<Num>{money(aovNew)}</Num>} />
        <Kpi label={T('Repeat customer avg order', 'متوسط طلب العميل المتكرر')} value={<Num>{money(aovRep)}</Num>} />
        <Kpi label={T('Second-purchase rate', 'معدل العودة للشراء الثاني')} value={<Num>41.5%</Num>} tone="text-emerald-700" />
      </div>
      <p className="text-xs font-medium text-slate-600">
        {view.isFiltered
          ? T('Customer figures were supplied for the whole group; for this selection they are scaled pro rata to its orders and its average order, so they are estimates.', 'أرقام العملاء مقدّمة للمجموعة كاملة؛ وفي هذا التحديد تُحسب بالتناسب مع طلباته ومتوسط فاتورته، لذلك هي تقديرات.')
          : T('Customer figures were supplied with the request; the project dataset has no customer-level records yet.', 'أرقام العملاء مقدّمة مع الطلب؛ ولا توجد في بيانات المشروع بعد سجلات على مستوى العميل.')}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={card}>
          <Title title={T('New vs repeat customers', 'العملاء الجدد مقابل المتكررين')} sub={T(`Of ${fmt0(active)} active customers`, `من أصل ${fmt0(active)} عميلاً نشطاً`)} />
          <div className="flex h-5 w-full overflow-hidden rounded" dir="ltr">
            <div style={{ width: `${newPct}%`, background: BLUE }} title={fmt0(fresh)} />
            <div style={{ width: `${100 - newPct}%`, background: '#0D9488' }} title={fmt0(repeat)} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-4 text-[13px] font-semibold text-slate-800">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} />{T('New', 'جدد')} · <Num>{fmt0(fresh)}</Num> (<Num>{fmt1(newPct)}%</Num>)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#0D9488' }} />{T('Repeat', 'متكررون')} · <Num>{fmt0(repeat)}</Num> (<Num>{fmt1(100 - newPct)}%</Num>)</span>
          </div>
        </div>
        <div className={card}>
          <Title title={T('Average order: new vs repeat', 'متوسط الطلب: الجديد مقابل المتكرر')} />
          <Bars labelW={130} rows={[
            { key: 'n', label: T('New customer', 'عميل جديد'), value: aovNew, text: fmt3(aovNew), color: BLUE },
            { key: 'r', label: T('Repeat customer', 'عميل متكرر'), value: aovRep, text: fmt3(aovRep), color: '#0D9488' },
          ]} />
          <p className="mt-2 text-xs font-medium text-slate-600">{T(`A repeat customer spends KWD ${fmt3(aovRep - aovNew)} more per order (about 10.9%).`, `العميل المتكرر ينفق ${fmt3(aovRep - aovNew)} د.ك أكثر في الطلب (حوالي 10.9%).`)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Pending
          title={T('New vs repeat customers by channel', 'توزيع العملاء الجدد مقابل المتكررين حسب القناة')}
          body={T(
            'Needs the customer on each order (partner id on pos.order) and the date of the first order. It cannot be derived from channel totals, so no chart is drawn until that feed is connected.',
            'يحتاج إلى ربط العميل بكل طلب في نقاط البيع وتاريخ أول طلب له. لا يمكن اشتقاقه من إجماليات القنوات، لذلك لا يُرسم شارت قبل ربط هذه التغذية.',
          )}
        />
        <Pending
          title={T('New-customer acquisition rate by brand', 'نسبة اكتساب العملاء الجدد حسب العلامة التجارية')}
          body={T(
            'Same requirement: first-order date per customer, split by brand. Pending the Odoo customer feed.',
            'المتطلب نفسه: تاريخ أول طلب لكل عميل موزعاً حسب العلامة. بانتظار تغذية العملاء من أودو.',
          )}
        />
      </div>
      <div className={card}>
        <Title title={T('Turning new Keeta and Talabat customers into regulars', 'تحويل عملاء كيتا وطلبات الجدد إلى عملاء دائمين')} />
        <RecTable
          head={[T('Step', 'الخطوة'), T('Channel', 'القناة'), T('Action', 'الإجراء'), T('Why', 'السبب')]}
          rows={[
            [T('1. First order', '1. الطلب الأول'), 'Keeta · Talabat', T('Include a printed card with a direct-ordering offer in every first delivery.', 'ضع بطاقة مطبوعة بعرض الطلب المباشر في كل توصيلة أولى.'), T('Moves the customer to a channel with no platform commission.', 'ينقل العميل إلى قناة بلا عمولة منصة.')],
            [T('2. Second order', '2. الطلب الثاني'), 'Keeta · Talabat', T('Offer a free drink on the second order instead of a percentage discount.', 'قدّم مشروباً مجانياً في الطلب الثاني بدل الخصم النسبي.'), T('Keeps discounts low and lifts the drink attach rate.', 'يبقي الخصومات منخفضة ويرفع نسبة المشروبات.')],
            [T('3. Habit', '3. التعوّد'), T('All delivery apps', 'كل تطبيقات التوصيل'), T('Feature the top combos first on the menu and keep photos and descriptions current.', 'اعرض أفضل الكومبو أولاً في القائمة وحدّث الصور والأوصاف.'), T('Repeat customers spend more per order (5.680 vs 5.120).', 'العميل المتكرر ينفق أكثر للطلب (5.680 مقابل 5.120).')],
            [T('4. Measure', '4. القياس'), T('All channels', 'كل القنوات'), T('Connect the customer id on each order so repeat rate can be tracked per channel.', 'اربط معرّف العميل في كل طلب لتتبع نسبة التكرار لكل قناة.'), T('Without it the charts above stay empty.', 'بدونه تبقى الشارتات أعلاه فارغة.')],
          ]}
        />
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- promotions */
export interface PromoChannel { key: string; label: string; sales: number; discPct: number; kwd?: number }
export interface PromoBrand { key: string; label: string; discPct: number }

export function PromotionsTab({ channels, brands, totalDiscounts, totalNet, selectedChannel = ALL_CHANNELS, selectedBrand = ALL_BRANDS }: { channels: PromoChannel[]; brands: PromoBrand[]; totalDiscounts: number; totalNet: number; selectedChannel?: string; selectedBrand?: string }) {
  const { T, ar } = useT()
  // discount KWD: explicit allocation when provided, otherwise net * r / (1 - r)
  const withKwd = channels.map((c) => ({ ...c, kwd: c.kwd ?? (c.sales * (c.discPct / 100)) / (1 - c.discPct / 100) }))
  const sortedPct = [...withKwd].sort((a, b) => b.discPct - a.discPct)
  const sumKwd = withKwd.reduce((a, c) => a + c.kwd, 0)
  const topBrand = [...brands].sort((a, b) => b.discPct - a.discPct)[0]
  const keeta = withKwd.find((c) => c.key === 'Keeta')
  const snoonu = withKwd.find((c) => c.key === 'Snoonu')
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-4 items-stretch">
        <Kpi label={T('Total discounts', 'إجمالي الخصومات')} value={<Num>{ar ? `${fmt0(totalDiscounts)} د.ك` : `KWD ${fmt0(totalDiscounts)}`}</Num>} />
        <Kpi label={T('Share of sales', 'نسبتها من المبيعات')} value={<Num>{totalNet + totalDiscounts > 0 ? ((totalDiscounts / (totalNet + totalDiscounts)) * 100).toFixed(1) : '0.0'}%</Num>} />
        <Kpi label={T('Highest by value: Keeta', 'الأعلى قيمة خصم: كيتا')} value={<Num>{keeta ? `${keeta.discPct.toFixed(1)}%` : '—'}</Num>} note={keeta ? `${fmt0(keeta.kwd)} ${ar ? 'د.ك' : 'KWD'}` : undefined} tone="text-rose-700" />
        <Kpi label={T('Snoonu rate', 'نسبة سنونو')} value={<Num>{snoonu ? `${snoonu.discPct.toFixed(1)}%` : '—'}</Num>} note={snoonu ? `${fmt0(snoonu.kwd)} ${ar ? 'د.ك' : 'KWD'}` : undefined} tone="text-amber-700" />
        <Kpi label={T('Highest brand', 'أعلى علامة خصماً')} value={<Num>{topBrand ? `${topBrand.discPct.toFixed(1)}%` : '—'}</Num>} note={topBrand?.label} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={card}>
          <Title title={T('Discount rate by channel (%)', 'نسبة الخصم حسب القناة (%)')} sub={T('Red above 5%', 'الأحمر فوق 5%')} />
          <Bars labelW={170} rows={sortedPct.map((c) => ({ key: c.key, label: c.label, badge: <ChannelModeBadge channel={c.key} />, value: c.discPct, text: `${c.discPct.toFixed(1)}%`, color: selectedChannel !== ALL_CHANNELS ? (c.key === selectedChannel ? '#1D4ED8' : '#BFDBFE') : c.discPct > 5 ? '#DC2626' : BLUE, tip: { title: c.label, lines: [`${T('Discount rate', 'نسبة الخصم')}: ${c.discPct.toFixed(1)}%`, `${T('Discount value', 'قيمة الخصم')}: ${ar ? `${fmt2(c.kwd)} د.ك` : `KWD ${fmt2(c.kwd)}`}`, `${T('Net sales', 'صافي المبيعات')}: ${ar ? `${fmt2(c.sales)} د.ك` : `KWD ${fmt2(c.sales)}`}`] } }))} />
        </div>
        <div className={card}>
          <Title title={T('Discount value by channel (KWD)', 'قيمة الخصم حسب القناة (د.ك)')} sub={T('Pro-rata to the official total', 'موزعة تناسبياً على الإجمالي الرسمي')} />
          <Bars labelW={170} rows={[...withKwd].sort((a, b) => b.kwd - a.kwd).map((c) => ({ key: c.key, label: c.label, badge: <ChannelModeBadge channel={c.key} />, value: c.kwd, text: fmt0(c.kwd), color: selectedChannel !== ALL_CHANNELS ? (c.key === selectedChannel ? '#1D4ED8' : '#BFDBFE') : c.discPct > 5 ? '#DC2626' : BLUE, tip: { title: c.label, lines: [`${T('Discount value', 'قيمة الخصم')}: ${ar ? `${fmt2(c.kwd)} د.ك` : `KWD ${fmt2(c.kwd)}`}`, `${T('Discount rate', 'نسبة الخصم')}: ${c.discPct.toFixed(1)}%`, `${T('Net sales', 'صافي المبيعات')}: ${ar ? `${fmt2(c.sales)} د.ك` : `KWD ${fmt2(c.sales)}`}`] } }))} />
          <p className="mt-2 text-xs font-medium text-slate-600">
            {selectedChannel !== ALL_CHANNELS || selectedBrand !== ALL_BRANDS
              ? T('Filtered view: channel discounts are re-scaled to the selected brand (rate scaled by the brand against the group rate); the selected channel is highlighted.', 'عرض مفلتر: خصومات القنوات معاد تناسبها مع العلامة المختارة (النسبة مضروبة في نسبة العلامة إلى متوسط المجموعة)، والقناة المختارة مظللة.')
              : Math.abs(sumKwd - 4152) < 0.01
              ? T('Channel discounts are allocated pro-rata from the channel rates so they add up exactly to the official KWD 4,152 (2.4%). Whatsapp shows a high rate on only 3 orders.', 'خصومات القنوات موزعة تناسبياً من نسب القنوات بحيث يطابق مجموعها الإجمالي الرسمي 4,152 د.ك (2.4%). واتساب يظهر نسبة مرتفعة على 3 طلبات فقط.')
              : T(`The channel rows add up to KWD ${fmt0(sumKwd)}, which does not match the reported total of KWD 4,152.`, `مجموع صفوف القنوات ${fmt0(sumKwd)} د.ك وهو لا يطابق الإجمالي المعتمد 4,152 د.ك.`)}
            </p>
        </div>
      </div>
      <div className={card}>
        <Title title={T('Discount rate by brand (%)', 'نسبة الخصم حسب العلامة التجارية (%)')} sub={T('Red above 3%', 'الأحمر فوق 3%')} />
        <Bars labelW={150} rows={[...brands].sort((a, b) => b.discPct - a.discPct).map((b) => ({ key: b.key, label: b.label, value: b.discPct, text: `${b.discPct.toFixed(1)}%`, color: selectedBrand !== ALL_BRANDS ? (b.key === selectedBrand ? '#1D4ED8' : '#BFDBFE') : b.discPct > 3 ? '#DC2626' : BLUE, tip: { title: b.label, lines: [`${T('Discount rate', 'نسبة الخصم')}: ${b.discPct.toFixed(1)}%`] } }))} />
      </div>
      <Pending
        title={T('Combo offers vs direct percentage discount', 'العائد من عروض الكومبو مقابل الخصم المئوي المباشر')}
        body={T(
          'Needs sales split by promotion type (combo, voucher, platform discount) from Odoo. The dataset only holds the total discount per channel, so no comparison is drawn.',
          'يحتاج إلى المبيعات موزعة حسب نوع العرض (كومبو، قسيمة، خصم منصة) من أودو. تحتوي البيانات على إجمالي الخصم لكل قناة فقط، لذلك لا تُرسم مقارنة.',
        )}
      />
      <div className={card}>
        <Title title={T('Stopping the discount bleed', 'إيقاف نزيف الخصومات')} />
        <RecTable
          head={[T('Target', 'الهدف'), T('Finding', 'الملاحظة'), T('Action', 'الإجراء'), T('Estimated monthly effect', 'الأثر الشهري التقديري')]}
          rows={[
            ['Keeta', T(`${keeta ? keeta.discPct.toFixed(1) : '—'}% discount rate, about KWD ${keeta ? fmt0(keeta.kwd) : '—'} of the total.`, `نسبة خصم ${keeta ? keeta.discPct.toFixed(1) : '—'}% وحوالي ${keeta ? fmt0(keeta.kwd) : '—'} د.ك من الإجمالي.`), T('Stop the open menu-wide discount; use bundle offers capped at 3.5%.', 'أوقف الخصم المفتوح على المنيو واستعمل عروض حزم بسقف 3.5%.'), <Num key="k">+1,620 {ar ? 'د.ك' : 'KWD'}</Num>],
            ['Snoonu', T(`${snoonu ? snoonu.discPct.toFixed(1) : '—'}% discount rate on a small channel.`, `نسبة خصم ${snoonu ? snoonu.discPct.toFixed(1) : '—'}% على قناة صغيرة.`), T('Cap at 3.5% and review the active promotions.', 'ضع سقفاً 3.5% وراجع العروض الفعالة.'), '—'],
            [topBrand?.label ?? '—', T('Highest brand discount rate.', 'أعلى نسبة خصم بين العلامات.'), T('Replace flat percentage discounts with a free drink above a basket threshold.', 'استبدل الخصم النسبي بمشروب مجاني فوق حد معيّن للسلة.'), '—'],
          ]}
        />
        <p className="mt-2 text-xs font-medium text-slate-600">{T('KWD 1,620 is a management estimate that assumes the action is fully achieved.', '1,620 د.ك تقدير إداري يفترض تحقق الإجراء بالكامل.')}</p>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- branches */
const BRAND_NAME_AR: Record<string, string> = {
  'China Garden': 'تشاينا جاردن',
  "Frank's": 'فرانكس',
  Tahina: 'شاورما طحينة',
  'Farm Brown': 'فارم براون',
  'The Noodle Bar': 'ذا نودل بار',
  'Karak Cafeteria': 'كرك كافتيريا',
}

export function BranchesTab({ filter }: { filter: SalesFilter }) {
  const { T, ar } = useT()
  const rows = useMemo(() => computeBranches(filter), [filter])
  const maxNet = Math.max(...rows.map((r) => r.net), 1)
  const sumNet = rows.reduce((a, r) => a + r.net, 0)
  const sumOrders = rows.reduce((a, r) => a + r.orders, 0)
  const sumShopNet = rows.reduce((a, r) => a + r.shopNet, 0)
  const sumShopOrders = rows.reduce((a, r) => a + r.shopOrders, 0)
  const sumTgoNet = rows.reduce((a, r) => a + r.tgoNet, 0)
  const sumTgoOrders = rows.reduce((a, r) => a + r.tgoOrders, 0)
  const sumMNet = rows.reduce((a, r) => a + r.mNet, 0)
  const sumMOrders = rows.reduce((a, r) => a + r.mOrders, 0)
  const sumOtherNet = rows.reduce((a, r) => a + r.otherNet, 0)
  const sumOtherOrders = rows.reduce((a, r) => a + r.otherOrders, 0)
  const sumTgoAcc = rows.reduce((a, r) => a + r.tgoAccountsCount, 0)
  const sumMAcc = rows.reduce((a, r) => a + r.mAccountsCount, 0)
  const unit = ar ? 'د.ك' : 'KWD'
  const bLabel = (bn: string) => (ar ? BRAND_NAME_AR[bn] ?? bn : bn)
  const name = (r: { nameAr: string; nameEn: string }) => (ar ? r.nameAr : r.nameEn)
  const scope = filter.brand === ALL_BRANDS && filter.channel === ALL_CHANNELS ? T('All brands, all channels', 'كل العلامات وكل القنوات') : `${filter.brand === ALL_BRANDS ? T('All brands', 'كل العلامات') : bLabel(filter.brand)} · ${filter.channel === ALL_CHANNELS ? T('All channels', 'كل القنوات') : filter.channel}`
  return (
    <div className="space-y-4">
      {/* 4 Channel Bucket Summary Cards across the 9 Actual Operational Branches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
          <div className="text-xs font-semibold text-slate-600">{T('Shop Sales across 9 branches', 'مبيعات المحل في الفروع التسعة')}</div>
          <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 mt-1 tabular-nums break-words leading-tight">
            <Num>{ar ? `${fmt2(sumShopNet)} د.ك` : `KWD ${fmt2(sumShopNet)}`}</Num>
          </div>
          <div className="text-xs font-semibold text-slate-500 mt-1">
            <Num>{fmt0(sumShopOrders)}</Num> {T('storefront orders', 'طلب محل مباشر')}
          </div>
        </div>

        <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700">{T('Tgo Sales (Platform Delivery)', 'مبيعات Tgo (توصيل المنصة)')}</span>
            <ChannelModeBadge channel="Talabat Go" />
          </div>
          <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-amber-700 mt-1 tabular-nums break-words leading-tight">
            <Num>{ar ? `${fmt2(sumTgoNet)} د.ك` : `KWD ${fmt2(sumTgoNet)}`}</Num>
          </div>
          <div className="text-xs font-semibold text-slate-600 mt-1">
            <Num>{fmt0(sumTgoOrders)}</Num> {T('Talabat Go orders', 'طلب عبر حسابات Tgo')} · <Num>{sumTgoAcc}</Num> {T('Tgo accounts', 'حساب Tgo')}
          </div>
        </div>

        <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{T('TMP Sales (Restaurant Delivery)', 'مبيعات TMP (توصيل المطعم)')}</span>
            <ChannelModeBadge channel="Talabat MP" />
          </div>
          <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-sky-700 dark:text-sky-400 mt-1 tabular-nums break-words leading-tight">
            <Num>{ar ? `${fmt2(sumMNet)} د.ك` : `KWD ${fmt2(sumMNet)}`}</Num>
          </div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
            <Num>{fmt0(sumMOrders)}</Num> {T('Talabat TMP + Deliveroo TMP orders', 'طلب عبر حسابات TMP')} · <Num>{sumMAcc}</Num> {T('TMP accounts', 'حساب TMP')}
          </div>
        </div>

        <div className="ae-tile ae-lift rounded-2xl p-4 min-w-0">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">{T('Other Platforms (Keeta, Deliveroo Core, etc.)', 'باقي المنصات (كيتا، ديليفرو كور، أوردابل...)')}</div>
          <div className="text-lg sm:text-xl xl:text-[22px] font-extrabold text-slate-900 dark:text-slate-100 mt-1 tabular-nums break-words leading-tight">
            <Num>{ar ? `${fmt2(sumOtherNet)} د.ك` : `KWD ${fmt2(sumOtherNet)}`}</Num>
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            <Num>{fmt0(sumOtherOrders)}</Num> {T('orders on other channels', 'طلب على باقي القنوات')}
          </div>
        </div>
      </div>

      <div className={card}>
        <Title
          title={T('Net sales by actual restaurant branch (9 operational branches)', 'صافي المبيعات حسب الفرع الفعلي للمطعم (9 فروع تشغيلية)')}
          sub={`${T('Only the 9 actual operational branches of Venture Foods (excluding residential customer areas)', 'فقط الفروع التسعة الفعلية لشركة فنتشر فودز (دون خلطها بمناطق سكن الزبائن)')} · ${scope}`}
        />
        <Bars
          labelW={235}
          rows={rows.map((r) => ({
            key: r.code,
            label: name(r),
            value: r.net,
            text: fmt0(r.net),
            sub: unit,
            color: r.net > 0 ? BLUE : GREY,
            tip: {
              title: name(r),
              lines: [
                `${T('Shop Sales', 'مبيعات المحل')}: ${ar ? `${fmt2(r.shopNet)} د.ك` : `KWD ${fmt2(r.shopNet)}`} (${fmt0(r.shopOrders)})`,
                `${T('Tgo Sales', 'مبيعات Tgo')}: ${ar ? `${fmt2(r.tgoNet)} د.ك` : `KWD ${fmt2(r.tgoNet)}`} (${fmt0(r.tgoOrders)})`,
                `${T('TMP Sales', 'مبيعات TMP')}: ${ar ? `${fmt2(r.mNet)} د.ك` : `KWD ${fmt2(r.mNet)}`} (${fmt0(r.mOrders)})`,
                `${T('Other Platforms', 'باقي المنصات')}: ${ar ? `${fmt2(r.otherNet)} د.ك` : `KWD ${fmt2(r.otherNet)}`} (${fmt0(r.otherOrders)})`,
                `${T('Total net sales', 'إجمالي صافي المبيعات')}: ${ar ? `${fmt3(r.net)} د.ك` : `KWD ${fmt3(r.net)}`}`,
                `${T('Total orders', 'إجمالي الطلبات')}: ${fmt0(r.orders)}`,
                `${T('Share', 'الحصة')}: ${fmt1(r.share)}%`,
              ],
            },
          }))}
        />
      </div>

      <div className={card}>
        <Title
          title={T('Actual Restaurant Branches — Detailed Breakdown (Shop Sales | Tgo | TMP | Other Platforms)', 'تفصيل الفروع الفعلية للمطعم — مقسّمة حسب (مبيعات المحل | Tgo | TMP | باقي المنصات)')}
          sub={T('The 9 actual operational restaurant branches of Venture Foods with sales & orders split across Shop Sales, Tgo (Talabat Go), TMP (Talabat Marketplace), and Other Platforms.', 'الفروع التشغيلية التسعة المعتمدة للمطعم مع تقسيم واضح لمبيعات وطلبات كل فرع إلى: مبيعات المحل، ومبيعات Tgo، ومبيعات TMP، وباقي المنصات.')}
        />
        <div className="ae-table-wrap w-full overflow-x-auto rounded-xl ring-1 ring-slate-200/70 dark:ring-slate-800">
          <table className="w-full text-[13.5px] md:text-sm border-collapse bg-white dark:bg-[#111827]">
            <thead className="sticky top-0 bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className={thc}>{T('Actual Restaurant Branch', 'الفرع الفعلي للمطعم')}</th>
                <th className={thc}>{T('Zone Accounts (Tgo / TMP)', 'حسابات التغطية (Tgo / TMP)')}</th>
                <th className={thc + ' text-end'}>{T('Shop Sales (Orders)', 'مبيعات المحل (الطلبات)')}</th>
                <th className={thc + ' text-end'}>
                  <span className="inline-flex items-center gap-1">{T('Tgo Sales (Orders)', 'مبيعات Tgo (الطلبات)')} <ChannelModeBadge channel="Talabat Go" /></span>
                </th>
                <th className={thc + ' text-end'}>
                  <span className="inline-flex items-center gap-1">{T('TMP Sales (Orders)', 'مبيعات TMP (الطلبات)')} <ChannelModeBadge channel="Talabat MP" /></span>
                </th>
                <th className={thc + ' text-end'}>{T('Other Platforms (Orders)', 'باقي المنصات (الطلبات)')}</th>
                <th className={thc + ' text-end'}>{T('Total Net (KWD)', 'إجمالي المبيعات (د.ك)')}</th>
                <th className={thc + ' text-end'}>{T('Total Orders', 'إجمالي الطلبات')}</th>
                <th className={thc + ' text-end'}>{T('Avg Order', 'متوسط الفاتورة')}</th>
                <th className={thc + ' text-end'}>{T('Share', 'الحصة')}</th>
                <th className={thc}>{T('Brands Run', 'العلامات المشغّلة')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {rows.map((r) => (
                <tr key={r.code} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150 ${r.net > 0 ? '' : 'opacity-50'}`}>
                  <td className={tdc + ' font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap'}>{name(r)}</td>
                  <td className={tdc + ' whitespace-nowrap'}>
                    <div className="inline-flex items-center gap-1.5">
                      <span dir="ltr" className="inline-flex items-center bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 ring-1 ring-amber-500/20 px-2.5 py-0.5 rounded-md font-bold text-xs">
                        {r.tgoAccountsCount} Tgo
                      </span>
                      <span dir="ltr" className="inline-flex items-center bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 ring-1 ring-sky-500/20 px-2.5 py-0.5 rounded-md font-bold text-xs">
                        {r.mAccountsCount} TMP
                      </span>
                    </div>
                  </td>
                  <td className={tdn}>
                    {r.shopNet > 0 ? (
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100"><Num>{fmt2(r.shopNet)}</Num></div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400"><Num>({fmt0(r.shopOrders)})</Num></div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className={tdn + ' bg-amber-50/30 dark:bg-amber-950/20'}>
                    {r.tgoNet > 0 ? (
                      <div>
                        <div className="font-bold text-amber-900 dark:text-amber-200"><Num>{fmt2(r.tgoNet)}</Num></div>
                        <div className="text-xs font-medium text-amber-700 dark:text-amber-400"><Num>({fmt0(r.tgoOrders)})</Num></div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className={tdn + ' bg-sky-50/40 dark:bg-sky-950/20'}>
                    {r.mNet > 0 ? (
                      <div>
                        <div className="font-bold text-sky-900 dark:text-sky-200"><Num>{fmt2(r.mNet)}</Num></div>
                        <div className="text-xs font-medium text-sky-700 dark:text-sky-400"><Num>({fmt0(r.mOrders)})</Num></div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className={tdn}>
                    {r.otherNet > 0 ? (
                      <div>
                        <div className="font-bold text-slate-900"><Num>{fmt2(r.otherNet)}</Num></div>
                        <div className="text-xs font-medium text-slate-500"><Num>({fmt0(r.otherOrders)})</Num></div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className={tdn}>
                    <div className="flex items-center gap-2 justify-end">
                      <span dir="ltr" className="font-extrabold text-slate-900">{r.net > 0 ? fmt3(r.net) : '—'}</span>
                      <div className="h-2.5 w-16 bg-slate-100 rounded-xs overflow-hidden"><div style={{ width: `${(r.net / maxNet) * 100}%`, height: '100%', background: BLUE }} /></div>
                    </div>
                  </td>
                  <td className={tdn + ' font-bold'}>{r.net > 0 ? fmt0(r.orders) : '—'}</td>
                  <td className={tdn}>{r.net > 0 ? fmt3(r.avgOrder) : '—'}</td>
                  <td className={tdn}>{r.net > 0 ? fmt1(r.share) + '%' : '—'}</td>
                  <td className={tdc + ' text-xs font-medium text-slate-700'}>{r.brands.map(bLabel).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                <td className={tdc + ' font-extrabold'}>{T('Total (9 Actual Branches)', 'الإجمالي (9 فروع فعلية)')}</td>
                <td className={tdc}>
                  <span dir="ltr" className="text-xs font-bold text-slate-700">{sumTgoAcc} Tgo + {sumMAcc} TMP</span>
                </td>
                <td className={tdn}>
                  <div><Num>{fmt2(sumShopNet)}</Num></div>
                  <div className="text-xs font-semibold text-slate-600"><Num>({fmt0(sumShopOrders)})</Num></div>
                </td>
                <td className={tdn + ' text-amber-900 bg-amber-50/50'}>
                  <div><Num>{fmt2(sumTgoNet)}</Num></div>
                  <div className="text-xs font-semibold text-amber-800"><Num>({fmt0(sumTgoOrders)})</Num></div>
                </td>
                <td className={tdn + ' text-sky-900 bg-sky-50/50'}>
                  <div><Num>{fmt2(sumMNet)}</Num></div>
                  <div className="text-xs font-semibold text-sky-800"><Num>({fmt0(sumMOrders)})</Num></div>
                </td>
                <td className={tdn}>
                  <div><Num>{fmt2(sumOtherNet)}</Num></div>
                  <div className="text-xs font-semibold text-slate-600"><Num>({fmt0(sumOtherOrders)})</Num></div>
                </td>
                <td className={tdn + ' font-extrabold text-slate-900'}><Num>{fmt3(sumNet)}</Num></td>
                <td className={tdn + ' font-extrabold'}><Num>{fmt0(sumOrders)}</Num></td>
                <td className={tdn}>{sumOrders > 0 ? fmt3(sumNet / sumOrders) : '—'}</td>
                <td className={tdn}>{sumNet > 0 ? '100.0%' : '—'}</td>
                <td className={tdc} />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">
          {T(
            `Branch net sales are the official Odoo branch figures for the 9 actual operational branches (adding up to KWD 167,092.160 and 30,540 orders). Sales and orders are broken down into Shop Sales (KWD ${fmt2(sumShopNet)} / ${fmt0(sumShopOrders)} orders), Tgo — Talabat Go platform delivery (KWD ${fmt2(sumTgoNet)} / ${fmt0(sumTgoOrders)} orders), TMP — Talabat TMP & Deliveroo TMP restaurant delivery (KWD ${fmt2(sumMNet)} / ${fmt0(sumMOrders)} orders), and Other Platforms (KWD ${fmt2(sumOtherNet)} / ${fmt0(sumOtherOrders)} orders).`,
            `صافي مبيعات الفروع هو الرقم الرسمي المعتمد للفروع التشغيلية التسعة في أودو (بإجمالي 167,092.160 د.ك و30,540 طلباً)، مقسّماً بدقة إلى: مبيعات المحل (${fmt2(sumShopNet)} د.ك / ${fmt0(sumShopOrders)} طلباً)، ومبيعات Tgo توصيل طلبات (${fmt2(sumTgoNet)} د.ك / ${fmt0(sumTgoOrders)} طلباً)، ومبيعات TMP توصيل المطعم عبر طلبات وديليفرو ماركت بليس (${fmt2(sumMNet)} د.ك / ${fmt0(sumMOrders)} طلباً)، وباقي المنصات (${fmt2(sumOtherNet)} د.ك / ${fmt0(sumOtherOrders)} طلباً).`,
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={card}>
          <Title title={T('Food cost', 'تكلفة الأغذية')} />
          <p className="text-[13px] font-medium text-slate-700 leading-relaxed">
            {T('Food cost is tracked at group level: 24.8% (KWD 41,438.856). Per-branch food cost is not in the dataset, so none is shown.', 'تكلفة الأغذية تُتابع على مستوى المجموعة: 24.8% (41,438.856 د.ك). تكلفة الأغذية لكل فرع غير متوفرة في البيانات، لذلك لا تُعرض.')}
          </p>
        </div>
        <div className="rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 p-5">
          <div className="text-[15px] font-bold text-rose-900">{T('Maintenance and custody: KWD 10,707.930', 'الصيانة والعهد: 10,707.930 د.ك')}</div>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-rose-800">
            {T('Repeated fridge failures at Al-Kout and Salmiya drove the spend. Stop repeated cash repairs and approve replacing the fridges as a capital item.', 'تكرار أعطال ثلاجات الكوت والسالمية رفع المصروف. أوقف الإصلاحات النقدية المتكررة واعتمد استبدال الثلاجات كبند رأسمالي.')}
          </p>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- peak hours */
function ThickDonut({ segs, total, unit }: { segs: { key: string; value: number; color: string }[]; total: number; unit: string }) {
  const { T } = useT()
  const r = 52, sw = 26, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="relative h-[150px] w-[150px] shrink-0" dir="ltr">
      <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
        <circle cx="75" cy="75" r={r} fill="none" stroke="#F1F5F9" strokeWidth={sw} />
        {segs.map((s) => {
          const frac = total > 0 ? s.value / total : 0
          const el = <circle key={s.key} cx="75" cy="75" r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-acc * c} />
          acc += frac
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-semibold tracking-wider text-gray-500">{T('TOTAL', 'الإجمالي')}</span>
        <span className="text-[15px] font-bold leading-tight text-gray-900 tabular-nums">{fmt0(total)}</span>
        <span className="text-[10px] text-gray-500">{unit}</span>
      </div>
    </div>
  )
}

function DonutCard({ title, sub, segs, total, unit, rows }: { title: string; sub?: string; segs: { key: string; value: number; color: string }[]; total: number; unit: string; rows: { key: string; label: string; pct: number; color: string; note: string }[] }) {
  return (
    <div className={card}>
      <Title title={title} sub={sub} />
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <ThickDonut segs={segs} total={total} unit={unit} />
        <div className="w-full space-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-gray-800"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}</span>
                <span className="font-bold text-gray-900"><Num>{fmt1(r.pct)}%</Num></span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100" dir="ltr"><div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} /></div>
              <div className="mt-0.5 text-[10px] text-gray-500"><Num>{r.note}</Num></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const HEAT_SHADES = ['#F1F5F9', '#BAE6FD', '#38BDF8', '#0284C7']
const heatShade = (orders: number, max: number) => {
  if (orders < 0.5 || max <= 0) return HEAT_SHADES[0]
  const r = orders / max
  return r <= 0.33 ? HEAT_SHADES[1] : r <= 0.66 ? HEAT_SHADES[2] : HEAT_SHADES[3]
}
const HOUR_TICKS: [number, string][] = [[0, '12a'], [6, '6a'], [12, '12p'], [18, '6p'], [23, '11p']]

export function PeakHoursTab({ view }: { view: SalesView }) {
  const { T, ar } = useT()
  const { cells, maxOrders } = useMemo(() => computeHeat(view), [view])
  const unit = ar ? 'د.ك' : 'KWD'
  const sel = view.filter.channel
  const chRows = sel === ALL_CHANNELS ? view.channels : view.channels.filter((c) => c.channel === sel)
  const storefront = chRows.filter((c) => c.channel === 'Shop Sales').reduce((a, c) => a + c.netSales, 0)
  const delivery = chRows.filter((c) => c.channel !== 'Shop Sales').reduce((a, c) => a + c.netSales, 0)
  const chTotal = storefront + delivery
  const sfOrders = chRows.filter((c) => c.channel === 'Shop Sales').reduce((a, c) => a + c.orders, 0)
  const dvOrders = chRows.filter((c) => c.channel !== 'Shop Sales').reduce((a, c) => a + c.orders, 0)
  const pct = (v: number, t: number) => (t > 0 ? (v / t) * 100 : 0)
  const lunch = view.orders * hourShare([12, 13, 14, 15])
  const dinner = view.orders * hourShare([19, 20, 21, 22, 23])
  const dayName = (d: number) => (ar ? weekdayLabelAr(d) : WEEKDAYS[d].charAt(0) + WEEKDAYS[d].slice(1).toLowerCase())
  const hh = (h: number) => `${String(h).padStart(2, '0')}:00`
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DonutCard
          title={T('Sales by channel type', 'المبيعات حسب نوع القناة')}
          sub={T('Storefront = Shop Sales; delivery = delivery apps and direct channels', 'المحل = مبيعات المحل؛ التوصيل = تطبيقات التوصيل والقنوات المباشرة')}
          total={chTotal}
          unit={unit}
          segs={[{ key: 'sf', value: storefront, color: '#0891B2' }, { key: 'dv', value: delivery, color: '#D97706' }]}
          rows={[
            { key: 'sf', label: T('Storefront', 'المحل'), pct: pct(storefront, chTotal), color: '#0891B2', note: `${unit} ${fmt0(storefront)} · ${fmt0(sfOrders)} ${T('orders', 'طلب')}` },
            { key: 'dv', label: T('Delivery & online', 'التوصيل والطلب المباشر'), pct: pct(delivery, chTotal), color: '#D97706', note: `${unit} ${fmt0(delivery)} · ${fmt0(dvOrders)} ${T('orders', 'طلب')}` },
          ]}
        />
        <DonutCard
          title={T('Payment methods', 'طرق الدفع')}
          sub={T('Split from the project payment report (KNET, credit card, cash)', 'التوزيع من تقرير طرق الدفع في المشروع (كي نت، بطاقة، نقداً)')}
          total={view.net}
          unit={unit}
          segs={PAYMENT_SPLIT.map((p, i) => ({ key: p.key, value: view.net * (p.pct / 100), color: ['#0891B2', '#D97706', '#94A3B8'][i] }))}
          rows={PAYMENT_SPLIT.map((p, i) => ({ key: p.key, label: ar ? p.ar : p.key, pct: p.pct, color: ['#0891B2', '#D97706', '#94A3B8'][i], note: `${unit} ${fmt0(view.net * (p.pct / 100))} · ${fmt0(view.orders * (p.pct / 100))} ${T('orders', 'طلب')}` }))}
        />
      </div>
      <p className="text-[10px] text-gray-400">
        {T('The payment split is the group split applied to the selection; the dataset has no payment data per brand or channel.', 'توزيع طرق الدفع هو توزيع المجموعة مطبَّق على التحديد؛ ولا توجد بيانات دفع لكل علامة أو قناة.')}
      </p>
      <div className={card}>
        <Title title={T('Busiest times', 'أوقات الذروة')} sub={T('Orders by day of week and hour', 'الطلبات حسب يوم الأسبوع والساعة')} />
        <div dir="ltr" className="select-none">
          {WEEKDAYS.map((d, di) => (
            <div key={d} className="mb-1 grid items-center gap-1" style={{ gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))' }}>
              <span className="text-[10px] font-semibold text-gray-500">{ar ? weekdayLabelAr(di).slice(0, 3) : d}</span>
              {cells[di].map((c) => {
                const pos = c.hour < 5 ? 'left-0' : c.hour > 18 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                const arrow = c.hour < 5 ? { left: 10 } : c.hour > 18 ? { right: 10 } : { left: '50%', marginLeft: -6 }
                return (
                  <div key={c.hour} className="group relative hover:z-50">
                    <div className="h-7 rounded-sm" style={{ backgroundColor: heatShade(c.orders, maxOrders) }} />
                    <div
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full z-[9999] mb-2 hidden w-max rounded-xl bg-white px-3.5 py-2.5 text-xs shadow-xl ring-1 ring-slate-200 group-hover:block ${pos}`}
                      style={{ backgroundColor: '#FFFFFF', color: '#0F172A', opacity: 1, zIndex: 9999 }}
                    >
                      <div className="font-bold text-slate-950 text-xs" style={{ color: '#0F172A' }}>{dayName(di)} · {hh(c.hour)}</div>
                      <div className="mt-0.5 whitespace-nowrap font-semibold text-blue-700 text-xs tabular-nums" style={{ color: '#1D4ED8' }}>
                        {fmt0(c.orders)} {T('orders', 'طلب')} · {ar ? `${fmt0(c.sales)} د.ك` : `KWD ${fmt0(c.sales)}`}
                      </div>
                      <span
                        className="absolute -bottom-1.5 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white"
                        style={{ ...arrow, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
          <div className="grid gap-1" style={{ gridTemplateColumns: '36px repeat(24, minmax(0, 1fr))' }}>
            <span />
            {Array.from({ length: 24 }, (_, h) => {
              const tick = HOUR_TICKS.find(([x]) => x === h)
              return <span key={h} className={`whitespace-nowrap text-[10px] text-gray-400 ${h === 23 ? 'justify-self-end' : ''}`}>{tick ? tick[1] : ''}</span>
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-gray-500">
            <span>{T('Fewer', 'أقل')}</span>
            {HEAT_SHADES.map((s) => <span key={s} className="h-3 w-3 rounded-sm" style={{ backgroundColor: s }} />)}
            <span>{T('More', 'أكثر')}</span>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
          {T(
            'Estimate: weekday weights come from the dated sample days of October and hour weights from the October hourly data, applied to the selected totals. The hourly data covers 11:00 to 00:59, so the other hours are empty. Odoo order timestamps by weekday and hour are not in the project dataset.',
            'تقدير: أوزان أيام الأسبوع من أيام العينة المؤرَّخة في أكتوبر وأوزان الساعات من البيانات الساعية لأكتوبر، مطبَّقة على الإجماليات المحددة. تغطي البيانات الساعية 11:00 حتى 00:59 لذلك تظهر بقية الساعات فارغة. أوقات الطلبات في أودو حسب اليوم والساعة غير موجودة في بيانات المشروع.',
          )}
        </p>
      </div>
      <div className={card}>
        <Title title={T('Shift scheduling and prep for the peaks', 'جدولة الشفتات والتحضير لساعات الذروة')} />
        <RecTable
          head={[T('Window', 'الفترة'), T('Share of orders', 'حصتها من الطلبات'), T('Action', 'الإجراء')]}
          rows={[
            [T('Lunch 12:00–15:00', 'الغداء 12:00–15:00'), <Num key="l">{view.orders > 0 ? ((lunch / view.orders) * 100).toFixed(1) : '0.0'}% · {fmt0(lunch)}</Num>, T('Finish prep by 11:30, put the strongest cashiers and the full line on shift, and pre-stage the best-selling noodles.', 'أنهِ التحضير قبل 11:30، وضع أقوى الكاشير والخط الكامل على الشفت، وجهّز النودلز الأكثر مبيعاً مسبقاً.')],
            [T('Afternoon lull 16:00–17:00', 'الهدوء بعد الظهر 16:00–17:00'), '—', T('Use it for stock transfer, cleaning and the evening prep; schedule breaks here.', 'استغله للتحويلات المخزنية والتنظيف وتحضير المساء؛ وحدّد فيه فترات الراحة.')],
            [T('Dinner 19:00–23:00', 'العشاء 19:00–23:00'), <Num key="d">{view.orders > 0 ? ((dinner / view.orders) * 100).toFixed(1) : '0.0'}% · {fmt0(dinner)}</Num>, T('Largest window. Start the second shift by 18:30, keep delivery packaging staged, and watch platform availability at 20:00–22:00.', 'أكبر فترة. ابدأ الشفت الثاني قبل 18:30، وجهّز مواد التغليف للتوصيل، وراقب توفر الفروع على المنصات من 20:00 إلى 22:00.')],
          ]}
        />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- operations */
export function OperationsTab({ view }: { view: SalesView }) {
  const { T, ar } = useT()
  const brandRow = view.filter.brand !== ALL_BRANDS ? BRANDS_DATA.find((b) => b.brand === view.filter.brand) : undefined
  const cogsPct = brandRow ? brandRow.cogsPct : 24.8
  const cogsKwd = (view.net * cogsPct) / 100
  const unit = ar ? 'د.ك' : 'KWD'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-4 items-stretch">
        <Kpi label={T('Average preparation time', 'متوسط زمن تحضير الطلب')} value={<Num>{T('14.2 min', '14.2 دقيقة')}</Num>} />
        <Kpi label={T('Orders completed without errors', 'الطلبات المكتملة بدون أخطاء')} value={<Num>98.4%</Num>} tone="text-emerald-700" />
        <Kpi label={T('Food cost vs standard', 'تكلفة الأغذية الفعلية مقابل المعيارية')} value={<Num>{cogsPct.toFixed(1)}% / 24.0%</Num>} note={T(`Actual / standard, a gap of ${(cogsPct - 24).toFixed(1)} pts`, `الفعلي / المعياري، بفارق ${(cogsPct - 24).toFixed(1)} نقطة`)} tone="text-amber-700" />
        <Kpi label={T('Food cost of the selection', 'تكلفة الأغذية للتحديد')} value={<Num>{unit} {fmt0(cogsKwd)}</Num>} note={view.isFiltered ? T('Net sales × food cost %', 'صافي المبيعات × نسبة تكلفة الأغذية') : T('Group total', 'إجمالي المجموعة')} />
        <Kpi label={T('Branch availability on platforms', 'توافر الفروع على المنصات')} value={<Num>99.1%</Num>} tone="text-emerald-700" />
      </div>
      <p className="text-[10px] text-gray-400">{T('Operating indicators were supplied with the request; they are not yet read from Odoo or the platform feeds. Food cost follows the brand filter; preparation time, accuracy and availability are group-level and are not split by brand or channel.', 'المؤشرات التشغيلية مقدّمة مع الطلب؛ وهي غير مقروءة بعد من أودو أو من تغذية المنصات. تتبع تكلفة الأغذية فلتر العلامة؛ أما زمن التحضير والدقة والتوافر فهي على مستوى المجموعة ولا تُقسَّم حسب العلامة أو القناة.')}</p>
      <div className={card}>
        <Title title={T('Operating actions to raise efficiency and cut waste', 'الإجراءات التشغيلية لرفع الكفاءة وتقليل الهدر')} />
        <RecTable
          head={[T('Area', 'المجال'), T('Indicator', 'المؤشر'), T('Action', 'الإجراء'), T('Owner', 'المسؤول')]}
          rows={[
            [T('Preparation time', 'زمن التحضير'), <Num key="a">14.2 {T('min', 'د')}</Num>, T('Time each station in the peaks and re-stage the line for the slowest dishes.', 'قِس زمن كل محطة في الذروة وأعد ترتيب الخط للأطباق الأبطأ.'), T('Operations', 'العمليات')],
            [T('Order accuracy', 'دقة الطلبات'), <Num key="b">98.4%</Num>, T('Add a packing check against the ticket before sealing delivery bags.', 'أضف فحص تعبئة مقابل التذكرة قبل إغلاق أكياس التوصيل.'), T('Branch managers', 'مديرو الفروع')],
            [T('Food cost', 'تكلفة الأغذية'), <Num key="c">24.8% / 24.0%</Num>, T('Pre-weigh marinade portions (140 g) and tie central-kitchen issues to daily POS sales.', 'وزّن حصص التتبيل مسبقاً (140 جم) واربط صرف المطبخ المركزي بمبيعات نقاط البيع يومياً.'), T('Central kitchen', 'المطبخ المركزي')],
            [T('Platform availability', 'توافر المنصات'), <Num key="d">99.1%</Num>, T('Alert on any branch that goes offline for more than 30 minutes (see the delivery apps page).', 'نبّه عند خروج أي فرع عن الخدمة أكثر من 30 دقيقة (انظر صفحة تطبيقات التوصيل).'), T('Delivery coordinator', 'منسق التوصيل')],
            [T('Waste', 'الهدر'), '—', T('Delist the slowest items to cut prep and expiry waste.', 'احذف أبطأ الأصناف لتقليل هدر التحضير والصلاحية.'), T('Menu owner', 'مسؤول المنيو')],
          ]}
        />
      </div>
    </div>
  )
}
