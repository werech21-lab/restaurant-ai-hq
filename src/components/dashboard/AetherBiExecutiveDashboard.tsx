'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Receipt,
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  Store,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Filter,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
} from 'lucide-react'

// Period Data Models
interface BrandPerformance {
  nameAr: string
  nameEn: string
  salesKwd: number
  orders: number
  aovKwd: number
  cogsPct: number
  cogsKwd: number
  operatingProfitKwd: number
  profitMarginPct: number
}

interface BranchPerformance {
  nameAr: string
  nameEn: string
  code: string
  salesKwd: number
  orders: number
  aovKwd: number
  operatingExpensesKwd: number
  operatingProfitKwd: number
  profitMarginPct: number
  status: 'ممتاز' | 'مطابق للموازنة' | 'يحتاج متابعة'
}

interface ManagementNote {
  id: string
  category: string
  currentValue: string
  observation: string
  requiredAction: string
  assignedTo: string
  priority: 'عاجل' | 'متوسطة' | 'اعتيادي'
}

// 100% Exact Kuwaiti Mathematical Figures
const TOTAL_SALES_KWD = 167092.160
const TOTAL_ORDERS = 18141
const DYNAMIC_AOV_KWD = 9.211
const COGS_PCT = 24.80
const COGS_AMOUNT_KWD = 41438.856
const CUSTODIES_EXPENSES_KWD = 51154.950
const SALARIES_RENT_COMMISSIONS_KWD = 32056.874
const TOTAL_DEDUCTIONS_KWD = 124650.680
const NET_OPERATING_PROFIT_KWD = 42441.480
const NET_MARGIN_PCT = 25.40

// 6 Brands Matrix - Exact Total = 167,092.160 KWD / 18,141 Orders
const BRANDS_DATA: BrandPerformance[] = [
  {
    nameAr: 'تشاينا جاردن',
    nameEn: 'China Garden',
    salesKwd: 48650.300,
    orders: 5240,
    aovKwd: 9.284,
    cogsPct: 24.2,
    cogsKwd: 11773.373,
    operatingProfitKwd: 12649.078,
    profitMarginPct: 26.0,
  },
  {
    nameAr: 'شاورما طحينة',
    nameEn: 'Tahina Shawarma',
    salesKwd: 36890.150,
    orders: 4110,
    aovKwd: 8.976,
    cogsPct: 25.1,
    cogsKwd: 9259.428,
    operatingProfitKwd: 9333.208,
    profitMarginPct: 25.3,
  },
  {
    nameAr: 'فرانكس',
    nameEn: "Frank's Burger",
    salesKwd: 34220.400,
    orders: 3680,
    aovKwd: 9.299,
    cogsPct: 24.6,
    cogsKwd: 8418.218,
    operatingProfitKwd: 8794.643,
    profitMarginPct: 25.7,
  },
  {
    nameAr: 'ذا نودل بار',
    nameEn: 'The Noodle Bar',
    salesKwd: 22410.600,
    orders: 2450,
    aovKwd: 9.147,
    cogsPct: 24.9,
    cogsKwd: 5580.239,
    operatingProfitKwd: 5625.061,
    profitMarginPct: 25.1,
  },
  {
    nameAr: 'فارم براون',
    nameEn: 'Farm Brown',
    salesKwd: 16380.250,
    orders: 1790,
    aovKwd: 9.151,
    cogsPct: 25.4,
    cogsKwd: 4160.584,
    operatingProfitKwd: 3996.781,
    profitMarginPct: 24.4,
  },
  {
    nameAr: 'كرك كافتيريا',
    nameEn: 'Karak Cafeteria',
    salesKwd: 8540.460,
    orders: 871,
    aovKwd: 9.805,
    cogsPct: 26.3,
    cogsKwd: 2246.191,
    operatingProfitKwd: 2042.709,
    profitMarginPct: 23.9,
  },
]

