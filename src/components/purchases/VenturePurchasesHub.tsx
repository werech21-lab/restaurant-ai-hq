'use client'

import React, { useState } from 'react'
import {
  ShoppingCart,
  Scale,
  TrendingUp,
  Building2,
  PackageCheck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Download,
  Filter,
  ArrowRight,
  Clock,
  ThermometerSnowflake,
  ShieldAlert,
} from 'lucide-react'

export function VenturePurchasesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<'orders' | 'matching' | 'priceRadar' | 'suppliers' | 'grn' | 'legacy'>('orders')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [searchQ, setSearchQ] = useState('')
  const [showNewPoModal, setShowNewPoModal] = useState(false)
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
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
              <ShoppingCart size={14} />
              {isAr ? 'المشتريات وإدارة الموردين والرقابة المالية' : 'Procurement & Vendor Intelligence'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'فنتشر فودز ذ.م.م.' : 'Venture Foods W.L.L.'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'مركز قيادة المشتريات والمطابقة الثلاثية' : 'Enterprise Procurement & 3-Way Matching Engine'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'إدارة أوامر الشراء، المطابقة الرقابية الثلاثية (PO ↔ GRN ↔ Bill)، ورادار تضخم أسعار الموردين'
              : 'Managing Purchase Orders, 3-Way Matching, Price Creep Detection, and Vendor AP Aging'}
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
            onClick={() => setShowNewPoModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/10"
          >
            <Plus size={15} />
            {isAr ? 'أمر شراء جديد (PO)' : 'New Purchase Order'}
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

      {/* 5 Specialized Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'orders', labelAr: '🛒 أوامر الشراء وإعادة الطلب (POs)', labelEn: 'Purchase Orders & Replenishment', icon: ShoppingCart },
          { key: 'matching', labelAr: '⚖️ المطابقة الثلاثية للفواتير (3-Way Match)', labelEn: '3-Way Match (PO ↔ GRN ↔ Bill)', icon: Scale },
          { key: 'priceRadar', labelAr: '📈 رادار تضخم ومقارنة أسعار الموردين', labelEn: 'Price Creep & Variance Radar', icon: TrendingUp },
          { key: 'suppliers', labelAr: '🏢 سجل الموردين وأعمار الديون (AP Aging)', labelEn: 'Vendors Directory & AP Aging', icon: Building2 },
          { key: 'grn', labelAr: '📦 سندات استلام البضاعة وفحص الجودة (GRN)', labelEn: 'Goods Receipt Notes & QC', icon: PackageCheck },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ فواتير الشراء الحية بقاعدة البيانات (DB)', labelEn: 'Database Purchase Invoices', icon: FileText }] : []),
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/10'
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
      {/* TAB 1: PURCHASE ORDERS & AUTO-REPLENISHMENT                               */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'إجمالي المشتريات الشهرية' : 'Monthly Spend'}</span>
              <p className="mt-1 text-2xl font-black text-white">52,634.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '148 أمر شراء معتمد' : '148 approved POs'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'أوامر قيد التسليم' : 'In-Transit POs'}</span>
              <p className="mt-1 text-2xl font-black text-blue-400">12 {isAr ? 'طلبية نشطة' : 'Active POs'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'تسليم اليوم بالمستودع' : 'Dock arrival today'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'وفورات الشراء والخصومات' : 'Rebate Savings'}</span>
              <p className="mt-1 text-2xl font-black text-emerald-400">3,840.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'خصم كميات وعقود مباشرة' : 'Volume discount'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'معدل التوريد في الموعد' : 'On-Time Fill Rate'}</span>
              <p className="mt-1 text-2xl font-black text-amber-400">98.4%</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'التزام تعاقدي ممتاز' : 'Strict SLA adherence'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'رقم أمر الشراء' : 'PO Number'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المورد المعتمد' : 'Supplier / Vendor'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الأصناف والمواصفات' : 'Items & Specs'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'القيمة الإجمالية (د.ك)' : 'Total (KWD)'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'موقع التسليم' : 'Delivery Hub'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'حالة الأمر' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { po: 'PO-202611-041', sup: 'شركة نقل وتجارة المواشي (Al Mawashi)', items: 'لحم أنجوس مفروم وشيت ستيك فاخر (850 كجم)', val: '4,850.000', hub: 'المطبخ المركزي (القرين)', status: 'تم الاستلام والفوترة' },
                    { po: 'PO-202611-042', sup: 'شركة نايف للدواجن الوطنية', items: 'صدور وفيليه دجاج طازج 100% (600 كجم)', val: '3,240.000', hub: 'المطبخ المركزي (القرين)', status: 'خرج للتوصيل' },
                    { po: 'PO-202611-043', sup: 'شركة أطلس للتغليف والكرتون', items: 'علب برجر فرانكس وثينيز وأكياس كرافت (25,000 علبة)', val: '2,900.000', hub: 'مستودع الري للتعبئة', status: 'معتمد قيد التجهيز' },
                    { po: 'PO-202611-044', sup: 'شركة مطاحن الدقيق والمخابز الكويتية', items: 'طحين فاخر وزيوت ذرة نقية (120 كرتون)', val: '2,450.000', hub: 'المطبخ المركزي (القرين)', status: 'تم الاستلام والفوترة' },
                    { po: 'PO-202611-045', sup: 'شركة الألبان الكويتية (KDD)', items: 'جبن شيدر طبيعي مبشور وزبدة (350 كجم)', val: '1,850.000', hub: 'المطبخ المركزي (القرين)', status: 'خرج للتوصيل' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-400">{row.po}</td>
                      <td className="px-4 py-3 font-semibold text-white">{row.sup}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{row.items}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right">{row.val}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 text-center">{row.hub}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          row.status.includes('الفوترة')
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : row.status.includes('التوصيل')
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
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
      {/* TAB 2: 3-WAY MATCHING (PO ↔ GRN ↔ BILL)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'matching' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'شاشة الرقابة والتدقيق المالي للمطابقة الثلاثية (3-Way Matching)' : 'Automated 3-Way Invoice Reconciliation'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'حماية بنسبة 100% من فروقات الأسعار وزيادة الفواتير' : '100% Protection from Billing Overages'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'أمر الشراء (PO)' : 'Purchase Order'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المورد وفاتورته' : 'Vendor & Invoice'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الكمية المطلوبة (PO)' : 'PO Qty'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'المستلم الفعلي (GRN)' : 'GRN Received'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'قيمة أمر الشراء' : 'PO Amount'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'فاتورة المورد' : 'Bill Amount'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'نتيجة المطابقة' : 'Audit Result'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الاعتماد' : 'Approval'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { po: 'PO-202611-041', grn: 'GRN-9021', bill: 'INV-ALM-891', sup: 'شركة نقل وتجارة المواشي', poQty: '850 كجم', grnQty: '850 كجم', poAmt: '4,850.000', billAmt: '4,850.000', match: 'مطابق 100%', ok: true },
                    { po: 'PO-202611-042', grn: 'GRN-9022', bill: 'INV-NYF-412', sup: 'شركة نايف للدواجن', poQty: '600 كجم', grnQty: '590 كجم', poAmt: '3,240.000', billAmt: '3,186.000', match: 'تعديل فاتورة للنقص (-54 د.ك)', ok: true },
                    { po: 'PO-202611-039', grn: 'GRN-9018', bill: 'INV-ATL-119', sup: 'شركة أطلس للتغليف', poQty: '20,000 علبة', grnQty: '20,000 علبة', poAmt: '2,200.000', billAmt: '2,290.000', match: 'فارق سعر غير مصرح (+90 د.ك)', ok: false },
                    { po: 'PO-202611-038', grn: 'GRN-9017', bill: 'INV-KFM-552', sup: 'مطاحن الدقيق الكويتية', poQty: '100 كيس', grnQty: '100 كيس', poAmt: '1,420.000', billAmt: '1,420.000', match: 'مطابق 100%', ok: true },
                  ].map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-400">{m.po}</td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {m.sup}
                        <span className="block text-xs font-mono text-slate-400">{m.bill} · {m.grn}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">{m.poQty}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">{m.grnQty}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{m.poAmt} د.ك</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-300">{m.billAmt} د.ك</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          m.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {m.match}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => showToast(m.ok ? '✅ تم اعتماد الفاتورة وتحويلها للصرف البنكي' : '⚠️ تم حظر الفاتورة ومطالبة المورد بتعديل السعر')}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                            m.ok ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-rose-500 text-white hover:bg-rose-600'
                          }`}
                        >
                          {m.ok ? (isAr ? 'اعتماد مالي' : 'Approve') : (isAr ? 'اعتراض وتجميد' : 'Hold Bill')}
                        </button>
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
      {/* TAB 3: PRICE CREEP & COST VARIANCE RADAR                                  */}
      {/* ========================================================================= */}
      {activeTab === 'priceRadar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'رادار تتبع تضخم وفروقات أسعار المواد الخام والتغليف' : 'Raw Materials & Packaging Cost Variance Radar'}
            </h3>
            <span className="text-xs text-amber-400 font-semibold">
              {isAr ? 'مقارنة تلقائية بأسعار العقود التاريخية' : 'Automated Baseline Variance Check'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'كود المادة' : 'SKU Code'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'اسم الصنف الخام' : 'Raw / Pack Item'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المورد المورد' : 'Current Supplier'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'السعر السابق (د.ك)' : 'Last Price (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'السعر الحالي (د.ك)' : 'Current Price'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'نسبة التغير %' : 'Variance %'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'أفضل مورد بديل' : 'Best Alternative'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { sku: 'RW01-BEEF-ANG', name: 'لحم أنجوس مفروم طازج (كجم)', sup: 'شركة المواشي', oldP: '5.400', newP: '5.400', change: '0.0% (ثابت)', alt: 'السعر الأفضل تعاقدياً', safe: true },
                    { sku: 'RW01-CHIK-BRS', name: 'صدور دجاج طازجة مخلية (كجم)', sup: 'دواجن نايف', oldP: '2.100', newP: '2.150', change: '+2.4%', alt: 'شركة التنمية للدواجن (2.050 د.ك)', safe: false },
                    { sku: 'PI02-CUP-250', name: 'أكواب كرتون للمشروبات والكرك 8 أونصة', sup: 'شركة أطلس', oldP: '0.022', newP: '0.025', change: '+13.6%', alt: 'مصنع الخليج للتغليف (0.021 د.ك)', safe: false },
                    { sku: 'RW01-OIL-CORN', name: 'زيت ذرة نقي للقلي صفيحة 18 لتر', sup: 'مطاحن الدقيق', oldP: '14.200', newP: '14.200', change: '0.0% (ثابت)', alt: 'مدعوم وحكومي', safe: true },
                    { sku: 'RW01-CHS-CHED', name: 'جبن شيدر طبيعي معتق كرتون 10 كجم', sup: 'شركة KDD', oldP: '28.500', newP: '29.200', change: '+2.5%', alt: 'شركة المراعي الكويت (28.400 د.ك)', safe: false },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-amber-400">{row.sku}</td>
                      <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                      <td className="px-4 py-3 text-slate-300">{row.sup}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-right">{row.oldP}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right">{row.newP}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.safe ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                        }`}>
                          {row.change}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-blue-300 text-right">{row.alt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPPLIERS DIRECTORY & AP AGING                                     */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'دليل الموردين وأعمار الديون وجدول السداد (Odoo AP Aging)' : 'Supplier Directory, Balances & AP Aging'}
            </h3>
            <span className="text-xs text-slate-400">
              {isAr ? 'إجمالي مستحقات الموردين: 68,420 د.ك' : 'Total Supplier Payables: 68,420 KWD'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'اسم المورد' : 'Supplier'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'فئة التوريد' : 'Category'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الرصيد الإجمالي (د.ك)' : 'Total Due'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? '0-30 يوم' : '0-30 Days'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? '31-60 يوم' : '31-60 Days'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? '60+ يوم' : '> 60 Days'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الحساب البنكي' : 'Bank IBAN'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { name: 'شركة نقل وتجارة المواشي (Al Mawashi)', cat: 'لحوم طازجة أنجوس وبقري', due: '18,450.000', c1: '14,200.000', c2: '4,250.000', c3: '0.000', iban: 'NBK - KW12 NBOK 0000 0012 3456' },
                    { name: 'شركة مطاحن الدقيق والمخابز الكويتية', cat: 'طحين، خبز برجر، زيوت', due: '12,800.000', c1: '12,800.000', c2: '0.000', c3: '0.000', iban: 'CBK - KW44 CBKU 0000 0098 7654' },
                    { name: 'شركة نايف للدواجن الوطنية', cat: 'صدور وفيليه دجاج طازج', due: '10,650.000', c1: '8,200.000', c2: '2,450.000', c3: '0.000', iban: 'GBK - KW65 GULB 0000 0045 6123' },
                    { name: 'شركة أطلس للتغليف والكرتون', cat: 'علب برجر وأكياس وورق زبدة', due: '8,200.000', c1: '5,100.000', c2: '3,100.000', c3: '0.000', iban: 'KFH - KW88 KFHU 0000 0033 4455' },
                    { name: 'شركة الألبان الكويتية (KDD)', cat: 'أجبان، صوصات، زبدة، حليب', due: '7,320.000', c1: '7,320.000', c2: '0.000', c3: '0.000', iban: 'NBK - KW90 NBOK 0000 0011 2233' },
                    { name: 'شركة وافر لمنتجات الخضار المركزية', cat: 'خضار وفواكه طازجة يومية', due: '4,800.000', c1: '4,800.000', c2: '0.000', c3: '0.000', iban: 'BBY - KW19 BOUB 0000 0077 8899' },
                  ].map((sup, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{sup.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{sup.cat}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right">{sup.due}</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 text-right">{sup.c1}</td>
                      <td className="px-4 py-3 font-mono text-amber-400 text-right">{sup.c2}</td>
                      <td className="px-4 py-3 font-mono text-rose-400 text-right">{sup.c3}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 text-center" dir="ltr">{sup.iban}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GOODS RECEIPT NOTES (GRN) & QC CHECK                               */}
      {/* ========================================================================= */}
      {activeTab === 'grn' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'سندات استلام البضاعة وفحص الجودة وباب المستودع (GRN & QC)' : 'Goods Receipt Notes (GRN) & Receiving QC'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'فحص إلزامي لدرجات الحرارة والصلاحيات عند الرصيف' : 'Mandatory Dock Cold-Chain Inspection'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'رقم السند (GRN)' : 'GRN No'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المورد والشاحنة' : 'Supplier / Truck'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المادة المستلمة' : 'Received Item'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الكمية المستلمة' : 'Qty'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'حرارة الشاحنة' : 'Truck Temp'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الصلاحية المسجلة' : 'Expiry Check'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'فحص الجودة (QC)' : 'QC Result'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { grn: 'GRN-202611-091', sup: 'شركة المواشي · براد #82', item: 'لحم أنجوس مبرد طازج', qty: '850 كجم', temp: '+2.4°C', exp: 'سارية (ذبح 02 نوفمبر)', qc: 'مطابق ومجاز' },
                    { grn: 'GRN-202611-092', sup: 'دواجن نايف · براد #19', item: 'صدور دجاج طازجة متبلة', qty: '590 كجم', temp: '+2.8°C', exp: 'سارية (إنتاج اليوم)', qc: 'مطابق ومجاز' },
                    { grn: 'GRN-202611-093', sup: 'شركة KDD · شاحنة مبردة', item: 'أجبان شيدر وقشطة وزبدة', qty: '350 كجم', temp: '+3.1°C', exp: 'سارية 6 أشهر', qc: 'مطابق ومجاز' },
                    { grn: 'GRN-202611-094', sup: 'شركة أطلس · شاحنة جافة', item: 'علب برجر فرانكس وثينيز', qty: '25,000 علبة', temp: 'حرارة الغرفة', exp: 'سليمة وغير مبللة', qc: 'مطابق ومجاز' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-400">{row.grn}</td>
                      <td className="px-4 py-3 font-semibold text-white">{row.sup}</td>
                      <td className="px-4 py-3 text-slate-300">{row.item}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">{row.qty}</td>
                      <td className="px-4 py-3 text-center font-mono text-cyan-400">{row.temp}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-300">{row.exp}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          {row.qc}
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
      {/* TAB 6: LEGACY DATABASE PURCHASES                                          */}
      {/* ========================================================================= */}
      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
          {liveChildren}
        </div>
      )}

      {/* New PO Modal */}
      {showNewPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إنشاء أمر شراء جديد لموردي فنتشر فودز (PO)' : 'Create New Vendor Purchase Order'}
              </h3>
              <button onClick={() => setShowNewPoModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setShowNewPoModal(false)
                showToast(isAr ? '✅ تم إصدار أمر الشراء وإرساله للمورد وتوثيقه في نظام المطابقة الثلاثية' : '✅ PO issued & forwarded for 3-way match')
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'المورد المعتمد:' : 'Approved Supplier:'}</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                  <option value="ALM">شركة نقل وتجارة المواشي (Al Mawashi)</option>
                  <option value="NAY">شركة نايف للدواجن الوطنية</option>
                  <option value="KDD">شركة الألبان الكويتية (KDD)</option>
                  <option value="ATL">شركة أطلس للتغليف والكرتون</option>
                  <option value="KFM">شركة مطاحن الدقيق الكويتية</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'مستودع الاستلام والتفريغ:' : 'Receiving Warehouse:'}</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                  <option value="CK-QURAIN">المطبخ المركزي الرئيسي (أسواق القرين)</option>
                  <option value="SLM">مستودع الري للتعبئة والتغليف</option>
                  <option value="FB-SALMIYA">مستودع فرع السالمية</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'الأصناف والكميات المطلوبة:' : 'Items & Quantities:'}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: 500 كجم لحم أنجوس مفروم بسعر 5.400 د.ك/كجم' : 'e.g. 500 KG Angus beef at 5.400 KWD/KG'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewPoModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-400"
                >
                  {isAr ? 'إصدار أمر الشراء واعتماده' : 'Issue & Approve PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
