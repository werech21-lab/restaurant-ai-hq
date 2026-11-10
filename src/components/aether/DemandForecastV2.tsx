'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, ChefHat, CloudSun, Download, Printer, Sparkles, Thermometer, TrendingUp, Users, Wind } from 'lucide-react'
import { LEDGER, feryalHref, fmt, kwd, pct } from '@/lib/aether/ledger'
import {
  BASE_CHANNEL_MIX,
  DAYPART_HOURS,
  PREP_BUFFER,
  branchForecast,
  buildDemandForecast,
  dayLabel,
  prepSheet,
  staffingPulse,
  wasteSavings,
  type ForecastDay,
  type WeatherKind,
} from '@/lib/enterprise-giants-engine'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, LineChartV2, Num, ReorderableTable, RoundedBars, SectionHeader, StatsCardV2, downloadCsv, useLang, type ReorderColumn } from '@/components/aether/ui'

const WEATHER_LABEL: Record<WeatherKind, { en: string; ar: string; tone: 'sky' | 'amber' | 'rose' | 'emerald' }> = {
  mild: { en: 'Mild', ar: 'معتدل', tone: 'emerald' },
  warm: { en: 'Warm', ar: 'دافئ', tone: 'sky' },
  heat: { en: 'High heat', ar: 'حر شديد', tone: 'amber' },
  dust: { en: 'Dust', ar: 'غبار', tone: 'rose' },
}

function DaypartCurve({ day, lang }: { day: ForecastDay; lang: 'ar' | 'en' }) {
  const peakIdx = day.hourly.indexOf(Math.max(...day.hourly))
  return (
    <LineChartV2
      series={[{ key: 'orders', color: '#0284C7', values: day.hourly, area: true }]}
      xLabels={DAYPART_HOURS.map((h) => `${String(h).padStart(2, '0')}:00`)}
      heightClass="h-[220px] lg:h-[250px]"
      pointLabels
      formatValue={(n) => fmt(n)}
      callout={{ index: peakIdx, text: lang === 'ar' ? `الذروة ${String(DAYPART_HOURS[peakIdx]).padStart(2, '0')}:00` : `Peak ${String(DAYPART_HOURS[peakIdx]).padStart(2, '0')}:00` }}
      maxTicks={14}
    />
  )
}

