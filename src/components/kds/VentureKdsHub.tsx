'use client'

import React, { useState, useEffect } from 'react'
import {
  Flame,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Trash2,
  Gauge,
  Layers,
  Building2,
  Package,
  ShieldAlert,
  ArrowRightLeft,
  UtensilsCrossed,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'

export interface KdsTicket {
  id: string
  ticketNo: string
  orderRef: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  channelAr: string
  channelEn: string
  channelBadge: string
  station: 'WOK' | 'GRILL' | 'FRYER' | 'SHAWARMA' | 'PACKING'
  stationAr: string
  stationEn: string
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'TGO' | 'TMP' | 'DELIVEROO'
  minutesElapsed: number
  status: 'PENDING' | 'PREPPING' | 'READY' | 'BUMPED'
  items: Array<{
    nameAr: string
    nameEn: string
    qty: number
    notes?: string
    sku: string
    rawIngredients: Array<{ code: string; nameAr: string; nameEn: string; qty: string; costKwd: number }>
    prepIngredients: Array<{ code: string; nameAr: string; nameEn: string; qty: string; costKwd: number }>
    packagingItems: Array<{ code: string; nameAr: string; nameEn: string; qty: string; costKwd: number }>
  }>
}

export const INITIAL_KDS_TICKETS: KdsTicket[] = [
  {
    id: 'tk-101',
    ticketNo: 'TK-4819',
    orderRef: 'ORD-TAL-9910',
    brandId: 'franks',
    brandNameAr: "فرانكس ستيك",
    brandNameEn: "Frank's Steak",
    channelAr: 'طلبات جو TGO 17%',
    channelEn: 'Talabat GO (17%)',
    channelBadge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    station: 'GRILL',
    stationAr: 'محطة الجريل والستيك',
    stationEn: 'Grill & Steak Station',
    orderType: 'TGO',
    minutesElapsed: 22, // > 20 min danger penalty!
    status: 'PREPPING',
    items: [
      {
        nameAr: 'ستيك ريب آي 300 غرام (Medium Well)',
        nameEn: 'Black Angus Ribeye 300g (Medium Well)',
        qty: 1,
        sku: 'MS01',
        notes: 'بدون بصل مكرمل - صوص فلفل أسود جانبي',
        rawIngredients: [
          { code: 'RW01-BF01', nameAr: 'لحم بلاك أنجوس خام', nameEn: 'Raw Angus Ribeye', qty: '320g', costKwd: 2.150 },
          { code: 'RW01-BT01', nameAr: 'زبدة نيوزيلندية وأعشاب', nameEn: 'Herb Butter', qty: '25g', costKwd: 0.180 },
        ],
        prepIngredients: [
          { code: 'PP03-PPR', nameAr: 'صوص الفلفل الأسود (تحضير مركزي)', nameEn: 'Pepper Sauce CK Prep', qty: '60ml', costKwd: 0.220 },
        ],
        packagingItems: [
          { code: 'PI02-STK', nameAr: 'علبة ستيك حرارية فاخرة', nameEn: 'Thermal Steak Box', qty: '1 unit', costKwd: 0.250 },
          { code: 'PI02-CUT', nameAr: 'طقم شوكة وسكين خشبية فاخرة', nameEn: 'Wood Cutlery Set', qty: '1 set', costKwd: 0.100 },
        ],
      },
    ],
  },
  {
    id: 'tk-102',
    ticketNo: 'TK-4820',
    orderRef: 'ORD-POS-1042',
    brandId: 'chinagarden',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    channelAr: 'صالة Dine-In',
    channelEn: 'Dine-In Table #4',
    channelBadge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    station: 'FRYER',
    stationAr: 'محطة المقليات والبرجر',
    stationEn: 'Fryer & Burger Station',
    orderType: 'DINE_IN',
    minutesElapsed: 16, // > 15 min alert
    status: 'PREPPING',
    items: [
      {
        nameAr: 'دجاج كانتون تشاينا جاردن المميز',
        nameEn: 'China Garden Special Canton Chicken',
        qty: 2,
        sku: 'TH01',
        notes: 'إكسترا مخلل وجبن أمريكي',
        rawIngredients: [
          { code: 'RW01-BF04', nameAr: 'لحم مفروم طازج', nameEn: 'Fresh Minced Beef', qty: '180g', costKwd: 0.850 },
          { code: 'RW01-BN01', nameAr: 'خبز بريوش طازج', nameEn: 'Brioche Bun', qty: '2 pcs', costKwd: 0.220 },
          { code: 'RW01-CH01', nameAr: 'جبن شيدر أمريكي', nameEn: 'Cheddar Cheese', qty: '4 slices', costKwd: 0.280 },
        ],
        prepIngredients: [
          { code: 'PP03-CGS', nameAr: 'صوص كانتون الخاص (القرين)', nameEn: 'Canton Secret Sauce', qty: '60ml', costKwd: 0.144 },
        ],
        packagingItems: [
          { code: 'PI02-WRP', nameAr: 'ورق تغليف برجر مشمع', nameEn: 'Waxed Burger Wrap', qty: '2 pcs', costKwd: 0.060 },
        ],
      },
      {
        nameAr: 'بطاطا كرينكل مقرمشة',
        nameEn: 'Crinkle Cut Crispy Fries',
        qty: 2,
        sku: 'TH03',
        rawIngredients: [
          { code: 'RW01-POT', nameAr: 'بطاطا بلجيكية 9/9 مفرزة', nameEn: 'Frozen Fries', qty: '350g', costKwd: 0.320 },
          { code: 'RW01-OIL', nameAr: 'زيت قلي نباتي نقي', nameEn: 'Vegetable Frying Oil', qty: '60ml', costKwd: 0.080 },
        ],
        prepIngredients: [],
        packagingItems: [
          { code: 'PI02-FRY', nameAr: 'باوتش بطاطا كرافت', nameEn: 'Kraft Fry Pouch', qty: '2 units', costKwd: 0.080 },
        ],
      },
    ],
  },
  {
    id: 'tk-103',
    ticketNo: 'TK-4821',
    orderRef: 'ORD-DLV-8831',
    brandId: 'shawarma',
    brandNameAr: 'شاورما طحينة',
    brandNameEn: 'Tahina',
    channelAr: 'دليفرو Deliveroo',
    channelEn: 'Deliveroo',
    channelBadge: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    station: 'SHAWARMA',
    stationAr: 'محطة الشاورما والخبز',
    stationEn: 'Shawarma & Bakery',
    orderType: 'DELIVEROO',
    minutesElapsed: 8, // < 10 min normal green
    status: 'PREPPING',
    items: [
      {
        nameAr: 'شاورما دجاج صاج بالثوم والمخلل',
        nameEn: 'Chicken Saj Shawarma',
        qty: 3,
        sku: 'SH02',
        rawIngredients: [
          { code: 'RW01-CK02', nameAr: 'صدور دجاج طازجة متبلة', nameEn: 'Marinated Chicken', qty: '270g', costKwd: 0.650 },
          { code: 'RW01-SAJ', nameAr: 'خبز صاج صاجي مخبوز', nameEn: 'Fresh Saj Bread', qty: '3 pcs', costKwd: 0.150 },
        ],
        prepIngredients: [
          { code: 'PP03-GAR', nameAr: 'كريمة الثوم اللبنانية المميزة', nameEn: 'Garlic Cream CK Prep', qty: '60g', costKwd: 0.120 },
        ],
        packagingItems: [
          { code: 'PI02-BOX', nameAr: 'بوكس كرافت مقسم 3 قطع', nameEn: 'Kraft Trio Box', qty: '1 unit', costKwd: 0.150 },
        ],
      },
    ],
  },
  {
    id: 'tk-104',
    ticketNo: 'TK-4822',
    orderRef: 'ORD-TMP-5501',
    brandId: 'noodle',
    brandNameAr: 'ذا نودل بار',
    brandNameEn: 'The Noodle Bar',
    channelAr: 'طلبات ماركت بليس TMP',
    channelEn: 'Talabat TMP (10%)',
    channelBadge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    station: 'WOK',
    stationAr: 'محطة الووك والنودلز',
    stationEn: 'Wok & Noodle Station',
    orderType: 'TMP',
    minutesElapsed: 5, // < 10 min normal green
    status: 'PREPPING',
    items: [
      {
        nameAr: 'نودلز ووك الروبيان والخضار الحار',
        nameEn: 'Spicy Wok Shrimp Noodles',
        qty: 1,
        sku: 'NB01',
        rawIngredients: [
          { code: 'RW01-SHR', nameAr: 'روبيان جامبو طازج منظف', nameEn: 'Jumbo Shrimp', qty: '140g', costKwd: 0.850 },
          { code: 'RW01-NOD', nameAr: 'نودلز قمح طازجة مسلوقة', nameEn: 'Fresh Wheat Noodles', qty: '180g', costKwd: 0.220 },
        ],
        prepIngredients: [
          { code: 'PP03-WOK', nameAr: 'صوص الووك والسيشوان (القرين)', nameEn: 'Wok Szechuan Sauce', qty: '50ml', costKwd: 0.150 },
        ],
        packagingItems: [
          { code: 'PI02-NWK', nameAr: 'وعاء نودلز كرتوني دائري مقاوم للتسريب', nameEn: 'Leakproof Noodle Pail', qty: '1 unit', costKwd: 0.220 },
        ],
      },
    ],
  },
]

export function VentureKdsHub({
  locale = 'ar',
}: {
  locale?: 'ar' | 'en'
}) {
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const [activeTab, setActiveTab] = useState<'liveTickets' | 'backflush' | 'wasteLogger' | 'velocity'>('liveTickets')
  const [selectedStation, setSelectedStation] = useState<string>('ALL')
  const [tickets, setTickets] = useState<KdsTicket[]>(INITIAL_KDS_TICKETS)
  const [bumpedTickets, setBumpedTickets] = useState<KdsTicket[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  // Waste Logger Form State
  const [wasteDishName, setWasteDishName] = useState("ستيك ريب آي 300 غرام")
  const [wasteStation, setWasteStation] = useState("GRILL")
  const [wasteCookName, setWasteCookName] = useState("كبير الطهاة: الشيف رافي")
  const [wasteReason, setWasteReason] = useState("احتراق أثناء الطهي على الجريل (Overcooked)")
  const [wasteCost, setWasteCost] = useState("2.750")
  const [wasteLogs, setWasteLogs] = useState<Array<{ id: string; time: string; item: string; station: string; cook: string; reason: string; cost: number; gl: string }>>([
    { id: 'WST-401', time: '11:45 ص', item: 'ستيك ريب آي 300 غرام (MS01)', station: 'محطة الجريل', cook: 'الشيف رافي', reason: 'احتراق على الجريل درجة Well Done مفرطة', cost: 2.750, gl: '501020 هدر مطبخ' },
    { id: 'WST-402', time: '12:15 م', item: '2x دجاج كانتون تشاينا جاردن (CG01)', station: 'محطة المقليات', cook: 'شيف بيلال', reason: 'خطأ كاشير - تكرار إضافة المكونات', cost: 1.560, gl: '501020 هدر مطبخ' },
    { id: 'WST-403', time: '01:10 م', item: 'طبق نودلز روبيان (NB01)', station: 'محطة الووك', cook: 'شيف أرون', reason: 'طلب العميل بدون فلفل وتم تحضيره حاراً', cost: 1.220, gl: '501020 هدر مطبخ' },
  ])

  // Timer Tick effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTickets((prev) =>
        prev.map((t) => ({ ...t, minutesElapsed: t.minutesElapsed + 0.1 }))
      )
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const handleBumpOrder = (ticketId: string) => {
    const target = tickets.find((t) => t.id === ticketId)
    if (!target) return
    setTickets((prev) => prev.filter((t) => t.id !== ticketId))
    setBumpedTickets((prev) => [{ ...target, status: 'BUMPED' }, ...prev])
    setNotice(
      isAr
        ? `تم تجهيز التذكرة ${target.ticketNo} بنجاح، وخصم مكونات الوصفة الخام (RW01) والتجهيزات (PP03) والتغليف (PI02) وترحيل قيد COGS للدفتر العام!`
        : `Ticket ${target.ticketNo} bumped! BOM ingredients deducted from stock & COGS posted to general ledger!`
    )
    setTimeout(() => setNotice(null), 5000)
  }

  const handleLogWaste = (e: React.FormEvent) => {
    e.preventDefault()
    const newLog = {
      id: `WST-${Math.floor(100 + Math.random() * 900)}`,
      time: 'الآن',
      item: wasteDishName,
      station: wasteStation === 'GRILL' ? 'محطة الجريل' : wasteStation === 'FRYER' ? 'محطة المقليات' : 'محطة الووك',
      cook: wasteCookName,
      reason: wasteReason,
      cost: parseFloat(wasteCost) || 0,
      gl: '501020 هدر مطبخ',
    }
    setWasteLogs((prev) => [newLog, ...prev])
    setNotice(
      isAr
        ? `تم قيد الهدر بمبلغ ${wasteCost} د.ك وترحيله فورياً لحساب (مصروف هدر وتوالف المطبخ 501020) في المحاسبة!`
        : `Kitchen waste ${wasteCost} KWD recorded and posted to Spoilage Expense GL 501020!`
    )
    setTimeout(() => setNotice(null), 5000)
  }

  // Filter Tickets
  const filteredTickets = tickets.filter((t) => {
    if (selectedStation !== 'ALL' && t.station !== selectedStation) return false
    return true
  })

  // Urgent Penalty Risk Counter (> 20 min)
  const penaltyRiskCount = tickets.filter((t) => t.minutesElapsed >= 20).length
  const approachingSlaCount = tickets.filter((t) => t.minutesElapsed >= 15 && t.minutesElapsed < 20).length

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#07090f] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
              <Flame size={14} />
              {isAr ? 'شاشة المطبخ الذكية وحماية SLA المنصات' : 'Smart Kitchen Display System & Penalty Shield'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'فرع مجمع الأفنيوز · مطبخ العمليات الرئيسي' : 'The Avenues Mall · Main Production Kitchen'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'لوحة تحكم محطات المطبخ والخصم اللحظي للمخزون' : 'Kitchen Station Command & Real-Time Backflushing'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'مراقبة زمن إعداد الوجبات بالثواني، تفادي غرامات تأخير المنصات 15m/20m، وخصم المكونات آلياً وترحيل تكلفة المبيعات COGS'
              : 'Live ticket timers, aggregator penalty shield, automated BOM inventory deduction, and kitchen waste logging'}
          </p>
        </div>

        {/* Global Controls & Language */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
          >
            {isAr ? 'English (LTR)' : 'عربي (RTL)'}
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/80 p-3.5 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* SLA Penalty Shield Alert Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'التذاكر النشطة بالمطبخ' : 'Active Kitchen Tickets'}</div>
          <div className="text-xl font-black text-white mt-1">{tickets.length} <span className="text-xs text-slate-400">{isAr ? 'تذكرة' : 'tickets'}</span></div>
          <div className="text-[10px] text-slate-400 mt-0.5">{isAr ? 'عبر 5 محطات تشغيل' : 'Across 5 active stations'}</div>
        </div>

        <div className={`rounded-xl border p-3.5 ${penaltyRiskCount > 0 ? 'border-rose-500/50 bg-rose-950/40 animate-pulse' : 'border-slate-800 bg-slate-900/80'}`}>
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'خطر غرامة تأخير المنصات (> 20 دقيقة)' : 'SLA Penalty Danger (>20m)'}</div>
          <div className={`text-xl font-black mt-1 ${penaltyRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {penaltyRiskCount} <span className="text-xs text-slate-400">{isAr ? 'تذاكر معرضة للغرامة' : 'at penalty risk'}</span>
          </div>
          <div className="text-[10px] text-rose-300 mt-0.5">{isAr ? 'غرامة طلبات/دليفرو 1.500 د.ك' : 'Risk of 1.500 KWD Talabat fee'}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'اقتراب من حد الـ SLA (15 - 20 دقيقة)' : 'Approaching SLA (15-20m)'}</div>
          <div className="text-xl font-black text-amber-400 mt-1">{approachingSlaCount} <span className="text-xs text-slate-400">{isAr ? 'تذكرة تحذير' : 'warning tickets'}</span></div>
          <div className="text-[10px] text-amber-300/80 mt-0.5">{isAr ? 'أولوية تجهيز فورية' : 'High prep priority'}</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <div className="text-[11px] font-medium text-slate-400">{isAr ? 'متوسط سرعة إعداد التذكرة' : 'Avg Ticket Prep Velocity'}</div>
          <div className="text-xl font-black text-emerald-400 mt-1">7.4 <span className="text-xs text-slate-400">{isAr ? 'دقائق' : 'minutes'}</span></div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5">{isAr ? 'ضمن المعيار الذهبي للشركة' : 'Within corporate target (<9m)'}</div>
        </div>
      </div>

      {/* 4 Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'liveTickets', labelAr: '🔥 لوحة التذاكر الحية وحماية الـ SLA', labelEn: 'Live Tickets & Aggregator SLA Shield', icon: Flame },
          { key: 'backflush', labelAr: '📉 الخصم اللحظي للمكونات وحساب COGS الآلي', labelEn: 'Inventory Backflushing & COGS', icon: TrendingDown },
          { key: 'wasteLogger', labelAr: '🗑️ مسجل هدر المطبخ وإعادة الطبخ المالي', labelEn: 'Kitchen Waste & Re-fire Logger', icon: Trash2 },
          { key: 'velocity', labelAr: '⏱️ كفاءة وسرعة محطات المطبخ وتكلفة الساعة', labelEn: 'Station Velocity & Efficiency', icon: Gauge },
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

      {/* TAB 1: Live Kitchen Tickets & Penalty Shield */}
      {activeTab === 'liveTickets' && (
        <div className="space-y-4">
          {/* Station Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', labelAr: 'جميع المحطات (5)', labelEn: 'All Stations (5)' },
                { id: 'GRILL', labelAr: 'الجريل والستيك (فرانكس)', labelEn: 'Grill & Steak' },
                { id: 'WOK', labelAr: 'الووك والصيني (تشاينا جاردن)', labelEn: 'Wok & Asian (China Garden)' },
                { id: 'SHAWARMA', labelAr: 'شاورما طحينة والمقبلات', labelEn: 'Tahina Shawarma & Appetizers' },
                { id: 'WOK', labelAr: 'الووك والنودلز', labelEn: 'Wok & Noodles' },
                { id: 'PACKING', labelAr: 'التغليف والتسليم Dispatch', labelEn: 'Packing & Dispatch' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStation(st.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    selectedStation === st.id
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {isAr ? st.labelAr : st.labelEn}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-400">
              {isAr ? `تحديث فوري بالثواني · ${filteredTickets.length} تذاكر قيد الطهي` : `Real-time sync · ${filteredTickets.length} tickets prepping`}
            </div>
          </div>

          {/* Tickets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTickets.map((ticket) => {
              const minutes = Math.floor(ticket.minutesElapsed)
              const seconds = Math.floor((ticket.minutesElapsed - minutes) * 60)
              const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

              const isDanger = ticket.minutesElapsed >= 20
              const isWarning = ticket.minutesElapsed >= 15 && ticket.minutesElapsed < 20
              const isAmber = ticket.minutesElapsed >= 10 && ticket.minutesElapsed < 15

              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border bg-slate-900/90 p-4 shadow-xl flex flex-col justify-between transition-all ${
                    isDanger
                      ? 'border-rose-500/80 shadow-rose-950/50 animate-pulse'
                      : isWarning
                      ? 'border-orange-500/80 shadow-orange-950/40'
                      : isAmber
                      ? 'border-amber-500/50'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Ticket Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-white">{ticket.ticketNo}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({ticket.orderRef})</span>
                        </div>
                        <div className="text-[11px] font-bold text-amber-400 mt-0.5">
                          {isAr ? ticket.brandNameAr : ticket.brandNameEn}
                        </div>
                      </div>

                      {/* Live SLA Timer Badge */}
                      <div
                        className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-mono font-black ${
                          isDanger
                            ? 'bg-rose-500 text-white animate-bounce'
                            : isWarning
                            ? 'bg-orange-500 text-black'
                            : isAmber
                            ? 'bg-amber-500 text-black'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        }`}
                      >
                        <Clock size={12} />
                        {timeString}
                      </div>
                    </div>

                    {/* Channel & Station Tag */}
                    <div className="flex items-center justify-between gap-1 mt-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ticket.channelBadge}`}>
                        {isAr ? ticket.channelAr : ticket.channelEn}
                      </span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {isAr ? ticket.stationAr : ticket.stationEn}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-2.5">
                      {ticket.items.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-start justify-between text-xs font-bold text-white">
                            <span>
                              <span className="font-mono text-amber-400 mr-1">{item.qty}x</span>
                              {isAr ? item.nameAr : item.nameEn}
                            </span>
                            <span className="font-mono text-[10px] text-indigo-400">{item.sku}</span>
                          </div>
                          {item.notes && (
                            <div className="rounded bg-slate-950/80 px-2 py-1 text-[10px] font-medium text-rose-300 border border-rose-500/20">
                              ⚠️ {item.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions: Mark Ready / Bump */}
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => handleBumpOrder(ticket.id)}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10"
                    >
                      <CheckCircle2 size={15} />
                      {isAr ? 'جاهز للتسليم (Bump / Ready)' : 'Bump / Mark Ready'}
                    </button>
                    <div className="text-center text-[9px] text-slate-500 mt-1">
                      {isAr ? 'الضغط يخصم المكونات من المخزون ويرحل تكلفة COGS' : 'Triggers inventory backflushing & COGS GL post'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Real-Time Inventory Backflushing & COGS Trigger */}
      {activeTab === 'backflush' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <TrendingDown size={18} className="text-emerald-400" />
                {isAr ? 'الخصم اللحظي للمخزون وترحيل تكلفة المبيعات (Inventory Backflushing & COGS)' : 'Inventory Backflushing & Automated COGS Trigger'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'تفكيك فوري لشجرة الوصفة (BOM) عند خروج كل طلب من المطبخ، وخصم المواد الخام والتحضيرات ومواد التغليف من رصيد الفرع'
                  : 'Real-time BOM recipe explosion upon kitchen order fulfillment, reducing branch stock & posting direct COGS'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {INITIAL_KDS_TICKETS.map((ticket) => {
              const totalTicketCogs = ticket.items.reduce((acc, it) => {
                const rawSum = it.rawIngredients.reduce((s, r) => s + r.costKwd, 0)
                const prepSum = it.prepIngredients.reduce((s, p) => s + p.costKwd, 0)
                const packSum = it.packagingItems.reduce((s, k) => s + k.costKwd, 0)
                return acc + (rawSum + prepSum + packSum) * it.qty
              }, 0)

              return (
                <div key={ticket.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-black text-white">{ticket.ticketNo}</span>
                      <span className="text-xs font-bold text-amber-400">({isAr ? ticket.brandNameAr : ticket.brandNameEn})</span>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">{ticket.orderRef}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400">{isAr ? 'إجمالي تكلفة المبيعات المحسوبة (COGS):' : 'Calculated COGS:'}</span>
                      <span className="font-mono text-sm font-black text-emerald-400 ml-2">
                        {totalTicketCogs.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                    </div>
                  </div>

                  {/* Exploded BOM Breakdown */}
                  {ticket.items.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="text-xs font-bold text-white flex items-center justify-between">
                        <span>{item.qty}x {isAr ? item.nameAr : item.nameEn} ({item.sku})</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                        {/* Raw materials */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                          <div className="text-[10px] font-bold text-blue-400">{isAr ? 'مواد خام RW01 (لحوم/دواجن/خضار)' : 'Raw Materials RW01'}</div>
                          {item.rawIngredients.map((r, ri) => (
                            <div key={ri} className="flex justify-between text-slate-300">
                              <span>{isAr ? r.nameAr : r.nameEn} ({r.qty})</span>
                              <span className="font-mono text-white">{r.costKwd.toFixed(3)} د.ك</span>
                            </div>
                          ))}
                        </div>

                        {/* Central Preps */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                          <div className="text-[10px] font-bold text-amber-400">{isAr ? 'تحضيرات المطبخ المركزي PP03 (صوصات وتتبيل)' : 'Central Kitchen Preps PP03'}</div>
                          {item.prepIngredients.length === 0 ? (
                            <div className="text-slate-500">{isAr ? 'لا توجد تحضيرات مسبقة' : 'No preps required'}</div>
                          ) : (
                            item.prepIngredients.map((p, pi) => (
                              <div key={pi} className="flex justify-between text-slate-300">
                                <span>{isAr ? p.nameAr : p.nameEn} ({p.qty})</span>
                                <span className="font-mono text-white">{p.costKwd.toFixed(3)} د.ك</span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Packaging Disposables */}
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 space-y-1">
                          <div className="text-[10px] font-bold text-purple-400">{isAr ? 'مواد التغليف والسفري PI02' : 'Packaging & Disposables PI02'}</div>
                          {item.packagingItems.map((k, ki) => (
                            <div key={ki} className="flex justify-between text-slate-300">
                              <span>{isAr ? k.nameAr : k.nameEn}</span>
                              <span className="font-mono text-white">{k.costKwd.toFixed(3)} د.ك</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
            </div>
          </div>
      )}

      {/* TAB 3: Kitchen Waste & Re-fire Logger */}
      {activeTab === 'wasteLogger' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Waste Input Form (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Trash2 size={18} className="text-rose-400" />
              {isAr ? 'تسجيل هدر المطبخ وإعادة الطهي (Waste & Re-fire)' : 'Kitchen Waste & Re-fire Financial Logger'}
            </h3>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'توثيق أي وجبة محترقة أو خطأ إعداد بالوزن والتكلفة لترحيلها لحساب (مصروف هدر وتوالف المطبخ 501020)'
                : 'Log burned, dropped or misprepared dishes with direct cost to record in Spoilage GL account 501020'}
            </p>

            <form onSubmit={handleLogWaste} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'اسم الطبق أو الصنف التالف:' : 'Dish Name / SKU:'}</label>
                <input
                  type="text"
                  value={wasteDishName}
                  onChange={(e) => setWasteDishName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300">{isAr ? 'محطة المطبخ:' : 'Station:'}</label>
                  <select
                    value={wasteStation}
                    onChange={(e) => setWasteStation(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="GRILL">{isAr ? 'الجريل والستيك' : 'Grill Station'}</option>
                    <option value="FRYER">{isAr ? 'المقليات والبرجر' : 'Fryer Station'}</option>
                    <option value="WOK">{isAr ? 'الووك والنودلز' : 'Wok Station'}</option>
                    <option value="SHAWARMA">{isAr ? 'الشاورما والخبز' : 'Shawarma'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300">{isAr ? 'التكلفة المباشرة (د.ك):' : 'Direct Cost (KWD):'}</label>
                  <input
                    type="text"
                    value={wasteCost}
                    onChange={(e) => setWasteCost(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs font-bold text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'اسم الطاهي / المسؤول:' : 'Cook / Responsible Chef:'}</label>
                <input
                  type="text"
                  value={wasteCookName}
                  onChange={(e) => setWasteCookName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">{isAr ? 'سبب التلف / إعادة الطهي:' : 'Failure Reason / Cause:'}</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="احتراق أثناء الطهي على الجريل (Overcooked)">{isAr ? 'احتراق أثناء الطهي (Overcooked)' : 'Burned during cooking'}</option>
                  <option value="خطأ كاشير في إدخال المكونات">{isAr ? 'خطأ كاشير في إدخال المكونات' : 'Cashier input error'}</option>
                  <option value="تعديل أو إلغاء من العميل">{isAr ? 'تعديل أو إلغاء من العميل بعد التحضير' : 'Customer cancel post-prep'}</option>
                  <option value="انتهاء صلاحية تحضير مسبق FEFO">{isAr ? 'انتهاء صلاحية تحضير مسبق FEFO' : 'FEFO prep expiry'}</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-rose-500 py-3 text-xs font-bold text-white hover:bg-rose-400 transition-all shadow-lg shadow-rose-500/10"
              >
                {isAr ? 'ترحيل قيد الهدر لدفتر الأستاذ (GL 501020)' : 'Post Spoilage Expense to General Ledger'}
              </button>
            </form>
          </div>

          {/* Waste Logs Table (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white">
                {isAr ? 'سجل الهدر والتوالف المالي المعتمد لليوم' : 'Today\'s Audited Kitchen Spoilage Log'}
              </h3>
              <div className="font-mono text-xs font-bold text-rose-400">
                {isAr ? 'المجموع اليومي:' : 'Total Waste:'} {wasteLogs.reduce((a, b) => a + b.cost, 0).toFixed(3)} د.ك
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2.5 px-2">{isAr ? 'المرجع' : 'Ref'}</th>
                    <th className="py-2.5 px-2">{isAr ? 'الوقت والصنف' : 'Time & Item'}</th>
                    <th className="py-2.5 px-2">{isAr ? 'السبب' : 'Reason'}</th>
                    <th className="py-2.5 px-2 text-left">{isAr ? 'التكلفة (د.ك)' : 'Cost (KWD)'}</th>
                    <th className="py-2.5 px-2">{isAr ? 'الحساب' : 'GL Account'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {wasteLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-2 font-mono text-slate-400">{log.id}</td>
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-white">{log.item}</div>
                        <div className="text-[10px] text-slate-400">{log.time} · {log.cook}</div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-300 text-[11px]">{log.reason}</td>
                      <td className="py-2.5 px-2 font-mono font-bold text-rose-400 text-left">{log.cost.toFixed(3)}</td>
                      <td className="py-2.5 px-2 font-mono text-[10px] text-indigo-400">{log.gl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Station Velocity & Kitchen Labor Efficiency */}
      {activeTab === 'velocity' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg">
                {isAr ? 'تحليل كفاءة وسرعة محطات المطبخ وتكلفة الساعة' : 'Kitchen Station Velocity & Labor Productivity Analysis'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? 'مؤشرات أداء سرعة تجهيز الطلبات وساعات الذروة وتكلفة عمالة المطبخ المحملة على كل تذكرة (Labor per Order)'
                  : 'Fulfillment speed benchmarks, peak hour throughput, and kitchen labor cost allocated per dish'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { stationAr: 'محطة الجريل والستيك (فرانكس)', stationEn: "Grill & Steak (Frank's)", avgTime: '11.2 دقيقة', target: '12.0 دقيقة', throughput: '48 طبق/ساعة', laborCost: '0.450 د.ك', badge: 'text-amber-400' },
              { stationAr: 'محطة الووك والصيني (تشاينا جاردن)', stationEn: 'Wok & Asian (China Garden)', avgTime: '6.4 دقائق', target: '7.0 دقائق', throughput: '110 طلب/ساعة', laborCost: '0.280 د.ك', badge: 'text-emerald-400' },
              { stationAr: 'محطة الشاورما والخبز', stationEn: 'Shawarma & Bakery', avgTime: '4.8 دقائق', target: '5.5 دقائق', throughput: '140 ساندوتش/ساعة', laborCost: '0.210 د.ك', badge: 'text-emerald-400' },
              { stationAr: 'محطة الووك والنودلز الآسيوي', stationEn: 'Wok & Noodle Station', avgTime: '7.8 دقائق', target: '8.5 دقائق', throughput: '55 طبق/ساعة', laborCost: '0.380 د.ك', badge: 'text-blue-400' },
            ].map((st, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                <div className="font-bold text-white text-xs">{isAr ? st.stationAr : st.stationEn}</div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[11px]">{isAr ? 'متوسط زمن الإعداد:' : 'Avg Prep Time:'}</span>
                  <span className={`font-mono text-sm font-black ${st.badge}`}>{st.avgTime}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{isAr ? 'الطاقة بساعة الذروة:' : 'Peak Throughput:'}</span>
                  <span className="font-mono text-white font-bold">{st.throughput}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{isAr ? 'تكلفة العمالة/الطلب:' : 'Labor Cost/Ticket:'}</span>
                  <span className="font-mono text-indigo-400 font-bold">{st.laborCost}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
