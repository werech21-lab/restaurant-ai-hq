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
    peakHoursAr: '8:00 م - 10:30 م (204 طلبات/ساعة)',
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
    peakHoursAr: '7:30 م - 10:00 م (179 طلبات/ساعة)',
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
    chartLabels: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'],
    currentSalesSeries: [4980, 4520, 4610, 4890, 5320, 6890, 7240],
    previousSalesSeries: [4420, 4100, 4180, 4390, 4820, 6100, 6340],
    currentOrdersSeries: [895, 812, 828, 878, 955, 1237, 1307],
    peakHoursAr: 'الخميس والجمعة (7,240 د.ك / 1,307 طلب)',
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
    peakHoursAr: 'عطل نهاية الأسبوع 8:00م - 11:00م (معدل 142 طلب/ساعة)',
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
    peakHoursAr: 'موسم الشتاء وتوسعات الربع الرابع في الكويت',
    peakHoursEn: 'Winter Season & Q4 Peak Expansion in Kuwait',
  },
}

export function AetherBiExecutiveDashboard({
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
      const docDir = document.documentElement.dir
      const stored = (
        localStorage.getItem('aetherbi_locale') ||
        localStorage.getItem('ai-hq-locale') ||
        localStorage.getItem('locale') ||
        localStorage.getItem('lang') ||
        document.cookie
      )?.toLowerCase() || ''
      const sidebarIsEn =
        (document.body?.innerText || '').includes('Executive Dashboard') ||
        (document.body?.innerText || '').includes('China Garden')
      if (docLang === 'en' || docDir === 'ltr' || stored.includes('en') || sidebarIsEn) {
        setCurrentLocale('en')
      } else {
        setCurrentLocale('ar')
      }
    }
    updateFromDoc()
    const observer = new MutationObserver(updateFromDoc)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir', 'class'] })
    window.addEventListener('storage', updateFromDoc)
    window.addEventListener('click', () => setTimeout(updateFromDoc, 50))
    return () => {
      observer.disconnect()
      window.removeEventListener('storage', updateFromDoc)
      window.removeEventListener('click', updateFromDoc)
    }
  }, [])

  const [dateRange, setDateRange] = useState<string>('OCT_2026')
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL')
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  const [chartMetric, setChartMetric] = useState<'sales' | 'orders' | 'aov'>('sales')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const metrics = PERIOD_METRICS[dateRange] || PERIOD_METRICS.OCT_2026

  // Channels Breakdown (Official active Kuwait channels)
  const channels = [
    { nameAr: 'المبيعات المباشرة بالصالات والسفري (Shop Sales)', nameEn: 'Shop Sales (Dine-In/Takeaway)', pct: 35.3, kwd: 58972.250, color: '#10b981' },
    { nameAr: 'طلبات جو (Talabat Go 17%)', nameEn: 'Talabat Go (17%)', pct: 33.3, kwd: 55715.210, color: '#ea580c' },
    { nameAr: 'كيتا (Keeta)', nameEn: 'Keeta Platform', pct: 21.3, kwd: 35607.550, color: '#eab308' },
    { nameAr: 'طلبات ماركت بليس (Talabat TMP 10%)', nameEn: 'Talabat Marketplace (TMP 10%)', pct: 3.9, kwd: 6557.250, color: '#f97316' },
    { nameAr: 'ديليفرو (Deliveroo)', nameEn: 'Deliveroo', pct: 3.6, kwd: 5996.740, color: '#06b6d4' },
    { nameAr: 'الموقع المباشر وجاهز والقنوات الأخرى (Direct Web & Others)', nameEn: 'Direct Web & Others', pct: 2.6, kwd: 4243.160, color: '#8b5cf6' },
  ]

  // The 6 Official Venture Foods Brands (100% real audited totals)
  const brandsLeaderboard = [
    { nameAr: 'تشاينا جاردن (China Garden)', nameEn: 'China Garden', kwd: 141662.650, pct: 84.8, color: '#ef4444' },
    { nameAr: "فرانكس (Frank's)", nameEn: "Frank's", kwd: 16222.260, pct: 9.7, color: '#f59e0b' },
    { nameAr: 'شاورما طحينة (Tahina)', nameEn: 'Tahina', kwd: 4424.850, pct: 2.6, color: '#10b981' },
    { nameAr: 'فارم براون (Farm Brown)', nameEn: 'Farm Brown', kwd: 2661.900, pct: 1.6, color: '#84cc16' },
    { nameAr: 'ذا نودل بار (The Noodle Bar)', nameEn: 'The Noodle Bar', kwd: 1676.950, pct: 1.0, color: '#06b6d4' },
    { nameAr: 'كرك كافتيريا (Karak Cafeteria)', nameEn: 'Karak Cafeteria', kwd: 443.550, pct: 0.3, color: '#8b5cf6' },
  ]

  // Top Menu Performers
  const topProducts = [
    { rank: '#1', nameAr: 'نودلز دجاج (Chicken Noodles)', brand: 'China Garden', rev: 12043.100, badge: '⭐ صنف ذهبي رائد' },
    { rank: '#2', nameAr: 'كومبو دجاج وخضار (Veg/Chicken Combo)', brand: 'China Garden', rev: 9827.300, badge: '📦 عالي الطلب' },
    { rank: '#3', nameAr: 'نودلز خضار (Vegetable Noodles)', brand: 'China Garden', rev: 6652.550, badge: '⭐ صنف ذهبي رائد' },
    { rank: '#4', nameAr: 'لحم منجوليان (Beef Mongolian)', brand: 'China Garden', rev: 5784.900, badge: '💎 واعد عالي الربح' },
    { rank: '#5', nameAr: 'دجاج سويت آند سور (Sweet & Sour)', brand: 'China Garden', rev: 4402.950, badge: '⭐ صنف ذهبي رائد' },
    { rank: '#6', nameAr: "وجبة ستيك فرانكس الخاصة (Frank's Steak)", brand: "Frank's", rev: 3735.810, badge: '⭐ صنف ذهبي رائد' },
  ]

  // Payments & Top Branches (9 Active Branches Only - No Jahra!)
  const paymentMethods = [
    { nameAr: 'كي نت (K-Net Gateway)', pct: 48, kwd: 80204.240, color: '#0284c7' },
    { nameAr: 'أبل باي (Apple Pay)', pct: 24, kwd: 40102.120, color: '#a855f7' },
    { nameAr: 'فيزا وماستركارد (Visa/Master)', pct: 16, kwd: 26734.750, color: '#10b981' },
    { nameAr: 'نقدي بصالات الفروع (Cash)', pct: 12, kwd: 20051.050, color: '#f59e0b' },
  ]

  const topBranches = [
    { nameAr: 'فرع أسواق القرين والمطبخ المركزي', sales: 36400.000, share: 21.8 },
    { nameAr: 'فرع السالمية (شارع سالم المبارك)', sales: 24150.000, share: 14.5 },
    { nameAr: 'فرع العاصمة مول - شرق', sales: 18200.000, share: 10.9 },
    { nameAr: 'فرع 360 مول - الزهراء', sales: 15900.000, share: 9.5 },
    { nameAr: 'فرع الأفنيوز - الري', sales: 13800.000, share: 8.3 },
  ]

  const maxVal = Math.max(...metrics.currentSalesSeries, ...metrics.previousSalesSeries, 1)

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-7 space-y-6"
    >
      {/* 1. TOP BAR: TITLE + STATUS + INTERACTIVE DATE PILLS */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-2xl backdrop-blur-xl transition-all hover:border-slate-700/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                {isAr ? '🟢 الفروع الـ 9 النشطة متصلة · المطبخ المركزي 100%' : '🟢 9 Active Branches Online · Central Kitchen 100%'}
              </span>
              <span className="rounded-full border border-slate-700/50 bg-slate-800/70 px-2.5 py-0.5 text-xs font-mono text-slate-300">
                AetherBI Enterprise Engine v2.6 · Venture Foods
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
              {isAr ? 'لوحة القيادة التنفيذية الذكية | شركة فنتشر فودز' : 'Executive Command Center | Venture Foods W.L.L.'}
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr
                ? 'لوحة القيادة التنفيذية الموحدة AetherBI: 6 براندات رسمية، 9 فروع نشطة + المطبخ المركزي بالقرين، ومبيعات أكتوبر 167,092.160 د.ك'
                : 'Unified AetherBI Command Dashboard: 6 official brands, 9 active branches & October revenue 167,092.160 KWD'}
            </p>
          </div>

          {/* Interactive Date Range Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1 shadow-inner">
              {[
                { id: 'TODAY', labelAr: 'اليوم', labelEn: 'Today' },
                { id: 'YESTERDAY', labelAr: 'أمس', labelEn: 'Yesterday' },
                { id: 'LAST_7D', labelAr: 'آخر 7 أيام', labelEn: 'Last 7D' },
                { id: 'OCT_2026', labelAr: 'أكتوبر 2026 (الفعلي المعتمد)', labelEn: 'Oct 2026 (Audited)' },
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

        {/* Clean Filter Dropdowns Bar (9 Active Branches Only - No Jahra) */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-slate-400 font-semibold">{isAr ? 'نطاق العرض:' : 'Scope Filter:'}</span>

            {/* Brands Dropdown */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">{isAr ? 'جميع البراندات الـ 6 الرسمية' : 'All 6 Official Brands'}</option>
              <option value="CHINA_GARDEN">تشاينا جاردن (China Garden)</option>
              <option value="FRANKS">فرانكس (Frank&apos;s)</option>
              <option value="TAHINA">شاورما طحينة (Tahina)</option>
              <option value="FARM_BROWN">فارم براون (Farm Brown)</option>
              <option value="NOODLE_BAR">ذا نودل بار (The Noodle Bar)</option>
              <option value="KARAK">كرك كافتيريا (Karak Cafeteria)</option>
            </select>

            {/* Branches Dropdown (Strictly 9 active + Central kitchen - NO JAHRA!) */}
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">{isAr ? 'جميع الفروع الـ 9 النشطة + المطبخ المركزي' : 'All 9 Active Branches + Central Kitchen'}</option>
              <option value="SLM">السالمية (Salmiya)</option>
              <option value="QRN">أسواق القرين + المطبخ المركزي (Qurain & CK)</option>
              <option value="ARD">العارضية الحرفية (Ardiya)</option>
              <option value="PRM">بروميناد حولي (Promenade)</option>
              <option value="ASM">العاصمة مول - شرق (Assima Mall)</option>
              <option value="360">360 مول - الزهراء (360 Mall)</option>
              <option value="AVN">الأفنيوز - الري (The Avenues)</option>
              <option value="KOT">الكوت مول - الفحيحيل (Al Kout Mall)</option>
              <option value="FRW">الفروانية (Farwaniya)</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-slate-400">
            <span>
              {isAr ? 'ساعات الذروة التشغيلية:' : 'Peak Rush:'}{' '}
              <strong className="text-amber-400">{isAr ? metrics.peakHoursAr : metrics.peakHoursEn}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 2. THE 4 HERO KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Net Sales */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 shadow-xl transition-all hover:border-slate-700 hover:shadow-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {isAr ? 'صافي المبيعات (Net Sales)' : 'Net Revenue'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl font-mono tracking-tight">
              {metrics.netSales.toLocaleString(undefined, { minimumFractionDigits: 3 })}
            </span>
            <span className="text-xs font-bold text-slate-400">د.ك</span>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono">
              <TrendingUp size={12} className="me-1 inline" />+{metrics.netSalesGrowth}%
            </span>
            <span className="text-slate-400 text-[11px]">{isAr ? 'مقارنة بالفترة السابقة' : 'vs prior period'}</span>
          </div>
        </div>

        {/* Metric 2: Total Orders */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 shadow-xl transition-all hover:border-slate-700 hover:shadow-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {isAr ? 'إجمالي الطلبات (Orders)' : 'Total Orders'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl font-mono tracking-tight">
              {metrics.orders.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400">{isAr ? 'طلباً' : 'orders'}</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 font-mono">
              +{metrics.ordersGrowth}%
            </span>
            <span className="text-[11px]">
              {metrics.deliveryOrders.toLocaleString()} {isAr ? 'توصيل' : 'dlv'} · {metrics.pickupOrders.toLocaleString()} {isAr ? 'استلام' : 'pick'}
            </span>
          </div>
        </div>

        {/* Metric 3: Average Order Value */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 shadow-xl transition-all hover:border-slate-700 hover:shadow-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {isAr ? 'متوسط قيمة الطلب (AOV)' : 'Average Order (AOV)'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Percent size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl font-mono tracking-tight">
              {metrics.aov.toFixed(3)}
            </span>
            <span className="text-xs font-bold text-slate-400">د.ك</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20 font-mono">
              +{metrics.aovGrowth}%
            </span>
            <span className="text-[11px]">
              {metrics.itemsPerBasket} {isAr ? 'صنف/سلة' : 'items/basket'}
            </span>
          </div>
        </div>

        {/* Metric 4: Net Payout */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#111827] to-[#0f172a] p-5 shadow-xl transition-all hover:border-slate-700 hover:shadow-2xl">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {isAr ? 'صافي التحويل البنكي (Net Payout)' : 'Net Bank Payout'}
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white sm:text-3xl font-mono tracking-tight">
              {metrics.netPayout.toLocaleString(undefined, { minimumFractionDigits: 3 })}
            </span>
            <span className="text-xs font-bold text-slate-400">د.ك</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-mono">
              +{metrics.payoutGrowth}%
            </span>
            <span className="text-[11px] text-slate-400">
              {isAr ? `تكلفة الطعام: ${metrics.foodCostPct}%` : `Food Cost: ${metrics.foodCostPct}%`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. MAIN SMOOTH AREA & VELOCITY CHART */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h2 className="text-lg font-black text-white">
              {isAr ? 'مخطط AetherBI الموجي لمبيعات وحركة الطلبات' : 'AetherBI Smooth Revenue & Orders Trendline'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr
                ? 'تحليل الاتجاه والسرعة التشغيلية مقارنة بالفترة السابقة بالتزامن مع ساعات الذروة'
                : 'Trendline velocity & revenue run rate comparing current vs prior cycle'}
            </p>
          </div>

          {/* Metric Selector Toggle */}
          <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1">
            {[
              { id: 'sales', labelAr: 'المبيعات (د.ك)', labelEn: 'Sales (KWD)' },
              { id: 'orders', labelAr: 'الطلبات', labelEn: 'Orders' },
              { id: 'aov', labelAr: 'متوسط الفاتورة', labelEn: 'AOV' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setChartMetric(btn.id as any)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  chartMetric === btn.id
                    ? 'bg-emerald-500 text-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isAr ? btn.labelAr : btn.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Smooth SVG Area Chart */}
        <div className="relative mt-6 h-64 w-full">
          <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 220">
            <defs>
              <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Horizontal Lines */}
            {[0, 55, 110, 165, 220].map((y) => (
              <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="#1f2937" strokeWidth="1" strokeDasharray="3 3" />
            ))}

            {/* Prior Period Dotted Reference Line */}
            <path
              d={metrics.previousSalesSeries
                .map((val, idx) => {
                  const x = (idx / (metrics.previousSalesSeries.length - 1)) * 800
                  const y = 200 - (val / maxVal) * 180
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                })
                .join(' ')}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              strokeDasharray="4 4"
            />

            {/* Current Period Area */}
            <path
              d={
                metrics.currentSalesSeries
                  .map((val, idx) => {
                    const x = (idx / (metrics.currentSalesSeries.length - 1)) * 800
                    const y = 200 - (val / maxVal) * 180
                    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                  })
                  .join(' ') + ` L 800 220 L 0 220 Z`
              }
              fill="url(#emeraldGradient)"
            />

            {/* Current Period Thick Stroke */}
            <path
              d={metrics.currentSalesSeries
                .map((val, idx) => {
                  const x = (idx / (metrics.currentSalesSeries.length - 1)) * 800
                  const y = 200 - (val / maxVal) * 180
                  return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
                })
                .join(' ')}
              fill="none"
              stroke="#10b981"
              strokeWidth="3.5"
            />

            {/* Data Dots & Interactive Hover */}
            {metrics.currentSalesSeries.map((val, idx) => {
              const x = (idx / (metrics.currentSalesSeries.length - 1)) * 800
              const y = 200 - (val / maxVal) * 180
              const isHovered = hoveredIdx === idx
              return (
                <g key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 7 : 4}
                    fill={isHovered ? '#34d399' : '#10b981'}
                    stroke="#090d16"
                    strokeWidth="2"
                    className="cursor-pointer transition-all duration-200"
                  />
                  {isHovered && (
                    <g>
                      <rect
                        x={Math.max(10, Math.min(x - 60, 680))}
                        y={Math.max(10, y - 48)}
                        width="120"
                        height="40"
                        rx="8"
                        fill="#0f172a"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                      <text
                        x={Math.max(10, Math.min(x - 60, 680)) + 60}
                        y={Math.max(10, y - 48) + 16}
                        fill="#94a3b8"
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {metrics.chartLabels[idx]}
                      </text>
                      <text
                        x={Math.max(10, Math.min(x - 60, 680)) + 60}
                        y={Math.max(10, y - 48) + 32}
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {val.toLocaleString()} د.ك
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Chart X-Axis Labels */}
        <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          {metrics.chartLabels.map((lbl, i) => (
            <span key={i} className={hoveredIdx === i ? 'text-emerald-400 font-bold' : ''}>
              {lbl}
            </span>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-white font-semibold">{isAr ? 'الفترة الحالية (الفعلي)' : 'Current Period'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400 inline-block"></span>
              <span>{isAr ? 'الفترة السابقة للمقارنة' : 'Prior Period'}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {isAr ? `إجمالي حركات الفترة: ${metrics.itemsSold.toLocaleString()} صنف مباع` : `Total Units: ${metrics.itemsSold.toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* 4. VISUAL BREAKDOWN GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* CARD A: CHANNELS BREAKDOWN */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr ? 'توزيع المبيعات عبر قنوات التوصيل والصالات' : 'Sales by Order Channel & Aggregators'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'فصل دقيق بين مبيعات الصالات والتوصيل المباشر ومنصات التوصيل' : 'Segregation between direct stores, Talabat (TGO vs TMP), Keeta & Deliveroo'}
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-mono text-emerald-400 font-bold">
              100%
            </span>
          </div>

          {/* Unified Channel Proportion Bar */}
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
            {channels.map((ch, idx) => (
              <div
                key={idx}
                style={{ width: `${ch.pct}%`, backgroundColor: ch.color }}
                className="h-full transition-all duration-300 hover:opacity-80"
                title={`${isAr ? ch.nameAr : ch.nameEn}: ${ch.pct}%`}
              />
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {channels.map((ch, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                  <span className="font-semibold text-slate-200 truncate">{isAr ? ch.nameAr : ch.nameEn}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono">
                  <span className="text-slate-400">{ch.kwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</span>
                  <span className="font-bold text-white w-12 text-end">{ch.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD B: BRANDS LEADERBOARD */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr ? 'ترتيب البراندات الـ 6 الرسمية حسب المبيعات' : 'Official 6 Brands Performance Leaderboard'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'تشاينا جاردن تتصدر بنسبة 84.8% تليها فرانكس وطحينة' : 'China Garden leads with 84.8% followed by Frank\'s, Tahina, and Farm Brown'}
              </p>
            </div>
            <Link
              href="/sales"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              <span>{isAr ? 'تفاصيل المبيعات' : 'Sales Details'}</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mt-4 space-y-3.5">
            {brandsLeaderboard.map((b, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">{isAr ? b.nameAr : b.nameEn}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-300 font-bold">{b.kwd.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</span>
                    <span className="text-slate-400 w-12 text-end font-semibold">{b.pct}%</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                    className="h-full rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. BOTTOM 3 INSIGHT CARDS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* CARD 1: BEST SELLERS */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Flame size={16} className="text-amber-400" />
              <span>{isAr ? 'الأصناف الأكثر مبيعاً' : 'Best Selling Items'}</span>
            </h3>
            <span className="text-[11px] text-slate-400">{isAr ? 'أكتوبر 2026' : 'Oct 2026'}</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-900/60 p-2.5 text-xs">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400 text-xs">{p.rank}</span>
                  <div className="truncate">
                    <div className="font-bold text-white truncate">{p.nameAr}</div>
                    <span className="text-[10px] text-slate-400">{p.brand}</span>
                  </div>
                </div>
                <div className="text-end font-mono shrink-0">
                  <div className="font-bold text-white">{p.rev.toLocaleString(undefined, { minimumFractionDigits: 3 })} د.ك</div>
                  <span className="text-[10px] text-amber-400 font-sans">{p.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2: TOP PERFORMING BRANCHES (9 Active Branches Only) */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Building2 size={16} className="text-blue-400" />
              <span>{isAr ? 'الفروع الأعلى أداءً في الكويت' : 'Top Kuwait Branches'}</span>
            </h3>
            <span className="text-[11px] text-emerald-400 font-bold">{isAr ? '9 فروع نشطة' : '9 Active Stores'}</span>
          </div>
          <div className="mt-3 space-y-3">
            {topBranches.map((br, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{br.nameAr}</span>
                  <span className="font-mono text-emerald-400 font-bold">{br.sales.toLocaleString()} د.ك</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    style={{ width: `${(br.share / 25) * 100}%` }}
                    className="h-full rounded-full bg-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 3: PAYMENT GATEWAYS BREAKDOWN */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CreditCard size={16} className="text-purple-400" />
              <span>{isAr ? 'طرق الدفع والتسويات البنكية' : 'Payment Methods Breakdown'}</span>
            </h3>
            <span className="text-[11px] text-slate-400">{isAr ? 'NBK + K-Net' : 'NBK / K-Net'}</span>
          </div>
          <div className="mt-3 space-y-3">
            {paymentMethods.map((pm, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pm.color }} />
                    <span className="font-bold text-slate-200">{pm.nameAr}</span>
                  </div>
                  <span className="font-mono text-slate-300 font-bold">{pm.pct}% ({pm.kwd.toLocaleString()} د.ك)</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    style={{ width: `${pm.pct}%`, backgroundColor: pm.color }}
                    className="h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>{isAr ? 'فترة التسوية في بنك الكويت الوطني:' : 'NBK Clearing Cycle:'}</span>
              <strong className="text-emerald-400 font-mono">T + 1 (24 Hours)</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>{isAr ? 'مطابقة الكاش اليومية بالخزينة:' : 'Daily Safe Cash Recon:'}</span>
              <strong className="text-white font-mono">100% Balanced</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
