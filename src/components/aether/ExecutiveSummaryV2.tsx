'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BadgePercent,
  Banknote,
  ChefHat,
  Coins,
  Flag,
  Printer,
  Receipt,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import {
  BRANCHES,
  BRANDS,
  CHANNELS,
  LEDGER,
  LEVERS,
  LEVERS_MONTHLY_TOTAL,
  PERIODS,
  ROADMAP,
  feryalHref,
  fmt,
  kwd,
  pct,
  sliceShares,
} from '@/lib/aether/ledger'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, DonutGauge, Num, RoundedBars, SectionHeader, StatsCardV2, TONE_HEX, useLang } from '@/components/aether/ui'

// Sampled every 3 days across October (11 points) from the Odoo daily journal.
const TREND = {
  sales: [4920, 5380, 5110, 5890, 5240, 6120, 5490, 5760, 6340, 5680, 6490],
  profit: [1240, 1370, 1295, 1510, 1320, 1580, 1390, 1465, 1640, 1440, 1675],
  orders: [895, 980, 930, 1075, 960, 1120, 1005, 1050, 1165, 1040, 1190],
  cogs: [1220, 1334, 1267, 1460, 1299, 1517, 1361, 1428, 1572, 1408, 1609],
}

const PNL = [
  { key: 'profit', en: 'Net operating profit', ar: 'صافي الربح التشغيلي', value: LEDGER.netProfit, color: '#059669' },
  { key: 'opex', en: 'Opex & custodies', ar: 'المصروفات والعهد', value: LEDGER.opex, color: '#D97706' },
  { key: 'cogs', en: 'Food & material cost', ar: 'تكلفة الأغذية والمواد', value: LEDGER.cogs, color: '#E11D48' },
  { key: 'payroll', en: 'Salaries, rent & commissions', ar: 'الرواتب والإيجارات والعمولات', value: LEDGER.salariesRentCommission, color: '#0284C7' },
]

