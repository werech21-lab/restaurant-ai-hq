'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Percent,
  ArrowUpRight,
  Filter,
  CreditCard,
  Building2,
  UtensilsCrossed,
  Truck,
  ShieldCheck,
  Flame,
  BookOpen,
  Landmark,
  Cpu,
  Clock,
  Sparkles,
  Smartphone,
  Store,
  ChevronRight,
  Layers,
  Users,
  FileSpreadsheet,
} from 'lucide-react'

// Period Data Models
interface PeriodData {
  netSales: number
  netSalesGrowth: number
  previousSales: number
  orders: number
  ordersGrowth: number
  deliveryOrders: number
  pickupOrders: number
  aov: number
  aovGrowth: number
  dineInAov: number
  deliveryAov: number
  grossProfitMargin: number
  marginGrowth: number
  foodCostPct: number
  chartLabels: string[]
  currentSalesSeries: number[]
  previousSalesSeries: number[]
  currentOrdersSeries: number[]
  peakHoursAr: string
  peakHoursEn: string
}

const PERIOD_METRICS: Record<string, PeriodData> = {
  TODAY: {
    netSales: 5420.850,
    netSalesGrowth: 8.4,
    previousSales: 5000.780,
    orders: 985,
    ordersGrowth: 6.2,
    deliveryOrders: 638,
    pickupOrders: 347,
    aov: 5.503,
    aovGrowth: 2.1,
    dineInAov: 7.150,
    deliveryAov: 4.880,
    grossProfitMargin: 69.5,
    marginGrowth: 1.2,
    foodCostPct: 30.5,
    chartLabels: ['10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm', '12am'],
    currentSalesSeries: [320, 680, 890, 420, 560, 940, 1120, 490],
    previousSalesSeries: [290, 610, 820, 390, 510, 880, 990, 410],
    currentOrdersSeries: [58, 124, 162, 76, 102, 171, 204, 88],
    peakHoursAr: '8:00 م - 10:30 م (204 طلباً/ساعة)',
    peakHoursEn: '8:00 PM - 10:30 PM (204 orders/hr)',
  },
  YESTERDAY: {
    netSales: 5210.400,
    netSalesGrowth: 4.2,
    previousSales: 5000.380,
    orders: 942,
    ordersGrowth: 3.8,
    deliveryOrders: 610,
    pickupOrders: 332,
    aov: 5.531,
    aovGrowth: 1.4,
    dineInAov: 7.120,
    deliveryAov: 4.850,
    grossProfitMargin: 69.2,
    marginGrowth: 0.9,
    foodCostPct: 30.8,
    chartLabels: ['10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm', '12am'],
    currentSalesSeries: [290, 610, 820, 390, 510, 880, 990, 410],
    previousSalesSeries: [280, 590, 780, 370, 490, 840, 920, 390],
    currentOrdersSeries: [53, 110, 148, 70, 92, 159, 179, 74],
    peakHoursAr: '7:30 م - 10:00 م (179 طلباً/ساعة)',
    peakHoursEn: '7:30 PM - 10:00 PM (179 orders/hr)',
  },
  LAST_7D: {
    netSales: 38450.200,
    netSalesGrowth: 12.1,
    previousSales: 34299.900,
    orders: 6912,
    ordersGrowth: 9.8,
    deliveryOrders: 4472,
    pickupOrders: 2440,
    aov: 5.563,
    aovGrowth: 2.3,
    dineInAov: 7.220,
    deliveryAov: 4.860,
    grossProfitMargin: 69.3,
    marginGrowth: 1.1,
    foodCostPct: 30.7,
    chartLabels: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
    currentSalesSeries: [4980, 4520, 4610, 4890, 5320, 6890, 7240],
    previousSalesSeries: [4420, 4100, 4180, 4390, 4820, 6100, 6340],
    currentOrdersSeries: [895, 812, 828, 878, 955, 1237, 1307],
    peakHoursAr: 'الخميس والجمعة (7,240 د.ك / 1,307 طلبات)',
    peakHoursEn: 'Thursday & Friday (7,240 KWD / 1,307 orders)',
  },
  OCT_2026: {
    netSales: 167092.160,
    netSalesGrowth: 14.8,
    previousSales: 145550.660,
    orders: 30543,
    ordersGrowth: 11.2,
    deliveryOrders: 19761,
    pickupOrders: 10782,
    aov: 5.471,
    aovGrowth: 3.1,
    dineInAov: 7.200,
    deliveryAov: 4.850,
    grossProfitMargin: 69.2,
    marginGrowth: 1.4,
    foodCostPct: 30.8,
    chartLabels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5'],
    currentSalesSeries: [36240, 37120, 37890, 41200, 14642],
    previousSalesSeries: [31500, 32400, 33100, 35800, 12600],
    currentOrdersSeries: [6625, 6786, 6926, 7531, 2675],
    peakHoursAr: 'ذروة عطلات نهاية الأسبوع 8:00م - 11:00م',
    peakHoursEn: 'Weekend Prime Hours 8:00PM - 11:00PM',
  },
  YTD: {
    netSales: 1842500.000,
    netSalesGrowth: 18.6,
    previousSales: 1553540.000,
    orders: 338100,
    ordersGrowth: 15.4,
    deliveryOrders: 218750,
    pickupOrders: 119350,
    aov: 5.449,
    aovGrowth: 2.9,
    dineInAov: 7.180,
    deliveryAov: 4.840,
    grossProfitMargin: 69.0,
    marginGrowth: 1.0,
    foodCostPct: 31.0,
    chartLabels: ['Q1', 'Q2', 'Q3', 'أكتوبر'],
    currentSalesSeries: [512000, 560000, 603408, 167092],
    previousSalesSeries: [431000, 472000, 508000, 142540],
    currentOrdersSeries: [93950, 102750, 110850, 30543],
    peakHoursAr: 'موسم الشتاء والربع الرابع الأعلى نمواً',
    peakHoursEn: 'Q4 & Winter Season Peak Expansion',
  },
}

