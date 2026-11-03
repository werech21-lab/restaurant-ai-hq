'use client'

import React, { useState } from 'react'
import {
  Warehouse,
  Truck,
  ChefHat,
  Trash2,
  ClipboardCheck,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Package,
  ThermometerSnowflake,
  Search,
  Filter,
  Download,
  RotateCw,
} from 'lucide-react'

export interface BranchWarehouseCard {
  id: string
  code: string
  nameAr: string
  nameEn: string
  areaAr: string
  areaEn: string
  brandCode: string
  isCommissary?: boolean
  stockValueKwd: number
  skuCount: { raw: number; prep: number; pack: number }
  chillerTemp: string
  freezerTemp: string
  manager: string
  readinessScore: number
}

const VENTURE_WAREHOUSES: BranchWarehouseCard[] = [
  {
    id: 'wh-commissary',
    code: 'CK-QURAIN',
    nameAr: 'المطبخ المركزي الرئيسي والمستودع اللوجستي (أسواق القرين)',
    nameEn: 'Al-Qurain Central Kitchen & Master Commissary',
    areaAr: 'أسواق القرين · مبارك الكبير',
    areaEn: 'Aswaq Al-Qurain · Mubarak Al-Kabeer',
    brandCode: 'ALL_BRANDS',
    isCommissary: true,
    stockValueKwd: 58450.0,
    skuCount: { raw: 142, prep: 68, pack: 85 },
    chillerTemp: '+2.8°C',
    freezerTemp: '-19.4°C',
    manager: 'الشيف طارق الشريف',
    readinessScore: 98,
  },
  {
    id: 'wh-salmiya',
    code: 'FB-SALMIYA',
    nameAr: 'مستودع فرع السالمية (شارع سالم المبارك)',
    nameEn: 'Salmiya Branch Warehouse',
    areaAr: 'السالمية · محافظة حولي',
    areaEn: 'Salmiya · Hawally Governorate',
    brandCode: "Frank's",
    stockValueKwd: 11240.0,
    skuCount: { raw: 24, prep: 18, pack: 22 },
    chillerTemp: '+3.1°C',
    freezerTemp: '-18.8°C',
    manager: 'راجيش باتيل',
    readinessScore: 96,
  },
  {
    id: 'wh-hawalli',
    code: 'TH-HAWALLI',
    nameAr: 'مستودع فرع حولي (شارع تونس)',
    nameEn: 'Hawalli Branch Warehouse',
    areaAr: 'حولي · محافظة حولي',
    areaEn: 'Hawalli · Hawally Governorate',
    brandCode: 'Thinnies',
    stockValueKwd: 8950.0,
    skuCount: { raw: 20, prep: 15, pack: 20 },
    chillerTemp: '+3.4°C',
    freezerTemp: '-18.5°C',
    manager: 'محمد إبراهيم',
    readinessScore: 95,
  },
  {
    id: 'wh-shuwaikh',
    code: 'SS-SHUWAIKH',
    nameAr: 'مستودع فرع الشويخ الصناعية (الرئيسي)',
    nameEn: 'Shuwaikh Industrial Flagship Warehouse',
    areaAr: 'الشويخ الصناعية · محافظة العاصمة',
    areaEn: 'Shuwaikh Industrial · Capital Governorate',
    brandCode: "Frank's",
    stockValueKwd: 14850.0,
    skuCount: { raw: 28, prep: 22, pack: 26 },
    chillerTemp: '+2.9°C',
    freezerTemp: '-19.1°C',
    manager: 'أحمد العوضي',
    readinessScore: 97,
  },
  {
    id: 'wh-ardiya',
    code: 'OS-ARDIYA',
    nameAr: 'مستودع فرع العارضية الحرفية',
    nameEn: 'Ardiya Craft Hub Warehouse',
    areaAr: 'العارضية الحرفية · محافظة الفروانية',
    areaEn: 'Ardiya Craft · Farwaniya Governorate',
    brandCode: 'Over Sized',
    stockValueKwd: 7820.0,
    skuCount: { raw: 18, prep: 14, pack: 18 },
    chillerTemp: '+3.2°C',
    freezerTemp: '-18.2°C',
    manager: 'سوريش كاليان',
    readinessScore: 94,
  },
  {
    id: 'wh-mahboula',
    code: 'SH-MAHBOULA',
    nameAr: 'مستودع فرع المهبولة (الطريق الساحلي)',
    nameEn: 'Mahboula Coastal Warehouse',
    areaAr: 'المهبولة · محافظة الأحمدي',
    areaEn: 'Mahboula · Ahmadi Governorate',
    brandCode: 'Shawarma Shack',
    stockValueKwd: 6420.0,
    skuCount: { raw: 16, prep: 12, pack: 16 },
    chillerTemp: '+3.0°C',
    freezerTemp: '-18.7°C',
    manager: 'خالد المنصور',
    readinessScore: 93,
  },
  {
    id: 'wh-jahra',
    code: 'FB-JAHRA',
    nameAr: 'مستودع فرع الجهراء (مجمع الخيمة مول)',
    nameEn: 'Jahra Al-Khaima Mall Warehouse',
    areaAr: 'الجهراء · محافظة الجهراء',
    areaEn: 'Jahra · Jahra Governorate',
    brandCode: 'Farm Brown',
    stockValueKwd: 5890.0,
    skuCount: { raw: 15, prep: 12, pack: 15 },
    chillerTemp: '+3.3°C',
    freezerTemp: '-18.4°C',
    manager: 'بدر الشمري',
    readinessScore: 92,
  },
  {
    id: 'wh-sharq',
    code: 'NB-SHARQ',
    nameAr: 'مستودع فرع شرق (برج التجارية)',
    nameEn: 'Sharq Tijaria Tower Warehouse',
    areaAr: 'شرق · محافظة العاصمة',
    areaEn: 'Sharq · Capital Governorate',
    brandCode: 'The Noodle Bar',
    stockValueKwd: 6150.0,
    skuCount: { raw: 17, prep: 14, pack: 18 },
    chillerTemp: '+3.1°C',
    freezerTemp: '-18.6°C',
    manager: 'سونيل ميهتا',
    readinessScore: 95,
  },
  {
    id: 'wh-fahaheel',
    code: 'KC-FAHAHEEL',
    nameAr: 'مستودع فرع الفحيحيل (مجمع أوتاد)',
    nameEn: 'Fahaheel Awtad Center Warehouse',
    areaAr: 'الفحيحيل · محافظة الأحمدي',
    areaEn: 'Fahaheel · Ahmadi Governorate',
    brandCode: 'Karak Cafeteria',
    stockValueKwd: 4320.0,
    skuCount: { raw: 12, prep: 10, pack: 14 },
    chillerTemp: '+3.5°C',
    freezerTemp: '-18.0°C',
    manager: 'راميش ناير',
    readinessScore: 91,
  },
  {
    id: 'wh-farwaniya',
    code: 'FB-FARWANIYA',
    nameAr: 'مستودع فرع الفروانية (شارع حبيب مناور)',
    nameEn: 'Farwaniya Commercial Warehouse',
    areaAr: 'الفروانية · محافظة الفروانية',
    areaEn: 'Farwaniya · Farwaniya Governorate',
    brandCode: 'Farm Brown',
    stockValueKwd: 5120.0,
    skuCount: { raw: 14, prep: 11, pack: 15 },
    chillerTemp: '+3.2°C',
    freezerTemp: '-18.3°C',
    manager: 'سيد عبدالحليم',
    readinessScore: 93,
  },
  {
    id: 'wh-fintas',
    code: 'TH-FINTAS',
    nameAr: 'مستودع فرع الفنطاس (مركز الخدمة السريعة)',
    nameEn: 'Fintas Express Warehouse',
    areaAr: 'الفنطاس · محافظة الأحمدي',
    areaEn: 'Fintas · Ahmadi Governorate',
    brandCode: 'Thinnies',
    stockValueKwd: 4790.0,
    skuCount: { raw: 14, prep: 10, pack: 14 },
    chillerTemp: '+3.4°C',
    freezerTemp: '-18.1°C',
    manager: 'أنور الصالح',
    readinessScore: 92,
  },
]