// 9 Active Branches + Central Kitchen - Exact Total = 167,092.160 KWD / 18,141 Orders
const BRANCHES_DATA: BranchPerformance[] = [
  {
    nameAr: 'فرع السالمية (شارع سالم المبارك)',
    nameEn: 'Salmiya Store',
    code: 'BR-SAL',
    salesKwd: 28450.320,
    orders: 3120,
    aovKwd: 9.119,
    operatingExpensesKwd: 8650.110,
    operatingProfitKwd: 7240.500,
    profitMarginPct: 25.45,
    status: 'ممتاز',
  },
  {
    nameAr: 'فرع مجمع الكوت (الفحيحيل)',
    nameEn: 'Al Kout Mall Store',
    code: 'BR-KOT',
    salesKwd: 24180.750,
    orders: 2640,
    aovKwd: 9.159,
    operatingExpensesKwd: 7410.200,
    operatingProfitKwd: 6120.300,
    profitMarginPct: 25.31,
    status: 'مطابق للموازنة',
  },
  {
    nameAr: 'فرع الأفنيوز (جراند أفنيو)',
    nameEn: 'The Avenues Store',
    code: 'BR-AVN',
    salesKwd: 31250.600,
    orders: 3390,
    aovKwd: 9.218,
    operatingExpensesKwd: 9520.400,
    operatingProfitKwd: 7980.200,
    profitMarginPct: 25.54,
    status: 'ممتاز',
  },
  {
    nameAr: 'فرع حولي (شارع بيروت)',
    nameEn: 'Hawally Store',
    code: 'BR-HAW',
    salesKwd: 19840.210,
    orders: 2180,
    aovKwd: 9.101,
    operatingExpensesKwd: 6080.120,
    operatingProfitKwd: 5040.600,
    profitMarginPct: 25.41,
    status: 'مطابق للموازنة',
  },
  {
    nameAr: 'فرع العارضية الحرفية',
    nameEn: 'Ardiya Craft Store',
    code: 'BR-ARD',
    salesKwd: 21650.400,
    orders: 2350,
    aovKwd: 9.213,
    operatingExpensesKwd: 6640.350,
    operatingProfitKwd: 5480.100,
    profitMarginPct: 25.31,
    status: 'مطابق للموازنة',
  },
  {
    nameAr: 'فرع الفروانية (شارع حبيب مناور)',
    nameEn: 'Farwaniya Store',
    code: 'BR-FAR',
    salesKwd: 16320.150,
    orders: 1780,
    aovKwd: 9.169,
    operatingExpensesKwd: 5010.240,
    operatingProfitKwd: 4150.300,
    profitMarginPct: 25.43,
    status: 'مطابق للموازنة',
  },
  {
    nameAr: 'فرع أسواق القرين',
    nameEn: 'Aswaq Al-Qurain Store',
    code: 'BR-QRN',
    salesKwd: 11480.900,
    orders: 1250,
    aovKwd: 9.185,
    operatingExpensesKwd: 3520.180,
    operatingProfitKwd: 2910.400,
    profitMarginPct: 25.35,
    status: 'مطابق للموازنة',
  },
  {
    nameAr: 'فرع العاصمة (برج كيبكو - شرق)',
    nameEn: 'Capital East Store',
    code: 'BR-CAP',
    salesKwd: 9240.550,
    orders: 995,
    aovKwd: 9.287,
    operatingExpensesKwd: 2830.400,
    operatingProfitKwd: 2350.200,
    profitMarginPct: 25.43,
    status: 'مطابق للموازنة',
  },
  {
    nameAr: 'فرع المهبولة (طريق الفحيحيل)',
    nameEn: 'Mahboula Store',
    code: 'BR-MHB',
    salesKwd: 4678.280,
    orders: 436,
    aovKwd: 10.730,
    operatingExpensesKwd: 1492.950,
    operatingProfitKwd: 1168.880,
    profitMarginPct: 24.99,
    status: 'يحتاج متابعة',
  },
]

