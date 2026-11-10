'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Radar, Truck } from 'lucide-react'
import { CHANNEL_ECONOMICS } from '@/lib/aether-proprietary-brain'
import { BRANDS, LEDGER } from '@/lib/aether/ledger'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import { INITIAL_BRANCH_PROFILES } from '@/lib/radar/talabat-geo-zone-radar'
import { useLang } from '@/components/aether/ui'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const card = 'min-w-0 rounded-[22px] bg-white p-5 shadow-[0_8px_32px_rgba(10,30,50,0.05)] ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800'
const PROMO_CAP = LEDGER.keetaCapPct

/** Delivery & Aggregator Radar — channel economics, zone accounts and settlement claims on Odoo data. */
export function DeliveryRadarV5() {
  const { isAr, T } = useLang()
  const [statement, setStatement] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const kwd = (n: number, d = 0) => (isAr ? `${d ? f3(n) : f0(n)} د.ك` : `${d ? f3(n) : f0(n)} KWD`)

  const aggIds = useMemo(() => new Set(CHANNEL_ECONOMICS.map((c) => c.id)), [])
  const locations = useMemo(
    () =>
      INITIAL_BRANCH_PROFILES.map((p) => {
        const loc = ODOO.restaurants.find((r) => r.en === p.branchNameEn)
        const agg = loc ? loc.channels.filter((c) => aggIds.has(c.channel)).reduce((s, c) => s + c.amountKwd, 0) : 0
        const tgo = p.zoneAccounts.filter((a) => a.deliveryMode === 'Tgo')
        const tmp = p.zoneAccounts.filter((a) => a.deliveryMode === 'M')
        return {
          id: p.branchId,
          en: p.branchNameEn,
          ar: p.branchNameAr,
          net: loc?.netKwd ?? 0,
          agg,
          share: loc && loc.netKwd ? (agg / loc.netKwd) * 100 : 0,
          tgo: tgo.length,
          tmp: tmp.length,
          platforms: [...new Set(p.zoneAccounts.map((a) => a.platform))],
          brands: p.supportedBrandIds.map((b) => BRANDS.find((x) => x.id === b)).filter(Boolean) as typeof BRANDS,
        }
      }),
    [aggIds],
  )

  const claimText = (c: (typeof CHANNEL_ECONOMICS)[number], actual: number) => {
    const gap = c.expectedPayout - actual
    return isAr
      ? [
          `إلى: مدير حساب ${c.ar}`,
          `الموضوع: مطالبة تسوية — ${LEDGER.periodLabelAr}`,
          '',
          `تحية طيبة، تتقدم شركة فنتشر فودز لإدارة المطاعم ذ.م.م (ترخيص رقم ${LEDGER.licence}) بمطالبة فرق تسوية عن ${LEDGER.periodLabelAr}.`,
          `المدفوعات المسجلة في نقاط البيع: ${f3(c.sales)} د.ك عبر ${f0(c.orders)} طلباً.`,
          `التسوية المتوقعة بعد العمولة التعاقدية ${c.commissionPct}%: ${f3(c.expectedPayout)} د.ك.`,
          `المبلغ الوارد في كشفكم: ${f3(actual)} د.ك — الفرق المطالب به: ${f3(gap)} د.ك.`,
          'نرجو تزويدنا بتفصيل الطلبات الملغاة والخصومات والعمولات وإضافة الفرق إلى دورة التسوية القادمة خلال 7 أيام عمل.',
          '',
          'مع خالص التقدير،',
          'قسم مطابقة المنصات — فنتشر فودز',
        ].join('\n')
      : [
          `To: ${c.en} Account Manager`,
          `Subject: Settlement claim — ${LEDGER.periodLabelEn}`,
          '',
          `Venture Foods Restaurants Management Co. W.L.L. (Licence No. ${LEDGER.licence}) raises a settlement difference for ${LEDGER.periodLabelEn}.`,
          `Payments recorded in our POS: ${f3(c.sales)} KWD across ${f0(c.orders)} orders.`,
          `Expected payout after the ${c.commissionPct}% contract commission: ${f3(c.expectedPayout)} KWD.`,
          `Amount on your statement: ${f3(actual)} KWD — difference claimed: ${f3(gap)} KWD.`,
          'Please share the order-level detail of cancellations, discounts and commissions and credit the difference in the next settlement cycle within 7 business days.',
          '',
          'Kind regards,',
          'Aggregator Reconciliation Desk — Venture Foods',
        ].join('\n')
  }

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {}
    setCopied(id)
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6">
      <section className={`${card} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0F172A] text-white">
            <Radar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">{T('Delivery & Aggregator Radar', 'رادار منصات التوصيل')}</h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400">
              {T(
                `Odoo payments, contract commissions, promotion burn and settlement claims · ${LEDGER.periodLabelEn}`,
                `مدفوعات أودو والعمولات التعاقدية واستنزاف العروض ومطالبات التسوية · ${LEDGER.periodLabelAr}`,
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Channel economics */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('Channel economics', 'اقتصاديات القنوات')}</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {CHANNEL_ECONOMICS.map((c) => {
            const over = c.promoPct > PROMO_CAP
            return (
              <article key={c.id} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="min-w-0 text-[15px] font-bold text-slate-900 dark:text-white">{isAr ? c.ar : c.en}</h3>
                  {c.riderCostPerOrder > 0 ? (
                    <span className="whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">{T('Restaurant fleet', 'أسطول المطعم')}</span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{T('Platform fleet', 'أسطول المنصة')}</span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                  <div className="min-w-0"><dt className="text-slate-500">{T('Odoo payments', 'مدفوعات أودو')}</dt><dd className="font-bold tabular-nums text-slate-900 dark:text-white">{kwd(c.sales)}</dd></div>
                  <div className="min-w-0"><dt className="text-slate-500">{T('Orders', 'الطلبات')}</dt><dd className="font-bold tabular-nums text-slate-900 dark:text-white">{f0(c.orders)}</dd></div>
                  <div className="min-w-0"><dt className="text-slate-500">{T('Commission', 'العمولة')}</dt><dd className="font-bold tabular-nums text-slate-900 dark:text-white">{c.commissionPct}% · {kwd(c.commissionKwd)}</dd></div>
                  <div className="min-w-0"><dt className="text-slate-500">{T('Expected payout', 'التسوية المتوقعة')}</dt><dd className="font-bold tabular-nums text-slate-900 dark:text-white">{kwd(c.expectedPayout)}</dd></div>
                  <div className="min-w-0"><dt className="text-slate-500">{T('Promotion burn', 'استنزاف العروض')}</dt><dd className={`font-bold tabular-nums ${over ? 'text-rose-600' : 'text-emerald-700 dark:text-emerald-400'}`}>{f1(c.promoPct)}% · {kwd(c.promo)}</dd></div>
                  <div className="min-w-0"><dt className="text-slate-500">{T('Pocket profit / order', 'صافي الربح للطلب')}</dt><dd className="font-bold tabular-nums text-slate-900 dark:text-white">{kwd(c.pocketPerOrder, 3)}</dd></div>
                </dl>
                {over && (
                  <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                    {T(`Above the ${PROMO_CAP}% promotion cap — move discounts into bundles.`, `فوق سقف العروض ${PROMO_CAP}% — حوّل الخصومات إلى وجبات مجمّعة.`)}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </section>

      {/* Zone accounts per location */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('Zone accounts by location (Talabat Go vs Marketplace)', 'حسابات المناطق حسب الموقع (طلبات جو مقابل سوق طلبات)')}</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((l) => (
            <article key={l.id} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="min-w-0 text-[15px] font-bold text-slate-900 dark:text-white">{isAr ? l.ar : l.en}</h3>
                <span className="whitespace-nowrap text-[12px] font-semibold text-slate-500">{T(`${f1(l.share)}% delivery`, `${f1(l.share)}% توصيل`)}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60"><div className="text-[11px] text-slate-500">{T('Platform fleet', 'أسطول المنصة')}</div><div className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{l.tgo}</div></div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60"><div className="text-[11px] text-slate-500">{T('Restaurant fleet', 'أسطول المطعم')}</div><div className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{l.tmp}</div></div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60"><div className="text-[11px] text-slate-500">{T('Delivery sales', 'مبيعات التوصيل')}</div><div className="text-[13px] font-extrabold tabular-nums text-slate-900 dark:text-white">{kwd(l.agg)}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {l.brands.map((b) => (
                  <span key={b.id} className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{isAr ? b.ar : b.en}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Settlement gaps & claims */}
      <section className={`${card} space-y-4`}>
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-slate-500" />
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('Settlement gaps & dispute claims', 'فروقات التسوية ومطالبات الاعتراض')}</h2>
        </div>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          {T('Enter the payout on each platform statement; a claim is prepared automatically when the gap exceeds 1% of the expected payout.', 'أدخل المبلغ الوارد في كشف كل منصة؛ تُجهَّز المطالبة تلقائياً عندما يتجاوز الفرق 1% من التسوية المتوقعة.')}
        </p>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-2 text-start font-semibold">{T('Channel', 'القناة')}</th>
                <th className="px-3 py-2 text-end font-semibold">{T('Expected payout', 'التسوية المتوقعة')}</th>
                <th className="px-3 py-2 text-end font-semibold">{T('Statement payout', 'مبلغ الكشف')}</th>
                <th className="px-3 py-2 text-end font-semibold">{T('Gap', 'الفرق')}</th>
                <th className="px-3 py-2 text-end font-semibold">{T('Claim', 'المطالبة')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {CHANNEL_ECONOMICS.map((c) => {
                const raw = statement[c.id]
                const actual = raw ? Number(raw) : NaN
                const gap = Number.isFinite(actual) ? c.expectedPayout - actual : 0
                const claimable = Number.isFinite(actual) && gap > c.expectedPayout * 0.01
                return (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-slate-900 dark:text-white">{isAr ? c.ar : c.en}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-end tabular-nums">{kwd(c.expectedPayout, 3)}</td>
                    <td className="px-3 py-2.5 text-end">
                      <input
                        inputMode="decimal"
                        value={raw ?? ''}
                        onChange={(e) => setStatement((s) => ({ ...s, [c.id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                        placeholder="0.000"
                        className="w-32 rounded-lg bg-slate-50 px-2.5 py-1.5 text-end tabular-nums ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:ring-slate-700"
                      />
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-end font-bold tabular-nums ${claimable ? 'text-rose-600' : 'text-slate-500'}`}>{Number.isFinite(actual) ? kwd(gap, 3) : '—'}</td>
                    <td className="px-3 py-2.5 text-end">
                      <button
                        type="button"
                        disabled={!claimable}
                        onClick={() => copy(c.id, claimText(c, actual))}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0F172A] px-3 py-1.5 text-[12px] font-bold text-white disabled:bg-slate-200 disabled:text-slate-500 dark:disabled:bg-slate-800"
                      >
                        {copied === c.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === c.id ? T('Copied', 'تم النسخ') : T('Copy claim', 'نسخ المطالبة')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