export function OrdableDashboardHub({
  locale = 'ar',
}: {
  locale?: 'ar' | 'en'
}) {
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [dateRange, setDateRange] = useState<string>('OCT_2026')
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  const [chartView, setChartView] = useState<'both' | 'sales' | 'orders'>('both')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const metrics = PERIOD_METRICS[dateRange] || PERIOD_METRICS.OCT_2026

  // Channels Data
  const channels = [
    { name: 'طلبات (Talabat)', nameEn: 'Talabat', pct: 48.2, kwd: 80538.42, feePct: '18.5%', color: '#ea580c' },
    { name: 'دليفرو (Deliveroo)', nameEn: 'Deliveroo', pct: 22.4, kwd: 37428.64, feePct: '17.0%', color: '#06b6d4' },
    { name: 'الصالة والسفري المباشر', nameEn: 'Dine-In / Takeaway', pct: 12.6, kwd: 21053.61, feePct: '0.0%', color: '#10b981' },
    { name: 'جاهز (Jahez)', nameEn: 'Jahez', pct: 9.1, kwd: 15205.38, feePct: '16.0%', color: '#ef4444' },
    { name: 'كاري (Cari)', nameEn: 'Cari', pct: 4.5, kwd: 7519.15, feePct: '15.0%', color: '#f59e0b' },
    { name: 'أوردبل المباشر (Ordable Web)', nameEn: 'Ordable Direct', pct: 3.2, kwd: 5346.96, feePct: '0.0%', color: '#8b5cf6' },
  ]

  // Brands Contribution
  const brands = [
    { name: "تشاينا جاردن (China Garden)", nameEn: "China Garden", share: 84.8, sales: 141662.65, orders: 25900, aov: 5.470, color: '#f59e0b' },
    { name: "فرانكس (Frank's)", nameEn: "Frank's", share: 9.7, sales: 16222.26, orders: 1647, aov: 9.850, color: '#ef4444' },
    { name: "شاورما طحينة (Tahina)", nameEn: "Tahina", share: 2.6, sales: 4424.85, orders: 1580, aov: 2.800, color: '#10b981' },
    { name: "فارم براون (Farm Brown)", nameEn: "Farm Brown", share: 1.6, sales: 2661.90, orders: 1835, aov: 1.450, color: '#84cc16' },
    { name: "ذا نودل بار (The Noodle Bar)", nameEn: "The Noodle Bar", share: 1.0, sales: 1676.95, orders: 1233, aov: 1.360, color: '#06b6d4' },
    { name: "كرك كافتيريا (Karak Cafeteria)", nameEn: "Karak Cafeteria", share: 0.3, sales: 443.55, orders: 326, aov: 1.360, color: '#8b5cf6' },
  ]

  // Top 5 Star Items
  const topItems = [
    { code: 'CG01', nameAr: 'دجاج كانتون تشاينا جاردن المميز', nameEn: 'China Garden Special Canton Chicken', brand: 'China Garden', qty: 6420, rev: 28890.00, badge: '⭐ بطل المبيعات' },
    { code: 'MS01', nameAr: 'فرانكس سموك هاوس برجر', nameEn: 'Frank\'s Smokehouse Burger', brand: "Frank's", qty: 4120, rev: 16892.00, badge: '🔥 الأكثر طلباً' },
    { code: 'SH01', nameAr: 'شاورما لحم طحينة سوبريم', nameEn: 'Tahina Meat Shawarma Supreme', brand: 'Tahina', qty: 4680, rev: 7488.00, badge: '🎯 أسرع تسليم' },
    { code: 'PP03', nameAr: 'ستريبس دجاج فارم براون المقرمش', nameEn: 'Farm Brown Chicken Strips', brand: 'Farm Brown', qty: 3120, rev: 5616.00, badge: '🌿 الخيار الصحي' },
    { code: 'NB01', nameAr: 'نودلز كانتون بالخضار واللحم', nameEn: 'The Noodle Bar Canton Noodles', brand: 'The Noodle Bar', qty: 2150, rev: 4300.00, badge: '🍜 الأكثر شعبية' },
  ]

  // Top Delivery Zones in Kuwait
  const deliveryZones = [
    { nameAr: 'السالمية والبدع', nameEn: 'Salmiya & Al-Bidaa', share: 18.2, orders: 5558, avgTime: '22 دقيقة', color: '#10b981' },
    { nameAr: 'حولي والنقرة وميدان حولي', nameEn: 'Hawally & Nugra', share: 14.5, orders: 4428, avgTime: '24 دقيقة', color: '#06b6d4' },
    { nameAr: 'الفروانية وخيطان', nameEn: 'Farwaniya & Khaitan', share: 12.1, orders: 3695, avgTime: '26 دقيقة', color: '#f59e0b' },
    { nameAr: 'صباح السالم والمسيلة', nameEn: 'Sabah Al-Salem & Messila', share: 10.4, orders: 3176, avgTime: '25 دقيقة', color: '#8b5cf6' },
    { nameAr: 'الجابرية والسرة وقرطبة', nameEn: 'Jabriya & Surra', share: 9.2, orders: 2810, avgTime: '21 دقيقة', color: '#ec4899' },
    { nameAr: 'مجمع الأفنيوز والشويخ والري', nameEn: 'Avenues, Shuwaikh & Rai', share: 8.6, orders: 2626, avgTime: '19 دقيقة', color: '#3b82f6' },
    { nameAr: 'مدينة الكويت وشرق وبنيد القار', nameEn: 'Kuwait City, Sharq & Bneid', share: 7.8, orders: 2382, avgTime: '27 دقيقة', color: '#14b8a6' },
    { nameAr: 'الفنطاس والمهبولة وأبو حليفة', nameEn: 'Coastal South (Fintas/Mahboula)', share: 6.8, orders: 2076, avgTime: '28 دقيقة', color: '#a855f7' },
  ]

  // Chart Max Values
  const maxSales = Math.max(...metrics.currentSalesSeries, ...metrics.previousSalesSeries, 1)
  const maxOrders = Math.max(...metrics.currentOrdersSeries, 1)

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-7 space-y-6"
    >
      {/* ========================================================================= */}
      {/* 1. ORDABLE TOP BAR: TITLE + PULSING LIVE STATUS + DATE PILLS + SELECTORS  */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-2xl backdrop-blur-xl transition-all hover:border-slate-700/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                {isAr ? '🟢 10/10 فروع متصلة الآن · مطبخ القرين 100%' : '🟢 10/10 Branches Online · Al-Qurain CK 100%'}
              </span>
              <span className="rounded-full border border-slate-700/50 bg-slate-800/70 px-2.5 py-0.5 text-xs font-mono text-slate-300">
                Ordable Engine v2.6 · Venture Foods
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
              {isAr ? 'ملخص الأداء التنفيذي | شركة فنتشر فودز' : 'Executive Performance Overview | Venture Foods'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr
                ? 'لوحة القيادة الموحدة على غرار نظام Ordable: 6 براندات، 10 فروع، و11 قناة بيع وتوصيل في الكويت'
                : 'Unified Ordable-style command dashboard: 6 brands, 10 branches & 11 order channels across Kuwait'}
            </p>
          </div>

          {/* Controls: Date Range Pills + Locale */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-inner">
              {[
                { id: 'TODAY', labelAr: 'اليوم', labelEn: 'Today' },
                { id: 'YESTERDAY', labelAr: 'أمس', labelEn: 'Yesterday' },
                { id: 'LAST_7D', labelAr: 'آخر 7 أيام', labelEn: 'Last 7D' },
                { id: 'OCT_2026', labelAr: 'هذا الشهر (أكتوبر)', labelEn: 'October' },
                { id: 'YTD', labelAr: 'هذا العام YTD', labelEn: 'YTD' },
              ].map((pill) => {
                const active = dateRange === pill.id
                return (
                  <button
                    key={pill.id}
                    onClick={() => setDateRange(pill.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                      active
                        ? 'bg-emerald-500 text-black font-extrabold shadow-lg shadow-emerald-500/25 scale-[1.02]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {isAr ? pill.labelAr : pill.labelEn}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              {isAr ? 'English (LTR)' : 'عربي (RTL)'}
            </button>
          </div>
        </div>

        {/* Clean Filter Dropdowns Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-slate-400 font-semibold">{isAr ? 'فلتر النطاق:' : 'Scope Filter:'}</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 font-bold text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">{isAr ? 'كل البراندات (6 براندات)' : 'All 6 Brands'}</option>
              <option value="FRANKS">تشاينا جاردن (China Garden)</option>
              <option value="FRANKS">فرانكس ستيك وبرجر (Frank&apos;s)</option>
              <option value="TAHINA">شاورما طحينة (Tahina Shack)</option>
              <option value="FARMBROWN">فارم براون الصحي (Farm Brown)</option>
              <option value="NOODLE">ذا نودل بار (The Noodle Bar)</option>
              <option value="KARAK">كرك كافتيريا (Karak Cafeteria)</option>
            </select>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 font-bold text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">{isAr ? 'كافة الفروع النشطة (9 فروع + مطبخ القرين)' : 'All Active Branches'}</option>
              <option value="SALMIYA">فرع السالمية (شارع سالم المبارك)</option>
              <option value="AVENUES">فرع مجمع الأفنيوز (المرحلة 2)</option>
              <option value="HAWALLY">فرع حولي (شارع بيروت)</option>
              <option value="FARWANIYA">فرع الفروانية (حبيب مناور)</option>
              <option value="MAHBOULA">فرع المهبولة (الشريط الساحلي)</option>
              <option value="ARDIYA">فرع العارضية الحرفية (Ardiya)</option>
              <option value="KHAITAN">فرع خيطان (عثمان بن عفان)</option>
              <option value="BNEID">فرع بنيد القار (شارع الاستقلال)</option>
              <option value="RAI">فرع الري (طريق الغزالي السريع)</option>
              <option value="FAHAHEEL">فرع الفحيحيل (الكوت مول)</option>
              <option value="QURAIN">المطبخ المركزي بالقرين</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="hidden sm:inline font-mono text-[11px] text-emerald-400/90">
              ● {metrics.orders.toLocaleString()} {isAr ? 'طلب معتمد في الدفتر' : 'orders ledgered'}
            </span>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>{isAr ? 'دليل التقارير الشامل' : 'Full Reports Directory'}</span>
              <ChevronRight size={14} className={isAr ? 'rotate-180' : ''} />
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THE 4 HERO KPI CARDS WITH CUSTOM SVG SMOOTH GRADIENT SPARKLINES        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Net Sales */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-2xl hover:shadow-emerald-500/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <DollarSign size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                  {isAr ? 'صافي المبيعات (Net Revenue)' : 'Net Revenue'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                <TrendingUp size={12} />
                ▲ +{metrics.netSalesGrowth}%
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-white sm:text-3xl tabular-nums tracking-tight">
                {metrics.netSales.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </span>
              <span className="text-xs font-bold text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {isAr ? `مقارنة بالفترة السابقة (${metrics.previousSales.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ك)` : `vs previous matching period (${metrics.previousSales.toLocaleString()} KWD)`}
            </p>
          </div>

          {/* Smooth Green SVG Sparkline */}
          <div className="mt-4 pt-3 border-t border-slate-800/70">
            <svg className="h-9 w-full overflow-visible" viewBox="0 0 100 24" fill="none">
              <defs>
                <linearGradient id="netSalesSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 19 Q 18 14, 30 16 T 55 9 T 80 6 T 100 2"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 0 19 Q 18 14, 30 16 T 55 9 T 80 6 T 100 2 L 100 24 L 0 24 Z"
                fill="url(#netSalesSparkGrad)"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Orders */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-sky-500/40 hover:shadow-2xl hover:shadow-sky-500/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-400">
                  <ShoppingBag size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                  {isAr ? 'إجمالي الطلبات (Total Orders)' : 'Total Orders'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-xs font-bold text-sky-400">
                <TrendingUp size={12} />
                ▲ +{metrics.ordersGrowth}%
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-white sm:text-3xl tabular-nums tracking-tight">
                {metrics.orders.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-slate-400">{isAr ? 'طلباً' : 'orders'}</span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {metrics.deliveryOrders.toLocaleString()} {isAr ? 'توصيل' : 'Delivery'} • {metrics.pickupOrders.toLocaleString()} {isAr ? 'صالة ومحلي' : 'Dine-In'}
            </p>
          </div>

          {/* Smooth Sky Blue SVG Sparkline */}
          <div className="mt-4 pt-3 border-t border-slate-800/70">
            <svg className="h-9 w-full overflow-visible" viewBox="0 0 100 24" fill="none">
              <defs>
                <linearGradient id="ordersSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 18 Q 20 16, 35 12 T 65 14 T 85 7 T 100 3"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 0 18 Q 20 16, 35 12 T 65 14 T 85 7 T 100 3 L 100 24 L 0 24 Z"
                fill="url(#ordersSparkGrad)"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Average Order Value (AOV) */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:shadow-2xl hover:shadow-purple-500/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <UtensilsCrossed size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                  {isAr ? 'متوسط الفاتورة (AOV)' : 'Average Order Value'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-xs font-bold text-purple-400">
                <TrendingUp size={12} />
                ▲ +{metrics.aovGrowth}%
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-white sm:text-3xl tabular-nums tracking-tight">
                {metrics.aov.toFixed(3)}
              </span>
              <span className="text-xs font-bold text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {isAr ? `صالة ومحلي: ${metrics.dineInAov.toFixed(3)} د.ك · التوصيل: ${metrics.deliveryAov.toFixed(3)} د.ك` : `Dine-In: ${metrics.dineInAov.toFixed(3)} · Delivery: ${metrics.deliveryAov.toFixed(3)}`}
            </p>
          </div>

          {/* Smooth Purple SVG Sparkline */}
          <div className="mt-4 pt-3 border-t border-slate-800/70">
            <svg className="h-9 w-full overflow-visible" viewBox="0 0 100 24" fill="none">
              <defs>
                <linearGradient id="aovSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 17 Q 25 18, 40 13 T 70 11 T 85 9 T 100 4"
                stroke="#a855f7"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 0 17 Q 25 18, 40 13 T 70 11 T 85 9 T 100 4 L 100 24 L 0 24 Z"
                fill="url(#aovSparkGrad)"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Gross Profit Margin */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Percent size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                  {isAr ? 'هامش مجمل الربح (Gross Margin)' : 'Gross Margin'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                <TrendingUp size={12} />
                ▲ +{metrics.marginGrowth}%
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-amber-300 sm:text-3xl tabular-nums tracking-tight">
                {metrics.grossProfitMargin.toFixed(1)}%
              </span>
              <span className="text-xs font-bold text-slate-400">{isAr ? 'مجمل' : 'gross'}</span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {isAr ? `تكلفة الغذاء والتغليف: ${metrics.foodCostPct}% (الهدف < 31%)` : `Food & Pack Cost: ${metrics.foodCostPct}% COGS`}
            </p>
          </div>

          {/* Smooth Amber SVG Sparkline */}
          <div className="mt-4 pt-3 border-t border-slate-800/70">
            <svg className="h-9 w-full overflow-visible" viewBox="0 0 100 24" fill="none">
              <defs>
                <linearGradient id="marginSparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 16 Q 20 18, 45 12 T 75 8 T 90 7 T 100 3"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 0 16 Q 20 18, 45 12 T 75 8 T 90 7 T 100 3 L 100 24 L 0 24 Z"
                fill="url(#marginSparkGrad)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. DUAL INTERACTIVE REVENUE & ORDERS CHART (ORDABLE CLEAN DESIGN)          */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-black text-white sm:text-lg">
                {isAr ? 'منحنى تدفق المبيعات والطلبات اليومي' : 'Daily Sales & Order Velocity Trendline'}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr ? metrics.peakHoursAr : metrics.peakHoursEn}
            </p>
          </div>

          {/* Metric Toggle Tabs */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 text-xs">
            <button
              onClick={() => setChartView('both')}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                chartView === 'both'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'المبيعات والطلبات معاً' : 'Both Sales & Orders'}
            </button>
            <button
              onClick={() => setChartView('sales')}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                chartView === 'sales'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'المبيعات فقط (د.ك)' : 'Revenue Only'}
            </button>
            <button
              onClick={() => setChartView('orders')}
              className={`rounded-lg px-3 py-1.5 font-bold transition-all ${
                chartView === 'orders'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'الطلبات فقط' : 'Orders Only'}
            </button>
          </div>
        </div>

        {/* Legend Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-5">
            {(chartView === 'both' || chartView === 'sales') && (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
                <span className="font-semibold text-slate-300">{isAr ? 'صافي المبيعات الحالية (د.ك)' : 'Current Net Sales'}</span>
              </span>
            )}
            {(chartView === 'both' || chartView === 'orders') && (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50"></span>
                <span className="font-semibold text-slate-300">{isAr ? 'عدد الطلبات' : 'Order Count'}</span>
              </span>
            )}
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-600"></span>
              <span>{isAr ? 'الفترة السابقة للمقارنة' : 'Benchmark (Prior Period)'}</span>
            </span>
          </div>

          {hoveredIndex !== null && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-bold text-emerald-300 animate-fadeIn">
              {metrics.chartLabels[hoveredIndex]}: {metrics.currentSalesSeries[hoveredIndex]?.toLocaleString()} د.ك • {metrics.currentOrdersSeries[hoveredIndex]?.toLocaleString()} طلب
            </div>
          )}
        </div>

        {/* Interactive Smooth Visual Bars & Points */}
        <div className="h-56 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800/80">
          {metrics.chartLabels.map((lbl, idx) => {
            const curSales = metrics.currentSalesSeries[idx] || 0
            const prevSales = metrics.previousSalesSeries[idx] || 0
            const curOrders = metrics.currentOrdersSeries[idx] || 0

            const salesHeight = Math.max(Math.round((curSales / maxSales) * 100), 10)
            const prevSalesHeight = Math.max(Math.round((prevSales / maxSales) * 100), 8)
            const ordersHeight = Math.max(Math.round((curOrders / maxOrders) * 100), 10)

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              >
                <div className="w-full flex items-end justify-center gap-1.5 h-full">
                  {/* Benchmark dashed ghost bar */}
                  <div
                    className="w-1/3 rounded-t-lg bg-slate-800/50 border border-dashed border-slate-700/50 transition-all duration-200 group-hover:bg-slate-700/60"
                    style={{ height: `${prevSalesHeight}%` }}
                    title={`${isAr ? 'السابق:' : 'Previous:'} ${prevSales.toLocaleString()} KWD`}
                  ></div>

                  {/* Active Sales Bar */}
                  {(chartView === 'both' || chartView === 'sales') && (
                    <div
                      className="w-1/3 rounded-t-lg bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 shadow-lg shadow-emerald-500/20 transition-all duration-300 group-hover:brightness-125 group-hover:scale-y-[1.03] origin-bottom"
                      style={{ height: `${salesHeight}%` }}
                      title={`${lbl} - ${curSales.toLocaleString()} KWD`}
                    ></div>
                  )}

                  {/* Active Orders Bar */}
                  {(chartView === 'both' || chartView === 'orders') && (
                    <div
                      className="w-1/3 rounded-t-lg bg-gradient-to-t from-sky-600 via-sky-500 to-sky-400 shadow-lg shadow-sky-500/20 transition-all duration-300 group-hover:brightness-125 group-hover:scale-y-[1.03] origin-bottom"
                      style={{ height: `${ordersHeight}%` }}
                      title={`${lbl} - ${curOrders.toLocaleString()} Orders`}
                    ></div>
                  )}
                </div>

                <span className="mt-2 text-[11px] font-mono text-slate-400 group-hover:text-white group-hover:font-bold transition-colors">
                  {lbl}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. ORDABLE 4-QUADRANT VISUAL INSIGHTS (PURE CLEAN CARDS - NO MESSY TABLES)*/}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quadrant 1: Order Channels Breakdown */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3.5">
            <div className="flex items-center gap-2.5">
              <Truck size={18} className="text-amber-400" />
              <h3 className="text-sm font-black text-white sm:text-base">
                {isAr ? 'توزيع قنوات البيع والتوصيل (Channels Breakdown)' : 'Order & Aggregator Channels'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">11 {isAr ? 'قناة نشطة' : 'Channels'}</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {channels.map((ch, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ch.color }}></span>
                    {isAr ? ch.name : ch.nameEn}
                  </span>
                  <div className="font-mono text-right flex items-center gap-2">
                    <span className="text-white font-extrabold">{ch.kwd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ك</span>
                    <span className="text-slate-400 font-medium">({ch.pct}%)</span>
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                      عمولة {ch.feePct}
                    </span>
                  </div>
                </div>
                {/* Visual Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${ch.pct}%`, backgroundColor: ch.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quadrant 2: Brand Contribution & Share */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3.5">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="text-blue-400" />
              <h3 className="text-sm font-black text-white sm:text-base">
                {isAr ? 'مساهمة البراندات الـ 6 (Brand Contribution)' : '6 Brands Revenue Share'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">100% {isAr ? 'فنتشر فودز' : 'Venture Foods'}</span>
          </div>

          <div className="space-y-3 pt-1">
            {brands.map((b, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 space-y-2 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-[10px] font-black text-slate-300">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-black text-white">{isAr ? b.name : b.nameEn}</span>
                  </div>
                  <div className="font-mono text-xs font-black text-emerald-400">
                    {b.sales.toLocaleString()} د.ك <span className="text-slate-400 font-normal">({b.share}%)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400">
                  <span>{b.orders.toLocaleString()} {isAr ? 'طلب' : 'orders'}</span>
                  <span>{isAr ? 'متوسط الفاتورة:' : 'AOV:'} <strong className="text-white font-mono">{b.aov.toFixed(3)}</strong> د.ك</span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${b.share}%`, backgroundColor: b.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quadrant 3: Top 5 Star Menu Items (Visual Cards - NOT a Table) */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3.5">
            <div className="flex items-center gap-2.5">
              <UtensilsCrossed size={18} className="text-purple-400" />
              <h3 className="text-sm font-black text-white sm:text-base">
                {isAr ? 'أقوى 5 أصناف مبيعاً (Top 5 Star Items)' : 'Top 5 Star Menu Items'}
              </h3>
            </div>
            <Link href="/reports?tab=products" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors">
              {isAr ? 'عرض 364 صنفاً' : 'All 364 SKUs'}
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {topItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 font-mono text-xs font-bold text-purple-300">
                    {item.code}
                  </span>
                  <div>
                    <div className="font-extrabold text-white text-xs">
                      {isAr ? item.nameAr : item.nameEn}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.brand} • {item.qty.toLocaleString()} {isAr ? 'وحدة مباعة' : 'units sold'}
                    </div>
                  </div>
                </div>

                <div className="text-end">
                  <div className="font-mono text-xs font-black text-emerald-400">
                    {item.rev.toLocaleString()} د.ك
                  </div>
                  <span className="inline-block mt-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                    {item.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quadrant 4: Top Kuwait Delivery Zones */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3.5">
            <div className="flex items-center gap-2.5">
              <CreditCard size={18} className="text-emerald-400" />
              <h3 className="text-sm font-black text-white sm:text-base">
                {isAr ? 'رادار مناطق التوصيل الأكثر نشاطاً في الكويت' : 'Kuwait Delivery Heatmap & Zones'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{isAr ? '8 مناطق رئيسية' : '8 Hot Zones'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {deliveryZones.map((zone, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 hover:border-slate-700 transition-all space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate max-w-[130px]">
                    {isAr ? zone.nameAr : zone.nameEn}
                  </span>
                  <span className="font-mono font-black text-emerald-400 text-xs">
                    {zone.share}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{zone.orders.toLocaleString()} {isAr ? 'طلب' : 'orders'}</span>
                  <span className="text-[10px] text-slate-500 font-mono">⚡ {zone.avgTime}</span>
                </div>
                <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${zone.share * 4.5}%`, backgroundColor: zone.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MINIMALIST BOTTOM QUICK NAVIGATION PILLS                               */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/60 p-4 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 font-bold">
          {isAr ? 'الوصول السريع إلى أقسام النظام المتخصصة:' : 'Quick Navigation:'}
        </span>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { href: '/erp/events-projects', labelAr: '🎪 المعارض والمخيمات', labelEn: 'Events & Camps' },
            { href: '/pos', labelAr: '🍔 كاشير المطاعم', labelEn: 'POS Terminal' },
            { href: '/kds', labelAr: '👨‍🍳 شاشة المطبخ KDS', labelEn: 'Kitchen KDS' },
            { href: '/recipes', labelAr: '📖 الوصفات وتكلفة الغذاء', labelEn: 'Recipes & BOM' },
            { href: '/accounting', labelAr: '🏢 الإدارة المالية والإيجارات', labelEn: 'Accounting & Leases' },
            { href: '/hr', labelAr: '👥 الموارد البشرية والرواتب', labelEn: 'HR & Payroll' },
            { href: '/reports', labelAr: '📊 دليل التقارير الشامل', labelEn: 'Reports Suite' },
          ].map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className="rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 font-bold text-slate-300 hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
            >
              {isAr ? item.labelAr : item.labelEn}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
