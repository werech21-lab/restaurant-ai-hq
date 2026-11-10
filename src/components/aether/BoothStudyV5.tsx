'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Scale, ShieldCheck, XCircle } from 'lucide-react'
import { analyzeEventContractWithGemini, type ContractDeepAuditResult } from '@/lib/feryal-gemini-brain'
import { BRANDS, EXB_UNIT, LEDGER } from '@/lib/aether/ledger'
import { ODOO } from '@/lib/odoo/odoo-dataset'
import { useLang } from '@/components/aether/ui'

const f0 = (n: number) => Math.round(n).toLocaleString('en-US')
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const card = 'relative min-w-0 overflow-hidden rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(15,23,42,0.04)] dark:bg-neutral-900'
const input = 'w-full rounded-xl bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white dark:ring-slate-700'

// Odoo calibration: exhibitions unit (registers 26–29) and brand baskets
const EXB = ODOO.exhibitions[0]
const EXB_REVENUE = EXB?.pnl ? EXB.pnl.income + EXB.pnl.otherIncome : 0
const EXB_COGS_PCT = EXB_REVENUE ? ((EXB?.pnl?.cogs ?? 0) / EXB_REVENUE) * 100 : LEDGER.cogsPct
const EXB_OPEX_PCT = EXB_REVENUE ? ((EXB?.pnl?.expense ?? 0) / EXB_REVENUE) * 100 : 0
const EXB_DAILY_ORDERS = Math.max(1, Math.round((EXB_UNIT?.orders ?? 0) / LEDGER.daysInPeriod))
const EXB_LEADER = [...(EXB?.brands ?? [])].sort((a, b) => b.netKwd - a.netKwd)[0]?.brand ?? BRANDS[0]?.id

const brandBasket = (brandId: string) => {
  const atExb = EXB?.brands.find((b) => b.brand === brandId)
  if (atExb && atExb.orders > 0) return { basket: atExb.netKwd / atExb.orders, source: 'exb' as const }
  const b = BRANDS.find((x) => x.id === brandId)
  return { basket: b?.aov ?? LEDGER.aov, source: 'brand' as const }
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const res = typeof reader.result === 'string' ? reader.result : ''
      resolve(res.includes(',') ? res.split(',')[1] : '')
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })

/** Seasonal booths & exhibitions study before contract signing. */
export function BoothStudyV5() {
  const { isAr, T } = useLang()
  const [eventName, setEventName] = useState('')
  const [days, setDays] = useState(30)
  const [rent, setRent] = useState(3000)
  const [setup, setSetup] = useState(800)
  const [staff, setStaff] = useState(0)
  const [dailyOrders, setDailyOrders] = useState(EXB_DAILY_ORDERS)
  const [brandId, setBrandId] = useState<string>(EXB_LEADER ?? 'china-garden')
  const [contract, setContract] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [audit, setAudit] = useState<ContractDeepAuditResult | null>(null)
  const [busy, setBusy] = useState(false)

  const kwd = (n: number) => (isAr ? `${f0(n)} د.ك` : `${f0(n)} KWD`)
  const brand = BRANDS.find((b) => b.id === brandId)
  const { basket, source } = brandBasket(brandId)

  const model = useMemo(() => {
    const variablePct = (EXB_COGS_PCT + EXB_OPEX_PCT) / 100
    const gpPerOrder = basket * (1 - variablePct)
    const fixed = rent + setup + staff
    const breakEven = days > 0 && gpPerOrder > 0 ? fixed / days / gpPerOrder : Infinity
    const scenarios = [
      { id: 'low', en: 'Conservative', ar: 'متحفظ', factor: 0.6 },
      { id: 'base', en: 'Base', ar: 'أساسي', factor: 1 },
      { id: 'high', en: 'Strong', ar: 'قوي', factor: 1.3 },
    ].map((s) => {
      const orders = dailyOrders * s.factor * days
      const revenue = orders * basket
      const gp = orders * gpPerOrder
      const profit = gp - fixed
      return { ...s, orders, revenue, gp, profit, roi: fixed > 0 ? (profit / fixed) * 100 : 0 }
    })
    const low = scenarios[0]
    const base = scenarios[1]
    const verdict: 'go' | 'conditional' | 'walk' = base.profit <= 0 ? 'walk' : low.profit >= 0 ? 'go' : 'conditional'
    const rentCeiling = Math.max(0, low.gp - setup - staff)
    const rentShare = base.revenue > 0 ? (rent / base.revenue) * 100 : 0
    return { gpPerOrder, fixed, breakEven, scenarios, verdict, rentCeiling, rentShare, variablePct }
  }, [basket, dailyOrders, days, rent, setup, staff])

  const quickMenu = useMemo(
    () =>
      ODOO.menu
        .filter((m) => m.brand === brandId && m.qty > 0 && m.netKwd > 0 && !/drink|beverage|sauce|extra/i.test(m.category))
        .sort((a, b) => (/^EXB/i.test(b.category) ? 1 : 0) - (/^EXB/i.test(a.category) ? 1 : 0) || b.qty - a.qty)
        .slice(0, 6),
    [brandId],
  )

  const runAudit = async () => {
    setBusy(true)
    try {
      const attachmentBase64 = file ? await toBase64(file) : undefined
      const res = await analyzeEventContractWithGemini({
        contractText: contract,
        eventDescription: description,
        executiveVision: brand ? `${brand.en} ${brand.ar}` : '',
        eventName: eventName || T('Seasonal booth', 'بوث موسمي'),
        durationDays: days,
        boothRentKwd: rent,
        attachmentBase64: attachmentBase64 || undefined,
        attachmentMimeType: file?.type || undefined,
        lang: isAr ? 'ar' : 'en',
      })
      setAudit(res)
    } finally {
      setBusy(false)
    }
  }

  const verdictUi = {
    go: { icon: <CheckCircle2 className="h-6 w-6" />, en: 'Go — sign the contract', ar: 'نعم — يوصى بالتوقيع', cls: 'bg-emerald-50 text-emerald-900 ring-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100' },
    conditional: { icon: <Scale className="h-6 w-6" />, en: 'Conditional — sign only after renegotiation', ar: 'مشروط — التوقيع بعد إعادة التفاوض فقط', cls: 'bg-amber-50 text-amber-900 ring-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100' },
    walk: { icon: <XCircle className="h-6 w-6" />, en: 'Walk away — the booth does not pay back', ar: 'انسحاب — البوث لا يسترد تكلفته', cls: 'bg-rose-50 text-rose-900 ring-rose-500/30 dark:bg-rose-950/40 dark:text-rose-100' },
  }[model.verdict]

  const base = model.scenarios[1]
  const low = model.scenarios[0]
  const be = Number.isFinite(model.breakEven) ? model.breakEven : 0
  const strengths = [
    be > 0 && be <= dailyOrders * 0.6 && T(`Break-even of ${f0(be)} orders a day sits below the conservative case.`, `نقطة التعادل ${f0(be)} طلباً يومياً أقل من السيناريو المتحفظ.`),
    source === 'exb' && T(`${brand?.en} already sells at exhibitions in Odoo at a ${f3(basket)} KWD basket.`, `${brand?.ar} تبيع فعلاً في المعارض حسب أودو بمتوسط سلة ${f3(basket)} د.ك.`),
    (EXB?.pnl?.operatingProfit ?? 0) > 0 && T(`The Odoo exhibitions unit runs a ${f1(EXB_REVENUE ? ((EXB?.pnl?.operatingProfit ?? 0) / EXB_REVENUE) * 100 : 0)}% operating margin.`, `وحدة المعارض في أودو تحقق هامشاً تشغيلياً ${f1(EXB_REVENUE ? ((EXB?.pnl?.operatingProfit ?? 0) / EXB_REVENUE) * 100 : 0)}%.`),
    model.rentShare > 0 && model.rentShare <= 20 && T(`Rent is ${f1(model.rentShare)}% of base-case revenue.`, `الإيجار ${f1(model.rentShare)}% من إيراد السيناريو الأساسي.`),
  ].filter(Boolean) as string[]
  const weaknesses = [
    be > dailyOrders && T(`Break-even needs ${f0(be)} orders a day, above the ${f0(dailyOrders)} expected.`, `نقطة التعادل تحتاج ${f0(be)} طلباً يومياً، أعلى من ${f0(dailyOrders)} المتوقعة.`),
    low.profit < 0 && T(`The conservative case loses ${kwd(-low.profit)}.`, `السيناريو المتحفظ يخسر ${kwd(-low.profit)}.`),
    model.rentShare > 25 && T(`Rent takes ${f1(model.rentShare)}% of base-case revenue.`, `الإيجار يستهلك ${f1(model.rentShare)}% من إيراد السيناريو الأساسي.`),
    EXB_COGS_PCT > LEDGER.cogsPct && T(`Exhibition food cost in Odoo is ${f1(EXB_COGS_PCT)}% versus ${f1(LEDGER.cogsPct)}% for the group.`, `تكلفة أغذية المعارض في أودو ${f1(EXB_COGS_PCT)}% مقابل ${f1(LEDGER.cogsPct)}% للمجموعة.`),
  ].filter(Boolean) as string[]

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="rounded-[28px] bg-[#F7F7F8] dark:bg-[#0A0A0A]">
     <div className="mx-auto w-full max-w-[1520px] space-y-6 px-6 py-6 lg:px-10">
      <section className={card}>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl dark:text-white">{T('Seasonal Booths & Exhibitions Study', 'جدوى المعارض والبوثات الموسمية')}</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {T(
            `Decide before signing: verdict, contract traps, daily break-even and three profit scenarios, calibrated to Odoo exhibition results (food cost ${f1(EXB_COGS_PCT)}%, running costs ${f1(EXB_OPEX_PCT)}%, ${f0(EXB_DAILY_ORDERS)} orders a day).`,
            `القرار قبل التوقيع: الحكم الاستثماري وأفخاخ العقد ونقطة التعادل اليومية وثلاثة سيناريوهات للربح، معايرة على نتائج المعارض في أودو (تكلفة أغذية ${f1(EXB_COGS_PCT)}%، مصروفات تشغيل ${f1(EXB_OPEX_PCT)}%، ${f0(EXB_DAILY_ORDERS)} طلباً يومياً).`,
          )}
        </p>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
      <section className={`${card} grid grid-cols-1 gap-4 sm:grid-cols-2 xl:sticky xl:top-24 xl:col-span-5`}>
        <label className="space-y-1.5"><span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{T('Event or exhibition name', 'اسم الفعالية أو المعرض')}</span><input className={input} value={eventName} onChange={(e) => setEventName(e.target.value)} /></label>
        <label className="space-y-1.5"><span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{T('Brand at the booth', 'العلامة في البوث')}</span>
          <select className={input} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {BRANDS.map((b) => (
              <option key={b.id} value={b.id}>{isAr ? b.ar : b.en}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          {[
            { v: days, set: setDays, en: 'Duration (days)', ar: 'المدة (أيام)' },
            { v: rent, set: setRent, en: 'Rent & organizer fees (KWD)', ar: 'الإيجار ورسوم المنظم (د.ك)' },
            { v: setup, set: setSetup, en: 'Setup & fit-out (KWD)', ar: 'التجهيز والديكور (د.ك)' },
            { v: staff, set: setStaff, en: 'Staff cost for the event (KWD)', ar: 'تكلفة الطاقم للفعالية (د.ك)' },
            { v: dailyOrders, set: setDailyOrders, en: 'Expected orders per day', ar: 'الطلبات المتوقعة يومياً' },
          ].map((f) => (
            <label key={f.en} className="min-w-0 space-y-1.5">
              <span className="block truncate text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">{isAr ? f.ar : f.en}</span>
              <input className={input} inputMode="decimal" value={f.v} onChange={(e) => f.set(Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0))} />
            </label>
          ))}
        </div>
        <label className="space-y-1.5 sm:col-span-2"><span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{T('Contract clauses (paste text)', 'بنود العقد (الصق النص)')}</span><textarea className={`${input} min-h-[110px]`} value={contract} onChange={(e) => setContract(e.target.value)} /></label>
        <label className="space-y-1.5"><span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{T('Event description', 'وصف الفعالية')}</span><textarea className={`${input} min-h-[80px]`} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <div className="flex flex-col justify-end gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
            <FileUp className="h-4 w-4" />
            <span className="truncate">{file ? file.name : T('Attach the contract (PDF or image)', 'إرفاق العقد (ملف أو صورة)')}</span>
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={runAudit} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0F172A] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {T('Audit the contract', 'تدقيق العقد')}
          </button>
        </div>
      </section>

      <div className="min-w-0 space-y-6 xl:col-span-7">
      {/* 1. Verdict */}
      <section className={`rounded-[22px] p-6 ring-1 ${verdictUi.cls}`}>
        <div className="text-[12px] font-bold opacity-80">{T('1. Go / Conditional / Walk-Away verdict', '١. الحكم الاستثماري الحاسم')}</div>
        <div className="mt-2 flex items-center gap-3">
          {verdictUi.icon}
          <h2 className="text-xl font-extrabold">{isAr ? verdictUi.ar : verdictUi.en}</h2>
        </div>
        <p className="mt-2 text-[14.5px] leading-[1.8]">
          {T(
            `Base case ${base.profit >= 0 ? 'profit' : 'loss'} of ${kwd(Math.abs(base.profit))} on ${kwd(model.fixed)} fixed costs; break-even ${be ? f0(be) : '—'} orders a day against ${f0(dailyOrders)} expected.`,
            `${base.profit >= 0 ? 'ربح' : 'خسارة'} السيناريو الأساسي ${kwd(Math.abs(base.profit))} على تكاليف ثابتة ${kwd(model.fixed)}؛ نقطة التعادل ${be ? f0(be) : '—'} طلباً يومياً مقابل ${f0(dailyOrders)} متوقعة.`,
          )}
        </p>
        {audit && <p className="mt-2 text-[14px] font-semibold">{isAr ? audit.verdictBadgeAr : audit.verdictBadgeEn}</p>}
      </section>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
        {/* 2. Strengths, weaknesses & traps */}
        <section className={`${card} space-y-4`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('2. Strengths vs. weaknesses & booth contract traps', '٢. نقاط القوة والضعف وأفخاخ عقد المعرض الموسمي')}</h2>
          <div className="space-y-2">
            <div className="text-[12px] font-bold text-emerald-700 dark:text-emerald-400">{T('Strengths', 'نقاط القوة')}</div>
            {strengths.length ? strengths.map((s) => <p key={s} className="text-[14px] leading-[1.75] text-slate-800 dark:text-slate-100">• {s}</p>) : <p className="text-[14px] text-slate-500">—</p>}
          </div>
          <div className="space-y-2">
            <div className="text-[12px] font-bold text-rose-700 dark:text-rose-400">{T('Weaknesses', 'نقاط الضعف')}</div>
            {weaknesses.length ? weaknesses.map((s) => <p key={s} className="text-[14px] leading-[1.75] text-slate-800 dark:text-slate-100">• {s}</p>) : <p className="text-[14px] text-slate-500">—</p>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{T('Contract traps', 'أفخاخ العقد')}</div>
            {audit ? (
              (isAr ? audit.risksAr : audit.risksEn).map((r) => <p key={r} className="text-[14px] leading-[1.75] text-slate-800 dark:text-slate-100">• {r}</p>)
            ) : (
              <p className="text-[14px] text-slate-500">{T('Paste or attach the contract and run the audit.', 'الصق العقد أو أرفقه ثم شغّل التدقيق.')}</p>
            )}
          </div>
        </section>

        {/* 3. Return, break-even & scenarios */}
        <section className={`${card} space-y-4`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('3. Expected return, daily break-even & three scenarios', '٣. المردود المتوقع ونقطة التعادل اليومية و٣ سيناريوهات للربح أو الخسارة')}</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><div className="text-[11px] text-slate-500">{T('Basket', 'متوسط السلة')}</div><div className="text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">{isAr ? `${f3(basket)} د.ك` : `${f3(basket)} KWD`}</div></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><div className="text-[11px] text-slate-500">{T('Profit per order', 'الربح للطلب')}</div><div className="text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">{isAr ? `${f3(model.gpPerOrder)} د.ك` : `${f3(model.gpPerOrder)} KWD`}</div></div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><div className="text-[11px] text-slate-500">{T('Break-even / day', 'التعادل يومياً')}</div><div className="text-[15px] font-extrabold tabular-nums text-slate-900 dark:text-white">{be ? f0(be) : '—'}</div></div>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13.5px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="px-2 py-2 text-start font-semibold">{T('Scenario', 'السيناريو')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{T('Orders', 'الطلبات')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{T('Revenue', 'الإيراد')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{T('Net result', 'صافي النتيجة')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{T('Return', 'العائد')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {model.scenarios.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap px-2 py-2.5 font-semibold text-slate-900 dark:text-white">{isAr ? s.ar : s.en}</td>
                    <td className="px-2 py-2.5 text-end tabular-nums">{f0(s.orders)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-end tabular-nums">{kwd(s.revenue)}</td>
                    <td className={`whitespace-nowrap px-2 py-2.5 text-end font-bold tabular-nums ${s.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>{kwd(s.profit)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-end tabular-nums">{f1(s.roi)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            {T(
              `Scenarios use 60%, 100% and 130% of the expected daily orders; basket from ${source === 'exb' ? 'the brand’s Odoo exhibition sales' : 'the brand’s Odoo average'}; food and running costs from the Odoo exhibitions unit.`,
              `السيناريوهات تستخدم 60% و100% و130% من الطلبات اليومية المتوقعة؛ متوسط السلة من ${source === 'exb' ? 'مبيعات العلامة في معارض أودو' : 'متوسط العلامة في أودو'}؛ وتكلفة الأغذية والتشغيل من وحدة المعارض في أودو.`,
            )}
          </p>
        </section>
      </div>

      {/* 4. Negotiation, quick menu & prep */}
      <section className={`${card} grid grid-cols-1 gap-6 lg:grid-cols-3`}>
        <div className="space-y-2 lg:col-span-3">
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">{T('4. Negotiation strategy, quick booth menu & advance prep', '٤. أفضل استراتيجية للتفاوض ومنيو البوث السريع والتحضير المسبق')}</h2>
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-bold text-slate-500">{T('Negotiation', 'التفاوض')}</div>
          <p className="text-[14px] leading-[1.75] text-slate-800 dark:text-slate-100">
            • {T(`Rent ceiling: ${kwd(model.rentCeiling)} keeps the conservative case at break-even${rent > model.rentCeiling ? ` — ask for ${kwd(rent - model.rentCeiling)} off.` : '.'}`, `سقف الإيجار: ${kwd(model.rentCeiling)} يبقي السيناريو المتحفظ عند التعادل${rent > model.rentCeiling ? ` — اطلب تخفيض ${kwd(rent - model.rentCeiling)}.` : '.'}`)}
          </p>
          {(audit ? (isAr ? audit.counterClausesAr : audit.counterClausesEn) : []).map((c) => (
            <p key={c} className="text-[14px] leading-[1.75] text-slate-800 dark:text-slate-100">• {c}</p>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-bold text-slate-500">{T(`Quick booth menu (${brand ? (isAr ? brand.ar : brand.en) : ''}, from Odoo sales)`, `منيو البوث السريع (${brand ? (isAr ? brand.ar : brand.en) : ''}، من مبيعات أودو)`)}</div>
          {quickMenu.length ? (
            quickMenu.map((m) => (
              <div key={`${m.code}-${m.name}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[13.5px] dark:bg-slate-800/60">
                <span className="min-w-0 truncate font-semibold text-slate-800 dark:text-slate-100">{m.name}</span>
                <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">{isAr ? `${f3(m.priceKwd)} د.ك` : `${f3(m.priceKwd)} KWD`}</span>
              </div>
            ))
          ) : (
            <p className="text-[14px] text-slate-500">—</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-bold text-slate-500">{T('Advance prep', 'التحضير المسبق')}</div>
          {(audit ? (isAr ? audit.solutionsAr : audit.solutionsEn) : [
            T('Pre-portion and marinate the booth items at the central kitchen; finish on site.', 'تجهيز وتتبيل أصناف البوث مسبقاً في المطبخ المركزي والاكتفاء بالتسوية في الموقع.'),
            T('Run a mobile KNET cashier along the queue at peak hours.', 'تشغيل كاشير متنقل بجهاز كي نت في طابور الذروة.'),
            T('Open a dedicated Odoo register and analytic account for the event.', 'فتح جهاز نقاط بيع وحساب تحليلي مستقلين للفعالية في أودو.'),
          ]).map((s) => (
            <p key={s} className="text-[14px] leading-[1.75] text-slate-800 dark:text-slate-100">• {s}</p>
          ))}
        </div>
      </section>
      </div>
      </div>
     </div>
    </div>
  )
}