export function DemandForecastV2({ anchor }: { anchor: string }) {
  const { lang, isAr, T } = useLang()
  const { filters, view } = useBiFilters()
  const [horizon, setHorizon] = useState<7 | 14>(7)
  const [selectedIdx, setSelectedIdx] = useState(1)
  const [buffer, setBuffer] = useState<number>(PREP_BUFFER.target)
  const [approvedAt, setApprovedAt] = useState<string | null>(null)

  const forecast = useMemo(() => buildDemandForecast(filters, anchor, horizon), [filters, anchor, horizon])
  const day = forecast[Math.min(selectedIdx, forecast.length - 1)]
  const sheet = useMemo(() => prepSheet(day, filters, buffer), [day, filters, buffer])
  const staffing = useMemo(() => staffingPulse(day, filters), [day, filters])
  const branches = useMemo(() => branchForecast(day, filters), [day, filters])
  const savings = wasteSavings(buffer, view.salesShare)

  const totalOrders = forecast.reduce((s, d) => s + d.orders, 0)
  const totalSales = forecast.reduce((s, d) => s + d.sales, 0)
  const peak = forecast.reduce((a, b) => (b.orders > a.orders ? b : a), forecast[0])
  const shiftDays = forecast.filter((d) => d.deliveryShift > 0.05).length
  const kpiScale = filters.period === 'daily' ? 1 / horizon : filters.period === 'annual' ? 365 / horizon : 1
  const kpiLabel = filters.period === 'daily' ? T('per day (avg)', 'يومياً (متوسط)') : filters.period === 'annual' ? T('annualised', 'سنوياً') : T(`next ${horizon} days`, `خلال ${horizon} يوماً`)
  const sheetCost = sheet.reduce((s, p) => s + p.cost, 0)
  const sheetAvoided = sheet.reduce((s, p) => s + p.avoided, 0)

  const exportSheet = () => {
    downloadCsv(`ardiya-prep-sheet-${day.date}.csv`, [
      [T('Item', 'الصنف'), T('Unit', 'الوحدة'), T('Forecast need', 'الاحتياج المتوقع'), T('Par level', 'مستوى التحضير'), T('Legacy par (12%)', 'التحضير السابق (12%)'), T('Batch cost KWD', 'تكلفة الدفعة د.ك'), T('Avoided waste KWD', 'الهدر المتجنب د.ك')],
      ...sheet.map((p) => [isAr ? p.ar : p.en, isAr ? p.unitAr : p.unitEn, p.need.toFixed(p.decimals), p.par.toFixed(p.decimals), p.legacy.toFixed(p.decimals), p.cost.toFixed(3), p.avoided.toFixed(3)]),
    ])
  }

  const approve = () => {
    setApprovedAt(new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' }))
  }

  const staffColumns: ReorderColumn<(typeof staffing)[number]>[] = [
    { key: 'branch', en: 'Branch', ar: 'الفرع', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{isAr ? r.ar : r.en}</span>, csv: (r) => (isAr ? r.ar : r.en) },
    { key: 'orders', en: 'Forecast orders', ar: 'الطلبات المتوقعة', align: 'end', render: (r) => <Num>{fmt(r.orders)}</Num>, csv: (r) => Math.round(r.orders) },
    { key: 'peak', en: 'Peak crew', ar: 'طاقم الذروة', align: 'end', render: (r) => <Num>{r.peak}</Num>, csv: (r) => r.peak },
    { key: 'roster', en: 'Current roster', ar: 'الجدول الحالي', align: 'end', render: (r) => <Num>{r.rosterCrew}</Num>, csv: (r) => r.rosterCrew },
    { key: 'hours', en: 'Labour hours (current → optimal)', ar: 'ساعات العمل (الحالي ← الأمثل)', align: 'end', render: (r) => <Num>{`${r.currentHours} → ${r.optimalHours}`}</Num>, csv: (r) => `${r.currentHours} -> ${r.optimalHours}` },
    { key: 'splh', en: 'Sales per labour hour', ar: 'المبيعات لكل ساعة عمل', align: 'end', render: (r) => <Num className="text-emerald-600">{`${fmt(r.splhCurrent, 2)} → ${fmt(r.splhOptimal, 2)}`}</Num>, csv: (r) => `${r.splhCurrent.toFixed(2)} -> ${r.splhOptimal.toFixed(2)}` },
    {
      key: 'curve',
      en: 'Crew need by hour',
      ar: 'الطاقم المطلوب بالساعة',
      render: (r) => (
        <span className="inline-flex h-6 items-end gap-px" dir="ltr">
          {r.required.map((v, i) => (
            <span key={i} className="w-1.5 rounded-sm" style={{ height: `${(v / r.peak) * 100}%`, backgroundColor: v > r.rosterCrew ? '#E11D48' : '#0284C7', opacity: 0.85 }} />
          ))}
        </span>
      ),
      csv: (r) => r.required.join(' '),
    },
    {
      key: 'flag',
      en: 'Signal',
      ar: 'المؤشر',
      render: (r) =>
        r.understaffedHours > 0 ? <Badge tone="rose">{T(`${r.understaffedHours} h short`, `نقص ${r.understaffedHours} ساعات`)}</Badge> : <Badge tone="emerald">{T(`+${fmt((r.efficiency - 1) * 100)}% efficiency`, `+${fmt((r.efficiency - 1) * 100)}% كفاءة`)}</Badge>,
      csv: (r) => (r.understaffedHours > 0 ? `short ${r.understaffedHours}h` : `+${((r.efficiency - 1) * 100).toFixed(0)}%`),
    },
  ]

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="sky">{T('Demand · weather · prep forecaster', 'متنبئ الطلب والطقس والتحضير')}</Badge>
            <Badge tone="slate">{T('Kuwait seasonal climate model', 'نموذج المناخ الموسمي للكويت')}</Badge>
          </div>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('AI Demand & Central Kitchen Prep Forecaster', 'متنبئ الطلب وتحضير المطبخ المركزي')}</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {T(
              'Day-by-day orders and revenue across 9 branches and 7 brands, factoring Thursday–Friday surges, salary week (24th–29th) and heat or dust shifting dine-in to delivery — translated into Ardiya prep par levels and crew plans.',
              'الطلبات والإيرادات يوماً بيوم عبر 9 فروع و7 علامات، مع ذروة الخميس والجمعة وأسبوع الرواتب (24–29) وتحول الصالة إلى التوصيل في الحر والغبار — وتحويلها إلى مستويات تحضير لمطبخ العارضية وخطط الطواقم.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="ae-seg">
            {([7, 14] as const).map((h) => (
              <button key={h} type="button" data-active={horizon === h} onClick={() => setHorizon(h)}>
                {T(`${h}-day`, `${h} يوماً`)}
              </button>
            ))}
          </div>
          <Link href={feryalHref(T(`Brief me on the ${horizon}-day demand forecast and the Ardiya prep plan.`, `أعطيني موجزاً عن توقع الطلب لـ ${horizon} يوماً وخطة تحضير العارضية.`))} className="ae-pill-dark">
            <Sparkles className="h-3.5 w-3.5" />
            {T('Feryal briefing', 'موجز فريال')}
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2 icon={<TrendingUp className="h-4 w-4" />} label={T('Forecast orders', 'الطلبات المتوقعة')} value={fmt(totalOrders * kpiScale)} sub={kpiLabel} spark={forecast.map((d) => d.orders)} />
        <StatsCardV2 icon={<CalendarDays className="h-4 w-4" />} label={T('Forecast net sales', 'صافي المبيعات المتوقع')} value={kwd(totalSales * kpiScale, lang, filters.period === 'daily' ? 3 : 0)} valueTone="sky" sub={kpiLabel} spark={forecast.map((d) => d.sales)} />
        <StatsCardV2 icon={<Thermometer className="h-4 w-4" />} label={T('Peak day', 'يوم الذروة')} value={dayLabel(peak.date, lang)} valueTone="amber" sub={T(`${fmt(peak.orders)} orders · ×${fmt(peak.multiplier, 2)} vs base`, `${fmt(peak.orders)} طلباً · ×${fmt(peak.multiplier, 2)} عن الأساس`)} />
        <StatsCardV2 icon={<Wind className="h-4 w-4" />} label={T('Weather delivery-shift days', 'أيام تحول التوصيل بسبب الطقس')} value={fmt(shiftDays)} valueTone={shiftDays ? 'rose' : 'emerald'} sub={T('Heat ≥ 34°C or dust events', 'حرارة 34 درجة فأكثر أو غبار')} />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-8">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title={T(`${horizon}-day revenue & order forecast`, `توقع الإيرادات والطلبات لـ ${horizon} يوماً`)}
            subtitle={T('Click a day to drive the daypart curve, prep sheet and crew plan', 'اختر يوماً لتحديث منحنى الساعات وورقة التحضير وخطة الطاقم')}
          />
          <RoundedBars
            rows={forecast.map((d) => ({ key: d.date, label: dayLabel(d.date, lang), a: d.dineIn + d.takeaway, b: d.delivery, top: `${d.tempC}°` }))}
            height={220}
            seriesA={{ color: '#38BDF8', label: T('Dine-in & takeaway orders', 'طلبات الصالة والسفري') }}
            seriesB={{ color: '#0F766E', label: T('Delivery orders (temperature on top)', 'طلبات التوصيل (الحرارة أعلى العمود)') }}
            highlight={day.date}
            onSelect={(key) => setSelectedIdx(forecast.findIndex((d) => d.date === key))}
          />
          <div className="flex flex-wrap gap-1.5">
            {forecast.map((d, i) => (
              <button key={d.date} type="button" onClick={() => setSelectedIdx(i)} className={i === selectedIdx ? 'ae-pill-dark ae-pill-sm' : 'ae-pill-light ae-pill-sm'}>
                {dayLabel(d.date, lang)}
                {d.weekendSurge ? <span className="text-amber-500">●</span> : null}
                {d.salaryWeek ? <span className="text-emerald-500">●</span> : null}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-[11px] text-slate-500">
            <span><span className="text-amber-500">●</span> {T('Thu/Fri weekend surge', 'ذروة نهاية الأسبوع الخميس والجمعة')}</span>
            <span><span className="text-emerald-500">●</span> {T('Salary week ×1.12 (24th–29th)', 'أسبوع الرواتب ×1.12 (24–29)')}</span>
          </div>
        </div>

        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-4">
          <SectionHeader icon={<CloudSun className="h-4 w-4" />} title={dayLabel(day.date, lang)} subtitle={T('Selected day drivers', 'محركات اليوم المحدد')} />
          <div className="grid grid-cols-2 gap-2">
            <div className="ae-tile-soft p-3">
              <div className="ae-meta">{T('Weather', 'الطقس')}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={WEATHER_LABEL[day.weather].tone}>{isAr ? WEATHER_LABEL[day.weather].ar : WEATHER_LABEL[day.weather].en}</Badge>
                <Num className="text-sm text-slate-900 dark:text-white">{day.tempC}°</Num>
              </div>
            </div>
            <div className="ae-tile-soft p-3">
              <div className="ae-meta">{T('Demand multiplier', 'معامل الطلب')}</div>
              <Num className="text-base text-slate-900 dark:text-white">×{fmt(day.multiplier, 2)}</Num>
            </div>
            <div className="ae-tile-soft p-3">
              <div className="ae-meta">{T('Orders', 'الطلبات')}</div>
              <Num className="text-base text-slate-900 dark:text-white">{fmt(day.orders)}</Num>
            </div>
            <div className="ae-tile-soft p-3">
              <div className="ae-meta">{T('Net sales', 'صافي المبيعات')}</div>
              <Num className="text-base text-sky-600">{kwd(day.sales, lang, 0)}</Num>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { key: 'dine', label: T('Dine-in', 'الصالة'), value: day.dineIn, base: BASE_CHANNEL_MIX.dineIn, color: '#133B5C' },
              { key: 'take', label: T('Takeaway & drive-thru', 'السفري وخدمة السيارات'), value: day.takeaway, base: BASE_CHANNEL_MIX.takeaway, color: '#38BDF8' },
              { key: 'del', label: T('Delivery', 'التوصيل'), value: day.delivery, base: BASE_CHANNEL_MIX.delivery, color: '#0F766E' },
            ].map((c) => (
              <div key={c.key} className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{c.label}</span>
                  <Num className="text-slate-900 dark:text-white">
                    {fmt(c.value)} · {pct((c.value / day.orders) * 100, 0)}
                  </Num>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" dir="ltr">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(c.value / day.orders) * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {day.deliveryShift > 0
              ? T(`${pct(day.deliveryShift * 100, 0)} of dine-in demand migrates to delivery on this day.`, `${pct(day.deliveryShift * 100, 0)} من طلب الصالة يتحول إلى التوصيل في هذا اليوم.`)
              : T('Mild weather lifts dine-in traffic slightly above the base mix.', 'الطقس المعتدل يرفع حركة الصالة قليلاً فوق المزيج الأساسي.')}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="ae-tile flex flex-col gap-3 p-5 lg:col-span-7">
          <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title={T('Daypart peak curve', 'منحنى ذروة الساعات')} subtitle={T('Forecast orders per opening hour, 11:00 → 01:00', 'الطلبات المتوقعة لكل ساعة عمل من 11:00 إلى 01:00')} />
          <DaypartCurve day={day} lang={lang} />
        </div>
        <div className="ae-tile flex flex-col gap-3 p-5 lg:col-span-5">
          <SectionHeader icon={<CalendarDays className="h-4 w-4" />} title={T('Branch forecast', 'توقع الفروع')} subtitle={dayLabel(day.date, lang)} />
          <ul className="flex-1 space-y-1.5">
            {branches.map((b) => (
              <li key={b.id} className="ae-tile-soft flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{isAr ? b.ar : b.en}</span>
                <span className="flex items-center gap-3">
                  <Num className="text-slate-500">{kwd(b.sales, lang, 0)}</Num>
                  <Num className="w-14 text-end text-slate-900 dark:text-white">{fmt(b.orders)}</Num>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<ChefHat className="h-4 w-4" />}
          title={T('Ardiya Central Kitchen dynamic prep par-level generator', 'مولد مستويات التحضير الديناميكي لمطبخ العارضية المركزي')}
          subtitle={T(`Forecast orders → exact raw prep batches for ${dayLabel(day.date, 'en')}`, `الطلبات المتوقعة ← دفعات التحضير الدقيقة ليوم ${dayLabel(day.date, 'ar')}`)}
          actions={
            <>
              <button type="button" onClick={() => window.print()} className="ae-pill-light no-print">
                <Printer className="h-3.5 w-3.5" />
                {T('Print', 'طباعة')}
              </button>
              <button
                type="button"
                onClick={() => {
                  approve()
                  exportSheet()
                }}
                className="ae-pill-dark no-print"
              >
                <Download className="h-3.5 w-3.5" />
                {T('Approve & Export Prep Sheet', 'اعتماد وتصدير ورقة التحضير')}
              </button>
            </>
          }
        />
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
          <div className="ae-tile-soft space-y-3 p-4 lg:col-span-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{T('Safety buffer over forecast', 'هامش الأمان فوق التوقع')}</span>
              <Num className="text-base text-slate-900 dark:text-white">{pct(buffer, 0)}</Num>
            </div>
            <input type="range" min={2} max={PREP_BUFFER.current} step={1} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="w-full accent-emerald-600" aria-label={T('Safety buffer', 'هامش الأمان')} />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{T('Lean 2%', 'مرن 2%')}</span>
              <span>{T('Target 4%', 'المستهدف 4%')}</span>
              <span>{T('Legacy 12%', 'السابق 12%')}</span>
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>{T('Waste reduction toward target', 'خفض الهدر نحو المستهدف')}</span>
                <Num className="font-bold text-emerald-600">{pct(Math.min(100, savings.progress * 100), 0)}</Num>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10" dir="ltr">
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${Math.min(100, savings.progress * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <Num className="text-emerald-600">+{kwd(savings.monthly, lang, 0)}</Num>
                <span>
                  {T('of', 'من')} <Num>{kwd(savings.target, lang, 0)}</Num> {T('/ month', '/ شهرياً')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="ae-tile p-2.5">
                <div className="text-[10px] text-slate-500">{T('Prep batch cost', 'تكلفة دفعة التحضير')}</div>
                <Num className="text-sm text-slate-900 dark:text-white">{kwd(sheetCost, lang, 1)}</Num>
              </div>
              <div className="ae-tile p-2.5">
                <div className="text-[10px] text-slate-500">{T('Avoided waste', 'الهدر المتجنب')}</div>
                <Num className="text-sm text-emerald-600">{kwd(sheetAvoided, lang, 1)}</Num>
              </div>
            </div>
            {approvedAt ? (
              <p className="ae-pop flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {T('Approved and exported at', 'تم الاعتماد والتصدير في')} <Num>{approvedAt}</Num>
              </p>
            ) : null}
          </div>
          <div className="w-full min-w-0 overflow-x-auto rounded-xl lg:col-span-8">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-3 py-2 text-start font-semibold">{T('Prep item', 'صنف التحضير')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('Forecast need', 'الاحتياج المتوقع')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('Par level', 'مستوى التحضير')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('Legacy 12%', 'السابق 12%')}</th>
                  <th className="px-3 py-2 text-end font-semibold">{T('Avoided', 'المتجنب')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sheet.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900 dark:text-white">{isAr ? p.ar : p.en}</div>
                      <div className="text-[10px] text-slate-500">{isAr ? p.unitAr : p.unitEn}</div>
                    </td>
                    <td className="px-3 py-2 text-end"><Num>{fmt(p.need, p.decimals)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className="text-slate-900 dark:text-white">{fmt(p.par, p.decimals)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className="text-slate-400 line-through">{fmt(p.legacy, p.decimals)}</Num></td>
                    <td className="px-3 py-2 text-end"><Num className="text-emerald-600">{fmt(p.avoided, 2)}</Num></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<Users className="h-4 w-4" />}
          title={T('Smart shift & kitchen productivity pulse', 'نبض الورديات وإنتاجية المطبخ')}
          subtitle={T(`Demand-following crew vs flat roster · ${ORDERS_PER_HOUR_LABEL.en}`, `طاقم يتبع الطلب مقابل جدول ثابت · ${ORDERS_PER_HOUR_LABEL.ar}`)}
        />
        <ReorderableTable columns={staffColumns} rows={staffing} rowKey={(r) => r.id} csvName={`aetherbi-crew-plan-${day.date}.csv`} maxHeight={440} />
      </section>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {T(
          `Forecasts start from the ${LEDGER.periodLabelEn} Odoo run-rate (${fmt(LEDGER.orders)} orders) and apply Kuwait weekday, salary-week and seasonal climate patterns. Filtered views allocate proportionally by brand, branch and channel.`,
          `تنطلق التوقعات من معدل أودو لشهر ${LEDGER.periodLabelAr} (${fmt(LEDGER.orders)} طلباً) وتطبق أنماط أيام الأسبوع وأسبوع الرواتب والمناخ الموسمي في الكويت. العروض المفلترة توزع نسبياً حسب العلامة والفرع والقناة.`,
        )}
      </p>
    </div>
  )
}

const ORDERS_PER_HOUR_LABEL = { en: '7 orders per labour hour, minimum 2 crew', ar: '7 طلبات لكل ساعة عمل وحد أدنى 2 من الطاقم' }
