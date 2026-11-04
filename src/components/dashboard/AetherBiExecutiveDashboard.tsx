'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Receipt,
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  Building2,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronDown,
  Layers,
  Store,
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

  const formatKwd = (amount: number) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' د.ك'
  }

  const formatNum = (num: number) => {
    return num.toLocaleString('en-US')
  }

  return (
    <div className="w-full max-w-none space-y-10 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">

      {/* ========================================================================= */}
      {/* 1. DIYAR HERO BANNER: ROYAL NAVY GRADIENT & SKY GLOW                      */}
      {/* ========================================================================= */}
      <div className="diyar-hero-header rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden">
        {/* Subtle Tech Grid Background Overlay */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38BDF8 1px, transparent 1px), radial-gradient(#38BDF8 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[#BAE6FD]">
            <Building2 size={13} className="text-[#38BDF8]" />
            <span>شركة فنتشر فودز لإدارة المطاعم ذ.م.م. (ترخيص 2021/22838)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-sans">
            الملخص المالي والتشغيلي
          </h1>

          <p className="text-base sm:text-lg font-normal text-[#E2E8F0] max-w-2xl mx-auto leading-relaxed">
            التقرير المالي والتشغيلي المعتمد لفترة أكتوبر 2026 — 6 علامات تجارية و9 فروع نشطة ومطبخ القرين المركزي
          </p>

          {/* Centered Pill Buttons for Period Selection */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {[
              { id: 'OCT_2026', label: 'أكتوبر 2026 (معتمد)' },
              { id: 'LAST_7D', label: 'آخر 7 أيام' },
              { id: 'YESTERDAY', label: 'أمس' },
              { id: 'TODAY', label: 'اليوم' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setDateRange(pill.id)}
                className={`diyar-pill-btn text-xs ${
                  dateRange === pill.id
                    ? 'bg-[#1D63B8] border-white shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                    : ''
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DIYAR 3x2 ROYAL NAVY GRADIENT CARDS GRID (3 COLS, GAP-6)               */}
      {/* ========================================================================= */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
            المؤشرات المالية والتشغيلية الرئيسية
          </h2>
          <p className="text-base font-normal text-[#334155] dark:text-[#E2E8F0] mt-1.5">
            أرقام معتمدة مطابقة بنسبة 100% لسجلات المحاسبة والمبيعات الفعلية
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Card 1: Gross Sales */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/15 mb-4 group-hover:scale-110 transition-transform">
                <Receipt size={44} strokeWidth={1.75} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#BAE6FD]">إجمالي المبيعات المعتمدة</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">
                {formatKwd(TOTAL_SALES_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E2E8F0]">
              <span>نمو دوري +8.4% · 9 فروع نشطة</span>
              <span className="text-white font-bold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1">
                تفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 2: Net Operating Profit */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/15 mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp size={44} strokeWidth={1.75} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#BAE6FD]">صافي الربح التشغيلي</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">
                {formatKwd(NET_OPERATING_PROFIT_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E2E8F0]">
              <span>هامش الربح التشغيلي: <strong>{NET_MARGIN_PCT}%</strong></span>
              <span className="text-white font-bold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1">
                تفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 3: Food Cost (COGS) */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/15 mb-4 group-hover:scale-110 transition-transform">
                <UtensilsCrossed size={44} strokeWidth={1.75} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#BAE6FD]">تكلفة الأغذية (Food Cost)</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">
                {COGS_PCT}%
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E2E8F0]">
              <span>القيمة: {formatKwd(COGS_AMOUNT_KWD)}</span>
              <span className="text-white font-bold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1">
                تفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 4: Orders & AOV */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/15 mb-4 group-hover:scale-110 transition-transform">
                <ShoppingBag size={44} strokeWidth={1.75} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#BAE6FD]">إجمالي الطلبات ومتوسط السلة</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">
                {formatNum(TOTAL_ORDERS)} <span className="text-base font-normal text-[#BAE6FD]">طلب</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E2E8F0]">
              <span>متوسط السلة: <strong>{formatKwd(DYNAMIC_AOV_KWD)}</strong></span>
              <span className="text-white font-bold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1">
                تفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 5: Custodies & Operating Expenses */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/15 mb-4 group-hover:scale-110 transition-transform">
                <Landmark size={44} strokeWidth={1.75} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#BAE6FD]">العهد والمصروفات التشغيلية</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">
                {formatKwd(CUSTODIES_EXPENSES_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E2E8F0]">
              <span>مصروفات الفروع والصيانة والتشغيل</span>
              <span className="text-white font-bold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1">
                تفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 6: Fixed Overheads, Mall Rents & Commissions */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/10 border border-white/15 mb-4 group-hover:scale-110 transition-transform">
                <Building2 size={44} strokeWidth={1.75} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-[#BAE6FD]">الرواتب والإيجارات وعمولات المنصات</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tracking-tight">
                {formatKwd(SALARIES_RENT_COMMISSIONS_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#E2E8F0]">
              <span>المقتطعات الثابتة وعقود المجمعات</span>
              <span className="text-white font-bold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1">
                تفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION: IMPORTANT MANAGEMENT NOTES (CLEAN WHITE CARD CONTAINER)       */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
            الملاحظات الإدارية الهامة
          </h2>
          <p className="text-base font-normal text-[#334155] dark:text-[#E2E8F0] mt-1.5 max-w-2xl mx-auto">
            متابعة دقيقة للبند والقيمة والإجراء الإداري المطلوب من القيادات والمسؤولين الميدانيين
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                <th className="px-5 py-3.5 text-right">البند</th>
                <th className="px-5 py-3.5 text-right font-mono">القيمة الحالية</th>
                <th className="px-5 py-3.5 text-right">الملاحظة الإدارية</th>
                <th className="px-5 py-3.5 text-right">الإجراء الإداري المطلوب</th>
                <th className="px-5 py-3.5 text-right">المسؤول المباشر</th>
                <th className="px-5 py-3.5 text-center">الأولوية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
              {MANAGEMENT_NOTES.map((note) => (
                <tr key={note.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                  <td className="px-5 py-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {note.category}
                  </td>
                  <td className="px-5 py-4 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {note.currentValue}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300 max-w-xs leading-relaxed">
                    {note.observation}
                  </td>
                  <td className="px-5 py-4 text-slate-900 dark:text-slate-100 max-w-sm leading-relaxed font-semibold">
                    {note.requiredAction}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400 whitespace-nowrap font-medium">
                    {note.assignedTo}
                  </td>
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold ${
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
      {/* 4. SECTION: FINANCIAL TREND DYNAMICS (CLEAN WHITE CARD CONTAINER)         */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
            تطور الإيرادات وصافي الأرباح
          </h2>
          <p className="text-base font-normal text-[#334155] dark:text-[#E2E8F0] mt-1.5 max-w-2xl mx-auto">
            مؤشرات الأداء الأسبوعية لشهر أكتوبر 2026 بالدينار الكويتي (د.ك)
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mb-6 text-xs font-bold">
          <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#1E3A8A]"></span>
            المبيعات المعتمدة
          </span>
          <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#10B981]"></span>
            صافي الربح التشغيلي
          </span>
          <span className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <span className="h-3.5 w-3.5 rounded-sm bg-[#00A8E8]"></span>
            تكلفة الأغذية (COGS)
          </span>
        </div>

        {/* 4 Weekly Trend Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {WEEKLY_TREND.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-5 shadow-sm hover:border-[#38BDF8] transition-colors"
            >
              <div className="text-xs font-extrabold text-[#0B1D42] dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2.5">
                {item.weekAr}
              </div>
              <div className="mt-3.5 space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>المبيعات:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formatKwd(item.sales)}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#1E3A8A] h-full rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>صافي الربح ({item.margin}%):</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{formatKwd(item.profit)}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#10B981] h-full rounded-full" style={{ width: `${item.margin}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1">
                    <span>تكلفة الأغذية (24.8%):</span>
                    <span className="font-mono font-bold text-[#00A8E8]">{formatKwd(item.cogs)}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#00A8E8] h-full rounded-full" style={{ width: '24.8%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SECTION: STORE & BRAND PERFORMANCE MATRIX (FORMAL ACCOUNTING LEDGER)   */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
            أداء الفروع والعلامات التجارية
          </h2>
          <p className="text-base font-normal text-[#334155] dark:text-[#E2E8F0] mt-1.5 max-w-2xl mx-auto">
            بيان تحليلي محاسبي موحد لمبيعات ومصاريف وأرباح الفروع الـ 9 والعلامات الـ 6
          </p>

          {/* Centered Pill Sub-tabs */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setActiveTab('branches')}
              className={`diyar-pill-btn text-xs ${
                activeTab === 'branches'
                  ? 'bg-[#1D63B8] border-white shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                  : 'bg-[#0A1938] opacity-80'
              }`}
            >
              أداء الفروع الـ 9 الرسمية
            </button>
            <button
              onClick={() => setActiveTab('brands')}
              className={`diyar-pill-btn text-xs ${
                activeTab === 'brands'
                  ? 'bg-[#1D63B8] border-white shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                  : 'bg-[#0A1938] opacity-80'
              }`}
            >
              أداء العلامات الـ 6 الرسمية
            </button>
          </div>
        </div>

        {/* Tab 1: 9 Active Branches Ledger */}
        {activeTab === 'branches' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                  <th className="px-4 py-3.5 text-right font-mono">الكود</th>
                  <th className="px-4 py-3.5 text-right">الفرع / الموقع الرسمي</th>
                  <th className="px-4 py-3.5 text-right font-mono">المبيعات المعتمدة (د.ك)</th>
                  <th className="px-4 py-3.5 text-center">الطلبات</th>
                  <th className="px-4 py-3.5 text-right font-mono">متوسط السلة</th>
                  <th className="px-4 py-3.5 text-right font-mono">المصاريف التشغيلية</th>
                  <th className="px-4 py-3.5 text-right font-mono">صافي الربح (د.ك)</th>
                  <th className="px-4 py-3.5 text-center">هامش الربح</th>
                  <th className="px-4 py-3.5 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                {BRANCHES_DATA.map((branch) => (
                  <tr key={branch.code} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-500 whitespace-nowrap">
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
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
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
                  <td className="px-4 py-3 font-mono text-right text-slate-500">— (توريد داخلي)</td>
                  <td className="px-4 py-3 text-center font-mono">364 أمر تزويد</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-500">—</td>
                  <td className="px-4 py-3 font-mono text-right text-slate-700 dark:text-slate-300">
                    {formatKwd(COGS_AMOUNT_KWD)}
                  </td>
                  <td className="px-4 py-3 font-mono text-right text-slate-500">—</td>
                  <td className="px-4 py-3 text-center font-mono">97.2% التزام</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      تشغيل كامل 100%
                    </span>
                  </td>
                </tr>

                {/* Grand Total Row */}
                <tr className="bg-[#0B1D42] text-white font-bold border-t-2 border-[#38BDF8]">
                  <td className="px-4 py-3 text-center font-mono">TOTAL</td>
                  <td className="px-4 py-3 font-black text-sm">
                    الإجمالي العام المعتمد (9 فروع نشطة)
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right text-[#38BDF8]">
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
                    معتمد 100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: 6 Brands Ledger */}
        {activeTab === 'brands' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                  <th className="px-4 py-3.5 text-right">العلامة التجارية</th>
                  <th className="px-4 py-3.5 text-right font-mono">المبيعات المعتمدة (د.ك)</th>
                  <th className="px-4 py-3.5 text-center">عدد الطلبات</th>
                  <th className="px-4 py-3.5 text-right font-mono">متوسط السلة</th>
                  <th className="px-4 py-3.5 text-center">نسبة تكلفة الأغذية</th>
                  <th className="px-4 py-3.5 text-right font-mono">تكلفة الأغذية (د.ك)</th>
                  <th className="px-4 py-3.5 text-right font-mono">صافي الربح التقديري</th>
                  <th className="px-4 py-3.5 text-center">هامش الربح (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                {BRANDS_DATA.map((brand) => (
                  <tr key={brand.nameAr} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
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
                <tr className="bg-[#0B1D42] text-white font-bold border-t-2 border-[#38BDF8]">
                  <td className="px-4 py-3 font-black text-sm">
                    إجمالي العلامات التجارية (6 براندات)
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-sm text-right text-[#38BDF8]">
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