export function ExecutiveSummaryV2() {
  const { lang, isAr, T } = useLang()
  const { filters, view, setBranch, setBrand, setChannel } = useBiFilters()
  const [chartMode, setChartMode] = useState<'branches' | 'channels'>('branches')
  const [hoverBrand, setHoverBrand] = useState<number | null>(null)
  const [greeting, setGreeting] = useState({ en: 'Welcome back', ar: 'أهلاً بعودتك' })

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? { en: 'Good morning', ar: 'صباح الخير' } : h < 18 ? { en: 'Good afternoon', ar: 'مساء الخير' } : { en: 'Good evening', ar: 'مساء الخير' })
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      const t = window.setTimeout(() => window.print(), 600)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [])

  const period = PERIODS.find((p) => p.id === filters.period)!
  const pf = view.periodFactor
  const digits = filters.period === 'daily' ? 3 : 0
  const scaleTrend = (arr: number[]) => arr.map((v) => v * view.salesShare)

  // (a) Revenue vs net profit across branches / channels for the current brand × channel × period slice.
  const barRows = useMemo(() => {
    if (chartMode === 'branches') {
      const s = sliceShares({ brand: filters.brand, branch: 'all', channel: filters.channel })
      return BRANCHES.map((b) => {
        const sales = b.sales * s.brandShare * s.channelShare * pf
        return {
          key: b.id,
          label: isAr ? b.ar.split(' / ')[0] : b.en.split(' / ')[0],
          a: sales,
          b: sales * (b.marginPct / 100),
          top: pct(b.marginPct, 1),
        }
      })
    }
    const s = sliceShares({ brand: filters.brand, branch: filters.branch, channel: 'all' })
    return [...CHANNELS]
      .sort((x, y) => y.sales - x.sales)
      .slice(0, 8)
      .map((c) => {
        const sales = c.sales * s.brandShare * s.branchShare * pf
        const contributionPct = 100 - c.commissionPct - LEDGER.cogsPct
        return { key: c.id, label: isAr ? c.ar : c.en, a: sales, b: sales * (contributionPct / 100), top: pct(contributionPct, 0) }
      })
  }, [chartMode, filters.brand, filters.branch, filters.channel, isAr, pf])

  // (b) 6-brand revenue distribution for the current branch × channel × period slice.
  const brandSlices = useMemo(() => {
    const s = sliceShares({ brand: 'all', branch: filters.branch, channel: filters.channel })
    return BRANDS.map((b) => ({ ...b, value: b.sales * s.branchShare * s.channelShare * pf }))
  }, [filters.branch, filters.channel, pf])
  const brandTotal = brandSlices.reduce((sum, b) => sum + b.value, 0)
  const focusBrand = hoverBrand != null ? brandSlices[hoverBrand] : null

  const runRateShare = LEDGER.netProfit / ROADMAP[3].total

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Executive greeting header */}
      <section className="ae-tile flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {T('Verified Odoo ledger', 'دفتر أودو المعتمد')}
            </Badge>
            <span className="ae-chip">
              {isAr ? period.ar : period.en} · {isAr ? LEDGER.periodLabelAr : LEDGER.periodLabelEn}
            </span>
            {view.filtered ? <Badge tone="sky">{T('Filtered slice', 'شريحة مفلترة')}</Badge> : null}
          </div>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white sm:text-[1.75rem]">
            {isAr ? `${greeting.ar}، الإدارة التنفيذية` : `${greeting.en}, Executive Leadership`}
          </h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {T(
              `Net operating profit is ${kwd(view.netProfit, 'en', digits)} on ${kwd(view.netSales, 'en', digits)} net sales (${pct(view.marginPct)} margin). Five approved levers add ${kwd(LEVERS_MONTHLY_TOTAL, 'en', 0)} per month on the path to ${kwd(ROADMAP[3].total, 'en', 0)} for the full year.`,
              `صافي الربح التشغيلي ${kwd(view.netProfit, 'ar', digits)} من صافي مبيعات ${kwd(view.netSales, 'ar', digits)} (هامش ${pct(view.marginPct)}). خمس روافع معتمدة تضيف ${kwd(LEVERS_MONTHLY_TOTAL, 'ar', 0)} شهرياً في الطريق إلى ${kwd(ROADMAP[3].total, 'ar', 0)} للسنة الكاملة.`,
            )}
          </p>
        </div>
        <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
          <Link href={feryalHref(T('Prepare the board executive brief for this month with the five profit levers.', 'جهزي الموجز التنفيذي لمجلس الإدارة لهذا الشهر مع روافع الربح الخمس.'))} className="ae-pill-light">
            <Sparkles className="h-3.5 w-3.5" />
            {T('Brief with Feryal', 'موجز مع فريال')}
          </Link>
          <button type="button" onClick={() => window.print()} className="ae-pill-dark">
            <Printer className="h-3.5 w-3.5" />
            {T('Print / Export Board Executive Brief', 'طباعة وتصدير الموجز التنفيذي للمجلس')}
          </button>
        </div>
      </section>

      {/* 8-card executive KPI grid */}
      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2
          icon={<Banknote className="h-4 w-4" />}
          label={T('Approved net sales', 'صافي المبيعات المعتمدة')}
          value={kwd(view.netSales, lang, digits)}
          sub={T(`${fmt(view.orders)} orders`, `${fmt(view.orders)} طلباً`)}
          delta="+14.8%"
          spark={scaleTrend(TREND.sales)}
          sparkColor={TONE_HEX.sky}
        />
        <StatsCardV2
          icon={<TrendingUp className="h-4 w-4" />}
          label={T('Net operating profit', 'صافي الربح التشغيلي')}
          value={kwd(view.netProfit, lang, digits)}
          valueTone="emerald"
          delta={pct(view.marginPct)}
          sub={T('Margin after COGS, opex & payroll', 'الهامش بعد التكاليف والمصروفات والرواتب')}
          spark={scaleTrend(TREND.profit)}
          sparkColor={TONE_HEX.emerald}
        />
        <StatsCardV2
          icon={<ShoppingBag className="h-4 w-4" />}
          label={T('Total orders', 'إجمالي الطلبات')}
          value={fmt(view.orders)}
          sub={T(`${fmt(LEDGER.menuItems)} active items · top ${LEDGER.topItems} = 80% revenue`, `${fmt(LEDGER.menuItems)} صنفاً نشطاً · أعلى ${LEDGER.topItems} = 80% من الإيراد`)}
          spark={TREND.orders.map((v) => v * view.ordersShare)}
          sparkColor={TONE_HEX.sky}
        />
        <StatsCardV2
          icon={<Target className="h-4 w-4" />}
          label={T('Average order value', 'متوسط قيمة الطلب')}
          value={kwd(view.aov, lang, 3)}
          sub={T(`Target ${kwd(LEDGER.aovTarget, 'en', 3)} via beverage attach`, `المستهدف ${kwd(LEDGER.aovTarget, 'ar', 3)} عبر إضافة المشروب`)}
          target={{ label: T('Progress to AOV target', 'التقدم نحو المستهدف'), progress: (view.aov / LEDGER.aovTarget) * 100, tone: 'sky' }}
        />
        <StatsCardV2
          icon={<ChefHat className="h-4 w-4" />}
          label={T('Food & material cost', 'تكلفة الأغذية والمواد')}
          value={kwd(view.cogs, lang, digits)}
          valueTone="rose"
          delta={T('+0.8 pp vs target', '+0.8 نقطة عن المستهدف')}
          deltaTone="rose"
          sub={T(`${pct(LEDGER.cogsPct)} actual vs ${pct(LEDGER.cogsTargetPct)} target · ${LEDGER.cogsEntries} entries`, `${pct(LEDGER.cogsPct)} فعلي مقابل ${pct(LEDGER.cogsTargetPct)} مستهدف · ${LEDGER.cogsEntries} قيداً`)}
          spark={scaleTrend(TREND.cogs)}
          sparkColor={TONE_HEX.rose}
        />
        <StatsCardV2
          icon={<Wallet className="h-4 w-4" />}
          label={T('Opex & petty-cash custodies', 'المصروفات والعهد النثرية')}
          value={kwd(view.opex, lang, digits)}
          valueTone="amber"
          sub={T(`${fmt(LEDGER.opexEntries)} journal entries · maintenance ${kwd(view.custody, 'en', digits)}`, `${fmt(LEDGER.opexEntries)} قيداً · الصيانة ${kwd(view.custody, 'ar', digits)}`)}
          target={{ label: T('Maintenance custody share', 'حصة عهدة الصيانة'), progress: (LEDGER.maintCustody / LEDGER.opex) * 100, tone: 'amber' }}
        />
        <StatsCardV2
          icon={<BadgePercent className="h-4 w-4" />}
          label={T('Marketing & aggregator discounts', 'الخصومات التسويقية والمنصات')}
          value={kwd(view.discounts, lang, digits)}
          valueTone="rose"
          sub={T(`Keeta ${kwd(LEDGER.keetaDiscounts, 'en', 0)} across ${fmt(LEDGER.keetaOrders)} orders`, `كيتا ${kwd(LEDGER.keetaDiscounts, 'ar', 0)} عبر ${fmt(LEDGER.keetaOrders)} طلباً`)}
          target={{ label: T('Keeta share of discounts', 'حصة كيتا من الخصومات'), progress: (LEDGER.keetaDiscounts / LEDGER.discounts) * 100, tone: 'rose' }}
        />
        <StatsCardV2
          icon={<Coins className="h-4 w-4" />}
          label={T('Recoverable profit levers', 'الربح القابل للاسترداد')}
          value={`+${kwd(view.levers, lang, digits)}`}
          valueTone="emerald"
          sub={T(`5 approved levers · ${kwd(LEVERS_MONTHLY_TOTAL, 'en', 0)} per month at group level`, `5 روافع معتمدة · ${kwd(LEVERS_MONTHLY_TOTAL, 'ar', 0)} شهرياً للمجموعة`)}
          target={{ label: T('Uplift on current profit', 'الزيادة على الربح الحالي'), progress: (LEVERS_MONTHLY_TOTAL / LEDGER.netProfit) * 100 * 4, tone: 'emerald' }}
        />
      </section>

      {/* Admin V2 dual chart row */}
      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="ae-tile flex flex-col gap-5 p-5 lg:col-span-7">
          <SectionHeader
            icon={<Receipt className="h-4 w-4" />}
            title={chartMode === 'branches' ? T('Revenue & net profit · 9 active branches', 'الإيراد وصافي الربح · الفروع النشطة الـ 9') : T('Revenue & contribution · top channels', 'الإيراد والمساهمة · أهم القنوات')}
            subtitle={T('Click a bar to filter the whole workspace', 'اضغط على أي عمود لفلترة مساحة العمل بالكامل')}
            actions={
              <div className="ae-seg">
                <button type="button" data-active={chartMode === 'branches'} onClick={() => setChartMode('branches')}>
                  {T('Branches', 'الفروع')}
                </button>
                <button type="button" data-active={chartMode === 'channels'} onClick={() => setChartMode('channels')}>
                  {T('Channels', 'القنوات')}
                </button>
              </div>
            }
          />
          <div className="flex-1">
            <RoundedBars
              rows={barRows}
              height={230}
              seriesA={{ color: '#38BDF8', label: T('Net sales', 'صافي المبيعات') }}
              seriesB={{ color: '#059669', label: chartMode === 'branches' ? T('Net operating profit (margin % on top)', 'صافي الربح التشغيلي (الهامش أعلى العمود)') : T('Contribution after commission & COGS', 'المساهمة بعد العمولة والتكلفة') }}
              highlight={chartMode === 'branches' ? (filters.branch === 'all' ? null : filters.branch) : filters.channel === 'all' ? null : filters.channel}
              onSelect={(key) => {
                if (chartMode === 'branches') setBranch(filters.branch === key ? 'all' : (key as typeof filters.branch))
                else setChannel(filters.channel === key ? 'all' : (key as typeof filters.channel))
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-700/50">
            <div>
              <div className="ae-meta">{T('Top branch', 'الفرع الأعلى')}</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{T('Salmiya', 'السالمية')}</div>
              <Num className="text-xs text-emerald-600">{kwd(31246.23, lang, 3)} · 18.7%</Num>
            </div>
            <div>
              <div className="ae-meta">{T('Online availability', 'الجاهزية أونلاين')}</div>
              <Num className="text-sm text-slate-900 dark:text-white">{pct(LEDGER.uptimePct)}</Num>
              <div className="text-xs text-slate-500">{T('Aggregator tablets', 'أجهزة المنصات')}</div>
            </div>
            <div>
              <div className="ae-meta">{T('Channels live', 'القنوات النشطة')}</div>
              <Num className="text-sm text-slate-900 dark:text-white">11</Num>
              <div className="text-xs text-slate-500">{T('Incl. Talabat Tgo & TMP', 'تشمل طلبات جو وسوق طلبات')}</div>
            </div>
          </div>
        </div>

        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-5">
          <SectionHeader icon={<Flag className="h-4 w-4" />} title={T('6-brand revenue distribution', 'توزيع إيراد العلامات الست')} subtitle={T('Hover to inspect · click to filter', 'مرر للتفاصيل · اضغط للفلترة')} />
          <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
            <DonutGauge
              segments={brandSlices.map((b) => ({ key: b.id, value: b.value, color: b.color }))}
              activeIndex={hoverBrand}
              onHover={setHoverBrand}
              center={
                <>
                  <span className="text-[11px] font-semibold text-slate-500">{focusBrand ? (isAr ? focusBrand.ar : focusBrand.en) : T('Approved total', 'الإجمالي المعتمد')}</span>
                  <Num className="text-lg text-slate-900 dark:text-white">{kwd(focusBrand ? focusBrand.value : brandTotal, lang, 0)}</Num>
                  <Num className="text-[11px] text-emerald-600">{pct(focusBrand ? (focusBrand.value / (brandTotal || 1)) * 100 : 100)}</Num>
                </>
              }
            />
            <ul className="w-full flex-1 space-y-1.5">
              {brandSlices.map((b, i) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoverBrand(i)}
                    onMouseLeave={() => setHoverBrand(null)}
                    onClick={() => setBrand(filters.brand === b.id ? 'all' : b.id)}
                    data-active={filters.brand === b.id}
                    className={`ae-tile-soft flex w-full items-center justify-between gap-2 px-3 py-2 text-xs transition-transform hover:-translate-y-0.5 ${filters.brand === b.id ? 'ring-2 ring-sky-500' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{isAr ? b.ar : b.en}</span>
                    </span>
                    <Num className="text-slate-900 dark:text-white">{pct((b.value / (brandTotal || 1)) * 100)}</Num>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Quarterly → annual profit roadmap + P&L composition */}
      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="ae-tile flex flex-col gap-5 p-5 lg:col-span-8">
          <SectionHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title={T('Quarterly-to-annual profit roadmap', 'خارطة الربح من الربع إلى السنة')}
            subtitle={T('Approved trajectory with Feryal’s five remedies', 'المسار المعتمد مع حلول فريال الخمسة')}
            actions={<Badge tone="emerald">{T('Full year', 'السنة الكاملة')} <Num>{kwd(ROADMAP[3].total, lang, 0)}</Num></Badge>}
          />
          <div className="relative pt-2" dir="ltr">
            <div className="relative h-3 rounded-full bg-slate-100 dark:bg-white/10">
              <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: '100%', background: 'linear-gradient(90deg, #0284C7 0%, #0EA5E9 45%, #10B981 100%)' }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${runRateShare * 100}%`, background: 'linear-gradient(90deg, #0284C7, #0EA5E9)' }} />
              {ROADMAP.map((m, i) => (
                <span
                  key={m.id}
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-sm dark:border-slate-900"
                  style={{ left: `${Math.min(99, (m.total / ROADMAP[3].total) * 100)}%`, backgroundColor: i === 0 ? '#0284C7' : i === 3 ? '#059669' : '#0EA5E9' }}
                  title={isAr ? m.ar : m.en}
                />
              ))}
            </div>
            <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROADMAP.map((m, i) => (
                <div key={m.id} className={`ae-tile-soft p-3 ${i === 3 ? 'ring-2 ring-emerald-400/60' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-slate-500">{isAr ? m.ar : m.en}</span>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i === 0 ? '#0284C7' : i === 3 ? '#059669' : '#0EA5E9' }} />
                  </div>
                  <Num className="mt-1 block text-sm text-slate-900 dark:text-white sm:text-base">{kwd(m.total, lang, 0)}</Num>
                  <Num className={`text-[11px] ${m.incremental ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {m.incremental ? `+${kwd(m.incremental, lang, 0)}` : T('Monthly baseline', 'الأساس الشهري')}
                  </Num>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/50">
            {LEVERS.map((l) => (
              <span key={l.id} className="ae-tile-soft inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TONE_HEX[l.tone] }} />
                {isAr ? l.ar : l.en}
                <Num className="text-emerald-600">+{fmt(l.monthly)}</Num>
              </span>
            ))}
          </div>
        </div>

        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-4">
          <SectionHeader icon={<Receipt className="h-4 w-4" />} title={T('Income statement composition', 'تكوين قائمة الدخل')} subtitle={T('Share of approved net sales', 'النسبة من صافي المبيعات المعتمدة')} />
          <div className="flex h-3 overflow-hidden rounded-full" dir="ltr">
            {PNL.map((p) => (
              <div key={p.key} style={{ width: `${(p.value / LEDGER.netSales) * 100}%`, backgroundColor: p.color }} />
            ))}
          </div>
          <ul className="flex-1 space-y-2">
            {PNL.map((p) => (
              <li key={p.key} className="ae-tile-soft flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {isAr ? p.ar : p.en}
                </span>
                <span className="text-end">
                  <Num className="block text-slate-900 dark:text-white">{kwd(p.value * view.salesShare * pf, lang, digits)}</Num>
                  <Num className="text-[11px] text-slate-500">{pct((p.value / LEDGER.netSales) * 100)}</Num>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Executive recommendations */}
      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<Sparkles className="h-4 w-4" />}
          title={T('Executive recommendations ranked by monthly KWD impact', 'التوصيات التنفيذية مرتبة حسب الأثر الشهري')}
          subtitle={T(
            `Profit rises from ${kwd(LEDGER.netProfit, 'en', 3)} to ${kwd(LEDGER.netProfit + LEVERS_MONTHLY_TOTAL, 'en', 3)} per month when all five are executed`,
            `يرتفع الربح من ${kwd(LEDGER.netProfit, 'ar', 3)} إلى ${kwd(LEDGER.netProfit + LEVERS_MONTHLY_TOTAL, 'ar', 3)} شهرياً عند تنفيذ الخمس`,
          )}
          actions={
            <Link href="/erp/feryal-ai" className="ae-pill-dark no-print">
              {T('Open What-If calculator', 'فتح محاكي الأثر')}
              <ArrowUpRight className={`h-3.5 w-3.5 ${isAr ? '-scale-x-100' : ''}`} />
            </Link>
          }
        />
        <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-5">
          {LEVERS.map((l, i) => (
            <div key={l.id} className="ae-tile-soft ae-lift flex flex-col justify-between gap-3 p-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Num className="text-[11px] text-slate-400">#{i + 1}</Num>
                  <Badge tone={l.tone}>{isAr ? l.ownerAr : l.ownerEn}</Badge>
                </div>
                <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{isAr ? l.ar : l.en}</p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{isAr ? l.detailAr : l.detailEn}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <Num className="text-lg text-emerald-600 dark:text-emerald-400">+{kwd(l.monthly, lang, 0)}</Num>
                  <span className="text-[11px] text-slate-500">{T('/ month', '/ شهرياً')}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(l.monthly / LEVERS[0].monthly) * 100}%` }} />
                </div>
                <Link href={feryalHref(isAr ? `اشرحي خطة تنفيذ: ${l.ar}` : `Explain the execution plan for: ${l.en}`)} className="no-print inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-300">
                  <Sparkles className="h-3 w-3" />
                  {T('Ask Feryal', 'اسأل فريال')}
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {T(
            'Monthly impacts are approved management estimates on the October Odoo ledger. Filtered views allocate group totals proportionally by brand, branch and channel share.',
            'الأثر الشهري تقديرات إدارية معتمدة على دفتر أودو لشهر أكتوبر. العروض المفلترة توزع إجماليات المجموعة نسبياً حسب حصة العلامة والفرع والقناة.',
          )}
        </p>
      </section>
    </div>
  )
}
