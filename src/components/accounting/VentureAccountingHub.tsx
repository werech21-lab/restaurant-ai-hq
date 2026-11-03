'use client'

import React, { useState } from 'react'
import {
  Landmark,
  FileSpreadsheet,
  Receipt,
  Wallet,
  BookOpen,
  PieChart,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Calendar,
  Search,
  Filter,
  Download,
  CreditCard,
  Scale,
  Printer,
  ShieldCheck,
  Store,
  ArrowUpRight,
  Truck,
} from 'lucide-react'
import { AutomatedGlBridge } from '@/components/finance/AutomatedGlBridge'
import { VENTURE_FOODS_EVENTS } from '@/lib/events/venture-events-engine'
import Link from 'next/link'

export function VentureAccountingHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<'pnl' | 'banking' | 'pettyCash' | 'journals' | 'chart' | 'aging' | 'glBridge' | 'eventsFinance' | 'leases' | 'fleet' | 'legacy'>('pnl')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [showNewEntryModal, setShowNewEntryModal] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const showToast = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
              <Landmark size={14} />
              {isAr ? 'المحاسبة والمالية والتدقيق المالي الشامل' : 'Corporate Finance & General Ledger'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'فنتشر فودز ذ.م.م. (820 حساباً Odoo)' : 'Venture Foods W.L.L. (820 Odoo Accounts)'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'مركز القيادة المالي ومراكز تكلفة البراندات والفروع' : 'Financial Command Center & Multi-Brand P&L'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'ميزان المراجعة الموحد، تسويات بنك الكويت الوطني KNET، العهد النقدية، ومخصصات نهاية الخدمة'
              : 'Managing P&L cost centers, NBK & K-Net reconciliations, petty cash, and Odoo general ledger'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {isAr ? 'English (LTR)' : 'عربي (RTL)'}
          </button>
          <button
            onClick={() => setShowNewEntryModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
          >
            <Plus size={15} />
            {isAr ? 'قيد يومية جديد' : 'New Journal Entry'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 6 Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'pnl', labelAr: '📊 قائمة الدخل ومراكز تكلفة البراندات والفروع', labelEn: 'Brand & Branch P&L Cost Centers', icon: FileSpreadsheet },
          { key: 'banking', labelAr: '🏦 البنوك، الخزينة، وتسوية K-Net والمنصات', labelEn: 'NBK Accounts, K-Net & Platform Recon', icon: Landmark },
          { key: 'pettyCash', labelAr: '💼 إدارة العهد النقدية والمصروفات النثرية', labelEn: 'Branch & PRO Petty Cash', icon: Wallet },
          { key: 'journals', labelAr: '📒 دفتر اليومية والقيود وسندات الصرف/القبض', labelEn: 'Journal Entries & Vouchers', icon: BookOpen },
          { key: 'chart', labelAr: '🗂️ شجرة الحسابات وميزان المراجعة (820 حساباً)', labelEn: 'Chart of Accounts & Trial Balance', icon: Scale },
          { key: 'aging', labelAr: '🧾 الذمم المدينة والدائنة ومخصصات نهاية الخدمة', labelEn: 'AR/AP Aging & EOSB Provisions', icon: Receipt },
          { key: 'glBridge', labelAr: '🔗 الربط المالي والقيود التلقائية (POS / KDS / Recipes)', labelEn: 'Automated GL Bridge (Field Ops)', icon: ArrowRightLeft },
          { key: 'eventsFinance', labelAr: '🎪 مالية المعارض والمخيمات والفعاليات', labelEn: 'Events & Camps Financials', icon: Store },
          { key: 'leases', labelAr: '🏢 سجل الإيجارات والفروع وسكن العمال والمخازن', labelEn: 'Leases, Branches, Housing & Rent Burden', icon: Building2 },
          { key: 'fleet', labelAr: '🚗 أسطول المركبات والصيانة والوقود ومخالفات السائقين', labelEn: 'Fleet, Garage Repairs, Fuel & Driver Fines', icon: Truck },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ قيود واستعلامات قاعدة البيانات (DB)', labelEn: 'Database Ledger Queries', icon: Building2 }] : []),
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BRAND & BRANCH P&L COST CENTERS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'pnl' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'إيرادات المبيعات (أكتوبر 2026)' : 'October 2026 Sales'}</span>
              <p className="mt-1 text-2xl font-black text-amber-400">167,092.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '30,543 طلباً معتمداً' : '30,543 orders'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'تكلفة الأغذية والتعبئة (COGS)' : 'Food Cost (COGS)'}</span>
              <p className="mt-1 text-2xl font-black text-rose-400">52,634.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '31.5% نسبة تكلفة الغذاء' : '31.5% of revenue'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'مجمل الربح (Gross Profit)' : 'Gross Profit'}</span>
              <p className="mt-1 text-2xl font-black text-emerald-400">114,458.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '68.5% هامش إجمالي' : '68.5% gross margin'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'صافي الربح التشغيلي (EBITDA)' : 'Operating EBITDA'}</span>
              <p className="mt-1 text-2xl font-black text-cyan-400">38,410.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '23.0% عائد تشغيلي صافي' : '23.0% net margin'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'مركز التكلفة / البراند' : 'Cost Center / Brand'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الإيراد الإجمالي' : 'Revenue (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'تكلفة الأغذية (COGS)' : 'Food Cost'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الرواتب والأجور (WPS)' : 'Labor OPEX'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'عمولات التوصيل' : 'Commissions'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الإيجارات والمرافق' : 'Rent & Utilities'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'صافي الربح (د.ك)' : 'Net Profit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { center: "فرانكس ستيك (Frank's Steak)", rev: '89,520.000', cogs: '27,750.000', labor: '24,100.000', comm: '10,800.000', rent: '8,500.000', net: '18,370.000' },
                    { center: 'ثينيز برجر (Thinnies Burger)', rev: '38,980.000', cogs: '12,470.000', labor: '11,200.000', comm: '4,850.000', rent: '4,200.000', net: '6,260.000' },
                    { center: 'أوفر سايزد برجر (Over Sized)', rev: '18,740.000', cogs: '6,180.000', labor: '5,400.000', comm: '2,240.000', rent: '2,100.000', net: '2,820.000' },
                    { center: 'شاورما شاك (Shawarma Shack)', rev: '15,070.000', cogs: '4,670.000', labor: '4,800.000', comm: '1,420.000', rent: '1,900.000', net: '2,280.000' },
                    { center: 'فارم براون (Farm Brown)', rev: '2,662.000', cogs: '850.000', labor: '1,200.000', comm: '320.000', rent: '900.000', net: '-608.000' },
                    { center: 'ذا نودل بار (The Noodle Bar)', rev: '1,677.000', cogs: '530.000', labor: '1,050.000', comm: '180.000', rent: '600.000', net: '-683.000' },
                    { center: 'كرك كافيتريا (Karak Cafeteria)', rev: '443.000', cogs: '84.000', labor: '500.000', comm: '47.000', rent: '300.000', net: '-488.000' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{row.center}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right">{row.rev}</td>
                      <td className="px-4 py-3 font-mono text-rose-400 text-right">{row.cogs}</td>
                      <td className="px-4 py-3 font-mono text-slate-300 text-right">{row.labor}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-right">{row.comm}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-right">{row.rent}</td>
                      <td className={`px-4 py-3 font-mono font-bold text-right ${
                        row.net.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {row.net} د.ك
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BANKING & K-NET / AGGREGATOR RECON                                  */}
      {/* ========================================================================= */}
      {activeTab === 'banking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'حسابات البنوك الرسمية وتسوية مدفوعات K-NET وتطبيقات التوصيل' : 'Official Bank Accounts & K-NET / Platform Settlement'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'رصيد النقدية والبنوك: 142,850.000 د.ك' : 'Total Bank & Cash Balances: 142,850 KWD'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* NBK Account */}
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                  الحساب التشغيلي الرئيسي (Operating)
                </span>
                <span className="text-xs font-mono text-slate-400">NBK - 0012345678</span>
              </div>
              <h4 className="text-lg font-black text-white">بنك الكويت الوطني (National Bank of Kuwait)</h4>
              <p className="text-xs text-slate-400">يستقبل إيداعات K-NET، تسويات طلبات ودليفرو وكيتا، والدفعات المباشرة</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">الرصيد الدفتري المطابق:</span>
                <span className="text-xl font-black text-emerald-400 font-mono">94,250.000 د.ك</span>
              </div>
            </div>

            {/* CBK Account */}
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
                  حساب حماية الأجور (WPS Payroll)
                </span>
                <span className="text-xs font-mono text-slate-400">CBK - 0098765432</span>
              </div>
              <h4 className="text-lg font-black text-white">البنك التجاري الكويتي (Commercial Bank)</h4>
              <p className="text-xs text-slate-400">مخصص لمسير رواتب 166 موظفاً وتحويلات وزارة الشؤون والقوى العاملة</p>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">الرصيد الدفتري المطابق:</span>
                <span className="text-xl font-black text-blue-400 font-mono">48,600.000 د.ك</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BRANCH & PRO PETTY CASH MANAGEMENT                                 */}
      {/* ========================================================================= */}
      {activeTab === 'pettyCash' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'إدارة العهد النقدية لمديري الفروع ومناديب الشؤون والبلدية' : 'Branch & PRO Petty Cash Reconciliation'}
            </h3>
            <span className="text-xs text-amber-400 font-semibold">
              {isAr ? 'إجمالي العهد الدوارة: 7,500.000 د.ك' : 'Total Revolving Petty Cash: 7,500 KWD'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'الموقع / المسؤول' : 'Custodian / Branch'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الغرض من العهدة' : 'Custody Purpose'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'سقف العهدة (د.ك)' : 'Ceiling (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المصروف بفواتير' : 'Spent (Invoices)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المتبقي كاش' : 'Cash Remaining'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'حالة التصفية' : 'Replenishment'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { name: 'طارق الشريف (المطبخ المركزي)', role: 'مشتريات طارئة ومحروقات شاحنات', limit: '1,500.000', spent: '1,120.000', rem: '380.000', status: 'تستحق الاستعاضة' },
                    { name: 'أحمد العوضي (مندوب الشؤون والبلدية)', role: 'رسوم معاملات إقامات وبطاقات بلدية', limit: '2,000.000', spent: '1,450.000', rem: '550.000', status: 'تستحق الاستعاضة' },
                    { name: 'راجيش باتيل (فرع السالمية)', role: 'نثريات صيانة وتنظيف وتغليف فوري', limit: '500.000', spent: '180.000', rem: '320.000', status: 'رصيد كافٍ' },
                    { name: 'محمد إبراهيم (فرع حولي)', role: 'نثريات صيانة وضيافة', limit: '500.000', spent: '220.000', rem: '280.000', status: 'رصيد كافٍ' },
                    { name: 'سوريش كاليان (فرع العارضية)', role: 'نثريات صيانة وتصليح دراجات توصيل', limit: '500.000', spent: '340.000', rem: '160.000', status: 'تستحق الاستعاضة' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{row.role}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right">{row.limit}</td>
                      <td className="px-4 py-3 font-mono text-rose-400 text-right">{row.spent}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 text-right">{row.rem}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          row.status.includes('الاستعاضة')
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GENERAL JOURNAL ENTRIES & VOUCHERS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'دفتر اليومية والقيود المزدوجة وسندات الصرف والقبض' : 'Dual-Entry General Journal & Vouchers'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'القيود متوازنة: المدين = الدائن = 1,485,210.000 د.ك' : 'Balanced: Total Debit = Total Credit'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'رقم القيد' : 'Entry No'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'البيان والوصف المحاسبي' : 'Narrative'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المدين (Debit)' : 'Debit (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الدائن (Credit)' : 'Credit (KWD)'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'المستخدم والمراجع' : 'Auditor'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { no: 'JV-202611-001', date: '03 نوفمبر 2026', desc: 'إثبات مبيعات الفروع المباشرة وإيداعات K-NET اليومية', dr: '1,840.500', cr: '1,840.500', auditor: 'أحمد العوضي (محاسب أول)' },
                    { no: 'JV-202611-002', date: '02 نوفمبر 2026', desc: 'استحقاق فاتورة توريد لحوم أنجوس من شركة المواشي', dr: '4,850.000', cr: '4,850.000', auditor: 'أحمد العوضي (محاسب أول)' },
                    { no: 'JV-202611-003', date: '01 نوفمبر 2026', desc: 'صرف مسير رواتب موظفي فنتشر فودز لشهر أكتوبر (WPS)', dr: '48,250.000', cr: '48,250.000', auditor: 'طارق عبد المنعم (شيف/مدير)' },
                    { no: 'JV-202611-004', date: '31 أكتوبر 2026', desc: 'تسوية وإيداع مستحقات منصة طلبات جو (Talabat Go Payout)', dr: '12,410.000', cr: '12,410.000', auditor: 'أحمد العوضي (محاسب أول)' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-400">{row.no}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{row.date}</td>
                      <td className="px-4 py-3 font-semibold text-white">{row.desc}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-bold text-right">{row.dr}</td>
                      <td className="px-4 py-3 font-mono text-amber-300 font-bold text-right">{row.cr}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{row.auditor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CHART OF ACCOUNTS (820 ODOO ACCOUNTS) & TRIAL BALANCE              */}
      {/* ========================================================================= */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'شجرة الحسابات وميزان المراجعة الموحد المستورد من Odoo (820 حساباً)' : 'Odoo Chart of Accounts & Unified Trial Balance'}
            </h3>
            <span className="text-xs text-slate-400">
              {isAr ? 'تطابق محاسبي تام بين Odoo ودفاتر فنتشر فودز' : '100% Synced with Odoo Data Lake'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-center">{isAr ? 'رقم الحساب' : 'Account Code'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'اسم الحساب المحاسبي' : 'Account Name'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'التبويب' : 'Class'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المدين (د.ك)' : 'Debit'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الدائن (د.ك)' : 'Credit'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الرصيد الصافي' : 'Net Balance'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { code: '101100', name: 'بنك الكويت الوطني (NBK - Main Operating)', cls: 'أصول نقدية', dr: '94,250.000', cr: '0.000', bal: '94,250.000' },
                    { code: '101200', name: 'البنك التجاري الكويتي (CBK - Payroll WPS)', cls: 'أصول نقدية', dr: '48,600.000', cr: '0.000', bal: '48,600.000' },
                    { code: '102000', name: 'عهد وصناديق الفروع النقدية (Branch Petty Cash)', cls: 'نقدية فروع', dr: '7,500.000', cr: '0.000', bal: '7,500.000' },
                    { code: '105000', name: 'مخزون المواد الغذائية والتعبئة والمطبخ المركزي', cls: 'مخزون متداول', dr: '124,500.000', cr: '0.000', bal: '124,500.000' },
                    { code: '106000', name: 'مدينو منصات التوصيل (طلبات، جاهز، دليفرو، كيتا)', cls: 'عملاء ومدينون', dr: '28,450.000', cr: '0.000', bal: '28,450.000' },
                    { code: '201000', name: 'موردو المواد الخام واللحوم والخضار (Payables)', cls: 'خصوم متداولة', dr: '0.000', cr: '68,420.000', bal: '-68,420.000' },
                    { code: '202000', name: 'مستحقات رواتب العاملين ومسير WPS', cls: 'خصوم متداولة', dr: '0.000', cr: '48,250.000', bal: '-48,250.000' },
                    { code: '203000', name: 'مخصص مكافأة نهاية الخدمة (EOSB Provision)', cls: 'مخصصات التزامات', dr: '0.000', cr: '25,640.000', bal: '-25,640.000' },
                    { code: '301000', name: 'رأس مال شركة فنتشر فودز المصرح به والمدفوع', cls: 'حقوق ملكية', dr: '0.000', cr: '250,000.000', bal: '-250,000.000' },
                  ].map((acc, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 text-center font-mono font-bold text-amber-400">{acc.code}</td>
                      <td className="px-4 py-3 font-semibold text-white">{acc.name}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{acc.cls}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 text-right">{acc.dr}</td>
                      <td className="px-4 py-3 font-mono text-amber-300 text-right">{acc.cr}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right">{acc.bal} د.ك</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: AR/AP AGING & PROVISIONS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'aging' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'الذمم المدينة والدائنة ومخصصات نهاية الخدمة (مادة 51)' : 'AR/AP Aging & Kuwait Labor Law EOSB Provisions'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'تغطية مالية كاملة لالتزامات الموظفين والموردين' : '100% Fully Funded Provisions'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-2">
              <span className="text-xs text-slate-400">مخصص مكافأة نهاية الخدمة (EOSB):</span>
              <p className="text-2xl font-black text-amber-400 font-mono">25,640.000 د.ك</p>
              <p className="text-xs text-slate-500">محسوب وفق المادة 51 من قانون العمل الكويتي لـ 166 موظفاً</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-2">
              <span className="text-xs text-slate-400">مخصص رصيد الإجازات المستحقة:</span>
              <p className="text-2xl font-black text-blue-400 font-mono">8,920.000 د.ك</p>
              <p className="text-xs text-slate-500">رصيد الإجازات السنوية غير المستنفدة للكادر التشغيلي</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-2">
              <span className="text-xs text-slate-400">صافي المستحق لموردي المواد:</span>
              <p className="text-2xl font-black text-rose-400 font-mono">68,420.000 د.ك</p>
              <p className="text-xs text-slate-500">مجدولة للشيكات والتحويلات البنكية خلال شهر نوفمبر</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: AUTOMATED FINANCIAL GL BRIDGE (FIELD OPS)                          */}
      {/* ========================================================================= */}
      {activeTab === 'glBridge' && (
        <AutomatedGlBridge locale={currentLocale} />
      )}

      {/* ========================================================================= */}
      {/* TAB: EVENTS & CAMPS FINANCIALS (GL LINKAGE & COST CENTERS)                */}
      {/* ========================================================================= */}
      {activeTab === 'eventsFinance' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-gold-400" />
                <h3 className="text-base font-black text-white">
                  {isAr ? 'الرقابة المالية لمشاريع المعارض والمخيمات والفعاليات' : 'Events, Expos & Ministry Camps Financial Control'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'مراكز التكلفة المستقلة (Cost Centers)، قيود اليومية الآلية، وتتبع شيكات التأمين المستردة (حساب 110400)'
                  : 'Event cost centers, double-entry automated postings, and refundable security deposit audit (GL 110400)'}
              </p>
            </div>
            <Link
              href="/erp/events-projects"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-400/20 border border-gold-300/30 px-4 py-2 text-xs font-bold text-gold-300 hover:bg-gold-400/30 transition-colors"
            >
              <span>{isAr ? 'فتح مركز القيادة الشامل للفعاليات' : 'Open Full Events Command Hub'}</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Events Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'إجمالي إيرادات الفعاليات' : 'Total Revenue'}</span>
              <div className="mt-2 text-xl font-black text-emerald-400 font-mono">
                {VENTURE_FOODS_EVENTS.reduce((acc, e) => acc + e.revenue.grossSalesKwd, 0).toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
              </div>
              <span className="text-[10px] text-slate-500">{isAr ? 'من 6 فعاليات ومخيمات موثقة' : 'Across 6 events & camps'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'صافي الأرباح المحققة' : 'Net Profit'}</span>
              <div className="mt-2 text-xl font-black text-gold-300 font-mono">
                {VENTURE_FOODS_EVENTS.reduce((acc, e) => acc + e.profitability.netProfitKwd, 0).toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">▲ 43.4% {isAr ? 'هامش ربح صافي' : 'Net margin'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'التأمينات المستردة المعلقة (GL 110400)' : 'Pending Deposits'}</span>
              <div className="mt-2 text-xl font-black text-cyan-300 font-mono">
                {VENTURE_FOODS_EVENTS.filter(e => e.costs.securityDepositStatus === 'pending').reduce((acc, e) => acc + e.costs.securityDepositKwd, 0).toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
              </div>
              <span className="text-[10px] text-amber-400">{isAr ? 'بانتظار خطابات إخلاء الطرف' : 'Awaiting site clearances'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'متوسط العائد على الاستثمار' : 'Average ROI'}</span>
              <div className="mt-2 text-xl font-black text-purple-300 font-mono">
                ▲ 77.3%
              </div>
              <span className="text-[10px] text-slate-400">{isAr ? 'استرداد كامل خلال 5-26 يوم' : '5-26 days payback'}</span>
            </div>
          </div>

          {/* Events Cost Center Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? 'سجل مراكز تكلفة الفعاليات وقيود الأرباح والخسائر' : 'Events Cost Center Ledger & P&L Statement'}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'مركز التكلفة والفعالية' : 'Cost Center & Event'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'الأيام' : 'Days'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الإيجار (501010)' : 'Rental (501010)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الديكور (120400)' : 'Fitout (120400)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الأغذية (501000)' : 'COGS (501000)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'المبيعات' : 'Sales'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'شيك التأمين' : 'Deposit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {VENTURE_FOODS_EVENTS.map((evt) => (
                    <tr key={evt.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-sans">
                        <span className="font-mono text-gold-400 font-bold text-[11px]">{evt.costCenterCode}</span>
                        <div className="font-bold text-white text-xs">{isAr ? evt.nameAr : evt.nameEn}</div>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300">{evt.daysCount}</td>
                      <td className="px-3 py-3 text-end text-slate-300">{evt.costs.boothRentalKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end text-slate-300">{evt.costs.constructionFitoutKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end text-slate-300">{evt.costs.foodPackagingCogsKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end font-bold text-emerald-400">{evt.revenue.grossSalesKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-end font-bold text-gold-300">{evt.profitability.netProfitKwd.toFixed(3)}</td>
                      <td className="px-3 py-3 text-center font-sans">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          evt.costs.securityDepositStatus === 'refunded'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {evt.costs.securityDepositKwd.toFixed(0)} KWD ({evt.costs.securityDepositStatus})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: LEGACY DATABASE ACCOUNTING                                         */}
      {/* ========================================================================= */}
      
      {/* ========================================================================= */}
      {/* TAB: COMPREHENSIVE LEASES, HOUSING & RENT BURDEN RATIO                    */}
      {/* ========================================================================= */}
      {activeTab === 'leases' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-black text-white">
                  {isAr ? 'منظومة الإيجارات الشاملة ونسب عبء الإيجار ومخاطر العقود' : 'Comprehensive Leases, Rent-to-Sales Burden & Facility Rents'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'عقود إيجار الفروع الـ 10، سكنات العمال (4 مباني)، المطبخ المركزي بالقرين ومخازن الشويخ، وتأمينات المعارض'
                  : 'Auditing 10 branch leases, 4 staff housing buildings, Al-Qurain central kitchen & warehouses, and event booth deposits'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">
                {isAr ? 'متوسط عبء الإيجار الموحد: 10.89%' : 'Weighted Rent Burden: 10.89%'}
              </span>
            </div>
          </div>

          {/* Lease Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'إجمالي الإيجارات الشهرية' : 'Total Monthly Leases'}</span>
              <div className="mt-2 text-xl font-black text-amber-400 font-mono">27,850.000 KWD</div>
              <span className="text-[10px] text-slate-500">{isAr ? 'فروع 18,200 + سكن 4,600 + مخازن 5,050' : '10 branches + 4 housing + 3 hubs'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'نسبة عبء الإيجار من المبيعات' : 'Rent-to-Sales Ratio'}</span>
              <div className="mt-2 text-xl font-black text-emerald-400 font-mono">10.89%</div>
              <span className="text-[10px] text-emerald-300 font-bold">🟢 {isAr ? 'ضمن المعدل العالمي الممتاز (< 15%)' : 'Healthy benchmark (< 15%)'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'التأمينات الإيجارية المستردة (GL 110400)' : 'Security Deposits in GL'}</span>
              <div className="mt-2 text-xl font-black text-cyan-300 font-mono">24,500.000 KWD</div>
              <span className="text-[10px] text-slate-400">{isAr ? 'تأمينات فروع وسكنات معتمدة' : 'Recoverable upon vacate'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'عقود تتطلب التجديد قريباً' : 'Expiring Soon'}</span>
              <div className="mt-2 text-xl font-black text-rose-400 font-mono">2 {isAr ? 'عقود' : 'Leases'}</div>
              <span className="text-[10px] text-rose-300 font-bold">{isAr ? 'بنيد القار والمهبولة (نوفمبر/ديسمبر 2026)' : 'Bneid Al-Qar & Mahboula'}</span>
            </div>
          </div>

          {/* Table 1: 10 Branch Leases & Rent-to-Sales Burden */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? '1. عقود إيجارات الفروع الـ 10 ونسبة عبء الإيجار من مبيعات أكتوبر 2026' : '1. 10 Branch Leases & October 2026 Rent-to-Sales Burden'}
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">18,200.000 KWD / 167,092.000 KWD = 10.89%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'الفرع والموقع' : 'Branch & Location'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'المساحة' : 'Area'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الإيجار الشهري' : 'Monthly Rent'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'مبيعات أكتوبر' : 'Oct Sales'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'نسبة عبء الإيجار %' : 'Rent Burden %'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'المالك / المؤجر' : 'Landlord'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'انتهاء العقد' : 'Expiry'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'حالة التجديد' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {[
                    { branchAr: 'فرع السالمية (شارع سالم المبارك)', branchEn: 'Salmiya - Salem Al-Mubarak', area: '140 m²', rent: 2400, sales: 24150, landlord: 'Al-Bahar Real Estate', expiry: '2027-12-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع الأفنيوز (المرحلة 2)', branchEn: 'The Avenues - Phase 2', area: '110 m²', rent: 3800, sales: 36400, landlord: 'Mabanee Co. S.A.K.', expiry: '2028-06-15', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع حولي (شارع بيروت)', branchEn: 'Hawally - Beirut St.', area: '130 m²', rent: 1850, sales: 18200, landlord: 'Al-Tijaria Real Estate', expiry: '2027-09-30', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع الفروانية (شارع حبيب مناور)', branchEn: 'Farwaniya - Habib Munawer St.', area: '125 m²', rent: 1600, sales: 15900, landlord: 'Al-Hamra Real Estate', expiry: '2027-03-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع المهبولة (الشريط الساحلي)', branchEn: 'Mahboula - Coastal Road', area: '150 m²', rent: 1450, sales: 13800, landlord: 'United Real Estate', expiry: '2026-11-30', status: 'EXPIRING', statusAr: 'قيد تجديد العقد' },
                    { branchAr: 'فرع الجهراء (شارع مرزوق المتعب)', branchEn: 'Jahra - Marzouq Al-Meteb St.', area: '160 m²', rent: 1750, sales: 14200, landlord: 'Al-Wafra Real Estate', expiry: '2027-08-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع خيطان (شارع عثمان بن عفان)', branchEn: 'Khaitan - Othman Bin Affan', area: '115 m²', rent: 1250, sales: 11400, landlord: 'Al-Safat Investment', expiry: '2027-10-31', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع بنيد القار (شارع الاستقلال)', branchEn: 'Bneid Al-Qar - Istiklal St.', area: '95 m²', rent: 1350, sales: 12800, landlord: 'Al-Safir Holdings', expiry: '2026-12-31', status: 'EXPIRING', statusAr: 'قيد التفاوض للتجديد' },
                    { branchAr: 'فرع الري (طريق الغزالي السريع)', branchEn: 'Al-Rai - Ghazali Hub', area: '140 m²', rent: 1550, sales: 11900, landlord: 'Al-Rai Logistics Co.', expiry: '2028-04-30', status: 'ACTIVE', statusAr: 'سارٍ ومستقر' },
                    { branchAr: 'فرع الفحيحيل (شارع مكة)', branchEn: 'Fahaheel - Makkah St.', area: '100 m²', rent: 1200, sales: 8342, landlord: 'Al-Koot Mall Complex', expiry: '2027-01-31', status: 'ACTIVE', statusAr: 'مراقبة العبء (< 15%)' },
                  ].map((row, idx) => {
                    const ratio = (row.rent / row.sales) * 100
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium text-white">{isAr ? row.branchAr : row.branchEn}</td>
                        <td className="px-3 py-3 text-center text-slate-400 font-mono">{row.area}</td>
                        <td className="px-3 py-3 text-end font-mono font-bold text-amber-300">{row.rent.toFixed(3)} KWD</td>
                        <td className="px-3 py-3 text-end font-mono text-slate-300">{row.sales.toLocaleString()} KWD</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            ratio < 11 ? 'bg-emerald-500/20 text-emerald-300' : ratio < 14 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {ratio.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-400">{row.landlord}</td>
                        <td className="px-3 py-3 text-center font-mono text-slate-300">{row.expiry}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.status === 'EXPIRING' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {isAr ? row.statusAr : row.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Staff Housing Flats & Dormitories */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
              <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isAr ? '2. سكنات الموظفين والعمالة (GL 502040)' : '2. Staff Housing & Flats (GL 502040)'}
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { building: 'عمارة المهبولة ق4 (4 شقق)', en: 'Mahboula Bldg 4 (4 Flats)', staff: '28 موظفاً', rent: 1400, deposit: 1400, landlord: 'شركة الأحمدية العقارية' },
                  { building: 'عمارة خيطان ق12 (3 شقق)', en: 'Khaitan Bldg 12 (3 Flats)', staff: '22 موظفاً', rent: 1150, deposit: 1150, landlord: 'عقارات العثمان' },
                  { building: 'شقق السالمية ق10 (شقتان)', en: 'Salmiya Block 10 (2 Flats)', staff: '14 موظفاً', rent: 950, deposit: 950, landlord: 'مجموعة الكاظمي' },
                  { building: 'فيلا سكن الفحيحيل (فيلا كاملة)', en: 'Fahaheel Villa (Full Villa)', staff: '16 موظفاً', rent: 1100, deposit: 1100, landlord: 'عقارات المطوع' },
                ].map((flat, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{isAr ? flat.building : flat.en}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{flat.staff} • {flat.landlord}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono font-bold text-amber-300">{flat.rent.toFixed(3)} KWD</div>
                      <div className="text-[10px] text-cyan-400 font-mono">تأمين: {flat.deposit} KWD</div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs font-bold px-1">
                  <span className="text-slate-300">{isAr ? 'إجمالي إيجار سكن الموظفين الشهري:' : 'Total Monthly Housing:'}</span>
                  <span className="font-mono text-amber-400 text-sm">4,600.000 KWD</span>
                </div>
              </div>
            </div>

            {/* Table 3: Central Commissary & Storage Warehouses */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
              <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {isAr ? '3. المطبخ المركزي بالقرين ومخازن التوزيع' : '3. Commissary & Logistics Warehouses'}
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: 'المطبخ المركزي والمقر الإنتاجي (أسواق القرين)', en: 'Al-Qurain Central Kitchen Commissary', area: '600 m²', rent: 3200, gl: 'GL 501000', landlord: 'إدارة أسواق القرين' },
                  { name: 'مستودع الشويخ الجاف والتغليف (الشويخ الصناعية)', en: 'Shuwaikh Dry & Packaging Warehouse', area: '450 m²', rent: 1850, gl: 'GL 501005', landlord: 'عقارات الشويخ الصناعية' },
                  { name: 'وحدة التبريد والتجميد المركزي (الري)', en: 'Al-Rai Cold Storage Unit', area: '200 m²', rent: 1200, gl: 'GL 501006', landlord: 'أجيليتي للمجمعات اللوجستية' },
                ].map((wh, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{isAr ? wh.name : wh.en}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{wh.area} • {wh.gl} • {wh.landlord}</div>
                    </div>
                    <div className="text-end">
                      <div className="font-mono font-bold text-amber-300">{wh.rent.toFixed(3)} KWD</div>
                      <div className="text-[10px] text-emerald-400 font-bold">{isAr ? 'عقد طويل الأجل' : 'Long-Term Lease'}</div>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs font-bold px-1">
                  <span className="text-slate-300">{isAr ? 'إجمالي إيجارات المنشآت اللوجستية:' : 'Total Facilities Leases:'}</span>
                  <span className="font-mono text-amber-400 text-sm">6,250.000 KWD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: FLEET, VEHICLES, GARAGE REPAIRS, FUEL & DRIVER FINES                 */}
      {/* ========================================================================= */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-sky-400" />
                <h3 className="text-base font-black text-white">
                  {isAr ? 'منظومة إدارة الأسطول وتكاليف الكراجات والمحروقات ومخالفات السائقين' : 'Fleet Management, Garage Repairs, Fuel Cards & Driver Fines'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'أسطول التوصيل المبرد (18 مركبة)، تكاليف الصيانة وقطع الغيار بالكراجات، كروت الوقود، والخصم المباشر لمخالفات المرور من الرواتب'
                  : 'Managing 18 fleet vehicles, garage work orders (GL 503010), fuel allowances (GL 503020), and driver payroll deductions (GL 210500)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-300">
                {isAr ? '18 مركبة نشطة تحت المراقبة' : '18 Active Vehicles Monitored'}
              </span>
            </div>
          </div>

          {/* Fleet Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'حجم الأسطول النشط' : 'Active Fleet Size'}</span>
              <div className="mt-2 text-xl font-black text-sky-400 font-mono">18 {isAr ? 'مركبة' : 'Units'}</div>
              <span className="text-[10px] text-slate-500">{isAr ? '6 سيارات فان مبردة + 8 دراجات + 4 عمليات' : '6 Vans + 8 Bikes + 4 SUVs'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'صيانة الكراجات وقطع الغيار (GL 503010)' : 'Garage Repairs & Parts'}</span>
              <div className="mt-2 text-xl font-black text-amber-400 font-mono">1,280.000 KWD</div>
              <span className="text-[10px] text-slate-400">{isAr ? 'كراجات الشويخ والري المعتمدة' : 'Approved Shuwaikh workshops'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'محروقات وبترول الأسطول (GL 503020)' : 'Fuel & Petrol (Monthly)'}</span>
              <div className="mt-2 text-xl font-black text-emerald-400 font-mono">1,420.000 KWD</div>
              <span className="text-[10px] text-emerald-300 font-bold">{isAr ? 'كروت الأولى وبترول الوطنية' : 'Oula & KNPC Fuel Cards'}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="text-xs font-semibold text-slate-400">{isAr ? 'المخالفات المرورية المربوطة بالرواتب' : 'Driver Traffic Fines'}</span>
              <div className="mt-2 text-xl font-black text-rose-400 font-mono">285.000 KWD</div>
              <span className="text-[10px] text-rose-300 font-bold">100% {isAr ? 'مربوطة بخصم مسير الرواتب (GL 210500)' : 'Linked to WPS Payroll'}</span>
            </div>
          </div>

          {/* Table 1: Garage Work Orders & Repairs (GL 503010) */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? '1. فواتير وتصليحات كراجات صيانة المركبات والتبريد (GL 503010)' : '1. Garage Repair Orders & Chiller Maintenance (GL 503010)'}
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">{isAr ? 'كراجات الشويخ الصناعية المعتمدة' : 'Shuwaikh Industrial Hub'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'رقم اللوحة والمركبة' : 'Plate & Vehicle'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'الكراج / الورشة المعتمدة' : 'Workshop / Garage'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'طبيعة الإصلاح وقطع الغيار' : 'Work Done & Parts'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'المبلغ بالفاتورة' : 'Amount KWD'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'الحساب المحاسبي' : 'GL Account'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {[
                    { plate: '12-49811', vehicle: 'Toyota HiAce Chilled Van', garage: 'كراج الشويخ المركزي للتبريد', work: 'صيانة كمبروسر التبريد Thermo King وتعبئة غاز R404A', amount: 145.0, date: '2026-10-28', gl: '503010 صيانة سيارات' },
                    { plate: '15-88201', vehicle: 'Nissan Urvan Refrig Van', garage: 'كراج الري المتخصص للمكابح', work: 'تبديل سفايف فرامل أمامية وخلفية + خرط ديسكات', amount: 85.0, date: '2026-10-24', gl: '503010 صيانة سيارات' },
                    { plate: '18-33104', vehicle: 'Isuzu Chilled 3-Ton Truck', garage: 'الورشة الفنية لمحركات الديزل (الأحمدي)', work: 'سيرفس كامل 40,000 كم + تبديل بوشات ومساعدات', amount: 260.0, date: '2026-10-18', gl: '503010 صيانة سيارات' },
                    { plate: 'BK-103', vehicle: 'Honda 150cc Delivery Bike', garage: 'ورشة الفروانية لصيانة الدراجات', work: 'تبديل جنزير ومسننات + إطار خلفي توبلس أصلي', amount: 38.0, date: '2026-10-29', gl: '503010 صيانة سيارات' },
                    { plate: '12-49812', vehicle: 'Toyota HiAce Chilled Van', garage: 'كراج كهرباء وبطاريات الشويخ', work: 'تبديل دينمو شحن أصلي + طقم بطاريتين هيفي ديوتي', amount: 120.0, date: '2026-10-12', gl: '503010 صيانة سيارات' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-sky-400 text-xs">{row.plate}</span>
                        <div className="text-[11px] text-slate-300">{row.vehicle}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{row.garage}</td>
                      <td className="px-3 py-3 text-slate-300">{row.work}</td>
                      <td className="px-3 py-3 text-end font-mono font-bold text-amber-300">{row.amount.toFixed(3)} KWD</td>
                      <td className="px-3 py-3 text-center font-mono text-slate-400">{row.date}</td>
                      <td className="px-3 py-3 text-center font-mono text-emerald-400">{row.gl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Traffic Violations Linked to Driver Payroll Deductions */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0d131f]">
            <div className="border-b border-slate-800 px-5 py-3.5 bg-slate-900/40 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {isAr ? '2. رادار المخالفات المرورية وربطها التلقائي بخصومات رواتب السائقين (GL 210500)' : '2. Traffic Violations & Automated Driver Payroll Deductions (GL 210500)'}
              </h4>
              <span className="text-[11px] text-rose-400 font-mono font-bold">{isAr ? 'إجمالي المخالفات المسجلة: 285.000 د.ك' : 'Total Fines: 285.000 KWD'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                    <th className="px-4 py-3 text-start">{isAr ? 'رقم المخالفة والتاريخ' : 'Violation Ref & Date'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'المركبة واللوحة' : 'Vehicle & Plate'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'وصف المخالفة المرورية' : 'Violation Detail'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'السائق المسؤول' : 'Driver'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'قيمة الغرامة' : 'Fine (KWD)'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'مسير الرواتب المربوط' : 'Payroll Month'}</th>
                    <th className="px-3 py-3 text-center">{isAr ? 'حالة القيد والخصم' : 'GL Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {[
                    { ref: 'MOH-TRF-90218', date: '2026-10-25 14:20', plate: '15-88201', desc: 'تجاوز السرعة المقررة (20-30 كم/س) - طريق الدائري الخامس', driver: 'محمد عمران (EMP-0042)', fine: 20.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90245', date: '2026-10-22 11:15', plate: 'BK-104', desc: 'الوقوف في مواقف الحافلات / فوق الرصيف بالسالمية', driver: 'جاسم الدين (EMP-0078)', fine: 15.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90302', date: '2026-10-19 18:40', plate: '12-49812', desc: 'عدم ارتداء حزام الأمان واستخدام الهاتف أثناء القيادة', driver: 'سونيل كومار (EMP-0036)', fine: 15.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90380', date: '2026-10-14 09:30', plate: '18-33104', desc: 'مخالفة السير في الحارة اليسرى لمركبة نقل بضائع في وقت الذروة', driver: 'كبير حسين (EMP-0051)', fine: 30.0, month: 'نوفمبر 2026', glStatus: 'مربوط بخصم الراتب', statusBadge: 'bg-amber-500/20 text-amber-300' },
                    { ref: 'MOH-TRF-90411', date: '2026-10-08 20:05', plate: 'BK-101', desc: 'عدم وضوح العاكس الضوئي لصندوق التوصيل الخلفي للدراجة', driver: 'بلال حسين (EMP-0081)', fine: 5.0, month: 'أكتوبر 2026', glStatus: 'تم الخصم والسداد بالمرور', statusBadge: 'bg-emerald-500/20 text-emerald-300' },
                  ].map((fine, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-rose-400 text-xs">{fine.ref}</span>
                        <div className="text-[10px] text-slate-400">{fine.date}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-sky-400">{fine.plate}</td>
                      <td className="px-3 py-3 text-slate-300">{fine.desc}</td>
                      <td className="px-3 py-3 font-medium text-white">{fine.driver}</td>
                      <td className="px-3 py-3 text-end font-mono font-bold text-rose-400">{fine.fine.toFixed(3)} KWD</td>
                      <td className="px-3 py-3 text-center text-slate-300 font-medium">{fine.month}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${fine.statusBadge}`}>
                          {fine.glStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
          {liveChildren}
        </div>
      )}

      {/* New Journal Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إنشاء قيد يومية محاسبي مزدوج' : 'Create General Journal Entry'}
              </h3>
              <button onClick={() => setShowNewEntryModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setShowNewEntryModal(false)
                showToast(isAr ? '✅ تم حفظ القيد المحاسبي وتحديث ميزان المراجعة بنجاح' : '✅ Journal entry posted to ledger')
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'البيان المحاسبي:' : 'Narrative / Description:'}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: إثبات إيداع مبيعات الكاش فرع السالمية بالبنك' : 'e.g. In-store cash deposit to NBK'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'الحساب المدين (Dr):' : 'Debit Account:'}</label>
                  <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                    <option value="101100">101100 - بنك الكويت الوطني NBK</option>
                    <option value="105000">105000 - مخزون المواد الغذائية</option>
                    <option value="601000">601000 - مصروف الرواتب</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'الحساب الدائن (Cr):' : 'Credit Account:'}</label>
                  <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                    <option value="401000">401000 - إيرادات مبيعات الفروع</option>
                    <option value="102000">102000 - نقدية وصناديق الفروع</option>
                    <option value="201000">201000 - حسابات الموردين</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'المبلغ بالدينار الكويتي (KWD):' : 'Amount in KWD:'}</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="1250.000"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEntryModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-bold text-black hover:bg-emerald-400"
                >
                  {isAr ? 'ترحيل واعتماد القيد' : 'Post Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
