'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import {
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Percent,
  CreditCard,
  Building2,
  UtensilsCrossed,
  Truck,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  Flame,
  BookOpen,
  Landmark,
  Store,
} from 'lucide-react'

// Period Data Models
interface PeriodData {
  netSales: number
  netSalesGrowth: number
  orders: number
  ordersGrowth: number
  deliveryOrders: number
  pickupOrders: number
  aov: number
  aovGrowth: number
  itemsPerBasket: number
  itemsSold: number
  netPayout: number
  payoutGrowth: number
  discountsKwd: number
  discountsPct: number
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
    orders: 985,
    ordersGrowth: 6.2,
    deliveryOrders: 638,
    pickupOrders: 347,
    aov: 5.503,
    aovGrowth: 2.1,
    itemsPerBasket: 2.62,
    itemsSold: 2580,
    netPayout: 4635.000,
    payoutGrowth: 7.8,
    discountsKwd: 135.500,
    discountsPct: 2.5,
    foodCostPct: 24.5,
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
    orders: 942,
    ordersGrowth: 3.8,
    deliveryOrders: 610,
    pickupOrders: 332,
    aov: 5.531,
    aovGrowth: 1.4,
    itemsPerBasket: 2.61,
    itemsSold: 2460,
    netPayout: 4455.000,
    payoutGrowth: 3.9,
    discountsKwd: 130.000,
    discountsPct: 2.5,
    foodCostPct: 24.6,
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
    orders: 6912,
    ordersGrowth: 9.8,
    deliveryOrders: 4472,
    pickupOrders: 2440,
    aov: 5.563,
    aovGrowth: 2.3,
    itemsPerBasket: 2.61,
    itemsSold: 18040,
    netPayout: 32860.000,
    payoutGrowth: 10.4,
    discountsKwd: 960.000,
    discountsPct: 2.5,
    foodCostPct: 24.7,
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
    orders: 30543,
    ordersGrowth: 11.2,
    deliveryOrders: 19761,
    pickupOrders: 10782,
    aov: 5.471,
    aovGrowth: 3.1,
    itemsPerBasket: 2.61,
    itemsSold: 79740,
    netPayout: 142850.400,
    payoutGrowth: 9.4,
    discountsKwd: 4152.000,
    discountsPct: 2.4,
    foodCostPct: 24.8,
    chartLabels: ['الأسبوع 1', 'الأسبوع 2', 'الأسبوع 3', 'الأسبوع 4', 'الأسبوع 5'],
    currentSalesSeries: [36240, 37120, 37890, 41200, 14642],
    previousSalesSeries: [31500, 32400, 33100, 35800, 12600],
    currentOrdersSeries: [6625, 6786, 6926, 7531, 2675],
    peakHoursAr: 'ذروة عطلات نهاية الأسبوع 8:00م - 11:00م (متوسط 142 طلباً/ساعة)',
    peakHoursEn: 'Weekend Prime Hours 8:00PM - 11:00PM (142 orders/hr avg)',
  },
  YTD: {
    netSales: 1842500.000,
    netSalesGrowth: 18.6,
    orders: 338100,
    ordersGrowth: 15.4,
    deliveryOrders: 218750,
    pickupOrders: 119350,
    aov: 5.449,
    aovGrowth: 2.9,
    itemsPerBasket: 2.61,
    itemsSold: 882400,
    netPayout: 1575300.000,
    payoutGrowth: 14.8,
    discountsKwd: 44200.000,
    discountsPct: 2.4,
    foodCostPct: 24.9,
    chartLabels: ['Q1', 'Q2', 'Q3', 'أكتوبر'],
    currentSalesSeries: [512000, 560000, 603408, 167092],
    previousSalesSeries: [431000, 472000, 508000, 142540],
    currentOrdersSeries: [93950, 102750, 110850, 30543],
    peakHoursAr: 'موسم الشتاء والربع الرابع الأعلى نمواً في الكويت',
    peakHoursEn: 'Winter Season & Q4 Peak Expansion in Kuwait',
  },
}

