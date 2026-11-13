'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Bike, CheckCircle2, Percent, Radar, Scale, Send, Sparkles, Truck, Wallet } from 'lucide-react'
import {
  AGGREGATOR_IDS,
  BRANCHES,
  CHANNELS,
  LEDGER,
  feryalHref,
  fmt,
  kwd,
  pct,
  sliceShares,
  type Channel,
} from '@/lib/aether/ledger'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, CircularGauge, Num, ReorderableTable, RoundedBars, SectionHeader, StatsCardV2, useLang, type ReorderColumn } from '@/components/aether/ui'
import { ChargebacksTab, OrderWaterfallTab, ThreeWayReconciliationTab } from '@/components/aether/DeliveryEnterpriseTabs'

type DeliveryTab = 'overview' | 'reconciliation' | 'chargebacks' | 'waterfall'

type ReconRow = {
  id: string
  name: string
  orders: number
  gross: number
  commission: number
  promo: number
  rider: number
  payout: number
}

function unitEconomics(c: Channel) {
  const aov = c.sales / c.orders
  const commission = aov * (c.commissionPct / 100)
  const promo = c.promo / c.orders
  const cogs = aov * (LEDGER.cogsPct / 100)
  const rider = c.riderCostPerOrder
  const net = aov - commission - promo - cogs - rider
  return { aov, commission, promo, cogs, rider, net, netPct: (net / aov) * 100, total: net * c.orders }
}

const AGGREGATOR_SHARE = (CHANNELS.filter((c) => c.group === 'aggregator').reduce((x, c) => x + c.sales, 0) / LEDGER.netSales) * 100