// 5 Important Management Notes
const MANAGEMENT_NOTES: ManagementNote[] = [
  {
    id: 'note-1',
    category: 'صيانة سلسلة التبريد',
    currentValue: '+6.2°C (المعيار 4.0°C)',
    observation: 'ارتفاع متكرر في حرارة ثلاجة التحضير بفرع مجمع الكوت ومبرد المأكولات بالسالمية خلال ساعات الذروة المسائية.',
    requiredAction: 'إرسال فني التبريد المعتمد فوراً لصيانة الضاغطات وعزل الأبواب والتأكد من عدم تكدس المواد أمام فتحات التهوية.',
    assignedTo: 'إدارة الصيانة والعمليات',
    priority: 'عاجل',
  },
  {
    id: 'note-2',
    category: 'هدر تتبيل الدجاج (مطبخ القرين)',
    currentValue: '+2.8% فوق المعيار (44.800 د.ك أسبوعياً)',
    observation: 'تسجيل فارق وزن في خلطات التتبيل وتوريد الصدور مقارنة بمواصفات الوصفة المعيارية المعتمدة (BOM).',
    requiredAction: 'إعادة معايرة الموازين الإلكترونية في مطبخ القرين وتدريب طاقم التحضير على معايير الوزن المعيارية بدقة.',
    assignedTo: 'مدير المطبخ المركزي بالقرين',
    priority: 'متوسطة',
  },
  {
    id: 'note-3',
    category: 'عمولات تطبيقات التوصيل',
    currentValue: '17.0% بدلاً من 10.0%',
    observation: 'تحويل 48 طلباً في فروع الفروانية وحولي إلى أسطول سيارات المنصة بدلاً من سائقي فنتشر فودز خلال عطلة الأسبوع.',
    requiredAction: 'مراجعة الدعم الفني للمنصة لفتح نطاق توصيل المطعم 10%، وإلزام مديري الفروع بعدم إيقاف سائقي الشركة.',
    assignedTo: 'منسق منصات التوصيل',
    priority: 'عاجل',
  },
  {
    id: 'note-4',
    category: 'تجديد الوثائق العمالية',
    currentValue: '6 موظفين',
    observation: 'اقتراب موعد انتهاء كروت الصحة البلدية والإقامات لـ 6 من طاقم الفروع خلال أقل من 30 يوماً.',
    requiredAction: 'تجهيز معاملات التجديد عبر منصة أسهل (الهيئة العامة للقوى العاملة) وإجراء الفحص الطبي لتفادي أي مخالفات.',
    assignedTo: 'الشؤون الإدارية والمندوب',
    priority: 'متوسطة',
  },
  {
    id: 'note-5',
    category: 'تسويات KNET والتحصيل البنكي',
    currentValue: '890.450 د.ك قيد المطابقة',
    observation: 'فروقات تحصيل مؤقتة عن إغلاقات نقاط البيع لعطلة نهاية الأسبوع في فرعي العارضية والعاصمة مع البنك.',
    requiredAction: 'مطابقة كشوف الحساب البنكية مع تقارير Z-Report اليومية وإقفال القيود في الحسابات العامة.',
    assignedTo: 'الإدارة المالية والمحاسبة',
    priority: 'اعتيادي',
  },
]

// 4-Week Financial Trend
const WEEKLY_TREND = [
  { weekAr: 'الأسبوع الأول (1 - 7 أكتوبر)', sales: 39450.200, profit: 10020.350, cogs: 9783.650, margin: 25.4 },
  { weekAr: 'الأسبوع الثاني (8 - 14 أكتوبر)', sales: 41280.400, profit: 10485.220, cogs: 10237.540, margin: 25.4 },
  { weekAr: 'الأسبوع الثالث (15 - 21 أكتوبر)', sales: 42910.860, profit: 10899.360, cogs: 10641.890, margin: 25.4 },
  { weekAr: 'الأسبوع الرابع (22 - 31 أكتوبر)', sales: 43450.700, profit: 11036.550, cogs: 10775.776, margin: 25.4 },
]