export function OrdableExecutiveDashboard({
  locale = 'ar',
}: {
  locale?: 'ar' | 'en'
}) {
  let ctxLocale: 'ar' | 'en' | null = null
  try {
    const i18n = useI18n()
    if (i18n?.locale) ctxLocale = i18n.locale
  } catch {}

  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)

  useEffect(() => {
    if (ctxLocale) setCurrentLocale(ctxLocale)
  }, [ctxLocale])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const updateFromDoc = () => {
      const docLang = document.documentElement.lang
      if (docLang === 'en' || docLang === 'ar') {
        setCurrentLocale(docLang)
      }
    }
    updateFromDoc()
    const observer = new MutationObserver(updateFromDoc)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] })
    return () => observer.disconnect()
  }, [])
  const [dateRange, setDateRange] = useState<string>('OCT_2026')
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  const [chartMetric, setChartMetric] = useState<'sales' | 'orders' | 'aov'>('sales')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const metrics = PERIOD_METRICS[dateRange] || PERIOD_METRICS.OCT_2026

  // Channels Breakdown (From user requirements)
  const channels = [
    { nameAr: 'مبيعات المحل والصالة (Shop Sales)', nameEn: 'Shop Sales (Dine-In/Takeaway)', pct: 35.3, kwd: 58972.250, color: '#10b981' },
    { nameAr: 'طلبات جو (Talabat Go)', nameEn: 'Talabat Go', pct: 33.3, kwd: 55715.210, color: '#ea580c' },
    { nameAr: 'كيتا (Keeta)', nameEn: 'Keeta', pct: 21.3, kwd: 35607.550, color: '#eab308' },
    { nameAr: 'طلبات ماركت بليس (Talabat MP)', nameEn: 'Talabat Marketplace', pct: 3.9, kwd: 6557.250, color: '#f97316' },
    { nameAr: 'دليفرو (Deliveroo)', nameEn: 'Deliveroo', pct: 3.6, kwd: 5996.740, color: '#06b6d4' },
    { nameAr: 'أوردبل والقنوات الأخرى (Ordable & Others)', nameEn: 'Ordable & Others', pct: 2.6, kwd: 4243.160, color: '#8b5cf6' },
  ]

  // Brands Leaderboard (From user requirements)
  const brandsLeaderboard = [
    { nameAr: 'تشاينا جاردن (China Garden)', nameEn: 'China Garden', kwd: 141662.650, pct: 84.8, color: '#ef4444' },
    { nameAr: "فرانكس ستيك وبرجر (Frank's)", nameEn: "Frank's Steak", kwd: 16222.260, pct: 9.7, color: '#f59e0b' },
    { nameAr: 'شاورما طحينة (Tahina)', nameEn: 'Tahina', kwd: 4424.850, pct: 2.6, color: '#10b981' },
    { nameAr: 'فارم براون الصحي (Farm Brown)', nameEn: 'Farm Brown', kwd: 2661.900, pct: 1.6, color: '#84cc16' },
    { nameAr: 'ذا نودل بار (The Noodle Bar)', nameEn: 'The Noodle Bar', kwd: 1676.950, pct: 1.0, color: '#06b6d4' },
    { nameAr: 'كرك كافتيريا (Karak Cafeteria)', nameEn: 'Karak Cafeteria', kwd: 443.550, pct: 0.3, color: '#8b5cf6' },
  ]

  // Top 6 Star Menu Items (From user requirements)
  const topProducts = [
    { rank: '#1', nameAr: 'تشيكن نودلز (Chicken Noodles)', brand: 'China Garden', rev: 12043.100, badge: '⭐ الأكثر مبيعاً' },
    { rank: '#2', nameAr: 'كومبو نودلز دجاج وخضار (Veg/Chicken Combo)', brand: 'China Garden', rev: 9827.300, badge: '🔥 نمو سريع' },
    { rank: '#3', nameAr: 'فيجيتابل نودلز (Vegetable Noodles)', brand: 'China Garden', rev: 6652.550, badge: '🥗 صنف كلاسيكي' },
    { rank: '#4', nameAr: 'بيف منجوليان (Beef Mongolian)', brand: 'China Garden', rev: 5784.900, badge: '🥩 طبق رئيسي' },
    { rank: '#5', nameAr: 'تشيكن سويت آند ساور (Sweet & Sour)', brand: 'China Garden', rev: 4402.950, badge: '✨ طلب مستمر' },
    { rank: '#6', nameAr: 'سندوتش فيلي تشيز ستيك الأصلي', brand: "Frank's", rev: 3735.810, badge: '🥪 بطل فرانكس' },
  ]

  // Payments & Top Branches (From user requirements)
  const paymentMethods = [
    { nameAr: 'كي نت (K-Net Gateway)', pct: 48, kwd: 80204.240, color: '#0284c7' },
    { nameAr: 'أبل باي (Apple Pay)', pct: 24, kwd: 40102.120, color: '#a855f7' },
    { nameAr: 'بطاقات الائتمان (Visa/Master)', pct: 16, kwd: 26734.750, color: '#10b981' },
    { nameAr: 'الدفع نقداً بالصالة (Cash)', pct: 12, kwd: 20051.050, color: '#f59e0b' },
  ]

  const topBranches = [
    { nameAr: 'فرع السالمية (شارع سالم المبارك)', sales: 24150.000, share: 14.5 },
    { nameAr: 'فرع مجمع الأفنيوز (المرحلة 2)', sales: 36400.000, share: 21.8 },
    { nameAr: 'فرع حولي (شارع بيروت)', sales: 18200.000, share: 10.9 },
    { nameAr: 'فرع الفروانية (حبيب مناور)', sales: 15900.000, share: 9.5 },
    { nameAr: 'فرع المهبولة (الشريط الساحلي)', sales: 13800.000, share: 8.3 },
  ]

  // Dynamic Chart Max
  const maxVal = Math.max(...metrics.currentSalesSeries, ...metrics.previousSalesSeries, 1)

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-7 space-y-6"
    >
      {/* ========================================================================= */}
      {/* 1. ORDABLE TOP BAR: TITLE + PULSING STATUS + INTERACTIVE DATE PILLS       */}
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

          {/* Interactive Date Range Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-inner">
              {[
                { id: 'TODAY', labelAr: 'اليوم', labelEn: 'Today' },
                { id: 'YESTERDAY', labelAr: 'أمس', labelEn: 'Yesterday' },
                { id: 'LAST_7D', labelAr: 'آخر 7 أيام', labelEn: 'Last 7D' },
                { id: 'OCT_2026', labelAr: 'أكتوبر 2026 (الافتراضي)', labelEn: 'Oct 2026 (Default)' },
                { id: 'YTD', labelAr: 'هذا العام', labelEn: 'This Year' },
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
              <option value="CHINA">تشاينا جاردن (China Garden - 84.8%)</option>
              <option value="FRANKS">فرانكس ستيك وبرجر (Frank&apos;s - 9.7%)</option>
              <option value="TAHINA">شاورما طحينة (Tahina - 2.6%)</option>
              <option value="FARMBROWN">فارم براون الصحي (Farm Brown - 1.6%)</option>
              <option value="NOODLE">ذا نودل بار (The Noodle Bar - 1.0%)</option>
              <option value="KARAK">كرك كافتيريا (Karak Cafeteria - 0.3%)</option>
            </select>

            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-1.5 font-bold text-white focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">{isAr ? 'كل الفروع (10 فروع + مطبخ القرين)' : 'All 10 Branches'}</option>
              <option value="SALMIYA">فرع السالمية (شارع سالم المبارك)</option>
              <option value="AVENUES">فرع مجمع الأفنيوز (المرحلة 2)</option>
              <option value="HAWALLY">فرع حولي (شارع بيروت)</option>
              <option value="FARWANIYA">فرع الفروانية (حبيب مناور)</option>
              <option value="MAHBOULA">فرع المهبولة (الشريط الساحلي)</option>
              <option value="JAHRA">فرع الجهراء (مرزوق المتعب)</option>
              <option value="KHAITAN">فرع خيطان (عثمان بن عفان)</option>
              <option value="BNEID">فرع بنيد القار (شارع الاستقلال)</option>
              <option value="RAI">فرع الري (طريق الغزالي السريع)</option>
              <option value="FAHAHEEL">فرع الفحيحيل (الكوت مول)</option>
              <option value="QURAIN">المطبخ المركزي بالقرين</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span className="hidden sm:inline font-mono text-[11px] text-emerald-400/90">
              ● {metrics.orders.toLocaleString()} {isAr ? 'طلب معتمد في الدفتر' : 'audited orders'}
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
        {/* Card 1: Net Revenue */}
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
              {isAr ? 'عن الفترة السابقة المماثلة' : 'vs prior period'}
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
              {metrics.deliveryOrders.toLocaleString()} {isAr ? 'توصيل' : 'Delivery'} • {metrics.pickupOrders.toLocaleString()} {isAr ? 'محل واستلام' : 'Pickup'}
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
                  {isAr ? 'متوسط قيمة السلة (AOV)' : 'Average Order Value'}
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
              {metrics.itemsPerBasket} {isAr ? 'صنف/طلب' : 'items/basket'} • {metrics.itemsSold.toLocaleString()} {isAr ? 'صنفاً مباعاً' : 'sold'}
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

        {/* Card 4: Net Payout */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-amber-500/40 hover:shadow-2xl hover:shadow-amber-500/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Percent size={20} />
                </div>
                <span className="text-xs font-bold text-slate-400 tracking-wide uppercase">
                  {isAr ? 'صافي العائد بعد العمولات (Net Payout)' : 'Net Payout'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-400">
                <TrendingUp size={12} />
                ▲ +{metrics.payoutGrowth}%
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-amber-300 sm:text-3xl tabular-nums tracking-tight">
                {metrics.netPayout.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </span>
              <span className="text-xs font-bold text-slate-400">{isAr ? 'د.ك' : 'KWD'}</span>
            </div>

            <p className="mt-1 text-[11px] text-slate-400">
              {isAr ? `الخصومات: ${metrics.discountsKwd.toLocaleString()} د.ك (${metrics.discountsPct}%) • Food Cost: ${metrics.foodCostPct}%` : `Discounts: ${metrics.discountsKwd.toLocaleString()} KWD • FC: ${metrics.foodCostPct}%`}
            </p>
          </div>

          {/* Smooth Amber SVG Sparkline */}
          <div className="mt-4 pt-3 border-t border-slate-800/70">
            <svg className="h-9 w-full overflow-visible" viewBox="0 0 100 24" fill="none">
              <defs>
                <linearGradient id="payoutSparkGrad" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#payoutSparkGrad)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ORDABLE MAIN SMOOTH AREA & VELOCITY CHART                              */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-black text-white sm:text-lg">
                {isAr ? 'مخطط أوردبل الموجي الكبير لحركة المبيعات والطلبات' : 'Ordable Main Smooth Revenue & Orders Trendline'}
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr ? metrics.peakHoursAr : metrics.peakHoursEn}
            </p>
          </div>

          {/* Metric Toggle Tabs */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 text-xs">
            <button
              onClick={() => setChartMetric('sales')}
              className={`rounded-lg px-3.5 py-1.5 font-bold transition-all ${
                chartMetric === 'sales'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'المبيعات (د.ك)' : 'Revenue (KWD)'}
            </button>
            <button
              onClick={() => setChartMetric('orders')}
              className={`rounded-lg px-3.5 py-1.5 font-bold transition-all ${
                chartMetric === 'orders'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'الطلبات' : 'Orders'}
            </button>
            <button
              onClick={() => setChartMetric('aov')}
              className={`rounded-lg px-3.5 py-1.5 font-bold transition-all ${
                chartMetric === 'aov'
                  ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'متوسط السلة (AOV)' : 'Average Basket'}
            </button>
          </div>
        </div>

        {/* Legend Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
              <span className="font-semibold text-slate-300">{isAr ? 'الأداء الفعلي المعتمد' : 'Audited Actuals'}</span>
            </span>
            <span className="flex items-center gap-2 text-slate-500">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-600"></span>
              <span>{isAr ? 'الفترة السابقة للمقارنة' : 'Benchmark (Prior Period)'}</span>
            </span>
          </div>

          {hoveredIdx !== null && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-bold text-emerald-300">
              {metrics.chartLabels[hoveredIdx]}: {metrics.currentSalesSeries[hoveredIdx]?.toLocaleString()} د.ك • {metrics.currentOrdersSeries[hoveredIdx]?.toLocaleString()} طلب
            </div>
          )}
        </div>

        {/* Large Smooth Curve Area Graph (SVG) */}
        <div className="h-56 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800/80">
          {metrics.chartLabels.map((lbl, idx) => {
            const curVal = chartMetric === 'orders' ? metrics.currentOrdersSeries[idx] : metrics.currentSalesSeries[idx]
            const prevVal = chartMetric === 'orders' ? Math.round(metrics.previousSalesSeries[idx] / 5.5) : metrics.previousSalesSeries[idx]
            const curHeight = Math.max(Math.round((curVal / maxVal) * 100), 12)
            const prevHeight = Math.max(Math.round((prevVal / maxVal) * 100), 8)

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              >
                <div className="w-full flex items-end justify-center gap-2 h-full">
                  {/* Benchmark dashed ghost bar */}
                  <div
                    className="w-2/5 rounded-t-lg bg-slate-800/50 border border-dashed border-slate-700/50 transition-all duration-200 group-hover:bg-slate-700/60"
                    style={{ height: `${prevHeight}%` }}
                    title={`${isAr ? 'السابق:' : 'Previous:'} ${prevVal.toLocaleString()}`}
                  ></div>

                  {/* Active Sales Bar with Glowing Emerald Gradient */}
                  <div
                    className="w-2/5 rounded-t-lg bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all duration-300 group-hover:brightness-125 group-hover:scale-y-[1.03] origin-bottom"
                    style={{ height: `${curHeight}%` }}
                    title={`${lbl} - ${curVal.toLocaleString()} ${chartMetric === 'orders' ? 'طلباً' : 'د.ك'}`}
                  ></div>
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
      {/* 4. CHANNEL DONUT CHART & PROGRESS BARS                                    */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-6 shadow-xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-3.5">
          <div className="flex items-center gap-2.5">
            <Truck size={18} className="text-amber-400" />
            <h3 className="text-base font-black text-white">
              {isAr ? 'توزيع قنوات البيع والمنصات (Channel Donut Chart & Bars)' : 'Channel Donut Chart & Order Breakdown'}
            </h3>
          </div>
          <span className="font-mono text-xs font-bold text-emerald-400">
            167,092.160 {isAr ? 'د.ك' : 'KWD'} (100%)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Visual SVG Donut Chart */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4">
            <div className="relative flex items-center justify-center">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" stroke="#1f2937" strokeWidth="16" fill="transparent" />
                {/* Shop Sales 35.3% */}
                <circle cx="50" cy="50" r="38" stroke="#10b981" strokeWidth="16" strokeDasharray="238.7" strokeDashoffset="0" fill="transparent" />
                {/* Talabat Go 33.3% */}
                <circle cx="50" cy="50" r="38" stroke="#ea580c" strokeWidth="16" strokeDasharray="238.7" strokeDashoffset="-84.2" fill="transparent" />
                {/* Keeta 21.3% */}
                <circle cx="50" cy="50" r="38" stroke="#eab308" strokeWidth="16" strokeDasharray="238.7" strokeDashoffset="-163.7" fill="transparent" />
                {/* Talabat MP 3.9% */}
                <circle cx="50" cy="50" r="38" stroke="#f97316" strokeWidth="16" strokeDasharray="238.7" strokeDashoffset="-214.6" fill="transparent" />
                {/* Deliveroo 3.6% */}
                <circle cx="50" cy="50" r="38" stroke="#06b6d4" strokeWidth="16" strokeDasharray="238.7" strokeDashoffset="-223.9" fill="transparent" />
                {/* Ordable 2.6% */}
                <circle cx="50" cy="50" r="38" stroke="#8b5cf6" strokeWidth="16" strokeDasharray="238.7" strokeDashoffset="-232.5" fill="transparent" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="font-mono text-sm font-black text-white">167K د.ك</span>
                <span className="text-[9px] text-emerald-400 font-bold">11 {isAr ? 'قناة' : 'ch'}</span>
              </div>
            </div>
          </div>

          {/* Detailed Channel Bars (From user specs) */}
          <div className="lg:col-span-8 space-y-3">
            {channels.map((ch, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ch.color }}></span>
                    {isAr ? ch.nameAr : ch.nameEn}
                  </span>
                  <div className="font-mono text-right flex items-center gap-2">
                    <span className="text-white font-extrabold">{ch.kwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك</span>
                    <span className="text-slate-400 font-medium font-sans">({ch.pct}%)</span>
                  </div>
                </div>
                {/* Inline Progress Bar */}
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
      </div>

      {/* ========================================================================= */}
      {/* 5. THE 3 BOTTOM CARDS ON ORDABLE PATTERN                                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: 6 Brands Leaderboard */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-2">
              <Building2 size={17} className="text-blue-400" />
              <h3 className="text-sm font-black text-white">
                {isAr ? 'ترتيب أداء البراندات الـ 6' : '6 Brands Leaderboard'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">100% {isAr ? 'فنتشر فودز' : 'Venture Foods'}</span>
          </div>

          <div className="space-y-2.5">
            {brandsLeaderboard.map((b, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 space-y-1.5 hover:border-slate-700 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-[10px] font-black text-slate-300">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-black text-white">{isAr ? b.nameAr : b.nameEn}</span>
                  </div>
                  <div className="font-mono text-xs font-black text-emerald-400">
                    {b.kwd.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك
                  </div>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                  ></div>
                </div>

                <div className="flex justify-end text-[10px] font-mono text-slate-400">
                  {b.pct}% {isAr ? 'من إجمالي المبيعات' : 'of total sales'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Top Selling Products */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={17} className="text-purple-400" />
              <h3 className="text-sm font-black text-white">
                {isAr ? 'الأصناف الأكثر مبيعاً (Top 6 SKUs)' : 'Top Selling Products'}
              </h3>
            </div>
            <Link href="/reports?tab=products" className="text-xs font-bold text-emerald-400 hover:text-emerald-300">
              {isAr ? '364 صنفاً' : 'All SKUs'}
            </Link>
          </div>

          <div className="space-y-2.5">
            {topProducts.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-black text-purple-400 text-xs">{p.rank}</span>
                  <div>
                    <div className="font-extrabold text-white text-xs">{p.nameAr}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{p.brand} • {p.badge}</div>
                  </div>
                </div>
                <div className="font-mono text-xs font-black text-emerald-400">
                  {p.rev.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} د.ك
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 3: Payments & Top Branches */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl backdrop-blur-xl space-y-4 hover:border-slate-700/80 transition-all">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard size={17} className="text-emerald-400" />
              <h3 className="text-sm font-black text-white">
                {isAr ? 'طرق الدفع وأعلى الفروع' : 'Payments & Top Branches'}
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">{isAr ? 'تسوية البنك الوطني' : 'NBK Gateway'}</span>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block">{isAr ? 'توزيع طرق الدفع:' : 'Tender Types:'}</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {paymentMethods.map((pm, idx) => (
                <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5 space-y-1">
                  <div className="text-[11px] font-bold text-slate-300 truncate">{pm.nameAr}</div>
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="font-black text-white text-xs">{pm.pct}%</span>
                    <span className="text-[10px] text-emerald-400">{pm.kwd.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ك</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pm.pct}%`, backgroundColor: pm.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Branches Mini List */}
          <div className="pt-2 border-t border-slate-800/70 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 block">{isAr ? 'أعلى الفروع مبيعاً:' : 'Top Branches:'}</span>
            {topBranches.slice(0, 3).map((br, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs p-1.5 rounded-lg bg-slate-950/50">
                <span className="text-white font-medium truncate">{br.nameAr}</span>
                <span className="font-mono font-bold text-emerald-400">{br.sales.toLocaleString()} د.ك ({br.share}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. MINIMALIST BOTTOM QUICK NAVIGATION PILLS                               */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/60 p-4 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-slate-400 font-bold">
          {isAr ? 'الوصول السريع إلى الأقسام التشغيلية:' : 'Quick Navigation:'}
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