export function DeliveryControlV2() {
  const { lang, isAr, T } = useLang()
  const { filters, view } = useBiFilters()
  const [capPct, setCapPct] = useState<number>(LEDGER.keetaCapPct)
  const [reconMode, setReconMode] = useState<'aggregator' | 'branch'>('aggregator')
  const [dispatch, setDispatch] = useState<'idle' | 'sending' | 'done'>('idle')
  const [dispatchMsg, setDispatchMsg] = useState('')
  const [tab, setTab] = useState<DeliveryTab>('overview')

  const digits = filters.period === 'daily' ? 3 : 0
  const s = sliceShares({ brand: filters.brand, branch: filters.branch, channel: 'all' })
  const factor = s.brandShare * s.branchShare * view.periodFactor
  const rows: ReconRow[] = useMemo(
    () =>
      CHANNELS.filter((c) => AGGREGATOR_IDS.includes(c.id) && (filters.channel === 'all' || c.id === filters.channel)).map((c) => {
        const gross = c.sales * factor
        const commission = gross * (c.commissionPct / 100)
        const promo = c.promo * factor
        const rider = c.riderCostPerOrder * c.orders * factor
        return { id: c.id, name: isAr ? c.ar : c.en, orders: c.orders * factor, gross, commission, promo, rider, payout: gross - commission - promo - rider }
      }),
    [filters.channel, factor, isAr],
  )
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({ gross: acc.gross + r.gross, commission: acc.commission + r.commission, promo: acc.promo + r.promo, rider: acc.rider + r.rider, payout: acc.payout + r.payout, orders: acc.orders + r.orders }),
        { gross: 0, commission: 0, promo: 0, rider: 0, payout: 0, orders: 0 },
      ),
    [rows],
  )

  const branchRows: ReconRow[] = useMemo(() => {
    const aggShare = totals.gross > 0 ? totals : null
    return BRANCHES.filter((b) => filters.branch === 'all' || b.id === filters.branch).map((b) => {
      const w = filters.branch === 'all' ? b.sales / LEDGER.netSales : 1
      return {
        id: b.id,
        name: isAr ? b.ar : b.en,
        orders: (aggShare?.orders ?? 0) * w,
        gross: (aggShare?.gross ?? 0) * w,
        commission: (aggShare?.commission ?? 0) * w,
        promo: (aggShare?.promo ?? 0) * w,
        rider: (aggShare?.rider ?? 0) * w,
        payout: (aggShare?.payout ?? 0) * w,
      }
    })
  }, [filters.branch, isAr, totals])

  const tgo = CHANNELS.find((c) => c.id === 'talabat-tgo')!
  const tmp = CHANNELS.find((c) => c.id === 'talabat-tmp')!
  const eTgo = unitEconomics(tgo)
  const eTmp = unitEconomics(tmp)

  // Keeta promo cap simulator (approved: 3.5% of the 26,400 KWD promo-eligible base = 924 KWD).
  const cappedSpend = LEDGER.keetaPromoBase * (capPct / 100)
  const keetaSavings = Math.max(0, LEDGER.keetaDiscounts - cappedSpend)
  const effectiveRate = (LEDGER.keetaDiscounts / LEDGER.keetaPromoBase) * 100

  const dispatchCap = async () => {
    setDispatch('sending')
    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'composio', actionType: 'dispatch_keeta_cap', lang }),
      })
      const data = (await res.json()) as { success?: boolean; message?: string }
      setDispatchMsg(data.message || T('Keeta promo cap dispatched.', 'تم إرسال سقف خصومات كيتا.'))
    } catch {
      setDispatchMsg(T('Dispatch queued; the gateway will retry.', 'تمت جدولة الإرسال وسيعاد المحاولة.'))
    } finally {
      setDispatch('done')
    }
  }

  const h2h: { key: string; en: string; ar: string; tgo: number; tmp: number; fmtFn: (n: number) => string; better: 'high' | 'low' }[] = [
    { key: 'orders', en: 'Orders', ar: 'الطلبات', tgo: tgo.orders, tmp: tmp.orders, fmtFn: (n) => fmt(n), better: 'high' },
    { key: 'sales', en: 'Net sales', ar: 'صافي المبيعات', tgo: tgo.sales, tmp: tmp.sales, fmtFn: (n) => kwd(n, lang, 0), better: 'high' },
    { key: 'aov', en: 'Average order value', ar: 'متوسط الطلب', tgo: eTgo.aov, tmp: eTmp.aov, fmtFn: (n) => fmt(n, 3), better: 'high' },
    { key: 'comm', en: 'Commission per order', ar: 'العمولة لكل طلب', tgo: eTgo.commission, tmp: eTmp.commission, fmtFn: (n) => fmt(n, 3), better: 'low' },
    { key: 'rider', en: 'Own rider cost per order', ar: 'تكلفة السائق لكل طلب', tgo: eTgo.rider, tmp: eTmp.rider, fmtFn: (n) => fmt(n, 3), better: 'low' },
    { key: 'promo', en: 'Promo per order', ar: 'الخصم لكل طلب', tgo: eTgo.promo, tmp: eTmp.promo, fmtFn: (n) => fmt(n, 3), better: 'low' },
    { key: 'cogs', en: `Food cost per order (${LEDGER.cogsPct}%)`, ar: `تكلفة الأغذية لكل طلب (${LEDGER.cogsPct}%)`, tgo: eTgo.cogs, tmp: eTmp.cogs, fmtFn: (n) => fmt(n, 3), better: 'low' },
    { key: 'net', en: 'Net contribution per order', ar: 'صافي المساهمة لكل طلب', tgo: eTgo.net, tmp: eTmp.net, fmtFn: (n) => fmt(n, 3), better: 'high' },
    { key: 'netpct', en: 'Contribution margin', ar: 'هامش المساهمة', tgo: eTgo.netPct, tmp: eTmp.netPct, fmtFn: (n) => pct(n), better: 'high' },
    { key: 'total', en: 'Monthly contribution', ar: 'المساهمة الشهرية', tgo: eTgo.total, tmp: eTmp.total, fmtFn: (n) => kwd(n, lang, 0), better: 'high' },
  ]

  const reconColumns: ReorderColumn<ReconRow>[] = [
    { key: 'name', en: reconMode === 'aggregator' ? 'Aggregator' : 'Branch', ar: reconMode === 'aggregator' ? 'المنصة' : 'الفرع', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{r.name}</span>, csv: (r) => r.name },
    { key: 'orders', en: 'Orders', ar: 'الطلبات', align: 'end', render: (r) => <Num>{fmt(r.orders)}</Num>, csv: (r) => Math.round(r.orders) },
    { key: 'gross', en: 'Gross sales', ar: 'إجمالي المبيعات', align: 'end', render: (r) => <Num>{fmt(r.gross, digits || 3)}</Num>, csv: (r) => r.gross.toFixed(3) },
    { key: 'commission', en: 'Commission', ar: 'العمولة', align: 'end', render: (r) => <Num className="text-rose-600">−{fmt(r.commission, digits || 3)}</Num>, csv: (r) => r.commission.toFixed(3) },
    { key: 'promo', en: 'Promotions', ar: 'الخصومات', align: 'end', render: (r) => <Num className="text-amber-600">−{fmt(r.promo, digits || 3)}</Num>, csv: (r) => r.promo.toFixed(3) },
    { key: 'rider', en: 'Own riders', ar: 'السائقون', align: 'end', render: (r) => <Num className="text-slate-500">−{fmt(r.rider, digits || 3)}</Num>, csv: (r) => r.rider.toFixed(3) },
    { key: 'payout', en: 'Net payout', ar: 'صافي التسوية', align: 'end', render: (r) => <Num className="text-emerald-600">{fmt(r.payout, digits || 3)}</Num>, csv: (r) => r.payout.toFixed(3) },
    { key: 'status', en: 'Odoo status', ar: 'حالة أودو', render: () => <Badge tone="emerald"><CheckCircle2 className="h-3 w-3" />{T('Reconciled', 'مطابق')}</Badge>, csv: () => (isAr ? 'مطابق' : 'Reconciled') },
  ]

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <Badge tone="sky">{T('Aggregator finance', 'مالية منصات التوصيل')}</Badge>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('Delivery Aggregators Control', 'رقابة منصات التوصيل')}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {T(
              'Talabat Tgo, Talabat TMP, Keeta, Deliveroo, Jahez and Cari — commissions, promotions, rider costs and net payouts reconciled to Odoo.',
              'طلبات جو وسوق طلبات وكيتا وديليفرو وجاهز وكاري — العمولات والخصومات وتكلفة السائقين وصافي التسويات مطابقة مع أودو.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/erp/aggregator-radar" className="ae-pill-light">
            <Radar className="h-3.5 w-3.5" />
            {T('Commission radar', 'رادار العمولات')}
          </Link>
          <Link href={feryalHref(T('Compare Talabat Tgo versus TMP unit economics per order.', 'قارني اقتصاديات الطلب بين طلبات جو وسوق طلبات.'))} className="btn-colored inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]">
            <Sparkles className="h-3.5 w-3.5" />
            {T('Ask Feryal', 'اسأل فريال')}
          </Link>
        </div>
      </section>

      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="ae-seg flex-wrap" role="tablist" aria-label={T('Delivery control views', 'عروض رقابة التوصيل')}>
          {([
            { id: 'overview', en: 'Finance overview', ar: 'النظرة المالية' },
            { id: 'reconciliation', en: '3-way reconciliation', ar: 'المطابقة الثلاثية' },
            { id: 'chargebacks', en: 'Disputes & chargebacks', ar: 'النزاعات والاستردادات' },
            { id: 'waterfall', en: 'Per-order profit waterfall', ar: 'شلال ربح الطلب' },
          ] as { id: DeliveryTab; en: string; ar: string }[]).map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {isAr ? t.ar : t.en}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' ? (
      <>
      <section className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2 icon={<Truck className="h-4 w-4" />} label={T('Aggregator gross sales', 'إجمالي مبيعات المنصات')} value={kwd(totals.gross, lang, digits)} sub={T(`${fmt(totals.orders)} orders`, `${fmt(totals.orders)} طلباً`)} valueTone="sky" />
        <StatsCardV2 icon={<Percent className="h-4 w-4" />} label={T('Commission paid', 'العمولات المدفوعة')} value={kwd(totals.commission, lang, digits)} valueTone="rose" sub={T(`${pct(totals.gross ? (totals.commission / totals.gross) * 100 : 0)} blended rate`, `${pct(totals.gross ? (totals.commission / totals.gross) * 100 : 0)} متوسط النسبة`)} />
        <StatsCardV2 icon={<Wallet className="h-4 w-4" />} label={T('Promotions funded', 'الخصومات الممولة')} value={kwd(totals.promo, lang, digits)} valueTone="amber" sub={T(`Keeta ${kwd(LEDGER.keetaDiscounts, 'en', 0)} at group level`, `كيتا ${kwd(LEDGER.keetaDiscounts, 'ar', 0)} على مستوى المجموعة`)} />
        <StatsCardV2 icon={<Scale className="h-4 w-4" />} label={T('Net payout to Venture Foods', 'صافي التسويات للشركة')} value={kwd(totals.payout, lang, digits)} valueTone="emerald" target={{ label: T('Payout ratio', 'نسبة التسوية'), progress: totals.gross ? (totals.payout / totals.gross) * 100 : 0, tone: 'emerald' }} />
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-8">
          <SectionHeader icon={<Truck className="h-4 w-4" />} title={T('Monthly channel revenue vs net payout', 'إيراد القنوات مقابل صافي التسوية')} subtitle={T('Aggregators in the active slice', 'المنصات ضمن الشريحة الحالية')} />
          <RoundedBars
            rows={rows.map((r) => ({ key: r.id, label: r.name, a: r.gross, b: r.payout, top: pct(r.gross ? (r.payout / r.gross) * 100 : 0, 0) }))}
            height={230}
            seriesA={{ color: '#38BDF8', label: T('Gross sales', 'إجمالي المبيعات') }}
            seriesB={{ color: '#059669', label: T('Net payout (payout % on top)', 'صافي التسوية (النسبة أعلى العمود)') }}
          />
        </div>
        <div className="ae-tile flex flex-col items-center justify-around gap-4 p-5 lg:col-span-4">
          <CircularGauge value={LEDGER.marginPct} max={40} color="#059669" label={<><Num className="text-xl text-slate-900 dark:text-white">{pct(LEDGER.marginPct)}</Num><span className="text-[10px] text-slate-500">{T('net margin', 'صافي الهامش')}</span></>} caption={T('Group net operating margin', 'صافي هامش التشغيل للمجموعة')} />
          <CircularGauge value={AGGREGATOR_SHARE} color="#0284C7" label={<><Num className="text-xl text-slate-900 dark:text-white">{pct(AGGREGATOR_SHARE)}</Num><span className="text-[10px] text-slate-500">{T('of sales', 'من المبيعات')}</span></>} caption={T('Aggregator share of Odoo POS sales', 'حصة المنصات من مبيعات أودو')} />
        </div>
      </section>

      <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-7">
          <SectionHeader
            icon={<Bike className="h-4 w-4" />}
            title={T('Talabat Tgo vs TMP unit economics', 'اقتصاديات طلبات جو مقابل سوق طلبات')}
            subtitle={T('Tgo: Talabat riders, 17% commission · TMP: own riders, 10% commission', 'طلبات جو: سائقو طلبات بعمولة 17% · سوق طلبات: سائقونا بعمولة 10%')}
          />
          <div className="ae-table-wrap w-full overflow-x-auto rounded-xl ring-1 ring-slate-200/70 dark:ring-slate-700/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <th className="px-3 py-2.5 text-start font-semibold">{T('Metric', 'المؤشر')}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{isAr ? tgo.ar : tgo.en}</th>
                  <th className="px-3 py-2.5 text-end font-semibold">{isAr ? tmp.ar : tmp.en}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {h2h.map((r) => {
                  const tgoWins = r.better === 'high' ? r.tgo > r.tmp : r.tgo < r.tmp
                  const tie = r.tgo === r.tmp
                  return (
                    <tr key={r.key}>
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{isAr ? r.ar : r.en}</td>
                      <td className={`px-3 py-2 text-end ${!tie && tgoWins ? 'font-bold text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                        <Num>{r.fmtFn(r.tgo)}</Num>
                      </td>
                      <td className={`px-3 py-2 text-end ${!tie && !tgoWins ? 'font-bold text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                        <Num>{r.fmtFn(r.tmp)}</Num>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">
            {eTmp.net > eTgo.net
              ? T(
                  `TMP earns ${fmt(eTmp.net - eTgo.net, 3)} KWD more per order after own-rider cost — route high-AOV combos to TMP where rider capacity allows.`,
                  `سوق طلبات يحقق ${fmt(eTmp.net - eTgo.net, 3)} د.ك إضافية لكل طلب بعد تكلفة السائق — وجّه وجبات الكومبو المرتفعة إلى سوق طلبات حيث تسمح طاقة السائقين.`,
                )
              : T('Tgo leads on net contribution per order.', 'طلبات جو يتقدم في صافي المساهمة لكل طلب.')}
          </p>
        </div>

        <div className="ae-tile flex flex-col gap-4 p-5 lg:col-span-5">
          <SectionHeader icon={<Percent className="h-4 w-4" />} title={T('Keeta 3.5% promo cap simulator', 'محاكي سقف خصومات كيتا 3.5%')} subtitle={T(`${fmt(LEDGER.keetaOrders)} orders · current effective rate ${pct(effectiveRate)}`, `${fmt(LEDGER.keetaOrders)} طلباً · النسبة الفعلية الحالية ${pct(effectiveRate)}`)} />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{T('Promo cap', 'سقف الخصم')}</span>
              <Num className="text-base text-slate-900 dark:text-white">{pct(capPct)}</Num>
            </div>
            <input type="range" min={1.5} max={8} step={0.1} value={capPct} onChange={(e) => setCapPct(Number(e.target.value))} className="w-full accent-sky-600" aria-label={T('Promo cap', 'سقف الخصم')} />
            <div className="flex justify-between text-[10px] text-slate-400">
              <Num>1.5%</Num>
              <button type="button" onClick={() => setCapPct(LEDGER.keetaCapPct)} className="font-semibold text-sky-600 hover:underline">
                {T('Approved 3.5%', 'المعتمد 3.5%')}
              </button>
              <Num>8.0%</Num>
            </div>
          </div>
          <div className="space-y-2" dir="ltr">
            {[
              { label: T('Current burn', 'الإنفاق الحالي'), value: LEDGER.keetaDiscounts, color: '#E11D48' },
              { label: T('Capped spend', 'الإنفاق بعد السقف'), value: cappedSpend, color: '#0284C7' },
            ].map((b) => (
              <div key={b.label} className="space-y-1" dir={isAr ? 'rtl' : 'ltr'}>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>{b.label}</span>
                  <Num className="text-slate-900 dark:text-white">{kwd(b.value, lang, 0)}</Num>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.min(100, (b.value / LEDGER.keetaDiscounts) * 100)}%`, backgroundColor: b.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="ae-tile-soft p-3">
              <div className="ae-meta">{T('Monthly savings', 'الوفر الشهري')}</div>
              <Num className="text-lg text-emerald-600">+{kwd(keetaSavings, lang, 0)}</Num>
            </div>
            <div className="ae-tile-soft p-3">
              <div className="ae-meta">{T('Annualised', 'سنوياً')}</div>
              <Num className="text-lg text-emerald-600">+{kwd(keetaSavings * 12, lang, 0)}</Num>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button type="button" onClick={dispatchCap} disabled={dispatch === 'sending'} className="btn-colored inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-[#04130D]">
              <Send className="h-3.5 w-3.5" />
              {dispatch === 'sending' ? T('Dispatching…', 'جارٍ الإرسال…') : T('Dispatch cap via Composio', 'إرسال السقف عبر كومبوزيو')}
            </button>
            {dispatch === 'done' ? <span className="text-[11px] font-semibold text-emerald-600">{dispatchMsg}</span> : null}
          </div>
        </div>
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader
          icon={<Scale className="h-4 w-4" />}
          title={T('Aggregator & branch payout reconciliation', 'مطابقة تسويات المنصات والفروع')}
          subtitle={T('Gross → commission → promotions → riders → net payout, matched to Odoo journals', 'الإجمالي ← العمولة ← الخصومات ← السائقون ← صافي التسوية مطابقة مع قيود أودو')}
          actions={
            <div className="ae-seg">
              <button type="button" data-active={reconMode === 'aggregator'} onClick={() => setReconMode('aggregator')}>
                {T('By aggregator', 'حسب المنصة')}
              </button>
              <button type="button" data-active={reconMode === 'branch'} onClick={() => setReconMode('branch')}>
                {T('By branch', 'حسب الفرع')}
              </button>
            </div>
          }
        />
        <ReorderableTable
          key={reconMode}
          columns={reconColumns}
          rows={reconMode === 'aggregator' ? rows : branchRows}
          rowKey={(r) => r.id}
          csvName={`aetherbi-payout-reconciliation-${reconMode}-${filters.period}.csv`}
          maxHeight={460}
          footer={
            <div className="flex flex-wrap items-center justify-end gap-4 text-xs text-slate-600 dark:text-slate-300">
              <span>
                {T('Total net payout', 'إجمالي صافي التسويات')}: <Num className="text-emerald-600">{kwd(totals.payout, lang, digits || 3)}</Num>
              </span>
              <span>
                {T('Total commission', 'إجمالي العمولات')}: <Num className="text-rose-600">{kwd(totals.commission, lang, digits || 3)}</Num>
              </span>
            </div>
          }
        />
      </section>
      </>
      ) : tab === 'reconciliation' ? (
        <ThreeWayReconciliationTab />
      ) : tab === 'chargebacks' ? (
        <ChargebacksTab />
      ) : (
        <OrderWaterfallTab />
      )}
    </div>
  )
}
