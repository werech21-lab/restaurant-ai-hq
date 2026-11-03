'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar,
  MapPin,
  Building,
  DollarSign,
  TrendingUp,
  Users,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Plus,
  Filter,
  Download,
  FileText,
  ChevronRight,
  Sparkles,
  ChefHat,
  Package,
  Flame,
  Coffee,
  Store,
  Layers,
  CheckSquare,
  XCircle,
  Info,
  Sliders,
  Check,
  Printer,
  FileSpreadsheet,
  Award,
  Zap,
  Tag,
  Percent,
  RefreshCw,
  Compass,
  FileCheck,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  VENTURE_FOODS_EVENTS,
  BRAND_SUITABILITY_MATRIX,
  GOLDEN_EVENT_MENU,
  DEFAULT_EVENT_PROJECT_TASKS,
  EVENT_EQUIPMENT_ROSTER,
  EVENT_STAFF_ROSTER,
  CENTRAL_KITCHEN_EVENT_QUOTAS,
  OFFICIAL_EXB_MENUS,
  HISTORICAL_BENCHMARKS,
  calculateThreeScenarios,
  recommendBrandForEvent,
  type VentureEvent,
  type EventStatus,
  type EventType,
  type ProjectTaskItem,
  type EquipmentChecklistItem,
  type EXBMenuItem,
  type HistoricalBenchmarkRecord,
} from '@/lib/events/venture-events-engine'
import AIContractRiskAnalyzer from '@/components/events/AIContractRiskAnalyzer'

