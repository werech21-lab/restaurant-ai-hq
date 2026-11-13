'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Banknote, Check, ClipboardCopy, FileWarning, Landmark, Receipt, Send, ShieldAlert, Sparkles, Undo2 } from 'lucide-react'
import { BRANCHES, BRANDS, CHANNELS, LEDGER, feryalHref, fmt, kwd, pct } from '@/lib/aether/ledger'
import {
  CHARGEBACK_TYPES,
  WATERFALL_CHANNELS,
  chargebacksFor,
  disputeClaim,
  orderWaterfall,
  threeWayReconciliation,
  type Chargeback,
  type ChargebackStatus,
  type ReconRow,
} from '@/lib/enterprise-giants-engine'
import { useBiFilters } from '@/components/aether/BiFilterContext'
import { Badge, Num, ReorderableTable, SectionHeader, StatsCardV2, useCopy, useLang, type ReorderColumn } from '@/components/aether/ui'

// ---------------------------------------------------------------------------
// 1. 3-way payout reconciliation (Odoo POS → aggregator statement → bank deposit)
// ---------------------------------------------------------------------------
export function ThreeWayReconciliationTab() {
  const { lang, isAr, T } = useLang()
  const { filters } = useBiFilters()
  const rows = useMemo(() => threeWayReconciliation(filters), [filters])
  const sum = (k: keyof ReconRow) => rows.reduce((s, r) => s + (r[k] as number), 0)
  const digits = filters.period === 'daily' ? 3 : 0
  const exceptions = rows.filter((r) => r.status === 'exception').length

  const STATUS: Record<ReconRow['status'], { en: string; ar: string; tone: 'emerald' | 'amber' | 'rose' }> = {
    matched: { en: 'Matched', ar: 'مطابق', tone: 'emerald' },
    timing: { en: 'In transit', ar: 'قيد التحويل', tone: 'amber' },
    exception: { en: 'Discrepancy', ar: 'فرق مرصود', tone: 'rose' },
  }

  const columns: ReorderColumn<ReconRow>[] = [
    { key: 'channel', en: 'Channel', ar: 'القناة', render: (r) => <span className="font-semibold text-slate-900 dark:text-white">{isAr ? r.ar : r.en}</span>, csv: (r) => (isAr ? r.ar : r.en) },
    { key: 'pos', en: 'Odoo POS sales', ar: 'مبيعات نقاط البيع', align: 'end', render: (r) => <Num>{fmt(r.posSales, 3)}</Num>, csv: (r) => r.posSales.toFixed(3) },
    { key: 'expected', en: 'Expected settlement', ar: 'التسوية المتوقعة', align: 'end', render: (r) => <Num>{fmt(r.expected, 3)}</Num>, csv: (r) => r.expected.toFixed(3) },
    { key: 'statement', en: 'Aggregator statement', ar: 'كشف المنصة', align: 'end', render: (r) => <Num>{fmt(r.statement, 3)}</Num>, csv: (r) => r.statement.toFixed(3) },
    { key: 'bank', en: 'Bank deposit', ar: 'إيداع البنك', align: 'end', render: (r) => <Num className="text-slate-900 dark:text-white">{fmt(r.bank, 3)}</Num>, csv: (r) => r.bank.toFixed(3) },
    { key: 'cancelled', en: 'Unpaid cancellations', ar: 'إلغاءات غير مدفوعة', align: 'end', render: (r) => <Num className={r.cancelledUnpaid ? 'text-rose-600' : 'text-slate-300'}>{fmt(r.cancelledUnpaid, 3)}</Num>, csv: (r) => r.cancelledUnpaid.toFixed(3) },
    { key: 'promo', en: 'Unapproved promo', ar: 'خصومات غير معتمدة', align: 'end', render: (r) => <Num className={r.promoUnapproved ? 'text-rose-600' : 'text-slate-300'}>{fmt(r.promoUnapproved, 3)}</Num>, csv: (r) => r.promoUnapproved.toFixed(3) },
    { key: 'overbill', en: 'Commission over-billing', ar: 'عمولة زائدة', align: 'end', render: (r) => <Num className={r.commissionOverbill ? 'text-rose-600' : 'text-slate-300'}>{fmt(r.commissionOverbill, 3)}</Num>, csv: (r) => r.commissionOverbill.toFixed(3) },
    { key: 'transit', en: 'Delayed settlement', ar: 'تسوية متأخرة', align: 'end', render: (r) => <Num className={r.inTransit ? 'text-amber-600' : 'text-slate-300'}>{fmt(r.inTransit, 3)}</Num>, csv: (r) => r.inTransit.toFixed(3) },
    { key: 'status', en: 'Status', ar: 'الحالة', render: (r) => <Badge tone={STATUS[r.status].tone}>{isAr ? STATUS[r.status].ar : STATUS[r.status].en}</Badge>, csv: (r) => (isAr ? STATUS[r.status].ar : STATUS[r.status].en) },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCardV2 icon={<Receipt className="h-4 w-4" />} label={T(`Odoo POS sales (${LEDGER.channels} channels)`, `مبيعات نقاط البيع (${LEDGER.channels} قنوات)`)} value={kwd(sum('posSales'), lang, digits)} valueTone="sky" />
        <StatsCardV2 icon={<FileWarning className="h-4 w-4" />} label={T('Recoverable discrepancies', 'فروقات قابلة للاسترداد')} value={kwd(sum('recoverable'), lang, digits || 3)} valueTone="rose" sub={T(`${exceptions} channels flagged`, `${exceptions} قنوات مرصودة`)} />
        <StatsCardV2 icon={<Landmark className="h-4 w-4" />} label={T('Settlements in transit', 'تسويات قيد التحويل')} value={kwd(sum('inTransit'), lang, digits || 3)} valueTone="amber" sub={T('Delayed beyond the payout cycle', 'متأخرة عن دورة السداد')} />
        <StatsCardV2 icon={<Banknote className="h-4 w-4" />} label={T('Deposited in bank', 'المودع في البنك')} value={kwd(sum('bank'), lang, digits)} valueTone="emerald" target={{ label: T('Bank vs expected', 'البنك مقابل المتوقع'), progress: (sum('bank') / (sum('expected') || 1)) * 100, tone: 'emerald' }} />
      </div>
      <div className="ae-tile flex flex-wrap items-center gap-3 p-4 text-xs" dir="ltr">
        {[
          { label: T('POS sales', 'نقاط البيع'), value: sum('posSales') },
          { label: T('− commission & promo', '− العمولة والخصم'), value: -(sum('commission') + sum('promo')) },
          { label: T('= expected', '= المتوقع'), value: sum('expected') },
          { label: T('− discrepancies', '− الفروقات'), value: -sum('recoverable') },
          { label: T('= statement', '= الكشف'), value: sum('statement') },
          { label: T('− in transit', '− قيد التحويل'), value: -sum('inTransit') },
          { label: T('= bank', '= البنك'), value: sum('bank') },
        ].map((s, i) => (
          <span key={i} className={`ae-tile-soft inline-flex flex-col px-3 py-2 ${s.label.startsWith('=') ? 'ring-1 ring-sky-300/60' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
            <span className="text-[10px] text-slate-500">{s.label}</span>
            <Num className={s.value < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}>{fmt(s.value, digits || 3)}</Num>
          </span>
        ))}
      </div>
      <ReorderableTable columns={columns} rows={rows} rowKey={(r) => r.id} csvName={`aetherbi-3way-reconciliation-${filters.period}.csv`} maxHeight={520} />
      <p className="text-[11px] text-slate-500">
        {T(
          'Expected settlement applies each contract commission and approved promotions to Odoo POS sales. Discrepancies and settlement timing follow the October aggregator statement pattern; connect live statements and the bank feed to replace them.',
          'التسوية المتوقعة تطبق عمولة كل عقد والخصومات المعتمدة على مبيعات نقاط البيع في أودو. الفروقات وتوقيت التسويات تتبع نمط كشوف المنصات لشهر أكتوبر؛ اربط الكشوف الفعلية وحركة البنك لاستبدالها.',
        )}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Dispute & chargeback recovery tracker
// ---------------------------------------------------------------------------
const CB_STATUS: Record<ChargebackStatus, { en: string; ar: string; tone: 'rose' | 'amber' | 'emerald' }> = {
  detected: { en: 'Detected', ar: 'مرصود', tone: 'rose' },
  'claim-generated': { en: 'Claim generated', ar: 'تم إعداد المطالبة', tone: 'amber' },
  recovered: { en: 'Recovered', ar: 'تم الاسترداد', tone: 'emerald' },
}

export function ChargebacksTab() {
  const { lang, isAr, T } = useLang()
  const { filters } = useBiFilters()
  const base = useMemo(() => chargebacksFor(filters), [filters])
  const [status, setStatus] = useState<Record<string, ChargebackStatus>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ChargebackStatus | 'all'>('all')
  const { copied, copy } = useCopy()

  const list = base.map((c) => ({ ...c, status: status[c.id] ?? c.status }))
  const visible = list.filter((c) => statusFilter === 'all' || c.status === statusFilter)
  const total = (s: ChargebackStatus) => list.filter((c) => c.status === s).reduce((sum, c) => sum + c.amount, 0)
  const name = (c: Chargeback) => {
    const ch = CHANNELS.find((x) => x.id === c.channel)!
    const br = BRANCHES.find((x) => x.id === c.branch)!
    const bd = BRANDS.find((x) => x.id === c.brand)!
    return { ch: isAr ? ch.ar : ch.en, br: isAr ? br.ar : br.en, bd: isAr ? bd.ar : bd.en }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-3">
        <StatsCardV2 icon={<ShieldAlert className="h-4 w-4" />} label={T('Detected deductions', 'خصومات مرصودة')} value={kwd(total('detected'), lang, 3)} valueTone="rose" sub={T(`${list.filter((c) => c.status === 'detected').length} cases`, `${list.filter((c) => c.status === 'detected').length} حالات`)} />
        <StatsCardV2 icon={<Send className="h-4 w-4" />} label={T('Claims generated', 'مطالبات معدة')} value={kwd(total('claim-generated'), lang, 3)} valueTone="amber" sub={T('Awaiting aggregator response', 'بانتظار رد المنصة')} />
        <StatsCardV2 icon={<Undo2 className="h-4 w-4" />} label={T('Recovered', 'المسترد')} value={kwd(total('recovered'), lang, 3)} valueTone="emerald" target={{ label: T('Recovery rate', 'نسبة الاسترداد'), progress: (total('recovered') / (list.reduce((s, c) => s + c.amount, 0) || 1)) * 100, tone: 'emerald' }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="ae-seg">
          <button type="button" data-active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
            {T('All', 'الكل')} <Num className="ms-1 opacity-70">{list.length}</Num>
          </button>
          {(Object.keys(CB_STATUS) as ChargebackStatus[]).map((s) => (
            <button key={s} type="button" data-active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {isAr ? CB_STATUS[s].ar : CB_STATUS[s].en} <Num className="ms-1 opacity-70">{list.filter((c) => c.status === s).length}</Num>
            </button>
          ))}
        </div>
        <Link href={feryalHref(T('Summarise our open aggregator chargebacks and the fastest recovery plan.', 'لخصي مطالبات الاسترداد المفتوحة لدى المنصات وأسرع خطة استرداد.'))} className="btn-colored ms-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]">
          <Sparkles className="h-3 w-3" />
          {T('Ask Feryal', 'اسأل فريال')}
        </Link>
      </div>
      <div className="space-y-3">
        {visible.length === 0 ? (
          <div className="ae-tile p-8 text-center text-sm text-slate-500">{T('No disputes in this slice.', 'لا توجد نزاعات في هذه الشريحة.')}</div>
        ) : (
          visible.map((c) => {
            const n = name(c)
            const t = CHARGEBACK_TYPES[c.type]
            const st = CB_STATUS[c.status]
            const claim = disputeClaim(c, lang)
            return (
              <article key={c.id} className="ae-tile space-y-3 p-4">
                <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-12">
                  <div className="space-y-1 lg:col-span-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Num className="text-[11px] text-slate-400">{c.id}</Num>
                      <Badge tone={st.tone}>{isAr ? st.ar : st.en}</Badge>
                      <Badge tone="slate">{n.ch}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{isAr ? t.ar : t.en}</p>
                    <p className="text-[11px] text-slate-500">
                      {n.bd} · {n.br} · <Num>{c.orderRef}</Num> · <Num>{c.date}</Num>
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="ae-meta">{T('Disputed amount', 'المبلغ المتنازع عليه')}</div>
                    <Num className="text-base text-rose-600">{kwd(c.amount, lang, 3)}</Num>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:col-span-4 lg:justify-end">
                    <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="btn-colored inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]">
                      <FileWarning className="h-3 w-3" />
                      {open === c.id ? T('Hide claim', 'إخفاء المطالبة') : T('Generate dispute claim', 'إعداد مطالبة الاعتراض')}
                    </button>
                    {c.status !== 'recovered' ? (
                      <button
                        type="button"
                        onClick={() => setStatus((s) => ({ ...s, [c.id]: c.status === 'detected' ? 'claim-generated' : 'recovered' }))}
                        className="ae-pill-light ae-pill-sm"
                      >
                        <Check className="h-3 w-3" />
                        {c.status === 'detected' ? T('Mark claim sent', 'تأكيد إرسال المطالبة') : T('Mark recovered', 'تأكيد الاسترداد')}
                      </button>
                    ) : null}
                  </div>
                </div>
                {open === c.id ? (
                  <div className="ae-pop ae-tile-soft space-y-2 p-3">
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-200" style={{ fontFamily: 'inherit' }} dir={isAr ? 'rtl' : 'ltr'}>
                      {claim}
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          copy(c.id, claim)
                          if (c.status === 'detected') setStatus((s) => ({ ...s, [c.id]: 'claim-generated' }))
                        }}
                        className="btn-colored inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]"
                      >
                        {copied === c.id ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                        {copied === c.id ? T('Copied', 'تم النسخ') : T('Copy claim', 'نسخ المطالبة')}
                      </button>
                      <button type="button" onClick={() => copy(`${c.id}-alt`, disputeClaim(c, isAr ? 'en' : 'ar'))} className="ae-pill-light ae-pill-sm">
                        {copied === `${c.id}-alt` ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                        {T('Copy Arabic version', 'نسخ النسخة الإنجليزية')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. True per-order net profit waterfall
// ---------------------------------------------------------------------------
function Waterfall({ steps, max }: { steps: ReturnType<typeof orderWaterfall>['steps']; max: number }) {
  const { isAr } = useLang()
  const H = 170
  let running = 0
  return (
    <div className="flex items-end gap-1.5" style={{ height: H }} dir="ltr">
      {steps.map((s) => {
        const isTotal = s.key === 'gross' || s.key === 'net'
        const top = isTotal ? s.value : running
        const bottom = isTotal ? 0 : running + s.value
        if (!isTotal) running += s.value
        else running = s.value
        const hPct = (Math.abs(top - bottom) / max) * 100
        const bottomPct = (Math.min(top, bottom) / max) * 100
        const color = s.key === 'gross' ? '#38BDF8' : s.key === 'net' ? '#059669' : '#E11D48'
        return (
          <div key={s.key} className="relative flex h-full flex-1 flex-col justify-end" title={isAr ? s.ar : s.en}>
            <div className="absolute w-full rounded-md transition-all duration-500" style={{ bottom: `${bottomPct}%`, height: `${Math.max(1.5, hPct)}%`, backgroundColor: color, opacity: isTotal ? 1 : 0.85 }} />
            <span className="ae-num absolute w-full text-center text-[9px] font-bold text-slate-600 dark:text-slate-300" style={{ bottom: `calc(${bottomPct + hPct}% + 2px)` }}>
              {s.value < 0 ? '−' : ''}
              {fmt(Math.abs(s.value), 3)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function OrderWaterfallTab() {
  const { lang, isAr, T } = useLang()
  const data = useMemo(() => WATERFALL_CHANNELS.map((id) => orderWaterfall(id)), [])
  const max = Math.max(...data.map((d) => d.gross)) * 1.12
  const best = data.reduce((a, b) => (b.pocket > a.pocket ? b : a), data[0])

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={<Receipt className="h-4 w-4" />}
        title={T('True per-order net profit waterfall', 'شلال صافي الربح الحقيقي لكل طلب')}
        subtitle={T('Gross basket → commission → marketing discount → food COGS → packaging (→ own rider) = net pocket profit', 'السلة الإجمالية ← العمولة ← الخصم ← تكلفة الأغذية ← التغليف (← سائق المطعم) = صافي الربح')}
        actions={
          <Link href={feryalHref(T('Compare the per-order net pocket profit across Talabat Tgo, TMP, Keeta, Deliveroo and Jahez.', 'قارني صافي الربح لكل طلب بين طلبات جو وسوق طلبات وكيتا وديليفرو وجاهز.'))} className="btn-colored inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-emerald-500 dark:bg-emerald-500 dark:text-[#04130D]">
            <Sparkles className="h-3 w-3" />
            {T('Ask Feryal', 'اسأل فريال')}
          </Link>
        }
      />
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.map((d) => (
          <div key={d.channel.id} className={`ae-tile ae-lift flex flex-col gap-3 p-4 ${d.channel.id === best.channel.id ? 'ring-2 ring-emerald-400/60' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="ae-h text-sm text-slate-900 dark:text-white">{isAr ? d.channel.ar : d.channel.en}</span>
              {d.channel.id === best.channel.id ? <Badge tone="emerald">{T('Best', 'الأفضل')}</Badge> : null}
            </div>
            <Waterfall steps={d.steps} max={max} />
            <ul className="space-y-1 text-[11px]">
              {d.steps.map((s) => (
                <li key={s.key} className={`flex justify-between ${s.key === 'net' ? 'border-t border-slate-100 pt-1 font-bold dark:border-slate-700/50' : ''}`}>
                  <span className="text-slate-600 dark:text-slate-300">{isAr ? s.ar : s.en}</span>
                  <Num className={s.key === 'net' ? 'text-emerald-600' : s.value < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}>{fmt(s.value, 3)}</Num>
                </li>
              ))}
            </ul>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <div className="ae-tile-soft p-2 text-center">
                <div className="text-[10px] text-slate-500">{T('Pocket margin', 'هامش الطلب')}</div>
                <Num className="text-sm text-emerald-600">{pct(d.pocketPct)}</Num>
              </div>
              <div className="ae-tile-soft p-2 text-center">
                <div className="text-[10px] text-slate-500">{T('Per month', 'شهرياً')}</div>
                <Num className="text-sm text-slate-900 dark:text-white">{kwd(d.monthlyPocket, lang, 0)}</Num>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        {T(
          `Per-order averages from October channel sales, contract commission rates, approved promotions, ${LEDGER.cogsPct}% food cost, 0.180 KWD packaging per delivery order and 0.350 KWD own-rider cost on TMP. Net pocket profit is before salaries, rent and overheads.`,
          `متوسطات لكل طلب من مبيعات القنوات لشهر أكتوبر ونسب العمولات التعاقدية والخصومات المعتمدة وتكلفة أغذية ${LEDGER.cogsPct}% وتغليف 0.180 د.ك لكل طلب توصيل وتكلفة سائق 0.350 د.ك في سوق طلبات. صافي الربح قبل الرواتب والإيجار والمصاريف العامة.`,
        )}
      </p>
    </div>
  )
}