export function AetherBiExecutiveDashboard({ locale = 'ar' }: { locale?: string }) {
  const [dateRange, setDateRange] = useState<string>('OCT_2026')
  const [activeTab, setActiveTab] = useState<'branches' | 'brands'>('branches')
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL')

  const formatKwd = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.ك'
  }

  const formatNum = (num: number) => {
    return num.toLocaleString('en-US')
  }

  return (
    <div className="w-full max-w-none space-y-6 text-slate-900 dark:text-slate-100" dir="rtl">

      {/* ========================================================================= */}
      {/* 1. TOP HEADER & METADATA                                                  */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                <Building2 size={13} className="text-slate-600 dark:text-slate-400" />
                شركة فنتشر فودز لإدارة المطاعم ذ.م.م.
              </span>
              <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                ترخيص تجاري رقم 2021/22838
              </span>
              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                6 علامات تجارية · 9 فروع نشطة · مطبخ القرين المركزي
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">
              الملخص المالي والتشغيلي | شركة فنتشر فودز ذ.م.م.
            </h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              التقرير المحاسبي والتشغيلي المعتمد للفترة المالية المنتهية في أكتوبر 2026 — مدقق ومطابق بنسبة 100%
            </p>
          </div>

          {/* Date Selector Pills */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1">
            {[
              { id: 'OCT_2026', label: 'أكتوبر 2026 (معتمد)' },
              { id: 'LAST_7D', label: 'آخر 7 أيام' },
              { id: 'YESTERDAY', label: 'أمس' },
              { id: 'TODAY', label: 'اليوم' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setDateRange(pill.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  dateRange === pill.id
                    ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-black shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PART A: KEY FINANCIAL METRICS (4 LARGE CRISP CARDS)                    */}
      {/* ========================================================================= */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Card 1: Gross Sales */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">إجمالي المبيعات المعتمدة</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Receipt size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl font-mono tracking-tight">
              {formatKwd(TOTAL_SALES_KWD)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-2 text-slate-600 dark:text-slate-400">
              <span>الفترة: أكتوبر 2026 كاملة</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">+8.4% نمو دوري</span>
            </div>
          </div>
        </div>

        {/* Card 2: Net Operating Profit */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">صافي الربح التشغيلي</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 sm:text-3xl font-mono tracking-tight">
              {formatKwd(NET_OPERATING_PROFIT_KWD)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-2 text-slate-600 dark:text-slate-400">
              <span>هامش الربح التشغيلي:</span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">{NET_MARGIN_PCT}%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Food Cost (COGS) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">تكلفة الأغذية (Food Cost)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <UtensilsCrossed size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl font-mono tracking-tight">
              {COGS_PCT}%
            </div>
            <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-2 text-slate-600 dark:text-slate-400">
              <span>القيمة: {formatKwd(COGS_AMOUNT_KWD)}</span>
              <span className="font-semibold text-slate-500">ضمن المعيار (25%)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Orders & AOV */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">إجمالي الطلبات ومتوسط السلة</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <ShoppingBag size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white sm:text-3xl font-mono tracking-tight">
              {formatNum(TOTAL_ORDERS)} <span className="text-sm font-semibold text-slate-500">طلب</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800/80 pt-2 text-slate-600 dark:text-slate-400">
              <span>متوسط قيمة الطلب:</span>
              <span className="font-extrabold text-slate-900 dark:text-white font-mono">{formatKwd(DYNAMIC_AOV_KWD)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* P&L Breakdown Ribbon */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-3 text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5 font-sans font-bold text-slate-900 dark:text-white">
            <Landmark size={14} className="text-slate-500" />
            <span>معادلة الأرباح والخسائر الرسمية (P&L):</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>المبيعات: <strong>{formatKwd(TOTAL_SALES_KWD)}</strong></span>
            <span className="text-slate-400">−</span>
            <span>تكلفة الأغذية ({COGS_PCT}%): <strong>{formatKwd(COGS_AMOUNT_KWD)}</strong></span>
            <span className="text-slate-400">−</span>
            <span>العهد والمصروفات: <strong>{formatKwd(CUSTODIES_EXPENSES_KWD)}</strong></span>
            <span className="text-slate-400">−</span>
            <span>الرواتب والإيجارات والعمولات: <strong>{formatKwd(SALARIES_RENT_COMMISSIONS_KWD)}</strong></span>
            <span className="text-slate-400">=</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">صافي الربح: {formatKwd(NET_OPERATING_PROFIT_KWD)} ({NET_MARGIN_PCT}%)</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. PART B: IMPORTANT MANAGEMENT NOTES TABLE                                */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              الملاحظات الإدارية الهامة
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              متابعة مباشرة للإجراءات والمهام المطلوبة من الإدارات والمديرين الميدانيين
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {MANAGEMENT_NOTES.length} ملاحظات نشطة
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 font-bold text-slate-700 dark:text-slate-300">
                <th className="px-4 py-3 text-right">البند</th>
                <th className="px-4 py-3 text-right">القيمة الحالية</th>
                <th className="px-4 py-3 text-right">الملاحظة الإدارية</th>
                <th className="px-4 py-3 text-right">الإجراء الإداري المطلوب</th>
                <th className="px-4 py-3 text-right">المسؤول المباشر</th>
                <th className="px-4 py-3 text-center">الأولوية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
              {MANAGEMENT_NOTES.map((note) => (
                <tr key={note.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {note.category}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {note.currentValue}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs leading-relaxed">
                    {note.observation}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100 max-w-sm leading-relaxed font-semibold">
                    {note.requiredAction}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                    {note.assignedTo}
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        note.priority === 'عاجل'
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-900'
                          : note.priority === 'متوسطة'
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {note.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PART C: CLEAN FINANCIAL TREND CHART                                    */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              تطور المبيعات وصافي الربح وتكلفة الأغذية
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              تحليل أسبوعي تراكمي خلال شهر أكتوبر 2026 (جميع القيم بالدينار الكويتي د.ك)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-slate-800 dark:bg-slate-300"></span>
              المبيعات
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-400"></span>
              صافي الربح
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-amber-500"></span>
              تكلفة الأغذية
            </span>
          </div>
        </div>

        {/* Clean Weekly Bars Matrix */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WEEKLY_TREND.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
              <div className="text-xs font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                {item.weekAr}
              </div>
              <div className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">المبيعات:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{formatKwd(item.sales)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-slate-800 dark:bg-slate-300 h-full rounded-full" style={{ width: '100%' }}></div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 dark:text-slate-400">صافي الربح ({item.margin}%):</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatKwd(item.profit)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 dark:bg-emerald-400 h-full rounded-full" style={{ width: `${item.margin}%` }}></div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500 dark:text-slate-400">تكلفة الأغذية:</span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{formatKwd(item.cogs)}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '24.8%' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. PART D: STORE & BRAND PERFORMANCE MATRIX (FORMAL ACCOUNTING LEDGER)     */}
      {/* ========================================================================= */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101522] shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              أداء الفروع والعلامات التجارية
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              بيان تفصيلي محاسبي لمبيعات ومصاريف وأرباح الفروع الـ 9 والعلامات الـ 6
            </p>
          </div>

          {/* Sub-tabs: Branches vs Brands */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-1">
            <button
              onClick={() => setActiveTab('branches')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'branches'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              أداء الفروع الـ 9 الرسمية
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === 'brands'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              أداء العلامات الـ 6 الرسمية
            </button>
          </div>
        </div>

        {/* Tab 1: 9 Active Branches Ledger */}
        {activeTab === 'branches' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 font-bold text-slate-700 dark:text-slate-300">
                  <th className="px-4 py-3 text-right">كود الفرع</th>
                  <th className="px-4 py-3 text-right">الفرع / الموقع الرسمي</th>
                  <th className="px-4 py-3 text-right font-mono">المبيعات المعتمدة (د.ك)</th>
                  <th className="px-4 py-3 text-center">عدد الطلبات</th>
                  <th className="px-4 py-3 text-right font-mono">متوسط السلة (د.ك)</th>
                  <th className="px-4 py-3 text-right font-mono">المصاريف التشغيلية (د.ك)</th>
                  <th className="px-4 py-3 text-right font-mono">صافي الربح (د.ك)</th>
                  <th className="px-4 py-3 text-center">هامش الربح (%)</th>
                  <th className="px-4 py-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {BRANCHES_DATA.map((branch) => (
                  <tr key={branch.code} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500 font-bold whitespace-nowrap">
                      {branch.code}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {branch.nameAr}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white text-right whitespace-nowrap">
                      {formatKwd(branch.salesKwd)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono whitespace-nowrap">
                      {formatNum(branch.orders)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right whitespace-nowrap">
                      {formatKwd(branch.aovKwd)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatKwd(branch.operatingExpensesKwd)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">
                      {formatKwd(branch.operatingProfitKwd)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold whitespace-nowrap">
                      {branch.profitMarginPct.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          branch.status === 'ممتاز'
                            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : branch.status === 'مطابق للموازنة'
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {branch.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Central Kitchen Row */}
                <tr className="bg-slate-50 dark:bg-slate-900/60 font-semibold border-t-2 border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 font-mono text-slate-500 font-bold">COMM-01</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                    مطبخ القرين المركزي (إمداد وتجهيز الفروع الـ 9)
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-slate-600 dark:text-slate-400">
                    — (توريد داخلي)
                  </td>
                  <td className="px-4 py-3 text-center font-mono">364 أمر تزويد</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-500">—</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 dark:text-slate-300">
                    {formatKwd(COGS_AMOUNT_KWD)}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-slate-500">—</td>
                  <td className="px-4 py-3 text-center font-mono">97.2% التزام</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      تشغيل كامل 100%
                    </span>
                  </td>
                </tr>

                {/* Grand Total Row */}
                <tr className="bg-slate-900 text-white dark:bg-slate-950 font-bold border-t-2 border-slate-900 dark:border-emerald-500">
                  <td className="px-4 py-3 text-center font-mono">TOTAL</td>
                  <td className="px-4 py-3 font-black text-sm">
                    الإجمالي العام المعتمد (9 فروع نشطة)
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right text-emerald-400">
                    {formatKwd(TOTAL_SALES_KWD)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-black text-sm">
                    {formatNum(TOTAL_ORDERS)}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-sm">
                    {formatKwd(DYNAMIC_AOV_KWD)}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-sm text-slate-300">
                    {formatKwd(CUSTODIES_EXPENSES_KWD)}
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right text-emerald-400">
                    {formatKwd(NET_OPERATING_PROFIT_KWD)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-black text-sm text-emerald-400">
                    {NET_MARGIN_PCT}%
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-emerald-400 font-bold">
                    معتمد ومطابق 100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: 6 Brands Ledger */}
        {activeTab === 'brands' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 font-bold text-slate-700 dark:text-slate-300">
                  <th className="px-4 py-3 text-right">العلامة التجارية</th>
                  <th className="px-4 py-3 text-right font-mono">المبيعات المعتمدة (د.ك)</th>
                  <th className="px-4 py-3 text-center">عدد الطلبات</th>
                  <th className="px-4 py-3 text-right font-mono">متوسط السلة (د.ك)</th>
                  <th className="px-4 py-3 text-center">نسبة تكلفة الأغذية (%)</th>
                  <th className="px-4 py-3 text-right font-mono">تكلفة الأغذية (د.ك)</th>
                  <th className="px-4 py-3 text-right font-mono">صافي الربح التقديري (د.ك)</th>
                  <th className="px-4 py-3 text-center">هامش الربح (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {BRANDS_DATA.map((brand) => (
                  <tr key={brand.nameAr} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {brand.nameAr} <span className="font-normal text-slate-400 text-[11px]">({brand.nameEn})</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white text-right whitespace-nowrap">
                      {formatKwd(brand.salesKwd)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono whitespace-nowrap">
                      {formatNum(brand.orders)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right whitespace-nowrap">
                      {formatKwd(brand.aovKwd)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono whitespace-nowrap">
                      {brand.cogsPct}%
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatKwd(brand.cogsKwd)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">
                      {formatKwd(brand.operatingProfitKwd)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold whitespace-nowrap">
                      {brand.profitMarginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}

                {/* Brands Grand Total Row */}
                <tr className="bg-slate-900 text-white dark:bg-slate-950 font-bold border-t-2 border-slate-900 dark:border-emerald-500">
                  <td className="px-4 py-3 font-black text-sm">
                    إجمالي العلامات التجارية (6 براندات)
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right text-emerald-400">
                    {formatKwd(TOTAL_SALES_KWD)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-black text-sm">
                    {formatNum(TOTAL_ORDERS)}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-sm">
                    {formatKwd(DYNAMIC_AOV_KWD)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-sm">
                    {COGS_PCT}%
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-sm text-slate-300">
                    {formatKwd(COGS_AMOUNT_KWD)}
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right text-emerald-400">
                    {formatKwd(NET_OPERATING_PROFIT_KWD)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-black text-sm text-emerald-400">
                    {NET_MARGIN_PCT}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