export default function VentureEventsHub() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  // Master Studio Mode: 'studio' (Future Events Studio) vs 'archive' (Historical Benchmark Archive)
  const [viewMode, setViewMode] = useState<'studio' | 'archive'>('studio')

  // Future Event Studio Active Tab
  const [studioTab, setStudioTab] = useState<
    'feasibility' | 'brand_advisor' | 'exb_menu' | 'historical_radar' | 'approval_pack' | 'contract_analyzer'
  >('feasibility')

  // Smart Event Inputs (Upcoming Event Target)
  const [eventNameAr, setEventNameAr] = useState('مخيم وبازار فندق السفير 2026-2027')
  const [eventNameEn, setEventNameEn] = useState('Safir Hotel Camp & Ramadan Pop-Up 2026-2027')
  const [organizerAr, setOrganizerAr] = useState('إدارة فعاليات فندق السفير - بنيد القار')
  const [locationAr, setLocationAr] = useState('قاعة اللؤلؤة والواجهة الخارجية - فندق السفير')
  const [mapLink, setMapLink] = useState('https://maps.google.com/?q=Safir+Hotel+Kuwait')
  const [startDate, setStartDate] = useState('2026-11-15')
  const [endDate, setEndDate] = useState('2026-12-20')
  const [boothCount, setBoothCount] = useState(2)
  const [boothLengthM, setBoothLengthM] = useState(2.85)
  const [boothWidthM, setBoothWidthM] = useState(2.50)
  const [totalRentKwd, setTotalRentKwd] = useState(4800)
  const [fitoutKwd, setFitoutKwd] = useState(1600)
  const [staffCount, setStaffCount] = useState(6)
  const [dailyWageKwd, setDailyWageKwd] = useState(18)
  const [expectedAovKwd, setExpectedAovKwd] = useState(5.400)
  const [estimatedCogsPct, setEstimatedCogsPct] = useState(25.8)
  const [marketingOpexKwd, setMarketingOpexKwd] = useState(450)
  const [baselineDailyOrders, setBaselineDailyOrders] = useState(240)
  const [selectedBrands, setSelectedBrands] = useState<string[]>([
    'Farm Brown',
    "Frank's",
    'Karak Cafeteria',
  ])

  // Calculated Days
  const calculatedDays = useMemo(() => {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24))
    return isNaN(diff) || diff <= 0 ? 35 : diff
  }, [startDate, endDate])

  const totalBoothAreaSqM = useMemo(() => {
    return (boothCount * boothLengthM * boothWidthM).toFixed(2)
  }, [boothCount, boothLengthM, boothWidthM])

  // 3-Scenario Simulator Output
  const threeScenarios = useMemo(() => {
    return calculateThreeScenarios({
      daysCount: calculatedDays,
      totalRentKwd: totalRentKwd,
      fitoutKwd: fitoutKwd,
      staffCount: staffCount,
      dailyWagePerStaffKwd: dailyWageKwd,
      expectedAovKwd: expectedAovKwd,
      estimatedCogsPercent: estimatedCogsPct,
      marketingOpexKwd: marketingOpexKwd,
      baselineDailyOrders: baselineDailyOrders,
      selectedBrands: selectedBrands,
    })
  }, [
    calculatedDays,
    totalRentKwd,
    fitoutKwd,
    staffCount,
    dailyWageKwd,
    expectedAovKwd,
    estimatedCogsPct,
    marketingOpexKwd,
    baselineDailyOrders,
    selectedBrands,
  ])

  // AI Brand Advisor Filters
  const [advAudience, setAdvAudience] = useState<'families' | 'youth' | 'shoppers' | 'corporate'>('shoppers')
  const [advStyle, setAdvStyle] = useState<'grab_and_go' | 'grill_subs' | 'family_share' | 'bakery_karak'>('grab_and_go')
  const [advPeak, setAdvPeak] = useState<'morning' | 'evening' | 'all_day'>('all_day')

  // EXB Menu State
  const [exbMenuList, setExbMenuList] = useState<EXBMenuItem[]>(OFFICIAL_EXB_MENUS)
  const [exbBrandFilter, setExbBrandFilter] = useState<string>('all')
  const [exbSearch, setExbSearch] = useState<string>('')
  const [priceOffsetPct, setPriceOffsetPct] = useState<number>(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Interactive Tasks
  const [tasks, setTasks] = useState<ProjectTaskItem[]>(DEFAULT_EVENT_PROJECT_TASKS)

  // Show Toast
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Toggle brand in selected list
  const toggleBrandSelection = (brandName: string) => {
    setSelectedBrands((prev) => {
      if (prev.includes(brandName)) {
        if (prev.length === 1) return prev // keep at least one
        return prev.filter((b) => b !== brandName)
      } else {
        return [...prev, brandName]
      }
    })
  }

  // Adjust EXB Prices
  const applyPriceOffset = (pct: number) => {
    setPriceOffsetPct(pct)
    setExbMenuList((prev) =>
      prev.map((item) => {
        const base = item.previousExbPriceKwd || item.standardBranchPriceKwd
        const offsetPrice = base * (1 + pct / 100)
        // round to nearest 0.050 KWD
        const rounded = Math.round(offsetPrice * 20) / 20
        return {
          ...item,
          recommendedExbPriceKwd: Number(rounded.toFixed(3)),
        }
      })
    )
    showToast(
      isAr
        ? `تم تحديث أسعار منيو المعارض بنسبة +${pct}% لتعويض تكلفة الإيجار بنجاح!`
        : `Updated EXB menu prices with +${pct}% rent-offset factor!`
    )
  }

  const roundToNearestFils = () => {
    setExbMenuList((prev) =>
      prev.map((item) => ({
        ...item,
        recommendedExbPriceKwd: Number((Math.round(item.recommendedExbPriceKwd * 20) / 20).toFixed(3)),
      }))
    )
    showToast(isAr ? 'تم تقريب كافة أسعار المعرض لأقرب 50 فلساً.' : 'Rounded all EXB prices to nearest 0.050 KWD.')
  }

  const resetExbPrices = () => {
    setPriceOffsetPct(0)
    setExbMenuList(OFFICIAL_EXB_MENUS)
    showToast(isAr ? 'تمت استعادة الأسعار المعتمدة الأصلية.' : 'Reset to default approved EXB price list.')
  }

  // Filtered EXB Menu
  const filteredExbMenu = useMemo(() => {
    return exbMenuList.filter((item) => {
      if (exbBrandFilter !== 'all' && item.brandKey !== exbBrandFilter) return false
      if (!exbSearch.trim()) return true
      const q = exbSearch.toLowerCase()
      return (
        item.code.toLowerCase().includes(q) ||
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.categoryAr.toLowerCase().includes(q)
      )
    })
  }, [exbMenuList, exbBrandFilter, exbSearch])

  // Export POS Ready Menu
  const exportPosJson = () => {
    const activeItems = exbMenuList.filter((i) => i.activeOnMenu)
    const exportData = {
      eventCode: 'EXB-2026-SAFIR',
      eventName: eventNameAr,
      generatedAt: new Date().toISOString(),
      itemCount: activeItems.length,
      items: activeItems.map((i) => ({
        posSku: i.code,
        nameAr: i.nameAr,
        nameEn: i.nameEn,
        brand: i.brandNameEn,
        priceKwd: i.recommendedExbPriceKwd,
        cogsKwd: i.foodPackagingCogsKwd,
        prepSeconds: i.prepTimeSeconds,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `POS_EXB_Menu_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast(isAr ? 'تم تصدير منيو الفعالية لشاشة الكاشير /pos بنجاح!' : 'Exported EXB POS Menu JSON!')
  }

  // Toggle Task Completion
  const toggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: t.status === 'completed' ? 'in_progress' : 'completed',
          }
        }
        return t
      })
    )
  }

  // Viability Decision for the Planned Event
  const plannedEventVerdict = useMemo(() => {
    const rentPct = threeScenarios.realistic.rentToSalesPercent
    const roi = threeScenarios.realistic.roiPercent
    const beDay = threeScenarios.realistic.breakEvenDay

    if (rentPct <= 20.0 && roi >= 70.0 && beDay <= calculatedDays * 0.65) {
      return {
        status: 'highly_viable',
        badgeAr: '🟢 فعالية عالية الجدوى ينصح بالمشاركة بقوة',
        badgeEn: '🟢 Highly Viable - Recommended to Participate',
        color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
        adviceAr: `نسبة الإيجار للمبيعات (${rentPct.toFixed(1)}%) ممتازة وأقل من الحد الأقصى 30%، والعائد المتوقع ${roi.toFixed(1)}% مع استرداد رأس المال بالكامل في اليوم ${beDay}.`,
        adviceEn: `Rent-to-sales ratio (${rentPct.toFixed(1)}%) is well below 30% threshold. Projected ROI is ${roi.toFixed(1)}% with full capital recovery on Day ${beDay}.`,
      }
    } else if (rentPct <= 30.0) {
      return {
        status: 'caution',
        badgeAr: '🟡 تتطلب التفاوض لتخفيض الإيجار أو رفع أسعار منيو EXB بنسبة +10%',
        badgeEn: '🟡 Caution - Negotiate Lower Rent or Apply +10% EXB Price Offset',
        color: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
        adviceAr: `نسبة الإيجار (${rentPct.toFixed(1)}%) تقترب من الحد الحرج؛ يُنصح برفع أسعار منيو المعرض أو طلب مساحة أكبر مجاناً.`,
        adviceEn: `Rent ratio (${rentPct.toFixed(1)}%) approaches threshold. Recommend applying +10% price offset or negotiating additional booth area.`,
      }
    } else {
      return {
        status: 'high_risk',
        badgeAr: '🔴 مخاطرة مالية عالية - الإيجار يتجاوز 30% من المبيعات المتوقعة',
        badgeEn: '🔴 High Financial Risk - Rent Exceeds 30% of Projected Sales',
        color: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
        adviceAr: `تحذير رقابي: الإيجار مرتفع جداً ويشكل ${rentPct.toFixed(1)}% من المبيعات، ما يهدد بابتلاع الأرباح. غير موصى بها بشروطها الحالية.`,
        adviceEn: `Audit warning: Rent is too high at ${rentPct.toFixed(1)}% of revenue. Participation not recommended without significant rent reduction.`,
      }
    }
  }, [threeScenarios, calculatedDays])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen space-y-6 bg-[#07090e] p-4 text-mist-100 antialiased sm:p-6 lg:p-8"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 end-6 z-50 rounded-2xl border border-emerald-500/40 bg-black/90 p-4 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ----------------- TOP EXECUTIVE HEADER ----------------- */}
      <div className="relative overflow-hidden rounded-3xl border border-gold-300/20 bg-gradient-to-br from-[#121620] via-[#0d1017] to-[#07090e] p-6 shadow-2xl">
        <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-gold-400/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-gold-400/10 px-3 py-1 text-xs font-black tracking-wider text-gold-300">
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              <span>
                {isAr
                  ? 'استوديو تخطيط ودراسة جدوى الفعاليات القادمة الذكي'
                  : 'Next-Gen Future Event Planner, AI Feasibility & EXB Menu Studio'}
              </span>
              <span className="rounded-full bg-gold-300/20 px-1.5 py-0.2 text-[10px] text-gold-200">
                CR 412891
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">
              {isAr ? '🎪 استوديو الفعاليات ودراسة الجدوى الذكية' : 'Events Feasibility & Planning Studio'}
            </h1>
            <p className="max-w-3xl text-sm font-medium text-mist-300">
              {isAr
                ? 'محاكي الـ 3 سيناريوهات المالية، رادار اختيار البراند الأمثل، مولّد منيو المعارض الرسمي (EXB Menu 6FB)، وحقيبة الاعتماد التنفيذية لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.'
                : '3-Scenario P&L Simulator, AI Brand Selector, Official EXB Menu Generator (6FB), and 1-Click Executive Approval Pack.'}
            </p>
          </div>

          {/* Master View Switcher & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-1 flex">
              <button
                onClick={() => setViewMode('studio')}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                  viewMode === 'studio'
                    ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                    : 'text-mist-400 hover:text-white'
                }`}
              >
                {isAr ? '🚀 استوديو الفعالية القادمة' : 'Future Event Studio'}
              </button>
              <button
                onClick={() => setViewMode('archive')}
                className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                  viewMode === 'archive'
                    ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                    : 'text-mist-400 hover:text-white'
                }`}
              >
                {isAr ? '📜 أرشيف الفعاليات السابقة' : 'Historical Archive'}
              </button>
            </div>

            <button
              onClick={() => {
                setViewMode('studio')
                setStudioTab('contract_analyzer')
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-gold-400/50 bg-gradient-to-r from-gold-400/20 to-amber-500/20 px-4 py-2.5 text-xs font-black text-gold-300 shadow-lg shadow-gold-500/10 hover:border-gold-400 hover:bg-gold-400/30 active:scale-95 transition-all"
            >
              <FileText className="h-4 w-4 text-gold-400" />
              <span>{isAr ? '📄 تحليل عقد فعالية جديد بالذكاء الاصطناعي (PDF)' : 'AI Contract Risk Analyzer'}</span>
            </button>

            <button
              onClick={() => {
                setStudioTab('approval_pack')
                setTimeout(() => window.print(), 300)
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-amber-600 px-4 py-2.5 text-xs font-black text-ink-950 shadow-lg shadow-gold-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Printer className="h-4 w-4 stroke-[2.5]" />
              <span>{isAr ? 'طباعة حقيبة الاعتماد الرسمية' : '1-Click Approval Pack'}</span>
            </button>
          </div>
        </div>

        {/* ----------------- REAL-TIME SUMMARY PILLS FOR UPCOMING EVENT ----------------- */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
            <span className="text-[10px] text-mist-400 uppercase font-bold">{isAr ? 'مدة الفعالية' : 'Duration'}</span>
            <div className="text-base font-black text-white">{calculatedDays} {isAr ? 'يوماً' : 'Days'}</div>
            <span className="text-[10px] text-gold-400">{boothCount} بوث ({totalBoothAreaSqM} م²)</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
            <span className="text-[10px] text-mist-400 uppercase font-bold">{isAr ? 'الإيجار اليومي' : 'Daily Rent'}</span>
            <div className="text-base font-black text-white">
              {threeScenarios.dailyRentKwd.toFixed(3)}{' '}
              <span className="text-[10px] text-gold-400">KWD/d</span>
            </div>
            <span className="text-[10px] text-mist-400">{isAr ? 'إجمالي:' : 'Total:'} {totalRentKwd.toLocaleString()} د.ك</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
            <span className="text-[10px] text-mist-400 uppercase font-bold">{isAr ? 'مبيعات التعادل اليومية' : 'Daily Break-Even'}</span>
            <div className="text-base font-black text-cyan-300">
              {threeScenarios.realistic.dailyBreakEvenSalesKwd.toFixed(0)}{' '}
              <span className="text-[10px] text-gold-400">KWD/d</span>
            </div>
            <span className="text-[10px] text-mist-400">{threeScenarios.realistic.dailyBreakEvenOrders} {isAr ? 'طلباً/يوم' : 'orders/d'}</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
            <span className="text-[10px] text-mist-400 uppercase font-bold">{isAr ? 'نسبة الإيجار للمبيعات' : 'Rent % of Sales'}</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-base font-black ${threeScenarios.realistic.rentWarning ? 'text-rose-400' : 'text-emerald-400'}`}>
                {threeScenarios.realistic.rentToSalesPercent.toFixed(1)}%
              </span>
              {threeScenarios.realistic.rentWarning && (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <span className={`text-[10px] font-bold ${threeScenarios.realistic.rentWarning ? 'text-rose-400' : 'text-emerald-400'}`}>
              {threeScenarios.realistic.rentWarning ? (isAr ? 'تحذير > 30%' : 'High > 30%') : (isAr ? 'ممتاز < 30%' : 'Healthy < 30%')}
            </span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
            <span className="text-[10px] text-mist-400 uppercase font-bold">{isAr ? 'صافي الربح المتوقع' : 'Realistic Net Profit'}</span>
            <div className="text-base font-black text-gold-300">
              {threeScenarios.realistic.netProfitKwd.toLocaleString('en-US', { minimumFractionDigits: 0 })}{' '}
              <span className="text-[10px] text-gold-400">KWD</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">▲ {threeScenarios.realistic.roiPercent.toFixed(1)}% ROI</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-black/40 p-3">
            <span className="text-[10px] text-mist-400 uppercase font-bold">{isAr ? 'يوم استرداد رأس المال' : 'BEP Day'}</span>
            <div className="text-base font-black text-emerald-400">
              {isAr ? `اليوم ${threeScenarios.realistic.breakEvenDay}` : `Day ${threeScenarios.realistic.breakEvenDay}`}
            </div>
            <span className="text-[10px] text-mist-400">
              {isAr ? `من أصل ${calculatedDays} يوماً` : `of ${calculatedDays} days`}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: NEXT-GEN FUTURE EVENT PLANNING STUDIO                             */}
      {/* ========================================================================= */}
      {viewMode === 'studio' && (
        <div className="space-y-6">
          {/* Studio Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0d1118] p-1.5 scrollbar-none">
            <button
              onClick={() => setStudioTab('contract_analyzer')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                studioTab === 'contract_analyzer'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>{isAr ? '📄 محلل عقود الفعاليات الذكي (كشتة المارينا 1976)' : 'AI Contract Risk Analyzer'}</span>
            </button>

            <button
              onClick={() => setStudioTab('feasibility')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                studioTab === 'feasibility'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Calculator className="h-4 w-4" />
              <span>{isAr ? '🔮 دراسة الجدوى ومحاكي الـ 3 سيناريوهات' : '3-Scenario Feasibility Simulator'}</span>
            </button>

            <button
              onClick={() => setStudioTab('brand_advisor')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                studioTab === 'brand_advisor'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <ChefHat className="h-4 w-4" />
              <span>{isAr ? '🎯 مستشار البراند الأمثل للفعالية' : 'AI Brand-Fit Recommender'}</span>
            </button>

            <button
              onClick={() => setStudioTab('exb_menu')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                studioTab === 'exb_menu'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Tag className="h-4 w-4" />
              <span>{isAr ? '📋 مولّد منيو المعارض وتسعير تعويض الإيجار' : 'Smart EXB Menu & Price Optimizer'}</span>
            </button>

            <button
              onClick={() => setStudioTab('historical_radar')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                studioTab === 'historical_radar'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Compass className="h-4 w-4" />
              <span>{isAr ? '📈 رادار المقارنة مع الفعاليات السابقة' : 'Historical Benchmarks Radar'}</span>
            </button>

            <button
              onClick={() => setStudioTab('approval_pack')}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all ${
                studioTab === 'approval_pack'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-ink-950 shadow-md'
                  : 'text-mist-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FileCheck className="h-4 w-4" />
              <span>{isAr ? '🗺️ المخطط الهندسي وحقيبة الاعتماد الرسمي' : 'Site Map & Approval Pack'}</span>
            </button>
          </div>

          {/* ----------------- SUB-TAB 0: AI CONTRACT RISK ANALYZER ----------------- */}
          {studioTab === 'contract_analyzer' && (
            <AIContractRiskAnalyzer
              isAr={isAr}
              onApplyToSimulator={(params) => {
                setEventNameAr(params.eventNameAr)
                setEventNameEn(params.eventNameEn)
                setOrganizerAr(params.organizerAr)
                setLocationAr(params.locationAr)
                setStartDate(params.startDate)
                setEndDate(params.endDate)
                setBoothCount(params.boothCount)
                setBoothLengthM(params.boothLengthM)
                setBoothWidthM(params.boothWidthM)
                setTotalRentKwd(params.totalRentKwd)
                setFitoutKwd(params.fitoutKwd)
                setStaffCount(params.staffCount)
                setDailyWageKwd(params.dailyWageKwd)
                setExpectedAovKwd(params.expectedAovKwd)
                setEstimatedCogsPct(params.estimatedCogsPct)
                setMarketingOpexKwd(params.marketingOpexKwd)
                setBaselineDailyOrders(params.baselineDailyOrders)
                setSelectedBrands(params.selectedBrands)
                setStudioTab('feasibility')
                showToast(isAr ? 'تم تطبيق أرقام عقد كشتة المارينا بنجاح في محاكي الجدوى!' : 'Applied Marina Kashta contract data to feasibility simulator!')
              }}
              onNavigateTab={(tab) => setStudioTab(tab)}
            />
          )}

          {/* ----------------- SUB-TAB 1: 3-SCENARIO FEASIBILITY SIMULATOR ----------------- */}
          {studioTab === 'feasibility' && (
            <div className="space-y-6">
              {/* Smart Inputs Card */}
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/20 text-gold-300">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        {isAr ? 'مدخلات ومعايير الفعالية القادمة المستهدفة' : 'Target Upcoming Event Parameters'}
                      </h3>
                      <p className="text-xs text-mist-400">
                        {isAr
                          ? 'عدّل التواريخ والإيجار والبراندات المشاركة ليقوم المحاكي بتوليد السيناريوهات المالية ونقطة التعادل فوراً'
                          : 'Modify event dates, rent, and participating brands to dynamically calculate 3-scenario P&L and BEP'}
                      </p>
                    </div>
                  </div>

                  {/* Viability Status Pill */}
                  <span className={`rounded-xl px-3 py-1.5 text-xs font-black border ${plannedEventVerdict.color}`}>
                    {isAr ? plannedEventVerdict.badgeAr : plannedEventVerdict.badgeEn}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-mist-300">{isAr ? 'اسم الفعالية القادمة:' : 'Event Name:'}</label>
                    <input
                      type="text"
                      value={eventNameAr}
                      onChange={(e) => setEventNameAr(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none focus:border-gold-400"
                    />
                  </div>

                  {/* Location & Map */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-mist-300">{isAr ? 'الموقع ورابط الخريطة:' : 'Location & Map:'}</label>
                    <input
                      type="text"
                      value={locationAr}
                      onChange={(e) => setLocationAr(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-gold-400"
                    />
                  </div>

                  {/* Start Date */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-mist-300">{isAr ? 'تاريخ البدء:' : 'Start Date:'}</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-gold-400"
                    />
                  </div>

                  {/* End Date */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-mist-300">
                      {isAr ? `تاريخ الانتهاء (${calculatedDays} يوماً):` : `End Date (${calculatedDays}d):`}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-gold-400"
                    />
                  </div>

                  {/* Total Rent */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-mist-300">{isAr ? 'إجمالي الإيجار المطلوب:' : 'Total Booth Rent:'}</span>
                      <span className="font-bold text-gold-300">{totalRentKwd} KWD</span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={12000}
                      step={200}
                      value={totalRentKwd}
                      onChange={(e) => setTotalRentKwd(Number(e.target.value))}
                      className="w-full accent-gold-400"
                    />
                    <div className="text-[10px] text-mist-400">
                      {isAr ? 'الإيجار اليومي:' : 'Daily:'} {threeScenarios.dailyRentKwd.toFixed(3)} KWD/d
                    </div>
                  </div>

                  {/* Booths & Dimensions */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-mist-300">
                      {isAr ? `عدد البوثات والأبعاد (${totalBoothAreaSqM} م²):` : `Booths (${totalBoothAreaSqM} sqm):`}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={boothCount}
                        onChange={(e) => setBoothCount(Number(e.target.value))}
                        className="rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
                      >
                        <option value={1}>بوث واحد (1x)</option>
                        <option value={2}>بوثان مدمجان (2x)</option>
                        <option value={3}>3 بوثات (3x)</option>
                        <option value={4}>4 بوثات مجمع (4x)</option>
                      </select>
                      <span className="rounded-xl border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-center font-mono text-mist-300">
                        {boothLengthM}m × {boothWidthM}m
                      </span>
                    </div>
                  </div>

                  {/* Fitout Setup */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-mist-300">{isAr ? 'تكلفة الديكور والـ Fit-out:' : 'Fit-out & Decor:'}</span>
                      <span className="font-bold text-white">{fitoutKwd} KWD</span>
                    </div>
                    <input
                      type="range"
                      min={500}
                      max={4000}
                      step={100}
                      value={fitoutKwd}
                      onChange={(e) => setFitoutKwd(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* Staff Crew */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-mist-300">{isAr ? 'عدد العمالة الميدانية:' : 'Crew Staff Count:'}</span>
                      <span className="font-bold text-white">{staffCount} {isAr ? 'موظفاً' : 'staff'}</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={16}
                      step={1}
                      value={staffCount}
                      onChange={(e) => setStaffCount(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  {/* Expected AOV */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-mist-300">{isAr ? 'متوسط الفاتورة المستهدف:' : 'Expected AOV:'}</span>
                      <span className="font-bold text-gold-300">{expectedAovKwd.toFixed(3)} KWD</span>
                    </div>
                    <input
                      type="range"
                      min={3.0}
                      max={8.5}
                      step={0.1}
                      value={expectedAovKwd}
                      onChange={(e) => setExpectedAovKwd(Number(e.target.value))}
                      className="w-full accent-gold-400"
                    />
                  </div>

                  {/* Target Daily Baseline Orders */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-mist-300">{isAr ? 'الطلبات اليومية الأساسية:' : 'Baseline Orders/Day:'}</span>
                      <span className="font-bold text-emerald-400">{baselineDailyOrders} {isAr ? 'طلب' : 'orders'}</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={600}
                      step={10}
                      value={baselineDailyOrders}
                      onChange={(e) => setBaselineDailyOrders(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>

                  {/* Estimated COGS % */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-mist-300">{isAr ? 'تكلفة الطعام والتغليف COGS %:' : 'Target COGS %:'}</span>
                      <span className="font-bold text-emerald-400">{estimatedCogsPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={35}
                      step={0.5}
                      value={estimatedCogsPct}
                      onChange={(e) => setEstimatedCogsPct(Number(e.target.value))}
                      className="w-full accent-emerald-400"
                    />
                  </div>

                  {/* Multi-Brand Selectors */}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-4 border-t border-white/5 pt-3">
                    <label className="text-[11px] font-bold text-mist-300">
                      {isAr ? 'البراندات المشاركة في الفعالية (انقر لاختيار براند أو أكثر):' : 'Participating Brands (Select one or more):'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'Farm Brown',
                        "Frank's",
                        'The Noodle Bar',
                        'Tahina',
                        'China Garden',
                        'Karak Cafeteria',
                      ].map((brand) => {
                        const active = selectedBrands.includes(brand)
                        return (
                          <button
                            key={brand}
                            type="button"
                            onClick={() => toggleBrandSelection(brand)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
                              active
                                ? 'bg-gold-400/20 border-gold-400 text-gold-300 shadow-sm'
                                : 'bg-black/30 border-white/10 text-mist-400 hover:text-white'
                            }`}
                          >
                            {active ? '✓ ' : '+ '} {brand}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3-Scenario Comparison Table */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1017]">
                <div className="border-b border-white/10 bg-black/40 px-6 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-black text-white">
                        {isAr ? 'جدول مقارنة السيناريوهات المالية الـ 3 (P&L Simulation)' : '3-Scenario Financial Projection (P&L Simulation)'}
                      </h3>
                      <p className="text-xs text-mist-400">
                        {isAr
                          ? 'مقارنة السيناريو المتحفظ (80% حركة) مع الأساس الواقعي (100%) والذروة المتفائلة (125%)'
                          : 'Side-by-side comparison across Conservative, Realistic Baseline, and Optimistic Peak scenarios'}
                      </p>
                    </div>

                    <div className="text-xs text-mist-400">
                      {isAr ? 'تأمين مسترد مقدر:' : 'Est. Security Deposit:'}{' '}
                      <strong className="text-cyan-300 font-mono">{threeScenarios.securityDepositKwd.toLocaleString()} KWD</strong>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-mist-400 font-bold">
                        <th className="px-5 py-3.5 text-start">{isAr ? 'البند المالي / المؤشر' : 'Financial Line Item'}</th>
                        <th className="px-4 py-3.5 text-end text-amber-300">
                          {isAr ? 'المتحفظ (80% زوار)' : 'Conservative (80%)'}
                        </th>
                        <th className="px-5 py-3.5 text-end font-black text-gold-300 bg-gold-400/10">
                          {isAr ? 'الواقعي المعتمد (100%)' : 'Realistic Baseline (100%)'}
                        </th>
                        <th className="px-4 py-3.5 text-end text-emerald-400">
                          {isAr ? 'المتفائل (125% ذروة)' : 'Optimistic Peak (125%)'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {/* Orders */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans font-bold text-white">
                          {isAr ? 'عدد الطلبات اليومي / الإجمالي' : 'Daily / Total Orders'}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-300">
                          {threeScenarios.conservative.dailyOrders} /d ({threeScenarios.conservative.totalOrders.toLocaleString()})
                        </td>
                        <td className="px-5 py-3 text-end font-bold text-white bg-gold-400/5">
                          {threeScenarios.realistic.dailyOrders} /d ({threeScenarios.realistic.totalOrders.toLocaleString()})
                        </td>
                        <td className="px-4 py-3 text-end text-emerald-300">
                          {threeScenarios.optimistic.dailyOrders} /d ({threeScenarios.optimistic.totalOrders.toLocaleString()})
                        </td>
                      </tr>

                      {/* Gross Revenue */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans font-bold text-white">
                          {isAr ? 'إجمالي المبيعات المحققة (Gross Sales)' : 'Gross Revenue'}
                        </td>
                        <td className="px-4 py-3 text-end text-amber-300 font-bold">
                          {threeScenarios.conservative.grossSalesKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
                        </td>
                        <td className="px-5 py-3 text-end font-black text-gold-300 bg-gold-400/5 text-sm">
                          {threeScenarios.realistic.grossSalesKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
                        </td>
                        <td className="px-4 py-3 text-end text-emerald-400 font-black text-sm">
                          {threeScenarios.optimistic.grossSalesKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
                        </td>
                      </tr>

                      {/* Daily Sales Velocity */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans text-mist-300">
                          {isAr ? 'المبيعات اليومية (Daily Velocity)' : 'Daily Velocity'}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-300">
                          {threeScenarios.conservative.dailySalesKwd.toFixed(3)} KWD/d
                        </td>
                        <td className="px-5 py-3 text-end font-bold text-cyan-300 bg-gold-400/5">
                          {threeScenarios.realistic.dailySalesKwd.toFixed(3)} KWD/d
                        </td>
                        <td className="px-4 py-3 text-end text-emerald-300">
                          {threeScenarios.optimistic.dailySalesKwd.toFixed(3)} KWD/d
                        </td>
                      </tr>

                      {/* COGS */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans text-mist-300">
                          {isAr ? `تكلفة الطعام والتغليف COGS (${estimatedCogsPct}%)` : `Food & Packaging COGS (${estimatedCogsPct}%)`}
                        </td>
                        <td className="px-4 py-3 text-end text-rose-300">
                          {threeScenarios.conservative.cogsKwd.toFixed(3)} KWD
                        </td>
                        <td className="px-5 py-3 text-end font-bold text-rose-300 bg-gold-400/5">
                          {threeScenarios.realistic.cogsKwd.toFixed(3)} KWD
                        </td>
                        <td className="px-4 py-3 text-end text-rose-300">
                          {threeScenarios.optimistic.cogsKwd.toFixed(3)} KWD
                        </td>
                      </tr>

                      {/* Gross Profit */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans font-bold text-emerald-400">
                          {isAr ? 'إجمالي الربح (Gross Profit)' : 'Gross Profit'}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-200">
                          {threeScenarios.conservative.grossProfitKwd.toFixed(3)} KWD
                        </td>
                        <td className="px-5 py-3 text-end font-bold text-emerald-400 bg-gold-400/5">
                          {threeScenarios.realistic.grossProfitKwd.toFixed(3)} KWD
                        </td>
                        <td className="px-4 py-3 text-end text-emerald-300 font-bold">
                          {threeScenarios.optimistic.grossProfitKwd.toFixed(3)} KWD
                        </td>
                      </tr>

                      {/* Rent & Rent % of Sales */}
                      <tr className="hover:bg-white/[0.02] bg-white/[0.01]">
                        <td className="px-5 py-3 font-sans font-bold text-white flex items-center gap-2">
                          <span>{isAr ? 'إيجار البوث ونسبة الإيجار للمبيعات' : 'Booth Rent & Rent % of Sales'}</span>
                          {threeScenarios.realistic.rentWarning && (
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300 font-bold">
                              {isAr ? 'تحذير > 30%' : 'Alert > 30%'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-300">
                          {totalRentKwd.toFixed(3)} ({threeScenarios.conservative.rentToSalesPercent.toFixed(1)}%)
                        </td>
                        <td className="px-5 py-3 text-end font-bold bg-gold-400/5">
                          <span className={threeScenarios.realistic.rentWarning ? 'text-rose-400' : 'text-emerald-400'}>
                            {totalRentKwd.toFixed(3)} KWD ({threeScenarios.realistic.rentToSalesPercent.toFixed(1)}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end text-mist-300">
                          {totalRentKwd.toFixed(3)} ({threeScenarios.optimistic.rentToSalesPercent.toFixed(1)}%)
                        </td>
                      </tr>

                      {/* Staff Labor */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans text-mist-400">
                          {isAr ? `أجور العمالة الميدانية (${staffCount} موظفين)` : `Field Staff Labor (${staffCount} staff)`}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-400">{threeScenarios.conservative.staffLaborKwd.toFixed(3)}</td>
                        <td className="px-5 py-3 text-end text-mist-300 bg-gold-400/5">{threeScenarios.realistic.staffLaborKwd.toFixed(3)}</td>
                        <td className="px-4 py-3 text-end text-mist-400">{threeScenarios.optimistic.staffLaborKwd.toFixed(3)}</td>
                      </tr>

                      {/* Fit-Out & Marketing */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans text-mist-400">
                          {isAr ? 'الديكور والتسويق التأسيسي (Fit-out & Mktg)' : 'Fit-Out & Pre-Opening'}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-400">{(fitoutKwd + marketingOpexKwd).toFixed(3)}</td>
                        <td className="px-5 py-3 text-end text-mist-300 bg-gold-400/5">{(fitoutKwd + marketingOpexKwd).toFixed(3)}</td>
                        <td className="px-4 py-3 text-end text-mist-400">{(fitoutKwd + marketingOpexKwd).toFixed(3)}</td>
                      </tr>

                      {/* Net Profit */}
                      <tr className="hover:bg-white/[0.02] border-t-2 border-white/20 bg-black/40">
                        <td className="px-5 py-4 font-sans font-black text-white text-sm">
                          {isAr ? 'صافي الربح التقديري (Net Profit)' : 'Net Profit (KWD)'}
                        </td>
                        <td className="px-4 py-4 text-end font-bold text-amber-300 text-sm">
                          {threeScenarios.conservative.netProfitKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
                          <div className="text-[10px] text-mist-400 font-normal">
                            ({threeScenarios.conservative.netProfitMarginPercent.toFixed(1)}% {isAr ? 'هامش' : 'margin'})
                          </div>
                        </td>
                        <td className="px-5 py-4 text-end font-black text-gold-300 bg-gold-400/10 text-base">
                          {threeScenarios.realistic.netProfitKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
                          <div className="text-[10px] text-emerald-400 font-bold">
                            ({threeScenarios.realistic.netProfitMarginPercent.toFixed(1)}% {isAr ? 'هامش صافي' : 'net margin'})
                          </div>
                        </td>
                        <td className="px-4 py-4 text-end font-black text-emerald-400 text-base">
                          {threeScenarios.optimistic.netProfitKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD
                          <div className="text-[10px] text-emerald-300 font-bold">
                            ({threeScenarios.optimistic.netProfitMarginPercent.toFixed(1)}% {isAr ? 'هامش صافي' : 'net margin'})
                          </div>
                        </td>
                      </tr>

                      {/* ROI */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans font-bold text-white">
                          {isAr ? 'العائد على الاستثمار (ROI %)' : 'Return on Investment (ROI %)'}
                        </td>
                        <td className="px-4 py-3 text-end font-bold text-amber-300">
                          ▲ {threeScenarios.conservative.roiPercent.toFixed(1)}%
                        </td>
                        <td className="px-5 py-3 text-end font-black text-purple-300 bg-gold-400/5">
                          ▲ {threeScenarios.realistic.roiPercent.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-end font-black text-emerald-400">
                          ▲ {threeScenarios.optimistic.roiPercent.toFixed(1)}%
                        </td>
                      </tr>

                      {/* Daily Break-Even Sales */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans font-bold text-cyan-300">
                          {isAr ? 'نقطة التعادل اليومية بالدينار والطلبات' : 'Daily Break-Even Requirement'}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-300">
                          {threeScenarios.conservative.dailyBreakEvenSalesKwd.toFixed(0)} KWD ({threeScenarios.conservative.dailyBreakEvenOrders} {isAr ? 'طلب' : 'ord'})
                        </td>
                        <td className="px-5 py-3 text-end font-bold text-cyan-300 bg-gold-400/5">
                          {threeScenarios.realistic.dailyBreakEvenSalesKwd.toFixed(0)} KWD ({threeScenarios.realistic.dailyBreakEvenOrders} {isAr ? 'طلب' : 'ord'})
                        </td>
                        <td className="px-4 py-3 text-end text-mist-300">
                          {threeScenarios.optimistic.dailyBreakEvenSalesKwd.toFixed(0)} KWD ({threeScenarios.optimistic.dailyBreakEvenOrders} {isAr ? 'طلب' : 'ord'})
                        </td>
                      </tr>

                      {/* Break-Even Day */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 font-sans font-bold text-emerald-400">
                          {isAr ? 'يوم استرداد رأس المال الكامل (Break-Even Day)' : 'Break-Even Day'}
                        </td>
                        <td className="px-4 py-3 text-end text-mist-200">
                          {isAr ? `اليوم ${threeScenarios.conservative.breakEvenDay}` : `Day ${threeScenarios.conservative.breakEvenDay}`}
                        </td>
                        <td className="px-5 py-3 text-end font-black text-gold-300 bg-gold-400/5">
                          {isAr ? `اليوم ${threeScenarios.realistic.breakEvenDay} من أصل ${calculatedDays}` : `Day ${threeScenarios.realistic.breakEvenDay} of ${calculatedDays}`}
                        </td>
                        <td className="px-4 py-3 text-end text-emerald-400 font-bold">
                          {isAr ? `اليوم ${threeScenarios.optimistic.breakEvenDay}` : `Day ${threeScenarios.optimistic.breakEvenDay}`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Per-Brand Contribution in Realistic Scenario */}
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <h4 className="text-sm font-black text-white">
                  {isAr ? 'توزيع الإيراد والأرباح حسب البراندات المشاركة (السيناريو الواقعي)' : 'Brand Sales & Profit Share (Realistic Baseline)'}
                </h4>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {threeScenarios.brandBreakdown.map((b, idx) => (
                    <div key={idx} className="rounded-2xl border border-white/5 bg-black/30 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{b.brandName}</span>
                        <span className="rounded-md bg-gold-400/15 px-2 py-0.5 text-xs font-mono font-bold text-gold-300">
                          {b.sharePercent.toFixed(1)}% Share
                        </span>
                      </div>
                      <div className="space-y-1 text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-mist-400">{isAr ? 'المبيعات:' : 'Sales:'}</span>
                          <span className="font-bold text-emerald-400">{b.realisticSalesKwd.toLocaleString('en-US', { minimumFractionDigits: 3 })} KWD</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-mist-400">{isAr ? 'التكلفة COGS:' : 'COGS:'}</span>
                          <span className="text-rose-300">{b.realisticCogsKwd.toFixed(3)} KWD</span>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-1">
                          <span className="text-mist-400">{isAr ? 'الربح الإجمالي:' : 'Gross Profit:'}</span>
                          <span className="font-bold text-gold-300">{b.realisticGrossProfitKwd.toFixed(3)} KWD</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ----------------- SUB-TAB 2: AI BRAND-FIT RECOMMENDER ----------------- */}
          {studioTab === 'brand_advisor' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gold-400/20 text-gold-300">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {isAr ? 'مستشار اختيار البراند الأمثل للفعالية القادمة (AI Brand Matcher)' : 'AI Brand-Fit Selector for Upcoming Event'}
                    </h3>
                    <p className="text-xs text-mist-400">
                      {isAr
                        ? 'حدد سمات جمهور المعرض وطبيعة الأكل وساعات الذروة ليقترح النظام التوليفة الأكثر ربحية وسرعة تسليم'
                        : 'Select event crowd traits, food style, and peak timings to recommend the highest margin synergy'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Audience */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-mist-300">{isAr ? 'طبيعة الجمهور المستهدف:' : 'Target Audience:'}</label>
                    <select
                      value={advAudience}
                      onChange={(e) => setAdvAudience(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-gold-400"
                    >
                      <option value="shoppers">{isAr ? 'متسوقو معارض وبازارات (شراء سريع وقهوة)' : 'Expo Shoppers (Grab & Go)'}</option>
                      <option value="families">{isAr ? 'عائلات وأطفال (مخيمات ووجبات مشاركة)' : 'Families (Camps & Sharing)'}</option>
                      <option value="youth">{isAr ? 'شباب ورياضيون (برجر ونودلز ولوديد)' : 'Youth & Sports (Comfort Food)'}</option>
                      <option value="corporate">{isAr ? 'موظفون وضباط وزارات (غداء سريع ومشاوي)' : 'Ministry Officers & Corporate'}</option>
                    </select>
                  </div>

                  {/* Food Style */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-mist-300">{isAr ? 'طبيعة الأكل المطلوب:' : 'Food Style:'}</label>
                    <select
                      value={advStyle}
                      onChange={(e) => setAdvStyle(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-gold-400"
                    >
                      <option value="grab_and_go">{isAr ? 'وجبات سريعة محمولة Grab & Go (< 2 دقيقة)' : 'Grab & Go Fast Cups (<2m)'}</option>
                      <option value="grill_subs">{isAr ? 'ساندويتشات ساخنة وبرجر وفرايز' : 'Hot Grills & Smashed Subs'}</option>
                      <option value="family_share">{isAr ? 'صواني شاورما عائلية وبوكسات كرم' : 'Family Shawarma Sharing Trays'}</option>
                      <option value="bakery_karak">{isAr ? 'كافيه صحي ومخبوزات وشاي كرك دافئ' : 'Healthy Cafe & Karak Warmers'}</option>
                    </select>
                  </div>

                  {/* Peak Hours */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-mist-300">{isAr ? 'ساعات الذروة:' : 'Peak Hours:'}</label>
                    <select
                      value={advPeak}
                      onChange={(e) => setAdvPeak(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-gold-400"
                    >
                      <option value="all_day">{isAr ? 'طوال اليوم (تدفق مستمر 10ص - 11م)' : 'All-Day Steady (10am - 11pm)'}</option>
                      <option value="evening">{isAr ? 'ذروة مسائية فقط (5م - 11م)' : 'Evening Rush Only (5pm - 11pm)'}</option>
                      <option value="morning">{isAr ? 'ذروة صباحية (إفطار وبرنش 8ص - 2ظ)' : 'Morning Rush (Breakfast/Brunch)'}</option>
                    </select>
                  </div>
                </div>

                {/* AI Recommendation Banner */}
                <div className="mt-6 rounded-2xl border border-gold-300/40 bg-gradient-to-r from-gold-400/10 via-amber-500/10 to-transparent p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/20 px-3 py-1 text-xs font-black text-gold-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        {isAr ? 'التوليفة الذهبية الفائزة المقترحة للفعالية:' : 'Recommended Golden Synergy Concept:'}
                      </span>
                      <h4 className="mt-2 text-xl font-black text-white">
                        {advStyle === 'bakery_karak'
                          ? 'Farm Brown (منيو 6FB الصحي) + Karak Cafeteria (شاباتي وترامس)'
                          : advStyle === 'family_share'
                          ? 'Tahina (بوكسات الشاورما) + Frank\'s (سلايدرز) + Karak Cafeteria'
                          : 'The Noodle Bar (أكواب النودلز) + Frank\'s (فيلي ستيك) + Karak Cafeteria'}
                      </h4>
                      <p className="mt-1 text-xs text-mist-300 max-w-3xl">
                        {isAr
                          ? 'تحقق هذه التوليفة أعلى سرعة تحضير (أقل من 90 ثانية في طوابير الذروة) مع متوسط فاتورة 5.400 د.ك وهوامش ربح تتجاوز 68% وهدر طعام شبه معدوم.'
                          : 'Delivers sub-90s ticket velocity during peak crowds, KWD 5.400 average ticket value, and >68% gross margin with zero prep waste.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBrands(
                          advStyle === 'bakery_karak'
                            ? ['Farm Brown', 'Karak Cafeteria']
                            : advStyle === 'family_share'
                            ? ['Tahina', "Frank's", 'Karak Cafeteria']
                            : ['The Noodle Bar', "Frank's", 'Karak Cafeteria']
                        )
                        setStudioTab('feasibility')
                        showToast(isAr ? 'تم تطبيق توليفة البراندات في محاكي الجدوى!' : 'Applied brand synergy to simulator!')
                      }}
                      className="shrink-0 rounded-xl bg-gold-400 px-4 py-2 text-xs font-black text-ink-950 hover:bg-gold-300 transition-all shadow-md"
                    >
                      {isAr ? 'اعتماد التوليفة في المحاكي' : 'Apply to Simulator'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Brand Scorecard Matrix */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {BRAND_SUITABILITY_MATRIX.map((b) => (
                  <div key={b.brandKey} className="rounded-2xl border border-white/10 bg-[#0d1017] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-white text-sm">{isAr ? b.nameAr : b.nameEn}</h5>
                      <span className="rounded-lg bg-gold-400/20 px-2 py-0.5 text-xs font-black text-gold-300">
                        {b.suitabilityScore}% Match
                      </span>
                    </div>
                    <p className="text-xs text-mist-300 line-clamp-2">{isAr ? b.strengthsAr : b.strengthsEn}</p>
                    <div className="flex items-center justify-between text-xs text-mist-400 border-t border-white/5 pt-2 font-mono">
                      <span>ROI تاريخي:</span>
                      <span className="font-bold text-emerald-400">▲ {b.historicalRoiPercent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------- SUB-TAB 3: SMART EXB MENU GENERATOR ----------------- */}
          {studioTab === 'exb_menu' && (
            <div className="space-y-6">
              {/* Menu Controls & Rent Offset Bar */}
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {isAr ? 'مولّد منيو المعارض الرسمي ومحرك تسعير تعويض الإيجار' : 'Official EXB Menu & Rent-Offset Price Optimizer'}
                    </h3>
                    <p className="text-xs text-mist-400">
                      {isAr
                        ? 'يشمل قائمة EXB Menu 6FB-11/2026 الرسمية لفارم براون وقوائم بقية البراندات مع إمكانية زيادة الأسعار +5% أو +10% لحماية الربح من إيجار البوث'
                        : 'Includes official EXB Menu 6FB-11/2026 with +5% / +10% price offset tools to offset booth rental costs'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyPriceOffset(5)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
                        priceOffsetPct === 5
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-white/5 text-mist-200 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      +5% {isAr ? 'تعويض إيجار' : 'Rent Offset'}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPriceOffset(10)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all border ${
                        priceOffsetPct === 10
                          ? 'bg-amber-500 text-black border-amber-400'
                          : 'bg-white/5 text-mist-200 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      +10% {isAr ? 'تعويض إيجار' : 'Rent Offset'}
                    </button>
                    <button
                      type="button"
                      onClick={roundToNearestFils}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-mist-200 hover:bg-white/10"
                    >
                      {isAr ? 'تقريب 50 فلساً' : 'Round 0.050'}
                    </button>
                    <button
                      type="button"
                      onClick={resetExbPrices}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-mist-400 hover:text-white"
                    >
                      {isAr ? 'إعادة ضبط' : 'Reset'}
                    </button>
                    <button
                      type="button"
                      onClick={exportPosJson}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3.5 py-1.5 text-xs font-bold text-black shadow-md hover:scale-105 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{isAr ? 'تصدير لكاشير /pos' : 'Export /pos'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-mist-400">{isAr ? 'البراند:' : 'Brand:'}</span>
                    {[
                      { key: 'all', label: isAr ? 'الكل (All)' : 'All' },
                      { key: 'farm-brown', label: 'Farm Brown (6FB)' },
                      { key: 'franks', label: "Frank's" },
                      { key: 'the-noodle-bar', label: 'The Noodle Bar' },
                      { key: 'tahina', label: 'Tahina' },
                      { key: 'karak-cafeteria', label: 'Karak Cafeteria' },
                      { key: 'china-garden', label: 'China Garden' },
                    ].map((b) => (
                      <button
                        key={b.key}
                        onClick={() => setExbBrandFilter(b.key)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                          exbBrandFilter === b.key
                            ? 'bg-gold-400 text-ink-950'
                            : 'bg-black/30 text-mist-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={exbSearch}
                    onChange={(e) => setExbSearch(e.target.value)}
                    placeholder={isAr ? 'بحث بالاسم أو الكود EXFB...' : 'Search item or SKU...'}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-mist-500 outline-none focus:border-gold-400"
                  />
                </div>
              </div>

              {/* EXB Menu Table */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1017]">
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-mist-400 font-bold">
                        <th className="px-4 py-3.5 text-center">{isAr ? 'تفعيل' : 'Active'}</th>
                        <th className="px-4 py-3.5 text-start">{isAr ? 'كود المعرض' : 'EXB SKU'}</th>
                        <th className="px-5 py-3.5 text-start">{isAr ? 'اسم الصنف والتصنيف' : 'Item Description'}</th>
                        <th className="px-3 py-3.5 text-start">{isAr ? 'البراند' : 'Brand'}</th>
                        <th className="px-3 py-3.5 text-end">{isAr ? 'سعر المطعم' : 'Branch Price'}</th>
                        <th className="px-3 py-3.5 text-end text-mist-400">{isAr ? 'سعر 2024/2025' : 'Prev EXB'}</th>
                        <th className="px-4 py-3.5 text-end font-black text-gold-300 bg-gold-400/5">
                          {isAr ? 'سعر المعرض الجديد' : 'New EXB Price'}
                        </th>
                        <th className="px-3 py-3.5 text-end text-rose-300">{isAr ? 'التكلفة COGS' : 'Cost KWD'}</th>
                        <th className="px-3 py-3.5 text-center">{isAr ? 'الهامش %' : 'Margin %'}</th>
                        <th className="px-3 py-3.5 text-center">{isAr ? 'سرعة التحضير' : 'Speed'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {filteredExbMenu.map((item) => {
                        const marginKwd = item.recommendedExbPriceKwd - item.foodPackagingCogsKwd
                        const marginPct = item.recommendedExbPriceKwd > 0 ? (marginKwd / item.recommendedExbPriceKwd) * 100 : 0
                        return (
                          <tr key={item.code} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={item.activeOnMenu}
                                onChange={() => {
                                  setExbMenuList((prev) =>
                                    prev.map((i) => (i.code === item.code ? { ...i, activeOnMenu: !i.activeOnMenu } : i))
                                  )
                                }}
                                className="accent-gold-400"
                              />
                            </td>
                            <td className="px-4 py-3 font-bold text-cyan-300">
                              {item.code}
                              {item.isSpecialSpecialty && (
                                <span className="ms-1 rounded bg-gold-400/20 px-1 py-0.2 text-[9px] text-gold-300">
                                  ★ Special
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 font-sans">
                              <div className="font-bold text-white">{isAr ? item.nameAr : item.nameEn}</div>
                              <div className="text-[10px] text-mist-400">{isAr ? item.categoryAr : item.categoryEn}</div>
                            </td>
                            <td className="px-3 py-3 font-sans text-mist-300">{isAr ? item.brandNameAr : item.brandNameEn}</td>
                            <td className="px-3 py-3 text-end text-mist-400">{item.standardBranchPriceKwd.toFixed(3)}</td>
                            <td className="px-3 py-3 text-end text-mist-500">{item.previousExbPriceKwd.toFixed(3)}</td>
                            <td className="px-4 py-3 text-end font-black text-gold-300 bg-gold-400/5 text-sm">
                              {item.recommendedExbPriceKwd.toFixed(3)} KWD
                            </td>
                            <td className="px-3 py-3 text-end text-rose-300 font-bold">{item.foodPackagingCogsKwd.toFixed(3)}</td>
                            <td className="px-3 py-3 text-center font-bold text-emerald-400">{marginPct.toFixed(1)}%</td>
                            <td className="px-3 py-3 text-center font-sans text-cyan-300 text-[11px]">
                              {item.prepTimeSeconds}s
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- SUB-TAB 4: HISTORICAL BENCHMARKS RADAR ----------------- */}
          {studioTab === 'historical_radar' && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-black text-white">
                      {isAr ? 'رادار المقارنة المباشرة: الفعالية القادمة مقابل الفعاليات السابقة' : 'Historical Benchmarking Radar: Proposed vs Historical Archive'}
                    </h3>
                    <p className="text-xs text-mist-400">
                      {isAr
                        ? 'مقارنة الفعالية القادمة مع أرشيف مخيم السفير الفعلي والميزانية، ومعرض العطور بمشرف، ومخيمات الدفاع والداخلية'
                        : 'Benchmark your proposed event against Safir Camp Actual & Budget, Mishref Expo, MOD & MOI Camps'}
                    </p>
                  </div>

                  <span className={`rounded-xl px-3.5 py-1.5 text-xs font-black border ${plannedEventVerdict.color}`}>
                    {isAr ? plannedEventVerdict.badgeAr : plannedEventVerdict.badgeEn}
                  </span>
                </div>

                <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/5 text-xs text-mist-200">
                  <strong>{isAr ? 'الرأي الاستشاري المالي للمنظومة:' : 'Advisory Recommendation:'}</strong>{' '}
                  {isAr ? plannedEventVerdict.adviceAr : plannedEventVerdict.adviceEn}
                </div>
              </div>

              {/* Benchmarking Comparison Table */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1017]">
                <div className="overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02] text-mist-400 font-bold">
                        <th className="px-5 py-3.5 text-start">{isAr ? 'الفعالية / الحدث' : 'Event Project'}</th>
                        <th className="px-3 py-3.5 text-center">{isAr ? 'الموسم والأيام' : 'Days'}</th>
                        <th className="px-3 py-3.5 text-end">{isAr ? 'الإيجار اليومي' : 'Daily Rent'}</th>
                        <th className="px-4 py-3.5 text-end">{isAr ? 'المبيعات اليومية' : 'Daily Sales'}</th>
                        <th className="px-3 py-3.5 text-end text-cyan-300">{isAr ? 'تعادل يومي' : 'Daily BEP'}</th>
                        <th className="px-3 py-3.5 text-center">{isAr ? 'نسبة الإيجار' : 'Rent %'}</th>
                        <th className="px-4 py-3.5 text-end">{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                        <th className="px-3 py-3.5 text-center">{isAr ? 'العائد ROI' : 'ROI %'}</th>
                        <th className="px-4 py-3.5 text-start">{isAr ? 'القرار الاستشاري' : 'Advisory Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {/* Proposed Event First */}
                      <tr className="bg-gold-400/10 font-bold">
                        <td className="px-5 py-4 font-sans font-black text-gold-300">
                          ★ {isAr ? eventNameAr : eventNameEn} ({isAr ? 'المقترح الجديد' : 'Target Planned'})
                        </td>
                        <td className="px-3 py-4 text-center text-white">{calculatedDays} {isAr ? 'يوماً' : 'd'}</td>
                        <td className="px-3 py-4 text-end text-white">{threeScenarios.dailyRentKwd.toFixed(3)} KWD</td>
                        <td className="px-4 py-4 text-end text-emerald-400 font-black">
                          {threeScenarios.realistic.dailySalesKwd.toFixed(3)} KWD
                        </td>
                        <td className="px-3 py-4 text-end text-cyan-300">
                          {threeScenarios.realistic.dailyBreakEvenSalesKwd.toFixed(0)} KWD
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className={threeScenarios.realistic.rentWarning ? 'text-rose-400' : 'text-emerald-400'}>
                            {threeScenarios.realistic.rentToSalesPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-end text-gold-300 font-black">
                          {threeScenarios.realistic.netProfitKwd.toLocaleString('en-US', { minimumFractionDigits: 0 })} KWD
                        </td>
                        <td className="px-3 py-4 text-center text-purple-300 font-black">
                          ▲ {threeScenarios.realistic.roiPercent.toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 font-sans text-[11px]">
                          <span className={`rounded-md px-2 py-0.5 font-bold ${plannedEventVerdict.color}`}>
                            {plannedEventVerdict.status === 'highly_viable' ? 'عالية الجدوى' : 'تتطلب تفاوض'}
                          </span>
                        </td>
                      </tr>

                      {/* Historical Benchmarks */}
                      {HISTORICAL_BENCHMARKS.map((bench) => (
                        <tr key={bench.id} className="hover:bg-white/[0.02]">
                          <td className="px-5 py-3.5 font-sans font-medium text-white">
                            {isAr ? bench.nameAr : bench.nameEn}
                            <div className="text-[10px] text-mist-400">{bench.periodSeason}</div>
                          </td>
                          <td className="px-3 py-3.5 text-center text-mist-300">{bench.daysCount} d</td>
                          <td className="px-3 py-3.5 text-end text-mist-400">{bench.dailyRentKwd.toFixed(3)}</td>
                          <td className="px-4 py-3.5 text-end font-bold text-emerald-400">{bench.dailySalesKwd.toFixed(3)}</td>
                          <td className="px-3 py-3.5 text-end text-cyan-300">{bench.dailyBreakEvenKwd.toFixed(0)}</td>
                          <td className="px-3 py-3.5 text-center text-mist-300">{bench.rentToSalesPercent.toFixed(1)}%</td>
                          <td className="px-4 py-3.5 text-end font-bold text-gold-300">{bench.netProfitKwd.toLocaleString()}</td>
                          <td className="px-3 py-3.5 text-center text-purple-300">▲ {bench.roiPercent.toFixed(1)}%</td>
                          <td className="px-4 py-3.5 font-sans text-[11px] text-mist-400 line-clamp-1">
                            {isAr ? bench.verdictAr : bench.verdictEn}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- SUB-TAB 5: SITE MAP & 1-CLICK APPROVAL PACK ----------------- */}
          {studioTab === 'approval_pack' && (
            <div className="space-y-6">
              {/* Site Map & Booth Layout Schematic */}
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-400/20 text-cyan-300">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        {isAr ? 'مخطط الموقع الهندسي وتوزيع البوثات (Booth Layout Schematic)' : 'Interactive Site Map & Booth Allocation'}
                      </h3>
                      <p className="text-xs text-mist-400">
                        {isAr
                          ? `مساحة بوث فنتشر فودز: ${boothCount} بوث بمقاس (${boothLengthM}م × ${boothWidthM}م) بإجمالي ${totalBoothAreaSqM} م² بجوار منطقة الجلوس وخدمة الطعام`
                          : `Venture Foods location: ${boothCount} booths (${boothLengthM}m × ${boothWidthM}m) total ${totalBoothAreaSqM} sqm adjacent to food court`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visual Schematic Diagram */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/60 p-6 relative overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 text-center text-xs">
                    {/* Entrance */}
                    <div className="col-span-12 rounded-xl border border-dashed border-cyan-400/40 bg-cyan-500/10 p-2 font-bold text-cyan-300">
                      🚪 {isAr ? 'البوابة الرئيسية ومدخل الزوار (Main Entrance & Ticket Hub)' : 'Main Entrance'}
                    </div>

                    {/* Left Corridor */}
                    <div className="col-span-3 rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-center text-mist-400">
                      <span>🚶 {isAr ? 'ممر المشاة' : 'Walkway'}</span>
                      <span className="text-[10px] text-mist-500">{isAr ? 'تدفق الزوار 100%' : 'High Traffic'}</span>
                    </div>

                    {/* VENTURE FOODS BOOTHS (HERO) */}
                    <div className="col-span-6 rounded-2xl border-2 border-gold-400 bg-gradient-to-br from-gold-400/20 to-amber-600/20 p-5 shadow-xl">
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-gold-400 px-2 py-0.5 text-[10px] font-black text-black">
                          VENTURE FOODS W.L.L.
                        </span>
                        <span className="font-mono text-xs font-bold text-gold-300">
                          {boothLengthM}m × {boothWidthM}m (x{boothCount})
                        </span>
                      </div>
                      <h4 className="mt-2 text-base font-black text-white">
                        {selectedBrands.join(' + ')}
                      </h4>
                      <div className="mt-2 flex flex-wrap justify-center gap-2 text-[10px]">
                        <span className="rounded bg-black/60 px-2 py-1 text-cyan-300">⚡ 3-Phase 32A Power</span>
                        <span className="rounded bg-black/60 px-2 py-1 text-emerald-300">📶 POS 5G Router</span>
                        <span className="rounded bg-black/60 px-2 py-1 text-amber-300">🚚 Al-Qurain Van Gate</span>
                      </div>
                    </div>

                    {/* Right Corridor */}
                    <div className="col-span-3 rounded-xl border border-white/5 bg-white/5 p-4 flex flex-col justify-center text-mist-400">
                      <span>🍽️ {isAr ? 'منطقة الجلوس' : 'Food Court'}</span>
                      <span className="text-[10px] text-mist-500">{isAr ? 'طاولات الطعام' : 'Dining Area'}</span>
                    </div>

                    {/* Bottom Logistics Bay */}
                    <div className="col-span-12 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-500/10 p-2 font-bold text-emerald-300">
                      🚛 {isAr ? 'بوابة النقل اللوجستي والمطبخ المركزي بالقرين (Central Kitchen Loading Bay)' : 'Loading Bay Access'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Phase Logistics Execution Checklist */}
              <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h3 className="text-base font-black text-white">
                    {isAr ? 'قائمة مهام تنفيذ الفعالية اللوجستية (4-Phase Execution Checklist)' : '4-Phase Project Execution Checklist'}
                  </h3>
                  <span className="text-xs text-mist-400">
                    {tasks.filter((t) => t.status === 'completed').length} / {tasks.length} {isAr ? 'مكتمل' : 'done'}
                  </span>
                </div>

                <div className="mt-4 divide-y divide-white/5">
                  {tasks.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => toggleTask(t.id)}
                      className="flex cursor-pointer items-start justify-between gap-4 py-3 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className={`h-5 w-5 rounded-lg border grid place-items-center ${
                            t.status === 'completed'
                              ? 'border-emerald-500 bg-emerald-500 text-black'
                              : 'border-white/20 bg-black/40'
                          }`}
                        >
                          {t.status === 'completed' && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>
                        <span className={`text-xs font-bold ${t.status === 'completed' ? 'line-through text-mist-400' : 'text-white'}`}>
                          {isAr ? t.titleAr : t.titleEn}
                        </span>
                      </div>
                      <span className="text-[11px] text-mist-400 font-mono">{t.assignee}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* OFFICIAL EXECUTIVE APPROVAL PACK (PRINT-READY) */}
              <div className="rounded-3xl border-2 border-gold-400/40 bg-white text-ink-950 p-8 shadow-2xl print:m-0 print:border-none print:p-0">
                {/* Venture Foods Official Header */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black tracking-tight">شركة فنتشر فودز لإدارة المطاعم ذ.م.م.</h2>
                    <p className="text-xs font-bold text-slate-700">VENTURE FOODS RESTAURANT MANAGEMENT CO. W.L.L. (CR 412891)</p>
                    <p className="text-[11px] text-slate-600">Al-Qurain Central Kitchen & HQ · State of Kuwait</p>
                  </div>
                  <div className="text-end">
                    <span className="rounded bg-slate-900 px-3 py-1 text-xs font-black text-white">
                      EXPO PARTICIPATION APPROVAL PACK
                    </span>
                    <p className="mt-1 text-[11px] font-mono text-slate-600">Ref: VF-EXB-{new Date().getFullYear()}-04</p>
                    <p className="text-[10px] text-slate-500">Date: {new Date().toLocaleDateString('en-GB')}</p>
                  </div>
                </div>

                {/* Event Executive Summary Box */}
                <div className="mt-6 rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs">
                  <h4 className="font-black text-sm text-slate-900 mb-2">1. استمارة المشاركة والبيانات العامة للفعالية</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-800">
                    <div><strong>اسم الفعالية:</strong> {eventNameAr}</div>
                    <div><strong>الجهة المنظمة:</strong> {organizerAr}</div>
                    <div><strong>الموقع:</strong> {locationAr}</div>
                    <div><strong>المدة:</strong> {calculatedDays} يوماً ({startDate} إلى {endDate})</div>
                    <div><strong>عدد البوثات والمساحة:</strong> {boothCount} بوث بمقاس ({boothLengthM}م × {boothWidthM}م = {totalBoothAreaSqM} م²)</div>
                    <div><strong>إجمالي الإيجار:</strong> {totalRentKwd.toFixed(3)} د.ك (معدل {threeScenarios.dailyRentKwd.toFixed(3)} د.ك/يوم)</div>
                    <div><strong>التأمين المسترد:</strong> {threeScenarios.securityDepositKwd.toFixed(3)} د.ك (GL 110400)</div>
                    <div><strong>البراندات المشاركة:</strong> {selectedBrands.join(' + ')}</div>
                  </div>
                </div>

                {/* Financial 3-Scenario Summary Table */}
                <div className="mt-6 text-xs">
                  <h4 className="font-black text-sm text-slate-900 mb-2">2. جدول دراسة الجدوى وتوقعات الأرباح والخسائر (P&L 3-Scenario)</h4>
                  <table className="w-full border-collapse border border-slate-300 text-center">
                    <thead>
                      <tr className="bg-slate-200 font-bold text-slate-900">
                        <th className="border border-slate-300 p-2 text-start">البيان المالي</th>
                        <th className="border border-slate-300 p-2">السيناريو المتحفظ (80%)</th>
                        <th className="border border-slate-300 p-2 bg-slate-300 font-black">السيناريو الواقعي (100%)</th>
                        <th className="border border-slate-300 p-2">السيناريو المتفائل (125%)</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr>
                        <td className="border border-slate-300 p-2 text-start font-sans">إجمالي المبيعات (Gross Sales)</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.conservative.grossSalesKwd.toFixed(3)} د.ك</td>
                        <td className="border border-slate-300 p-2 font-bold bg-slate-50">{threeScenarios.realistic.grossSalesKwd.toFixed(3)} د.ك</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.optimistic.grossSalesKwd.toFixed(3)} د.ك</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-start font-sans">تكلفة الأغذية COGS ({estimatedCogsPct}%)</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.conservative.cogsKwd.toFixed(3)} د.ك</td>
                        <td className="border border-slate-300 p-2 bg-slate-50">{threeScenarios.realistic.cogsKwd.toFixed(3)} د.ك</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.optimistic.cogsKwd.toFixed(3)} د.ك</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-start font-sans">نسبة الإيجار للمبيعات (Rent %)</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.conservative.rentToSalesPercent.toFixed(1)}%</td>
                        <td className="border border-slate-300 p-2 font-bold bg-slate-50">{threeScenarios.realistic.rentToSalesPercent.toFixed(1)}%</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.optimistic.rentToSalesPercent.toFixed(1)}%</td>
                      </tr>
                      <tr className="bg-slate-100 font-bold">
                        <td className="border border-slate-300 p-2 text-start font-sans">صافي الربح التقديري (Net Profit)</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.conservative.netProfitKwd.toFixed(3)} د.ك</td>
                        <td className="border border-slate-300 p-2 font-black bg-slate-200">{threeScenarios.realistic.netProfitKwd.toFixed(3)} د.ك</td>
                        <td className="border border-slate-300 p-2">{threeScenarios.optimistic.netProfitKwd.toFixed(3)} د.ك</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-start font-sans">العائد على الاستثمار (ROI %)</td>
                        <td className="border border-slate-300 p-2">▲ {threeScenarios.conservative.roiPercent.toFixed(1)}%</td>
                        <td className="border border-slate-300 p-2 font-bold bg-slate-50">▲ {threeScenarios.realistic.roiPercent.toFixed(1)}%</td>
                        <td className="border border-slate-300 p-2">▲ {threeScenarios.optimistic.roiPercent.toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 text-start font-sans">يوم تحقيق التعادل واسترداد رأس المال</td>
                        <td className="border border-slate-300 p-2">اليوم {threeScenarios.conservative.breakEvenDay}</td>
                        <td className="border border-slate-300 p-2 font-bold bg-slate-50">اليوم {threeScenarios.realistic.breakEvenDay}</td>
                        <td className="border border-slate-300 p-2">اليوم {threeScenarios.optimistic.breakEvenDay}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Approved EXB Menu Sample */}
                <div className="mt-6 text-xs">
                  <h4 className="font-black text-sm text-slate-900 mb-2">3. قائمة أسعار المعرض المعتمدة (Approved EXB Menu & Pricing)</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-800">
                    {exbMenuList.filter((i) => i.activeOnMenu).slice(0, 8).map((item) => (
                      <div key={item.code} className="border-b border-slate-200 pb-1 flex justify-between">
                        <span><strong>{item.code}:</strong> {item.nameAr}</span>
                        <span className="font-mono font-bold">{item.recommendedExbPriceKwd.toFixed(3)} KWD</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Executive Approval & Signatures Matrix */}
                <div className="mt-8 border-t-2 border-slate-900 pt-4">
                  <h4 className="font-black text-sm text-slate-900 mb-4">4. مصفوفة الاعتماد والتوقيع الرسمي للشركاء والإدارة</h4>
                  <div className="grid grid-cols-4 gap-4 text-center text-xs">
                    <div className="border border-slate-300 rounded p-3">
                      <div className="font-bold text-slate-900">إدارة العمليات (Operations)</div>
                      <div className="text-[10px] text-slate-600 mt-1">Choukrallah Nassif</div>
                      <div className="mt-6 border-b border-slate-400"></div>
                      <div className="text-[9px] text-slate-500 mt-1">التوقيع / التاريخ</div>
                    </div>

                    <div className="border border-slate-300 rounded p-3">
                      <div className="font-bold text-slate-900">الإدارة المالية (Finance)</div>
                      <div className="text-[10px] text-slate-600 mt-1">Hesham (Controller)</div>
                      <div className="mt-6 border-b border-slate-400"></div>
                      <div className="text-[9px] text-slate-500 mt-1">التوقيع / التاريخ</div>
                    </div>

                    <div className="border border-slate-300 rounded p-3">
                      <div className="font-bold text-slate-900">أمين السر والشؤون القانونية</div>
                      <div className="text-[10px] text-slate-600 mt-1">Abdullah Abdulghafar</div>
                      <div className="mt-6 border-b border-slate-400"></div>
                      <div className="text-[9px] text-slate-500 mt-1">التوقيع / التاريخ</div>
                    </div>

                    <div className="border-2 border-slate-900 rounded p-3 bg-slate-50">
                      <div className="font-black text-slate-900">اعتماد الشركاء والمدير العام</div>
                      <div className="text-[10px] text-slate-700 mt-1">Ahmed Al-Abdulmohsen & Ahmed Al-Ebrahim</div>
                      <div className="mt-6 border-b-2 border-slate-900"></div>
                      <div className="text-[9px] text-slate-600 mt-1">الختم والتوقيع الرسمي</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: HISTORICAL EVENTS ARCHIVE & BENCHMARK MATRIX                       */}
      {/* ========================================================================= */}
      {viewMode === 'archive' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0d1017] p-6">
            <h3 className="text-base font-black text-white">
              {isAr ? 'أرشيف الفعاليات والمخيمات التاريخية المعتمدة' : 'Audited Historical Events & Camps Archive'}
            </h3>
            <p className="text-xs text-mist-400">
              {isAr
                ? 'السجلات الفعلية لفعاليات أرض المعارض بمشرف، مخيمات وزارة الدفاع، مخيمات وزارة الداخلية، وبازار فندق السفير'
                : 'Historical actual operational data for Mishref Fairground, MOD & MOI camps, and Safir Hotel Pop-Ups'}
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d1017]">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-mist-400 font-bold">
                    <th className="px-5 py-3.5 text-start">{isAr ? 'كود واسم الفعالية' : 'Event & Code'}</th>
                    <th className="px-3 py-3.5 text-center">{isAr ? 'المدة' : 'Days'}</th>
                    <th className="px-3 py-3.5 text-end">{isAr ? 'التكلفة الإجمالية' : 'Total Cost'}</th>
                    <th className="px-4 py-3.5 text-end">{isAr ? 'المبيعات' : 'Sales'}</th>
                    <th className="px-3 py-3.5 text-end text-cyan-300">{isAr ? 'السرعة اليومية' : 'Daily Velocity'}</th>
                    <th className="px-4 py-3.5 text-end">{isAr ? 'صافي الربح' : 'Net Profit'}</th>
                    <th className="px-3 py-3.5 text-center">{isAr ? 'العائد ROI' : 'ROI %'}</th>
                    <th className="px-3 py-3.5 text-center">{isAr ? 'التأمين' : 'Deposit'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {VENTURE_FOODS_EVENTS.map((evt) => (
                    <tr key={evt.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 font-sans">
                        <span className="font-mono text-gold-400 font-bold text-[11px]">{evt.code}</span>
                        <div className="font-bold text-white text-xs">{isAr ? evt.nameAr : evt.nameEn}</div>
                        <div className="text-[10px] text-mist-400">{evt.primaryBrands.join(' + ')}</div>
                      </td>
                      <td className="px-3 py-3.5 text-center text-white">{evt.daysCount} d</td>
                      <td className="px-3 py-3.5 text-end text-rose-300">{evt.costs.totalCostsKwd.toFixed(3)}</td>
                      <td className="px-4 py-3.5 text-end font-bold text-emerald-400">{evt.revenue.grossSalesKwd.toFixed(3)}</td>
                      <td className="px-3 py-3.5 text-end text-cyan-300">{evt.revenue.dailySalesVelocityKwd.toFixed(0)} KWD/d</td>
                      <td className="px-4 py-3.5 text-end font-bold text-gold-300">{evt.profitability.netProfitKwd.toFixed(3)}</td>
                      <td className="px-3 py-3.5 text-center text-purple-300 font-bold">▲ {evt.profitability.roiPercent.toFixed(1)}%</td>
                      <td className="px-3 py-3.5 text-center font-sans">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
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
    </div>
  )
}
