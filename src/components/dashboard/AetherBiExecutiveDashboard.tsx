'use client'

import React, { useState } from 'react'
import {
  TrendingUp,
  Receipt,
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  Building2,
  ArrowLeft,
  ChevronDown,
  Layers,
  Store,
  DollarSign,
  PieChart,
  BarChart3,
  Wrench,
  Truck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ExternalLink,
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

interface ChannelPerformance {
  id: string
  nameAr: string
  nameEn: string
  salesKwd: number
  orders: number
  aovKwd: number
  sharePct: number
  color: string
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
const MAINTENANCE_RABIE_CUSTODY_KWD = 10707.930
const SALARIES_RENT_COMMISSIONS_KWD = 32056.874
const TOTAL_DEDUCTIONS_KWD = 124650.680
const NET_OPERATING_PROFIT_KWD = 42441.480
const NET_MARGIN_PCT = 25.40

// 6 Brands Matrix - Exact Total = 167,092.160 KWD / 42,441.480 KWD / 18,141 Orders
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
    nameAr: 'فرانكس برجر',
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

// 8 Channels & Aggregators Matrix - Exact Total = 167,092.160 KWD / 18,141 Orders
const CHANNELS_DATA: ChannelPerformance[] = [
  {
    id: 'shop',
    nameAr: 'مبيعات الصالة والاستلام المباشر',
    nameEn: 'Shop Sales & Pickup',
    salesKwd: 58972.500,
    orders: 6402,
    aovKwd: 9.212,
    sharePct: 35.29,
    color: '#1E3A8A', // Royal Navy
  },
  {
    id: 'talabat',
    nameAr: 'منصة طلبات',
    nameEn: 'Talabat',
    salesKwd: 41250.300,
    orders: 4478,
    aovKwd: 9.212,
    sharePct: 24.69,
    color: '#0284C7', // Sky Blue
  },
  {
    id: 'keeta',
    nameAr: 'منصة كيتا',
    nameEn: 'Keeta',
    salesKwd: 23410.200,
    orders: 2542,
    aovKwd: 9.209,
    sharePct: 14.01,
    color: '#0284C7', // Sky Blue
  },
  {
    id: 'deliveroo',
    nameAr: 'منصة دليفرو',
    nameEn: 'Deliveroo',
    salesKwd: 18920.400,
    orders: 2054,
    aovKwd: 9.212,
    sharePct: 11.32,
    color: '#0284C7', // Sky Blue
  },
  {
    id: 'jahez',
    nameAr: 'منصة جاهز',
    nameEn: 'Jahez',
    salesKwd: 10840.600,
    orders: 1177,
    aovKwd: 9.210,
    sharePct: 6.49,
    color: '#0284C7', // Sky Blue
  },
  {
    id: 'cari',
    nameAr: 'منصة كاري',
    nameEn: 'Cari',
    salesKwd: 6850.160,
    orders: 744,
    aovKwd: 9.207,
    sharePct: 4.10,
    color: '#0284C7', // Sky Blue
  },
  {
    id: 'ordable',
    nameAr: 'أوردابل (الطلب المباشر أونلاين)',
    nameEn: 'Ordable Online Web',
    salesKwd: 4120.000,
    orders: 448,
    aovKwd: 9.196,
    sharePct: 2.47,
    color: '#10B981', // Emerald Green (Direct)
  },
  {
    id: 'snoonu',
    nameAr: 'منصة سنونو',
    nameEn: 'Snoonu',
    salesKwd: 2728.000,
    orders: 296,
    aovKwd: 9.216,
    sharePct: 1.63,
    color: '#0284C7', // Sky Blue
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
    observation: 'تسجيل فارق وزن في خخلطات التتبيل وتوريد الصدور مقارنة بمواصفات الوصفة المعيارية المعتمدة (BOM).',
    requiredAction: 'إعادة معايرة الموازين الإلكترونية في مطبخ القرين وتدريب طاقم التحضير على معايير الوزن بدقة.',
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
    requiredAction: 'تجهيز معاملات التجديد عبر منصة أسهل (الهيئة العامة للقوى العاملة) وإجراء الفحص الطبي لتفادي المخالفات.',
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
    <div className="w-full max-w-none space-y-10 font-sans" dir="rtl">

      {/* ========================================================================= */}
      {/* 1. HERO BANNER: ROYAL NAVY GRADIENT & SKY GLOW                            */}
      {/* ========================================================================= */}
      <div className="diyar-hero-header rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl">
        {/* Subtle Tech Grid Background Overlay */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38BDF8 1px, transparent 1px), radial-gradient(#38BDF8 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-[#BAE6FD]">
            <Building2 size={13} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
            <span style={{ color: '#BAE6FD' }}>شركة فنتشر فودز لإدارة المطاعم ذ.م.م. (ترخيص 2021/22838)</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl font-extrabold !text-white tracking-tight drop-shadow-md"
            style={{ color: '#FFFFFF', textShadow: '0 2px 12px rgba(56, 189, 248, 0.35)' }}
          >
            الملخص المالي والتشغيلي
          </h1>

          <p
            className="text-base sm:text-lg font-normal !text-[#E2E8F0] max-w-2xl mx-auto leading-relaxed"
            style={{ color: '#E2E8F0' }}
          >
            التقرير المالي والتشغيلي المعتمد لفترة أكتوبر 2026 — 6 علامات تجارية و9 فروع نشطة ومطبخ القرين المركزي
          </p>

          {/* Period Selection Pill Buttons */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            {[
              { id: 'OCT_2026', label: 'أكتوبر 2026 (معتمد)' },
              { id: 'LAST_7D', label: 'آخر 7 أيام' },
              { id: 'YESTERDAY', label: 'أمس' },
              { id: 'TODAY', label: 'اليوم' },
            ].map((pill) => {
              const isSelected = dateRange === pill.id
              return (
                <button
                  key={pill.id}
                  onClick={() => setDateRange(pill.id)}
                  style={
                    isSelected
                      ? { backgroundColor: '#0284C7', color: '#FFFFFF', borderColor: '#38BDF8' }
                      : { backgroundColor: '#0A1938', color: '#FFFFFF', borderColor: 'rgba(56, 189, 248, 0.4)' }
                  }
                  className={`px-5 py-2 rounded-full text-xs font-bold border transition-all shadow-md ${
                    isSelected
                      ? 'shadow-[0_0_20px_rgba(2,132,199,0.6)] scale-105'
                      : 'hover:bg-[#1D63B8] hover:border-white'
                  }`}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 3x2 ROYAL NAVY GRADIENT CARDS GRID (6 NAVY KPI CARDS)                  */}
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
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <Receipt size={38} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                إجمالي المبيعات المعتمدة
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(TOTAL_SALES_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>نمو دوري +8.4% · 9 فروع نشطة</span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 2: Net Operating Profit */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <TrendingUp size={38} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                صافي الربح التشغيلي
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(NET_OPERATING_PROFIT_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>
                هامش الربح التشغيلي: <strong className="!text-emerald-300" style={{ color: '#6EE7B7' }}>{NET_MARGIN_PCT}%</strong>
              </span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 3: Food Cost (COGS) */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <UtensilsCrossed size={38} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                تكلفة الأغذية (Food Cost)
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {COGS_PCT}%
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>القيمة: {formatKwd(COGS_AMOUNT_KWD)}</span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 4: Orders & AOV */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <ShoppingBag size={38} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                إجمالي الطلبات ومتوسط السلة
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatNum(TOTAL_ORDERS)}{' '}
                <span className="text-base font-normal !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                  طلب
                </span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>
                متوسط السلة: <strong className="!text-sky-200" style={{ color: '#BAE6FD' }}>{formatKwd(DYNAMIC_AOV_KWD)}</strong>
              </span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 5: Custodies & Operating Expenses */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <Landmark size={38} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                العهد والمصروفات التشغيلية
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(CUSTODIES_EXPENSES_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>مصروفات الفروع والصيانة والتشغيل</span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

          {/* Card 6: Fixed Overheads, Mall Rents & Platform Commissions */}
          <div className="diyar-navy-card group p-7 text-center flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/15 border border-sky-400/40 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                <Building2 size={38} strokeWidth={2} className="text-[#38BDF8]" style={{ color: '#38BDF8' }} />
              </div>
              <span className="text-sm font-semibold !text-[#BAE6FD]" style={{ color: '#BAE6FD' }}>
                الرواتب والإيجارات وعمولات المنصات
              </span>
              <div
                className="text-3xl font-extrabold !text-white font-mono mt-1.5 tracking-tight"
                style={{ color: '#FFFFFF' }}
              >
                {formatKwd(SALARIES_RENT_COMMISSIONS_KWD)}
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-white/15 flex items-center justify-between text-xs">
              <span style={{ color: '#E2E8F0' }}>المقتطعات الثابتة وعقود المجمعات</span>
              <span
                className="!text-sky-300 hover:!text-white font-semibold group-hover:-translate-x-1.5 transition-transform inline-flex items-center gap-1 cursor-pointer"
                style={{ color: '#7DD3FC' }}
              >
                التفاصيل <ArrowLeft size={14} />
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. VISUAL CHARTS SECTION (ROYAL NAVY, SKY GLOW & EMERALD)                  */}
      {/* ========================================================================= */}
      <div className="space-y-8">

        {/* Row A & B: Brands Comparison & Channels Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Chart A: 6 Brands Sales & Operating Profit Comparison */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                  <BarChart3 size={20} className="text-[#0284C7]" />
                  مقارنة مبيعات وصافي ربح العلامات الـ 6
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  إجمالي مبيعات 167,092.160 د.ك وصافي ربح 42,441.480 د.ك
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="h-3 w-3 rounded bg-[#1E3A8A]"></span>
                  المبيعات
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="h-3 w-3 rounded bg-[#10B981]"></span>
                  صافي الربح
                </span>
              </div>
            </div>

            {/* Horizontal Dual Bar Chart */}
            <div className="space-y-5">
              {BRANDS_DATA.map((brand) => {
                const salesPct = (brand.salesKwd / 50000) * 100
                const profitPct = (brand.operatingProfitKwd / 50000) * 100
                return (
                  <div key={brand.nameAr} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {brand.nameAr}{' '}
                        <span className="text-[11px] font-normal text-slate-400">({brand.nameEn})</span>
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {formatNum(brand.orders)} طلب · سلة {formatKwd(brand.aovKwd)}
                      </span>
                    </div>

                    {/* Sales Bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-5 rounded-md overflow-hidden relative">
                        <div
                          className="bg-[#1E3A8A] h-full rounded-md flex items-center justify-start px-2 transition-all duration-500"
                          style={{ width: `${salesPct}%` }}
                        >
                          <span className="text-[10px] font-bold text-white font-mono whitespace-nowrap">
                            {formatKwd(brand.salesKwd)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-[#1E3A8A] dark:text-[#38BDF8] w-14 text-left font-mono shrink-0">
                        {((brand.salesKwd / TOTAL_SALES_KWD) * 100).toFixed(1)}%
                      </span>
                    </div>

                    {/* Profit Bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-4 rounded-md overflow-hidden relative">
                        <div
                          className="bg-[#10B981] h-full rounded-md flex items-center justify-start px-2 transition-all duration-500"
                          style={{ width: `${profitPct}%` }}
                        >
                          <span className="text-[10px] font-bold text-white font-mono whitespace-nowrap">
                            {formatKwd(brand.operatingProfitKwd)}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 w-14 text-left font-mono shrink-0">
                        {brand.profitMarginPct.toFixed(1)}% ربح
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chart B: Channels & Aggregator Delivery Comparison */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                  <Truck size={20} className="text-[#0284C7]" />
                  مقارنة قنوات البيع وتطبيقات التوصيل (8 قنوات)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  توزيع الإيرادات بين المبيعات المباشرة ومنصات التوصيل
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-sky-50 dark:bg-sky-950/40 text-[11px] font-bold text-[#0284C7] border border-sky-200 dark:border-sky-800">
                <span>18,141 طلب معتمد</span>
              </div>
            </div>

            {/* Channels Horizontal Bar Chart */}
            <div className="space-y-4">
              {CHANNELS_DATA.map((ch) => {
                const barWidth = (ch.salesKwd / 60000) * 100
                return (
                  <div key={ch.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: ch.color }}
                        />
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {ch.nameAr}
                        </span>
                        <span className="text-[11px] text-slate-400">({ch.nameEn})</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatKwd(ch.salesKwd)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-6 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md flex items-center justify-between px-2.5 transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: ch.color }}
                        >
                          <span className="text-[10px] font-bold text-white font-mono">
                            {formatNum(ch.orders)} طلب
                          </span>
                          <span className="text-[10px] font-bold text-white font-mono">
                            {ch.sharePct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 w-16 text-left shrink-0">
                        {formatKwd(ch.aovKwd)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* Row C: Expenses, Custodies & Food Cost P&L Structure */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-[#0B1D42] dark:text-white flex items-center gap-2">
                <PieChart size={20} className="text-[#0284C7]" />
                شارت توزيع المصروفات والعهد وتكلفة الأغذية (معادلة P&L المعتمدة)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                تفصيل الاقتطاعات من إجمالي المبيعات (167,092.160 د.ك) للوصول لصافي الربح (42,441.480 د.ك)
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                صافي الربح: 42,441.480 د.ك (25.4%)
              </span>
            </div>
          </div>

          {/* Visual Stacked Bar of P&L Breakdown */}
          <div className="mb-6">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
              <span>توزيع المبيعات المعتمدة (167,092.160 د.ك = 100%)</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">فائض ربحي 25.4%</span>
            </div>
            <div className="w-full h-8 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex shadow-inner">
              <div
                className="bg-[#0284C7] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono"
                style={{ width: '24.8%' }}
                title="تكلفة الأغذية COGS: 41,438.856 د.ك (24.8%)"
              >
                الأغذية 24.8%
              </div>
              <div
                className="bg-[#1E3A8A] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono border-l border-white/20"
                style={{ width: '30.61%' }}
                title="العهد والمصروفات التشغيلية: 51,154.950 د.ك (30.6%)"
              >
                العهد والتشغيل 30.6%
              </div>
              <div
                className="bg-[#475569] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono border-l border-white/20"
                style={{ width: '19.19%' }}
                title="الرواتب والإيجارات والعمولات: 32,056.874 د.ك (19.2%)"
              >
                إيجارات ورواتب 19.2%
              </div>
              <div
                className="bg-[#10B981] h-full flex items-center justify-center text-[11px] font-bold text-white font-mono border-l border-white/20"
                style={{ width: '25.4%' }}
                title="صافي الربح التشغيلي: 42,441.480 د.ك (25.4%)"
              >
                صافي الربح 25.4%
              </div>
            </div>
          </div>

          {/* Detailed Itemized Ledger Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Sub-item 1: COGS */}
            <div className="rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#0284C7] mb-1">
                <span>تكلفة الأغذية (Food Cost)</span>
                <span className="font-mono">24.8%</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mb-2">
                {formatKwd(COGS_AMOUNT_KWD)}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                توريد اللحوم والدواجن والخضروات عبر مطبخ القرين المركزي والموردين المعتمدين.
              </p>
            </div>

            {/* Sub-item 2: Custodies & Operations */}
            <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-[#1E3A8A] dark:text-[#38BDF8] mb-1">
                <span>العهد والمصروفات التشغيلية</span>
                <span className="font-mono">30.6%</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mb-2">
                {formatKwd(CUSTODIES_EXPENSES_KWD)}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                تشمل <strong>عهد وصيانة ربيع ({formatKwd(MAINTENANCE_RABIE_CUSTODY_KWD)})</strong> ومستهلكات الفروع الـ 9.
              </p>
            </div>

            {/* Sub-item 3: Overheads & Rents */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                <span>الرواتب والإيجارات والعمولات</span>
                <span className="font-mono">19.2%</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white font-mono mb-2">
                {formatKwd(SALARIES_RENT_COMMISSIONS_KWD)}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                إيجارات مجمعات الأفنيوز والكوت (16,500 د.ك)، رواتب الكادر (11,200 د.ك)، وعمولات المنصات.
              </p>
            </div>

            {/* Sub-item 4: Net Operating Profit */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-1">
                <span>صافي الربح التشغيلي المحقق</span>
                <span className="font-mono">25.4%</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono mb-2">
                {formatKwd(NET_OPERATING_PROFIT_KWD)}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                الفائض التشغيلي الصافي بنسبة نمو محققة تفوق المستهدف الشهري للمجموعة (+8.4%).
              </p>
            </div>

          </div>
        </div>

        {/* Row D: Management Notes & Store Performance Matrix */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-7">
          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
              الملاحظات الإدارية الهامة
            </h3>
            <p className="text-sm font-normal text-slate-600 dark:text-slate-400 mt-1 max-w-2xl mx-auto">
              متابعة دقيقة للبند والقيمة والإجراء الإداري المطلوب من القيادات والمسؤولين الميدانيين
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-[#0B1D42] text-white font-bold">
                  <th className="px-5 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>البند</th>
                  <th className="px-5 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>القيمة الحالية</th>
                  <th className="px-5 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الملاحظة الإدارية</th>
                  <th className="px-5 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الإجراء الإداري المطلوب</th>
                  <th className="px-5 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>المسؤول المباشر</th>
                  <th className="px-5 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الأولوية</th>
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

        {/* Row E: Store & Brand Performance Ledger Table */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1424] shadow-lg p-6 sm:p-7">
          <div className="text-center mb-6">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0B1D42] dark:text-white tracking-tight">
              أداء الفروع والعلامات التجارية
            </h3>
            <p className="text-sm font-normal text-slate-600 dark:text-slate-400 mt-1 max-w-2xl mx-auto">
              بيان تحليلي محاسبي موحد لمبيعات ومصاريف وأرباح الفروع الـ 9 والعلامات الـ 6
            </p>

            {/* Pill Sub-tabs */}
            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => setActiveTab('branches')}
                style={
                  activeTab === 'branches'
                    ? { backgroundColor: '#0284C7', color: '#FFFFFF', borderColor: '#38BDF8' }
                    : { backgroundColor: '#0A1938', color: '#FFFFFF', borderColor: 'rgba(56, 189, 248, 0.3)' }
                }
                className="px-5 py-2 rounded-full text-xs font-bold border transition-all shadow-sm"
              >
                أداء الفروع الـ 9 الرسمية ومطبخ القرين
              </button>
              <button
                onClick={() => setActiveTab('brands')}
                style={
                  activeTab === 'brands'
                    ? { backgroundColor: '#0284C7', color: '#FFFFFF', borderColor: '#38BDF8' }
                    : { backgroundColor: '#0A1938', color: '#FFFFFF', borderColor: 'rgba(56, 189, 248, 0.3)' }
                }
                className="px-5 py-2 rounded-full text-xs font-bold border transition-all shadow-sm"
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
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>الكود</th>
                    <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>الفرع / الموقع الرسمي</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>المبيعات المعتمدة (د.ك)</th>
                    <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الطلبات</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>متوسط السلة</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>المصاريف التشغيلية</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>صافي الربح (د.ك)</th>
                    <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>هامش الربح</th>
                    <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>الحالة</th>
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
                    <td className="px-4 py-3 text-center font-mono !text-white" style={{ color: '#FFFFFF' }}>TOTAL</td>
                    <td className="px-4 py-3 font-black text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      الإجمالي العام المعتمد (9 فروع نشطة)
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-sm text-right !text-[#38BDF8]" style={{ color: '#38BDF8' }}>
                      {formatKwd(TOTAL_SALES_KWD)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-black text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      {formatNum(TOTAL_ORDERS)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      {formatKwd(DYNAMIC_AOV_KWD)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-sm text-slate-300 !text-slate-300" style={{ color: '#CBD5E1' }}>
                      {formatKwd(CUSTODIES_EXPENSES_KWD)}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-sm text-right !text-emerald-400" style={{ color: '#34D399' }}>
                      {formatKwd(NET_OPERATING_PROFIT_KWD)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-black text-sm !text-emerald-400" style={{ color: '#34D399' }}>
                      {NET_MARGIN_PCT}%
                    </td>
                    <td className="px-4 py-3 text-center text-xs !text-emerald-400 font-bold" style={{ color: '#34D399' }}>
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
                    <th className="px-4 py-3.5 text-right !text-white" style={{ color: '#FFFFFF' }}>العلامة التجارية</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>المبيعات المعتمدة (د.ك)</th>
                    <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>عدد الطلبات</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>متوسط السلة</th>
                    <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>نسبة تكلفة الأغذية</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>تكلفة الأغذية (د.ك)</th>
                    <th className="px-4 py-3.5 text-right font-mono !text-white" style={{ color: '#FFFFFF' }}>صافي الربح التقديري</th>
                    <th className="px-4 py-3.5 text-center !text-white" style={{ color: '#FFFFFF' }}>هامش الربح (%)</th>
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
                    <td className="px-4 py-3 font-black text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      إجمالي العلامات التجارية (6 براندات)
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-sm text-right !text-[#38BDF8]" style={{ color: '#38BDF8' }}>
                      {formatKwd(TOTAL_SALES_KWD)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-black text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      {formatNum(TOTAL_ORDERS)}
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      {formatKwd(DYNAMIC_AOV_KWD)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-sm !text-white" style={{ color: '#FFFFFF' }}>
                      {COGS_PCT}%
                    </td>
                    <td className="px-4 py-3 font-mono text-right text-sm text-slate-300 !text-slate-300" style={{ color: '#CBD5E1' }}>
                      {formatKwd(COGS_AMOUNT_KWD)}
                    </td>
                    <td className="px-4 py-3 font-mono font-black text-sm text-right !text-emerald-400" style={{ color: '#34D399' }}>
                      {formatKwd(NET_OPERATING_PROFIT_KWD)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-black text-sm !text-emerald-400" style={{ color: '#34D399' }}>
                      {NET_MARGIN_PCT}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