export function VentureWarehousesHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<'locations' | 'transfers' | 'prep' | 'waste' | 'count' | 'legacy'>('locations')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [searchQ, setSearchQ] = useState('')
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const showToast = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  // Filtered Warehouses
  const filteredWarehouses = VENTURE_WAREHOUSES.filter((w) => {
    if (!searchQ.trim()) return true
    const q = searchQ.toLowerCase()
    return (
      w.nameAr.toLowerCase().includes(q) ||
      w.nameEn.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      w.areaAr.toLowerCase().includes(q)
    )
  })

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
              <Warehouse size={14} />
              {isAr ? 'إدارة المستودعات وسلاسل الإمداد الداخلية' : 'Internal Warehousing & Supply Chain'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'المطبخ المركزي بالقرين + 10 فروع' : 'Al-Qurain Kitchen + 10 Branches'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'مركز العمليات اللوجستية والتحويلات المخزنية' : 'Logistics Hub & Internal Transfers'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'إدارة مخزون المواد الخام، التحضيرات اليومية، والتحويلات بين المطبخ المركزي وفروع فنتشر فودز'
              : 'Managing Raw Materials (RW01), Prep Batches (PP03), and Inter-Branch Dispatches'}
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
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/10"
          >
            <Plus size={15} />
            {isAr ? 'إنشاء أمر تحويل مخزني' : 'New Internal Transfer'}
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

      {/* 5 Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'locations', labelAr: '🏭 المطبخ المركزي وفروع الشركة (11 موقعاً)', labelEn: 'Central Kitchen & 10 Branches', icon: Building2 },
          { key: 'transfers', labelAr: '🚚 التحويلات المخزنية والتزويد الداخلي', labelEn: 'Internal Transfers & Requisitions', icon: Truck },
          { key: 'prep', labelAr: '🍲 أوامر الإنتاج والتحضير بالمطبخ المركزي (PP03*)', labelEn: 'Commissary Daily Prep Batches', icon: ChefHat },
          { key: 'waste', labelAr: '🗑️ سجل الهدر والتوالف والفرز', labelEn: 'Waste & Spoilage Log', icon: Trash2 },
          { key: 'count', labelAr: '📋 الجرد الفعلي ومطابقة الفروقات', labelEn: 'Stock Count & Variance Recon', icon: ClipboardCheck },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ إدارة المستودعات في قاعدة البيانات (DB)', labelEn: 'Database Warehouses', icon: Warehouse }] : []),
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
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
      {/* TAB 1: LOCATIONS (AL-QURAIN COMMISSARY & 10 BRANCHES)                     */}
      {/* ========================================================================= */}
      {activeTab === 'locations' && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'إجمالي قيمة المخزون' : 'Total Stock Value'}</span>
              <p className="mt-1 text-2xl font-black text-amber-400">124,500.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'عبر 11 موقعاً تشغيلياً' : 'Across 11 locations'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'مستودع المطبخ المركزي بالقرين' : 'Al-Qurain Commissary'}</span>
              <p className="mt-1 text-2xl font-black text-emerald-400">58,450.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '46.9% من إجمالي المخزون' : '46.9% of stock'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'أصناف التحضير والتتبيل (PP03*)' : 'Prep Batches (PP03)'}</span>
              <p className="mt-1 text-2xl font-black text-blue-400">68 {isAr ? 'تتبيلة وصلصة' : 'Recipes'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'جاهزة للتوزيع اليومي' : 'Ready for dispatch'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'جاهزية التبريد والسلامة' : 'Cold-Chain Status'}</span>
              <p className="mt-1 text-2xl font-black text-cyan-400">100% {isAr ? 'سليم' : 'Compliant'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'رصد آلي مستمر لدرجات الحرارة' : '24/7 Telemetry'}</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute top-2.5 start-3 text-slate-500" size={16} />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={isAr ? 'بحث باسم المستودع، الكود، أو المنطقة...' : 'Search warehouse name, code, or area...'}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2 ps-9 pe-4 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWarehouses.map((wh) => (
              <div
                key={wh.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-sm ${
                  wh.isCommissary
                    ? 'border-amber-500/50 bg-gradient-to-b from-[#1c1917]/70 to-[#0d131f] ring-1 ring-amber-500/20'
                    : 'border-slate-800 bg-[#0d131f] hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="rounded bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-400" dir="ltr">
                      {wh.code}
                    </span>
                    {wh.isCommissary ? (
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                        {isAr ? 'المطبخ المركزي الرئيسي' : 'Master Commissary'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
                        {isAr ? 'مستودع فرع' : 'Branch Store'}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-bold text-white">
                    {isAr ? wh.nameAr : wh.nameEn}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isAr ? wh.areaAr : wh.areaEn}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">{isAr ? 'قيمة المخزون' : 'Stock Value'}</span>
                      <strong className="text-sm font-black text-amber-400 font-mono">
                        {wh.stockValueKwd.toFixed(3)} د.ك
                      </strong>
                    </div>
                    <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">{isAr ? 'جاهزية الموقع' : 'Readiness'}</span>
                      <strong className="text-sm font-black text-emerald-400 font-mono">
                        {wh.readinessScore}%
                      </strong>
                    </div>
                  </div>

                  {/* SKU Counts */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2.5">
                    <span>
                      {isAr ? 'مواد خام (RW01):' : 'Raw:'} <strong className="text-white">{wh.skuCount.raw}</strong>
                    </span>
                    <span>
                      {isAr ? 'تحضيرات (PP03):' : 'Prep:'} <strong className="text-blue-400">{wh.skuCount.prep}</strong>
                    </span>
                    <span>
                      {isAr ? 'تغليف (PI02):' : 'Pack:'} <strong className="text-purple-400">{wh.skuCount.pack}</strong>
                    </span>
                  </div>

                  {/* Temperature */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] rounded-lg bg-slate-950/60 p-2 border border-slate-800/40">
                    <span className="flex items-center gap-1 text-cyan-400">
                      <ThermometerSnowflake size={12} />
                      {isAr ? 'المبرد:' : 'Chiller:'} <strong className="font-mono">{wh.chillerTemp}</strong>
                    </span>
                    <span className="text-blue-400">
                      {isAr ? 'الفريزر:' : 'Freezer:'} <strong className="font-mono">{wh.freezerTemp}</strong>
                    </span>
                    <span className="text-slate-500">
                      {wh.manager}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setShowTransferModal(true)
                    }}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    {isAr ? 'طلب تزويد لهذا الفرع ←' : 'Requisition Dispatch ←'}
                  </button>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {isAr ? 'متصل ونشط' : 'Online'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERNAL TRANSFERS & REQUISITIONS                                  */}
      {/* ========================================================================= */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'جدول تتبع التحويلات المخزنية بين المطبخ المركزي بالقرين والفروع' : 'Al-Qurain Central Kitchen to Branch Dispatches'}
            </h3>
            <span className="text-xs text-slate-400">
              {isAr ? 'تحديث فوري لحركة الشاحنات والتسليم' : 'Live Fleet & Dispatch Tracking'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'رقم الإذن' : 'Transfer No'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'من مستودع' : 'From Warehouse'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'إلى الفرع' : 'To Branch'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الأصناف والكميات' : 'Items & Quantities'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'القيمة (د.ك)' : 'Value (KWD)'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'السائق والشاحنة' : 'Driver / Truck'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'حالة التوصيل' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { id: 'TR-202611-081', from: 'المطبخ المركزي (القرين)', to: 'فرع السالمية (Frank\'s)', items: '40 كجم برجر أنجوس + 12 لتر ترفل صوص', val: '420.000', driver: 'سوريش كاليان · شاحنة مبردة #14', status: 'تم الاستلام والمطابقة', time: '11:45 ص' },
                    { id: 'TR-202611-082', from: 'المطبخ المركزي (القرين)', to: 'فرع حولي (Thinnies)', items: '35 كجم فيليه دجاج + 800 خبز بطاطس', val: '315.500', driver: 'محمد سليم · شاحنة مبردة #08', status: 'في الطريق للتسليم', time: '12:10 م' },
                    { id: 'TR-202611-083', from: 'المطبخ المركزي (القرين)', to: 'فرع الشويخ (Frank\'s)', items: '60 كجم ستيك شيت + 18 لتر صوص خاص', val: '680.000', driver: 'طارق عبدالحليم · شاحنة مبردة #02', status: 'قيد التجهيز بالقرين', time: '12:30 م' },
                    { id: 'TR-202611-084', from: 'المطبخ المركزي (القرين)', to: 'فرع المهبولة (Shawarma)', items: '50 كجم سيخ شاورما متبل جاهز', val: '385.000', driver: 'راجو شارما · شاحنة مبردة #11', status: 'طلب معتمد من الفرع', time: '12:45 م' },
                  ].map((tr, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-amber-400">{tr.id}</td>
                      <td className="px-4 py-3 text-slate-300">{tr.from}</td>
                      <td className="px-4 py-3 font-semibold text-white">{tr.to}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{tr.items}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right">{tr.val}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 text-center">{tr.driver}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          tr.status.includes('الاستلام')
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : tr.status.includes('الطريق')
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {tr.status}
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
      {/* TAB 3: CENTRAL KITCHEN PREP BATCHES (PP03*)                               */}
      {/* ========================================================================= */}
      {activeTab === 'prep' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'خطة الإنتاج والتحضير اليومي بالمطبخ المركزي (صبحان / القرين)' : 'Daily Commissary Recipe Batches (PP03*)'}
            </h3>
            <span className="text-xs text-slate-400">
              {isAr ? 'معايير وزن دقيقة وتتبع لتواريخ الصلاحية FEFO' : 'Standard Recipe Yields & FEFO Expiry'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'كود الدفعة' : 'Batch Code'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الصنف المحضر (PP03*)' : 'Prepared Recipe'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'البراند المخصص' : 'Target Brand'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'كمية الإنتاج' : 'Batch Yield'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'تكلفة الدفعة (د.ك)' : 'Cost (KWD)'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الصلاحية (FEFO)' : 'FEFO Expiry'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'حالة الاعتماد' : 'QC Sign-Off'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { code: 'PP03-ANGUS-102', name: 'أقراص لحم أنجوس متبلة 150 جم', brand: 'Frank\'s Steak', yield: '180 كجم (1,200 قرص)', cost: '486.000', expiry: '06 نوفمبر 2026 (72h)', qc: 'معتمد ومختوم QC' },
                    { code: 'PP03-CHIK-088', name: 'صدور دجاج كرسبي منقوعة باللبن والأعشاب', brand: 'Thinnies', yield: '120 كجم (600 صدر)', cost: '216.000', expiry: '06 نوفمبر 2026 (72h)', qc: 'معتمد ومختوم QC' },
                    { code: 'PP03-SAUCE-TRUF', name: 'صلصة الكمأة والمايونيز الإيطالي (Truffle)', brand: 'Frank\'s Steak', yield: '45 لتر', cost: '135.000', expiry: '10 نوفمبر 2026 (7d)', qc: 'معتمد ومختوم QC' },
                    { code: 'PP03-SHAW-CHIK', name: 'شاورما دجاج متبلة خلطة لبنانية خاصة', brand: 'Shawarma Shack', yield: '150 كجم (3 أسياخ)', cost: '315.000', expiry: '05 نوفمبر 2026 (48h)', qc: 'معتمد ومختوم QC' },
                    { code: 'PP03-DOUGH-CHP', name: 'عجينة شباتي مجهزة ومقطعة بالزبدة', brand: 'Karak Cafeteria', yield: '900 قرص', cost: '72.000', expiry: '05 نوفمبر 2026 (48h)', qc: 'معتمد ومختوم QC' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-emerald-400">{row.code}</td>
                      <td className="px-4 py-3 font-semibold text-white">{row.name}</td>
                      <td className="px-4 py-3 text-xs text-amber-300">{row.brand}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">{row.yield}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-300">{row.cost}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-300">{row.expiry}</td>
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
      {/* TAB 4: WASTE, SPOILAGE & DAMAGE LOG                                       */}
      {/* ========================================================================= */}
      {activeTab === 'waste' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'سجل الهدر والتوالف اليومي (Waste & Spoilage Incident Log)' : 'Daily Waste & Spoilage Incident Log'}
            </h3>
            <span className="text-xs text-rose-400 font-semibold">
              {isAr ? 'نسبة الهدر الكلية: 0.8% (تحت المستهدف 1.5%)' : 'Overall Waste Rate: 0.8% (Target < 1.5%)'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الفرع / الموقع' : 'Location'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المادة التالفة' : 'Spoiled Item'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الكمية' : 'Quantity'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'القيمة (د.ك)' : 'Cost Loss (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'سبب التلف' : 'Root Cause'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'مسؤول التدقيق' : 'Auditor'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { time: '03 نوفمبر 11:20 ص', loc: 'فرع السالمية', item: 'خس آيسبرغ طازج (RW01-LET-01)', qty: '4.5 كجم', cost: '3.150', reason: 'تلف ورقي أثناء الفرز الصباحي', auditor: 'خوسيه سانتوس (QA)' },
                    { time: '02 نوفمبر 10:15 م', loc: 'المطبخ المركزي (القرين)', item: 'بقايا عجين شباتي مقصوصة', qty: '8 كجم', cost: '4.200', reason: 'هدر تشغيلي في ماكينة التقطيع', auditor: 'طارق الشريف' },
                    { time: '02 نوفمبر 03:40 م', loc: 'فرع حولي', item: 'علب برجر ورقية مطبوعة (PI02-BX)', qty: '15 علبة', cost: '1.800', reason: 'تلف رطوبة أثناء النقل', auditor: 'محمد إبراهيم' },
                    { time: '01 نوفمبر 01:10 م', loc: 'فرع العارضية', item: 'طماطم طازجة محلية', qty: '6 كجم', cost: '2.400', reason: 'نضوج زائد عن معيار الشطائر', auditor: 'سوريش كاليان' },
                  ].map((w, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{w.time}</td>
                      <td className="px-4 py-3 font-semibold text-white">{w.loc}</td>
                      <td className="px-4 py-3 text-slate-300">{w.item}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold">{w.qty}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">{w.cost} د.ك</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{w.reason}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-300">{w.auditor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PHYSICAL STOCK COUNT & VARIANCE RECON                             */}
      {/* ========================================================================= */}
      {activeTab === 'count' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'محضر الجرد الفعلي الشهري ومطابقة الفروقات الدفترية' : 'Monthly Physical Stock Count & Variance Reconciliation'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'نسبة التطابق الإجمالية: 99.4% (ضمن الحدود المقبولة)' : 'Overall Match Rate: 99.4%'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'كود الصنف' : 'Item SKU'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'اسم المادة' : 'Item Description'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الموقع' : 'Location'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الرصيد الدفتري' : 'Book Qty'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الجرد الفعلي' : 'Physical Qty'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الفارق' : 'Variance'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'قيمة الفارق (د.ك)' : 'Variance Val (KWD)'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الإجراء' : 'Recon Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { sku: 'RW01-BEEF-01', name: 'لحم أنجوس مفروم طازج', loc: 'المطبخ المركزي (القرين)', book: '480 كجم', phys: '478.5 كجم', diff: '-1.5 كجم', val: '-4.050', action: 'تسوية تبخر طبيعي أثناء التبريد' },
                    { sku: 'PP03-CHIK-088', name: 'صدور دجاج كرسبي متبلة', loc: 'فرع السالمية', book: '45 كجم', phys: '45.0 كجم', diff: '0.0 كجم', val: '0.000', action: 'مطابق 100%' },
                    { sku: 'PI02-BX-FRANK', name: 'علب برجر كرتون فرانكس', loc: 'مستودع الري', book: '3,200 حبة', phys: '3,190 حبة', diff: '-10 حبات', val: '-0.850', action: 'خصم عينات فحص الجودة' },
                    { sku: 'RW01-OIL-CORN', name: 'زيت ذرة نقي للقلي (18 لتر)', loc: 'فرع حولي', book: '24 عبوة', phys: '24 عبوة', diff: '0 عبوة', val: '0.000', action: 'مطابق 100%' },
                    { sku: 'PP03-SAUCE-TRUF', name: 'صلصة ترفل طازجة جاهزة', loc: 'فرع الشويخ', book: '12 لتر', phys: '12.2 لتر', diff: '+0.2 لتر', val: '+0.600', action: 'فائض تحضير إيجابي' },
                  ].map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-amber-400">{r.sku}</td>
                      <td className="px-4 py-3 font-semibold text-white">{r.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{r.loc}</td>
                      <td className="px-4 py-3 text-center font-mono">{r.book}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">{r.phys}</td>
                      <td className={`px-4 py-3 text-center font-mono font-bold ${
                        r.diff.startsWith('-') ? 'text-rose-400' : r.diff.startsWith('+') ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {r.diff}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{r.val} د.ك</td>
                      <td className="px-4 py-3 text-center text-xs">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                          {r.action}
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
      {/* TAB 6: LEGACY DATABASE WAREHOUSES & FORMS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
          {liveChildren}
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إنشاء أمر تحويل مخزني داخلي (Inter-Branch Transfer)' : 'Create Internal Transfer Order'}
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setShowTransferModal(false)
                showToast(isAr ? '✅ تم إنشاء أمر التحويل وإرساله لجدول تحضير المطبخ المركزي بالقرين' : '✅ Transfer order created & sent to commissary')
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'من المستودع المصدر:' : 'Source Warehouse:'}</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                  <option value="CK-QURAIN">المطبخ المركزي الرئيسي (أسواق القرين)</option>
                  <option value="FB-SALMIYA">مستودع فرع السالمية</option>
                  <option value="SS-SHUWAIKH">مستودع فرع الشويخ</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'إلى الفرع المستلم:' : 'Destination Branch:'}</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                  <option value="FB-SALMIYA">فرع السالمية (Frank&apos;s Steak)</option>
                  <option value="TH-HAWALLI">فرع حولي (Thinnies)</option>
                  <option value="OS-ARDIYA">فرع العارضية (Over Sized)</option>
                  <option value="SH-MAHBOULA">فرع المهبولة (Shawarma Shack)</option>
                  <option value="FB-JAHRA">فرع الجهراء (Farm Brown)</option>
                  <option value="NB-SHARQ">فرع شرق (The Noodle Bar)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'المادة أو الوصفة المطلوبة:' : 'Requested SKU / Recipe:'}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: أقراص أنجوس برجر 150 جم (50 كجم)' : 'e.g. Angus Burger Patties (50 KG)'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 font-bold text-black hover:bg-amber-400"
                >
                  {isAr ? 'تأكيد وإصدار إذن التحويل' : 'Confirm & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
