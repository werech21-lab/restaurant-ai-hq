'use client'

import { Building2 } from 'lucide-react'
import { BRANDS, EXB_REGISTERS, EXB_UNIT, LEDGER } from '@/lib/aether/ledger'
import { ODOO } from '@/lib/odoo/odoo-dataset'

const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const f1 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

/** Odoo actuals of the Exhibitions & Booths (EXB) unit: registers 26–29, brand mix and analytic P&L. */
export const EXB_ODOO = (() => {
  const unit = ODOO.exhibitions[0] ?? null
  const pnl = unit?.pnl ?? null
  const revenue = pnl ? pnl.income + pnl.otherIncome : 0
  return {
    sales: EXB_UNIT?.sales ?? 0,
    orders: EXB_UNIT?.orders ?? 0,
    aov: EXB_UNIT?.aov ?? 0,
    revenue,
    cogs: pnl?.cogs ?? 0,
    opex: pnl?.expense ?? 0,
    depreciation: pnl?.depreciation ?? 0,
    profit: pnl?.operatingProfit ?? 0,
    cogsPct: revenue ? ((pnl?.cogs ?? 0) / revenue) * 100 : 0,
    marginPct: revenue ? ((pnl?.operatingProfit ?? 0) / revenue) * 100 : 0,
    brands: (unit?.brands ?? []).map((b) => ({ ...b, en: BRANDS.find((x) => x.id === b.brand)?.en ?? b.brand, ar: BRANDS.find((x) => x.id === b.brand)?.ar ?? b.brand })),
  }
})()

export function ExbOdooUnitCard({ lang }: { lang: 'ar' | 'en' }) {
  const isAr = lang === 'ar'
  const T = (en: string, ar: string) => (isAr ? ar : en)
  const cur = T('KWD', 'د.ك')
  const maxReg = Math.max(1, ...EXB_REGISTERS.map((r) => r.netKwd))
  return (
    <section className="ae-tile rounded-2xl p-5 sm:p-6 space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-sky-500/10 text-sky-700 flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">
              {T(`Exhibitions & Booths (EXB) — Odoo ${LEDGER.periodLabelEn}`, `المعارض والأجنحة (EXB) — أودو ${LEDGER.periodLabelAr}`)}
            </h3>
            <p className="text-xs font-medium text-slate-500">
              {T(
                `POS registers ${EXB_REGISTERS.map((r) => r.posConfigId).join(', ')} · kept out of the restaurant branch rankings · analytic P&L from the Odoo Branches plan`,
                `أجهزة نقاط البيع ${EXB_REGISTERS.map((r) => r.posConfigId).join('، ')} · خارج ترتيب فروع المطاعم · قائمة الدخل التحليلية من خطة الفروع في أودو`,
              )}
            </p>
          </div>
        </div>
        <span className="ae-chip">{T('Odoo actuals', 'فعلي أودو')}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { l: T('POS net sales', 'صافي نقاط البيع'), v: `${f3(EXB_ODOO.sales)} ${cur}`, s: T(`${f0(EXB_ODOO.orders)} orders · AOV ${f3(EXB_ODOO.aov)}`, `${f0(EXB_ODOO.orders)} طلباً · السلة ${f3(EXB_ODOO.aov)}`) },
          { l: T('Posted revenue', 'الإيراد المرحّل'), v: `${f3(EXB_ODOO.revenue)} ${cur}`, s: T('Branches analytic plan', 'خطة الفروع التحليلية') },
          { l: T('COGS', 'تكلفة الأغذية'), v: `${f1(EXB_ODOO.cogsPct)}%`, s: T(`${f3(EXB_ODOO.cogs)} ${cur} · group ${LEDGER.cogsPct}%`, `${f3(EXB_ODOO.cogs)} ${cur} · المجموعة ${LEDGER.cogsPct}%`) },
          { l: T('Operating expenses', 'المصروفات التشغيلية'), v: `${f3(EXB_ODOO.opex + EXB_ODOO.depreciation)} ${cur}`, s: T('Incl. depreciation', 'شاملة الإهلاك') },
          { l: T('Operating profit', 'الربح التشغيلي'), v: `${f3(EXB_ODOO.profit)} ${cur}`, s: T(`${f1(EXB_ODOO.marginPct)}% margin`, `هامش ${f1(EXB_ODOO.marginPct)}%`) },
        ].map((k) => (
          <div key={k.l} className="ae-tile-soft rounded-xl p-3 min-w-0">
            <div className="text-[11px] font-bold text-slate-500">{k.l}</div>
            <div className="mt-1 text-base font-extrabold text-slate-950 dark:text-white font-mono tabular-nums break-words">{k.v}</div>
            <div className="mt-1 text-[11px] font-medium text-slate-500">{k.s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{T('By POS register', 'حسب جهاز نقطة البيع')}</div>
          {EXB_REGISTERS.map((r) => (
            <div key={r.posConfigId} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{T(`Register ${r.posConfigId}`, `الجهاز ${r.posConfigId}`)}</span>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden" dir="ltr">
                <div className="h-full rounded-full bg-sky-600" style={{ width: `${(r.netKwd / maxReg) * 100}%` }} />
              </div>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                {f3(r.netKwd)} · {f0(r.orders)} {T('orders', 'طلب')}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">{T('By brand', 'حسب العلامة')}</div>
          {EXB_ODOO.brands.map((b) => (
            <div key={b.brand} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{isAr ? b.ar : b.en}</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                {f3(b.netKwd)} {cur} · {f0(b.orders)} {T('orders', 'طلب')} · {f1(EXB_ODOO.sales ? (b.netKwd / EXB_ODOO.sales) * 100 : 0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {T(
          'Contract benchmarks, booth break-even and seasonal ROI elsewhere on this page are planning simulations, not Odoo postings.',
          'مقارنات العقود ونقطة تعادل البوث والعائد الموسمي في باقي الصفحة محاكاة تخطيطية وليست قيوداً في أودو.',
        )}
      </p>
    </section>
  )
}
