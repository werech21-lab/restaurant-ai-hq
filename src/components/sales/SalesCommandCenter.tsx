'use client'

import React, { useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Truck,
  Building2,
  Sparkles,
  Clock,
  Download,
  Printer,
  Layers,
  Search,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sun,
  Moon,
  UtensilsCrossed,
  DollarSign,
  Coffee,
  PieChart,
  Award,
  ChevronRight,
  ChevronLeft,
  Share2,
  ExternalLink,
  Info,
} from 'lucide-react'

import {
  OCTOBER_BRAND_SCORECARDS,
  OCTOBER_CHANNEL_SCORECARDS,
  TOP_BEST_SELLERS,
  SLOW_MOVERS_LIST,
  ACTION_PLAYBOOKS,
  CATEGORY_BREAKDOWN,
  OCTOBER_AGGREGATOR_AUDIT,
  OCTOBER_BRANCH_PERFORMANCE,
  OCTOBER_HOURLY_HEATMAP,
  STRATEGIC_15_REPORTS,
  computeFilteredDashboard,
  type BrandKey,
  type ChannelKey,
} from '@/lib/analytics/brand-sales-october-data'

export type SalesTabId =
  | 'scorecard'
  | 'aggregators'
  | 'menu'
  | 'slow-movers'
  | 'branches'
  | 'upselling'
  | 'live-invoices'
  | 'reports'

interface Props {
  initialLocale?: 'ar' | 'en'
  initialTab?: SalesTabId
  liveChildren?: React.ReactNode
}

export function SalesCommandCenter({ initialLocale = 'ar', initialTab = 'scorecard', liveChildren }: Props) {
  const [locale, setLocale] = useState<'ar' | 'en'>(initialLocale)
  const isAr = locale === 'ar'
  const [printMode, setPrintMode] = useState(false)
  const [activeTab, setActiveTab] = useState<SalesTabId>(initialTab)

  // Top Filters
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('ALL')
  const [selectedChannel, setSelectedChannel] = useState<ChannelKey>('ALL')
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL')
  const [period, setPeriod] = useState<string>('october-2026')

  // Menu Search & Filter
  const [menuSearch, setMenuSearch] = useState('')
  const [selectedQuadrant, setSelectedQuadrant] = useState<'ALL' | 'TopPerformer' | 'HighDemand' | 'HighMargin' | 'SlowMover'>('ALL')

  // Playbook execution toast / tracker
  const [executedPlaybooks, setExecutedPlaybooks] = useState<Record<string, number>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Compute filtered dashboard metrics
  const dashboard = useMemo(
    () => computeFilteredDashboard(selectedBrand, selectedChannel),
    [selectedBrand, selectedChannel]
  )

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Export CSV Helper
  const handleExportCSV = (filename: string, content: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast(isAr ? `تم تصدير ملف ${filename} بنجاح` : `Exported ${filename} successfully`)
  }

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return TOP_BEST_SELLERS.filter((item) => {
      const matchBrand = selectedBrand === 'ALL' || item.brand === selectedBrand
      const matchQuadrant = selectedQuadrant === 'ALL' || item.classification === selectedQuadrant
      const matchSearch =
        !menuSearch ||
        item.nameAr.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.nameEn.toLowerCase().includes(menuSearch.toLowerCase()) ||
        item.brand.toLowerCase().includes(menuSearch.toLowerCase())
      return matchBrand && matchQuadrant && matchSearch
    })
  }, [selectedBrand, selectedQuadrant, menuSearch])

  // Filtered branch performance
  const filteredBranches = useMemo(() => {
    if (selectedBranch === 'ALL') return OCTOBER_BRANCH_PERFORMANCE
    return OCTOBER_BRANCH_PERFORMANCE.filter((b) => b.id === selectedBranch)
  }, [selectedBranch])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className={`min-h-screen transition-colors duration-200 ${
        printMode ? 'bg-slate-50 text-slate-900' : 'bg-[#0a0d12] text-slate-100'
      } pb-20`}
    >
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/90 px-5 py-3.5 text-sm font-semibold text-emerald-200 shadow-2xl backdrop-blur-md">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Executive Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8cc63f] to-[#00a99d] shadow-lg shadow-emerald-500/20">
              <BarChart3 className="text-black" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight sm:text-xl">
                  {isAr
                    ? 'مركز قيادة المبيعات، القنوات، وهندسة المنيو'
                    : 'Enterprise Sales, Channel & Menu Command Center'}
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Oct 2026 Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isAr
                  ? 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م. · 6 براندات · 10 فروع · 11 قناة بيع · 364 صنفاً'
                  : 'Venture Foods Restaurant Management W.L.L. · 6 Brands · 10 Branches · 11 Channels'}
              </p>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedBrand('ALL')
                setSelectedChannel('ALL')
                setSelectedBranch('ALL')
              }}
              title={isAr ? 'إعادة ضبط الفلاتر' : 'Reset filters'}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">{isAr ? 'إعادة ضبط' : 'Reset'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPrintMode(!printMode)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              {printMode ? <Moon size={14} /> : <Sun size={14} />}
              <span className="hidden sm:inline">
                {printMode ? (isAr ? 'الوضع الداكن' : 'Dark Mode') : isAr ? 'وضع الطباعة' : 'Print Mode'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocale(isAr ? 'en' : 'ar')}
              className="flex items-center gap-1.5 rounded-xl border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs font-bold text-gold-300 hover:bg-gold-400/20"
            >
              {isAr ? 'English' : 'العربية'}
            </button>

            <a
              href="/erp/brand-sales-analytics"
              className="flex items-center gap-1.5 rounded-xl border border-[#8cc63f]/30 bg-[#8cc63f]/10 px-3 py-2 text-xs font-bold text-[#8cc63f] hover:bg-[#8cc63f]/20"
            >
              <ExternalLink size={14} />
              <span>{isAr ? 'لوحة أكتوبر التفاعلية' : 'Oct Analytics View'}</span>
            </a>
          </div>
        </div>

        {/* Global Multi-Dimension Filters */}
        <div className="mx-auto mt-4 grid max-w-[1600px] grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Brand Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">
              {isAr ? 'العلامة التجارية (Brand)' : 'Brand'}
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value as BrandKey)}
              className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">{isAr ? 'جميع البراندات (All 6 Brands)' : 'All 6 Brands'}</option>
              <option value="China Garden">China Garden (تشاينا جاردن)</option>
              <option value="Frank's">{"Frank's (فرانكس ستيك)"}</option>
              <option value="Tahina">Tahina (شاورما طحينة)</option>
              <option value="Farm Brown">Farm Brown (فارم براون)</option>
              <option value="The Noodle Bar">The Noodle Bar (ذا نودل بار)</option>
              <option value="Karak Cafeteria">Karak Cafeteria (كرك كافيتريا)</option>
            </select>
          </div>

          {/* Channel Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">
              {isAr ? 'قناة البيع (Sales Channel)' : 'Channel'}
            </label>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value as ChannelKey)}
              className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">{isAr ? 'جميع القنوات (All 11 Channels)' : 'All 11 Channels'}</option>
              <option value="Shop Sales">{isAr ? 'مبيعات الصالة (Shop Sales)' : 'Shop Sales'}</option>
              <option value="Talabat Go">{isAr ? 'طلبات جو (Talabat Go)' : 'Talabat Go'}</option>
              <option value="Keeta">Keeta (كيتا)</option>
              <option value="Talabat MP">{isAr ? 'طلبات ماركت (Talabat MP)' : 'Talabat MP'}</option>
              <option value="Deliveroo Core">Deliveroo Core (ديليفرو)</option>
              <option value="Direct">Direct Web (الموقع المباشر)</option>
              <option value="Snoonu">Snoonu (سنونو)</option>
              <option value="Jahez">Jahez (جاهز)</option>
              <option value="Phone">{isAr ? 'الهاتف (Phone)' : 'Phone'}</option>
              <option value="Deliveroo MP">Deliveroo MP</option>
              <option value="Whatsapp">{isAr ? 'الواتساب (WhatsApp)' : 'WhatsApp'}</option>
            </select>
          </div>

          {/* Branch Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">
              {isAr ? 'الفرع (Branch)' : 'Branch'}
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="ALL">{isAr ? 'جميع الفروع الـ 10' : 'All 10 Branches'}</option>
              {OCTOBER_BRANCH_PERFORMANCE.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </div>

          {/* Period Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-400">
              {isAr ? 'الفترة الزمنية (Period)' : 'Period'}
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-emerald-500"
            >
              <option value="october-2026">{isAr ? 'أكتوبر 2026 (معتمد ومدقق)' : 'October 2026 (Live Audited)'}</option>
              <option value="q3-2026">{isAr ? 'الربع الثالث Q3 2026' : 'Q3 2026'}</option>
              <option value="ytd-2026">{isAr ? 'مجمع العام YTD 2026' : 'YTD 2026'}</option>
              <option value="live-db">{isAr ? 'بيانات قاعدة البيانات الحية' : 'Live Database'}</option>
            </select>
          </div>
        </div>
      </header>

      {/* 8 Specialized Command Tabs Bar */}
      <nav className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 py-2 text-xs font-bold scrollbar-none sm:px-6">
          {[
            {
              id: 'scorecard' as SalesTabId,
              labelAr: '📊 بطاقة البراندات والقنوات',
              labelEn: 'Brand & Channel Scorecard',
            },
            {
              id: 'aggregators' as SalesTabId,
              labelAr: '🛵 تدقيق المنصات والتسويات',
              labelEn: 'Aggregator Audit & Payout',
            },
            {
              id: 'menu' as SalesTabId,
              labelAr: '🍽️ مصفوفة ربحية الأصناف وهندسة المنيو',
              labelEn: 'Menu Profitability Matrix',
            },
            {
              id: 'slow-movers' as SalesTabId,
              labelAr: '⚡ معالجة الأصناف البطيئة (7 خطط)',
              labelEn: 'Slow Movers & 7 Playbooks',
            },
            {
              id: 'branches' as SalesTabId,
              labelAr: '🏢 أداء الفروع الـ 10 والخريطة الحرارية',
              labelEn: '10 Branches & Heatmap',
            },
            {
              id: 'upselling' as SalesTabId,
              labelAr: '🎯 إضافات الأطباق والبيع المتقاطع',
              labelEn: 'Upselling & Add-ons',
            },
            {
              id: 'live-invoices' as SalesTabId,
              labelAr: '🧾 فواتير البيع الحية والعملاء',
              labelEn: 'Live Invoices & Customers',
            },
            {
              id: 'reports' as SalesTabId,
              labelAr: '📑 الأرشيف و 15 تقريراً تصديرياً',
              labelEn: '15 Strategic Reports',
            },
          ].map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 transition-all ${
                  active
                    ? 'bg-gradient-to-r from-[#8cc63f] to-[#00a99d] text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6">
        {/* ======================================================== */}
        {/* TAB 1: Brand & Channel Scorecard */}
        {/* ======================================================== */}
        {activeTab === 'scorecard' && (
          <div className="space-y-6">
            {/* Top 6 KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                {
                  labelAr: 'صافي المبيعات',
                  labelEn: 'Net Sales',
                  value: `${dashboard.kpi.netSalesKwd.toLocaleString()} KWD`,
                  subAr: `حصة المجموعة ${dashboard.kpi.shareOfGroupPercent}%`,
                  subEn: `Group share: ${dashboard.kpi.shareOfGroupPercent}%`,
                  color: 'emerald',
                },
                {
                  labelAr: 'عدد الطلبات',
                  labelEn: 'Total Orders',
                  value: dashboard.kpi.orders.toLocaleString(),
                  subAr: 'معدل الإنجاز 99.4%',
                  subEn: 'Fulfillment: 99.4%',
                  color: 'sky',
                },
                {
                  labelAr: 'متوسط قيمة الطلب (AOV)',
                  labelEn: 'Avg Order Value',
                  value: `${dashboard.kpi.avgOrderValueKwd.toFixed(3)} KWD`,
                  subAr: 'الهدف: 6.000 KWD',
                  subEn: 'Target: 6.000 KWD',
                  color: 'amber',
                },
                {
                  labelAr: 'الأصناف المباعة',
                  labelEn: 'Items Sold',
                  value: dashboard.kpi.itemsSold.toLocaleString(),
                  subAr: '2.61 صنف / طلب',
                  subEn: '2.61 items/order',
                  color: 'indigo',
                },
                {
                  labelAr: 'الخصومات الممنوحة',
                  labelEn: 'Discounts Given',
                  value: `${dashboard.kpi.discountsGivenKwd.toLocaleString()} KWD`,
                  subAr: '2.4% من إجمالي المبيعات',
                  subEn: '2.4% of gross sales',
                  color: 'rose',
                },
                {
                  labelAr: 'حصة العلامة التجارية',
                  labelEn: 'Brand Share',
                  value: `${dashboard.kpi.shareOfGroupPercent}%`,
                  subAr: selectedBrand === 'ALL' ? 'كامل المجموعة' : selectedBrand,
                  subEn: selectedBrand === 'ALL' ? 'Whole Group' : selectedBrand,
                  color: 'teal',
                },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-sm"
                >
                  <p className="text-[11px] font-semibold text-slate-400">
                    {isAr ? kpi.labelAr : kpi.labelEn}
                  </p>
                  <p className="mt-1 text-lg font-black tracking-tight text-white sm:text-xl">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {isAr ? kpi.subAr : kpi.subEn}
                  </p>
                </div>
              ))}
            </div>

            {/* 4 Interpretive Highlight Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <Truck size={16} />
                  <span>{isAr ? 'القناة الأكبر' : 'Biggest Channel'}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-300">
                  {isAr ? dashboard.highlights.biggestChannelTextAr : dashboard.highlights.biggestChannelTextEn}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <Award size={16} />
                  <span>{isAr ? 'الطبق الأكثر مبيعاً' : 'Best Seller'}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-300">
                  {isAr ? dashboard.highlights.bestSellerTextAr : dashboard.highlights.bestSellerTextEn}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <PieChart size={16} />
                  <span>{isAr ? 'تركيز المنيو (قاعدة باريتو)' : 'Menu Concentration'}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-300">
                  {isAr ? dashboard.highlights.menuConcentrationTextAr : dashboard.highlights.menuConcentrationTextEn}
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                  <Coffee size={16} />
                  <span>{isAr ? 'معدل ربط الإضافات' : 'Add-ons Attach Rate'}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-slate-300">
                  {isAr ? dashboard.highlights.addOnsTextAr : dashboard.highlights.addOnsTextEn}
                </p>
              </div>
            </div>

            {/* Dual Click-to-filter Horizontal Bars (Brand & Channel) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Brand Scorecard Bar Chart */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {isAr ? 'أداء البراندات الـ 6 (انقر للفلترة)' : '6 Brands Breakdown (Click to filter)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isAr ? 'اضغط على أي براند لتخصيص كامل اللوحة' : 'Click any bar to filter entire dashboard'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">167,092 KWD</span>
                </div>
                <div className="space-y-3">
                  {OCTOBER_BRAND_SCORECARDS.map((b) => {
                    const isSelected = selectedBrand === b.brand
                    return (
                      <button
                        key={b.brand}
                        type="button"
                        onClick={() => setSelectedBrand(isSelected ? 'ALL' : (b.brand as BrandKey))}
                        className={`group w-full text-start transition-all rounded-xl p-2 ${
                          isSelected ? 'bg-emerald-500/15 border border-emerald-500/40' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={isSelected ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                            {isAr ? b.brandAr : b.brand}
                          </span>
                          <span className="text-slate-400">
                            {b.netSalesKwd.toLocaleString()} KWD ({b.sharePercent}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#8cc63f] to-[#00a99d]'
                                : 'bg-slate-500 group-hover:bg-[#8cc63f]'
                            }`}
                            style={{ width: `${b.sharePercent}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Channel Scorecard Bar Chart */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {isAr ? 'أداء قنوات البيع الـ 11 (انقر للفلترة)' : '11 Sales Channels (Click to filter)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isAr ? 'مبيعات الصالة 35.3% مقابل منصات التوصيل' : 'Dine-in vs Delivery aggregators'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-sky-400">30,543 Orders</span>
                </div>
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {OCTOBER_CHANNEL_SCORECARDS.map((c) => {
                    const isSelected = selectedChannel === c.channel
                    return (
                      <button
                        key={c.channel}
                        type="button"
                        onClick={() => setSelectedChannel(isSelected ? 'ALL' : (c.channel as ChannelKey))}
                        className={`group w-full text-start transition-all rounded-xl p-2 ${
                          isSelected ? 'bg-sky-500/15 border border-sky-500/40' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className={isSelected ? 'text-sky-400 font-bold' : 'text-slate-300'}>
                            {isAr ? c.channelAr : c.channel}
                          </span>
                          <span className="text-slate-400">
                            {c.netSalesKwd.toLocaleString()} KWD ({c.sharePercent}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isSelected
                                ? 'bg-gradient-to-r from-sky-400 to-indigo-500'
                                : 'bg-slate-600 group-hover:bg-sky-400'
                            }`}
                            style={{ width: `${c.sharePercent}%` }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Brand Scorecard Detailed Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAr ? 'جدول أداء البراندات المالي والتشغيلي' : 'Brand Scorecard Detailed Performance'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'الأرقام المالية المعتمدة لشهر أكتوبر 2026' : 'Audited financial metrics for Oct 2026'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleExportCSV(
                      'VentureFoods-Brand-Scorecard-Oct2026.csv',
                      OCTOBER_BRAND_SCORECARDS.map(
                        (b) =>
                          `${b.brand},${b.orders},${b.netSalesKwd},${b.sharePercent}%,${b.avgOrderValueKwd},${b.itemsPerOrder},${b.discountRatePercent}%,${b.bestSellerEn}`
                      ).join('\n')
                    )
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-start">{isAr ? 'العلامة التجارية' : 'Brand'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'صافي المبيعات (د.ك)' : 'Net Sales (KWD)'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الطلبات' : 'Orders'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الحصة' : 'Share %'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'متوسط الفاتورة' : 'AOV (KWD)'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'أصناف/طلب' : 'Items/Ord'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الخصم %' : 'Disc %'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'الأكثر مبيعاً' : 'Best Seller'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {OCTOBER_BRAND_SCORECARDS.map((b) => (
                      <tr key={b.brand} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-bold text-white">
                          {isAr ? b.brandAr : b.brand}
                          {b.lowOrderWarning && (
                            <span className="ms-2 inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] text-amber-400">
                              {isAr ? 'تنبيه حجم' : 'Volume warning'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">
                          {b.netSalesKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-end font-mono">{b.orders.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end font-mono">{b.sharePercent}%</td>
                        <td className="px-4 py-3 text-end font-mono">{b.avgOrderValueKwd.toFixed(3)}</td>
                        <td className="px-4 py-3 text-end font-mono">{b.itemsPerOrder}</td>
                        <td className="px-4 py-3 text-end font-mono text-rose-400">{b.discountRatePercent}%</td>
                        <td className="px-4 py-3 text-slate-200">
                          {isAr ? b.bestSellerAr : b.bestSellerEn}
                          <span className="ms-1.5 text-[10px] text-slate-500 font-mono">
                            ({b.bestSellerSalesKwd.toLocaleString()} KWD)
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

        {/* ======================================================== */}
        {/* TAB 2: Aggregator Commission & Net Payout Audit */}
        {/* ======================================================== */}
        {activeTab === 'aggregators' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-[11px] font-semibold text-slate-400">
                  {isAr ? 'إجمالي مبيعات منصات التوصيل' : 'Gross Aggregator Sales'}
                </p>
                <p className="mt-1 text-xl font-black text-white">106,818 KWD</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {isAr ? '64.1% من إجمالي مبيعات فنتشر فودز' : '64.1% of total enterprise sales'}
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4">
                <p className="text-[11px] font-semibold text-rose-300">
                  {isAr ? 'عمولات المنصات المقتطعة' : 'Aggregator Commissions'}
                </p>
                <p className="mt-1 text-xl font-black text-rose-400">17,002.27 KWD</p>
                <p className="mt-1 text-[10px] text-rose-500">
                  {isAr ? 'متوسط العمولة الفعلي 15.9%' : 'Blended commission: 15.9%'}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
                <p className="text-[11px] font-semibold text-emerald-300">
                  {isAr ? 'صافي التحصيل البنكي الفعلي' : 'Net Banking Inflow'}
                </p>
                <p className="mt-1 text-xl font-black text-emerald-400">88,605.73 KWD</p>
                <p className="mt-1 text-[10px] text-emerald-500">
                  {isAr ? 'موزع بين الوطني NBK والتجاري CBK' : 'Deposited in NBK & CBK accounts'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4">
                <p className="text-[11px] font-semibold text-amber-300">
                  {isAr ? 'فروقات التسوية وقيد المراجعة' : 'Reconciliation Variances'}
                </p>
                <p className="mt-1 text-xl font-black text-amber-400">644.79 KWD</p>
                <p className="mt-1 text-[10px] text-amber-500">
                  {isAr ? '51 طلباً ملغى / مسترد قيد المطالبة' : '51 disputed orders under claim'}
                </p>
              </div>
            </div>

            {/* Aggregator Reconciliation Audit Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAr
                      ? 'جدول تدقيق عمولات المنصات والتسويات البنكية (أكتوبر 2026)'
                      : 'Aggregator Commission & Bank Settlement Audit'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? 'مقارنة دقيقة للعمولة التعاقدية ورسوم التسويق وصافي الإيداع الفعلي'
                      : 'Comparison of contractual commission, marketing fees & bank deposits'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleExportCSV(
                      'VentureFoods-Aggregator-Audit-Oct2026.csv',
                      OCTOBER_AGGREGATOR_AUDIT.map(
                        (a) =>
                          `${a.channel},${a.grossSalesKwd},${a.commissionRatePercent}%,${a.commissionAmountKwd},${a.marketingFeesKwd},${a.expectedNetPayoutKwd},${a.bankReceivedKwd},${a.varianceKwd},${a.bank},${a.payoutStatus}`
                      ).join('\n')
                    )
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  <Download size={13} />
                  <span>{isAr ? 'تصدير التدقيق' : 'Export Audit'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-start">{isAr ? 'قناة البيع / المنصة' : 'Channel / Platform'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'إجمالي المبيعات' : 'Gross Sales'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'نسبة العمولة' : 'Comm %'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'مبلغ العمولة' : 'Comm Amt'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'رسوم التسويق' : 'Mktg Fees'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'المستحق البنكي' : 'Expected Net'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'المودع بالبنك' : 'Bank Received'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'فروقات التسوية' : 'Variance'}</th>
                      <th className="px-4 py-3 text-center">{isAr ? 'الحساب البنكي' : 'Bank'}</th>
                      <th className="px-4 py-3 text-center">{isAr ? 'حالة التسوية' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {OCTOBER_AGGREGATOR_AUDIT.map((row) => (
                      <tr key={row.channel} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-bold text-white">
                          {isAr ? row.channelAr : row.channel}
                          <div className="text-[10px] text-slate-500">{row.settlementCycle}</div>
                        </td>
                        <td className="px-4 py-3 text-end font-mono">
                          {row.grossSalesKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-amber-400">
                          {row.commissionRatePercent}%
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-rose-400">
                          {row.commissionAmountKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-slate-400">
                          {row.marketingFeesKwd.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">
                          {row.expectedNetPayoutKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-white">
                          {row.bankReceivedKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-end font-mono">
                          {row.varianceKwd < 0 ? (
                            <span className="text-rose-400 font-bold">{row.varianceKwd.toFixed(2)}</span>
                          ) : (
                            <span className="text-emerald-400">0.00</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-[11px] text-slate-400">
                          {row.bank}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.payoutStatus === 'Settled'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : row.payoutStatus === 'Disputed'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {row.payoutStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Compensation & Dispute Claim Action Box */}
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/15 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-400">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {isAr ? 'محرك استرداد التعويضات والطلبات الملغاة (Aggregator Claim Engine)' : 'Aggregator Compensation Claims'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {isAr
                        ? 'يوجد 51 طلباً ملغى بقيمة 644.79 د.ك تم تسليمها لسائقي المنصات ولم تودع مستحقاتها'
                        : '51 dispatched orders worth KWD 644.79 pending refund claims from Talabat & Snoonu'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    showToast(
                      isAr
                        ? 'تم إرسال مطالبات التعويض لمدراء حسابات المنصات (طلبات، كيتا، سنونو)'
                        : 'Compensation claim letters dispatched to platform account managers'
                    )
                  }
                  className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  {isAr ? 'إرسال ملف المطالبات للمنصات ⚡' : 'Dispatch Claim Package ⚡'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: Menu Engineering & Profitability Matrix */}
        {/* ======================================================== */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            {/* Quadrant 4 Quadrants Visual Summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Top Performers */}
              <button
                type="button"
                onClick={() => setSelectedQuadrant((prev) => (prev === 'TopPerformer' ? 'ALL' : 'TopPerformer'))}
                className={`text-start rounded-2xl border p-4 transition-all ${
                  selectedQuadrant === 'TopPerformer'
                    ? 'border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/30'
                    : 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">⭐</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    114 {isAr ? 'صنف' : 'items'}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-white">
                  {isAr ? 'الأصناف الذهبية الرائدة (Top Performers)' : 'Top Performers'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'ربحية عالية + شعبية عالية' : 'High Margin + High Popularity'}
                </p>
                <p className="mt-2 text-xs font-mono font-bold text-emerald-400">
                  {isAr ? 'الحماية والترويج المستمر' : 'Protect quality & hold price'}
                </p>
              </button>

              {/* High-Demand Staples */}
              <button
                type="button"
                onClick={() => setSelectedQuadrant((prev) => (prev === 'HighDemand' ? 'ALL' : 'HighDemand'))}
                className={`text-start rounded-2xl border p-4 transition-all ${
                  selectedQuadrant === 'HighDemand'
                    ? 'border-sky-500 bg-sky-950/40 ring-2 ring-sky-500/30'
                    : 'border-sky-500/30 bg-sky-950/20 hover:border-sky-500/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🐎</span>
                  <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                    82 {isAr ? 'صنف' : 'items'}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-white">
                  {isAr ? 'الأصناف عالية الطلب (High-Demand Staples)' : 'High-Demand Staples'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'شعبية عالية + ربحية منخفضة' : 'High Popularity + Low Margin'}
                </p>
                <p className="mt-2 text-xs font-mono font-bold text-sky-400">
                  {isAr ? 'إعادة تسعير طفيفة أو خفض تكلفة' : 'Slight reprice or trim portion'}
                </p>
              </button>

              {/* High-Margin Opportunities */}
              <button
                type="button"
                onClick={() => setSelectedQuadrant((prev) => (prev === 'HighMargin' ? 'ALL' : 'HighMargin'))}
                className={`text-start rounded-2xl border p-4 transition-all ${
                  selectedQuadrant === 'HighMargin'
                    ? 'border-amber-500 bg-amber-950/40 ring-2 ring-amber-500/30'
                    : 'border-amber-500/30 bg-amber-950/20 hover:border-amber-500/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🧩</span>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                    96 {isAr ? 'صنف' : 'items'}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-white">
                  {isAr ? 'أصناف واعدة عالية الربح (High-Margin Opportunities)' : 'High-Margin Opportunities'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'ربحية عالية + شعبية منخفضة' : 'High Margin + Low Popularity'}
                </p>
                <p className="mt-2 text-xs font-mono font-bold text-amber-400">
                  {isAr ? 'ترويج رقمي واقتراح الكاشير' : 'Promote via combos & upsell'}
                </p>
              </button>

              {/* Slow-Moving Items */}
              <button
                type="button"
                onClick={() => setSelectedQuadrant((prev) => (prev === 'SlowMover' ? 'ALL' : 'SlowMover'))}
                className={`text-start rounded-2xl border p-4 transition-all ${
                  selectedQuadrant === 'SlowMover'
                    ? 'border-rose-500 bg-rose-950/40 ring-2 ring-rose-500/30'
                    : 'border-rose-500/30 bg-rose-950/20 hover:border-rose-500/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🐕</span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                    72 {isAr ? 'صنف' : 'items'}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-white">
                  {isAr ? 'الأصناف الراكدة ضعيفة الأداء (Slow-Moving Items)' : 'Slow-Moving Items'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'ربحية منخفضة + شعبية منخفضة' : 'Low Margin + Low Popularity'}
                </p>
                <p className="mt-2 text-xs font-mono font-bold text-rose-400">
                  {isAr ? 'إلغاء الصنف وسحبه من المنيو' : 'Delist & free station capacity'}
                </p>
              </button>
            </div>

            {/* Menu Search and Items Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/10 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute start-3 top-2.5 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder={isAr ? 'بحث في أصناف المنيو...' : 'Search menu items...'}
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950 ps-9 pe-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    {filteredMenuItems.length} {isAr ? 'صنف معروض' : 'items shown'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleExportCSV(
                        'VentureFoods-Menu-Profitability-Matrix.csv',
                        filteredMenuItems.map(
                          (i) =>
                            `${i.nameEn},${i.nameAr},${i.brand},${i.categoryEn},${i.priceKwd},${i.costPriceKwd},${i.marginPercent}%,${i.unitsSold},${i.salesKwd},${i.classification}`
                        ).join('\n')
                      )
                    }
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                  >
                    <Download size={13} />
                    <span>{isAr ? 'تصدير المنيو CSV' : 'Export Menu CSV'}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-start">{isAr ? 'الصنف' : 'Item Name'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'البراند' : 'Brand'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'التصنيف' : 'Category'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'سعر البيع' : 'Price'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'التكلفة' : 'Cost'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'هامش الربح' : 'Margin %'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الكمية المباعة' : 'Units Sold'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'إجمالي المبيعات' : 'Sales KWD'}</th>
                      <th className="px-4 py-3 text-center">{isAr ? 'تصنيف الربحية' : 'Classification'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filteredMenuItems.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-semibold text-white">
                          {isAr ? item.nameAr : item.nameEn}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{item.brand}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {isAr ? item.categoryAr : item.categoryEn}
                        </td>
                        <td className="px-4 py-3 text-end font-mono">{item.priceKwd.toFixed(3)} KWD</td>
                        <td className="px-4 py-3 text-end font-mono text-slate-400">
                          {item.costPriceKwd.toFixed(3)} KWD
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">
                          {item.marginPercent}%
                        </td>
                        <td className="px-4 py-3 text-end font-mono">{item.unitsSold.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-white">
                          {item.salesKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              item.classification === 'TopPerformer'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : item.classification === 'HighDemand'
                                ? 'bg-sky-500/20 text-sky-300'
                                : item.classification === 'HighMargin'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {item.classification === 'TopPerformer'
                              ? '⭐ صنف رائد (Top Performer)'
                              : item.classification === 'HighDemand'
                              ? '📦 High Demand'
                              : item.classification === 'HighMargin'
                              ? '💎 واعد عالي الربح (High-Margin)'
                              : '⚠️ راكد ضعيف الأداء (Slow-Moving)'}
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

        {/* ======================================================== */}
        {/* TAB 4: Slow Movers & 7 Action Playbooks */}
        {/* ======================================================== */}
        {activeTab === 'slow-movers' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'محرك خطط العمل الـ 7 لمعالجة الأصناف الراكدة' : '7 Strategic Slow Mover Action Playbooks'}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'بروتوكول فنتشر فودز المعتمد لمعالجة الأصناف منخفضة الدوران وتحويلها إلى أرباح أو سحبها بأقل خسائر.'
                  : 'Venture Foods formal playbooks to recover sluggish SKUs into margin contributors or delist them.'}
              </p>
            </div>

            {/* 7 Action Playbooks Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ACTION_PLAYBOOKS.map((play) => (
                <div
                  key={play.id}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition-all hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400">
                      #{play.id}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">Playbook</span>
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white">
                    {isAr ? play.titleAr : play.titleEn}
                  </h4>
                  <p className="mt-1 text-xs text-slate-400">
                    {isAr ? play.taglineAr : play.taglineEn}
                  </p>
                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 text-[11px] font-semibold text-emerald-300">
                    ⚡ {isAr ? play.expectedImpactAr : play.expectedImpactEn}
                  </div>
                </div>
              ))}
            </div>

            {/* Slow Movers Operational Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAr ? 'سجل الأصناف الراكدة وتطبيق خطط المعالجة' : 'Slow Mover SKUs & Playbook Dispatch'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'الأصناف التي حققت أقل من 25 طلباً خلال الشهر' : 'Items with under 25 units sold in Oct'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-start">{isAr ? 'الصنف الراكد' : 'Slow Mover SKU'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'البراند' : 'Brand'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'السعر' : 'Price'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الكمية المباعة' : 'Units Sold'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'المبيعات' : 'Sales KWD'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'الخطة المقترحة' : 'Recommended Playbook'}</th>
                      <th className="px-4 py-3 text-center">{isAr ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {SLOW_MOVERS_LIST.map((sm) => {
                      const executed = executedPlaybooks[sm.id]
                      return (
                        <tr key={sm.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-bold text-white">
                            {isAr ? sm.nameAr : sm.nameEn}
                            <div className="text-[10px] text-slate-500">{isAr ? sm.categoryAr : sm.categoryEn}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">{sm.brand}</td>
                          <td className="px-4 py-3 text-end font-mono">{sm.priceKwd.toFixed(3)}</td>
                          <td className="px-4 py-3 text-end font-mono text-rose-400 font-bold">
                            {sm.unitsSold}
                          </td>
                          <td className="px-4 py-3 text-end font-mono">{sm.salesKwd.toFixed(2)} KWD</td>
                          <td className="px-4 py-3 text-slate-200">
                            {isAr ? sm.playbookTitleAr : sm.playbookTitleEn}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {executed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                                <CheckCircle2 size={12} />
                                {isAr ? 'تم التطبيق' : 'Executed'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setExecutedPlaybooks((prev) => ({ ...prev, [sm.id]: sm.recommendedPlaybookId }))
                                  showToast(
                                    isAr
                                      ? `تم تطبيق الخطة (${sm.playbookTitleAr}) على ${sm.nameAr}`
                                      : `Dispatched playbook for ${sm.nameEn}`
                                  )
                                }}
                                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all"
                              >
                                {isAr ? 'تطبيق الخطة ⚡' : 'Execute ⚡'}
                              </button>
                            )}
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

        {/* ======================================================== */}
        {/* TAB 5: 10 Branches Performance & Hourly Heatmap */}
        {/* ======================================================== */}
        {activeTab === 'branches' && (
          <div className="space-y-6">
            {/* 10 Branches Cards / Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
              <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAr ? 'مقارنة أداء الفروع الـ 10 لشركة فنتشر فودز' : '10 Venture Foods Branches Performance'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'المبيعات، الطلبات، متوسط الفاتورة، ونسب التوصيل' : 'Sales, orders, AOV & delivery share'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleExportCSV(
                      'VentureFoods-Branches-Performance-Oct2026.csv',
                      filteredBranches
                        .map(
                          (b) =>
                            `${b.nameEn},${b.areaEn},${b.netSalesKwd},${b.orders},${b.avgOrderValueKwd},${b.topBrandEn},${b.deliveryPercent}%,${b.dineInPercent}%,${b.staffCount}`
                        )
                        .join('\n')
                    )
                  }
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  <Download size={13} />
                  <span>{isAr ? 'تصدير الفروع CSV' : 'Export Branches CSV'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'المحافظة والمنطقة' : 'Location'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'صافي المبيعات' : 'Net Sales'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الطلبات' : 'Orders'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'متوسط الفاتورة' : 'AOV (KWD)'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'العلامة الأقوى' : 'Top Brand'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'توصيل' : 'Delivery %'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'صالة' : 'Dine-In %'}</th>
                      <th className="px-4 py-3 text-start">{isAr ? 'ساعات الذروة' : 'Peak Hours'}</th>
                      <th className="px-4 py-3 text-end">{isAr ? 'الكادر' : 'Staff'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filteredBranches.map((br) => (
                      <tr key={br.id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-bold text-white">
                          {isAr ? br.nameAr : br.nameEn}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {isAr ? br.areaAr : br.areaEn}
                        </td>
                        <td className="px-4 py-3 text-end font-mono font-bold text-emerald-400">
                          {br.netSalesKwd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-end font-mono">{br.orders.toLocaleString()}</td>
                        <td className="px-4 py-3 text-end font-mono">{br.avgOrderValueKwd.toFixed(3)}</td>
                        <td className="px-4 py-3 text-slate-200">
                          {isAr ? br.topBrandAr : br.topBrandEn}
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-sky-400">{br.deliveryPercent}%</td>
                        <td className="px-4 py-3 text-end font-mono text-amber-400">{br.dineInPercent}%</td>
                        <td className="px-4 py-3 text-slate-300 text-[11px]">
                          {isAr ? br.peakHourAr : br.peakHourEn}
                        </td>
                        <td className="px-4 py-3 text-end font-mono">{br.staffCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 24-Hour Peak Hours Heatmap */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isAr ? 'الخريطة الحرارية لساعات اليوم (Hourly Sales Heatmap)' : 'Hourly Sales Heatmap (11 AM - 12 AM)'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'توزيع الطلبات والمبيعات على ساعات النهار والليل' : 'Hourly distribution of orders & sales volume'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-slate-700" /> {isAr ? 'هادئ' : 'Off-peak'}
                  </span>
                  <span className="flex items-center gap-1 text-sky-400">
                    <span className="h-2 w-2 rounded-full bg-sky-500" /> {isAr ? 'عادي' : 'Normal'}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> {isAr ? 'نشط' : 'Rush'}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> {isAr ? 'ذروة' : 'Peak'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {OCTOBER_HOURLY_HEATMAP.map((slot) => {
                  const isPeak = slot.traffic === 'peak'
                  const isRush = slot.traffic === 'rush'
                  const isOff = slot.traffic === 'off-peak'

                  return (
                    <div
                      key={slot.hour}
                      className={`rounded-xl border p-3 transition-all ${
                        isPeak
                          ? 'border-emerald-500/40 bg-emerald-950/30'
                          : isRush
                          ? 'border-amber-500/40 bg-amber-950/30'
                          : isOff
                          ? 'border-white/5 bg-slate-950/40'
                          : 'border-white/10 bg-slate-900/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-white">{isAr ? slot.labelAr : slot.labelEn}</span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                            isPeak
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isRush
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {slot.traffic}
                        </span>
                      </div>
                      <p className="mt-2 text-base font-black font-mono text-white">
                        {slot.salesKwd.toLocaleString()} KWD
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {slot.orders.toLocaleString()} {isAr ? 'طلب' : 'orders'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: Upselling & Add-ons Analytics */}
        {/* ======================================================== */}
        {activeTab === 'upselling' && (
          <div className="space-y-6">
            {/* Category Attach Rates Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Drinks */}
              <div className="rounded-2xl border border-sky-500/20 bg-sky-950/20 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-xl bg-sky-500/20 p-2 text-sky-400">
                    <Coffee size={20} />
                  </span>
                  <span className="text-xs font-bold text-sky-400">
                    {isAr ? 'الهدف: 35.0%' : 'Target: 35.0%'}
                  </span>
                </div>
                <h4 className="mt-3 text-base font-bold text-white">
                  {isAr ? 'المشروبات والعصائر (Drinks)' : 'Drinks & Beverages'}
                </h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-sky-400">25.5%</span>
                  <span className="text-xs text-slate-400">
                    {isAr ? 'معدل الإضافة لكل 100 طلب' : 'attach rate / 100 orders'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  <p>9,940 {isAr ? 'مشروب مباع' : 'units sold'} · 6,684 KWD</p>
                  <p className="mt-1 text-[11px] text-sky-300">
                    ⭐ {isAr ? 'الأكثر مبيعاً: ليموناضة نعناع طازجة' : 'Top: Fresh Mint Lemonade'}
                  </p>
                </div>
              </div>

              {/* Starters & Sides */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-xl bg-emerald-500/20 p-2 text-emerald-400">
                    <UtensilsCrossed size={20} />
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {isAr ? 'الهدف: 45.0%' : 'Target: 45.0%'}
                  </span>
                </div>
                <h4 className="mt-3 text-base font-bold text-white">
                  {isAr ? 'المقبلات والجانبيات (Starters & Sides)' : 'Starters & Sides'}
                </h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-400">32.7%</span>
                  <span className="text-xs text-slate-400">
                    {isAr ? 'معدل الإضافة لكل 100 طلب' : 'attach rate / 100 orders'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  <p>18,450 {isAr ? 'مقبلات مباعة' : 'units sold'} · 25,064 KWD</p>
                  <p className="mt-1 text-[11px] text-emerald-300">
                    ⭐ {isAr ? 'الأكثر مبيعاً: سبرينج رولز وديناميت شرمب' : 'Top: Spring Rolls & Dynamite Shrimp'}
                  </p>
                </div>
              </div>

              {/* Desserts */}
              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-xl bg-amber-500/20 p-2 text-amber-400">
                    <Sparkles size={20} />
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {isAr ? 'الهدف: 8.0%' : 'Target: 8.0%'}
                  </span>
                </div>
                <h4 className="mt-3 text-base font-bold text-white">
                  {isAr ? 'الحلويات (Desserts)' : 'Desserts'}
                </h4>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-400">2.2%</span>
                  <span className="text-xs text-slate-400">
                    {isAr ? 'معدل الإضافة لكل 100 طلب' : 'attach rate / 100 orders'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-300">
                  <p>2,100 {isAr ? 'حلوى مباعة' : 'units sold'} · 1,671 KWD</p>
                  <p className="mt-1 text-[11px] text-amber-300">
                    ⚡ {isAr ? 'فرصة تطوير: كيك الزعفران والموز المقلي' : 'Opportunity: Saffron Cake'}
                  </p>
                </div>
              </div>
            </div>

            {/* AOV Boost & Missed Revenue Calculator */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'محرك نمو متوسط الفاتورة والفرص الضائعة (AOV Boost Engine)' : 'AOV Boost & Revenue Uplift Engine'}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'رفع نسبة ربط المشروب إلى 35% والمقبلات إلى 45% يضيف للشركة إيراداً شهرياً مباشراً قدره +8,400 د.ك بهامش ربح يفوق 78%.'
                  : 'Raising beverage attach to 35% and starters to 45% adds +KWD 8,400 monthly profit.'}
              </p>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-xs font-bold text-slate-300">{isAr ? 'زيادة مبيعات المشروبات المستهدفة' : 'Beverage Growth Potential'}</p>
                  <p className="mt-1 text-xl font-black text-emerald-400">+2,900 KWD</p>
                  <p className="text-[10px] text-slate-500">{isAr ? '+2,320 علبة مشروب طازج' : '+2,320 fresh drink units'}</p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-xs font-bold text-slate-300">{isAr ? 'زيادة مبيعات المقبلات المستهدفة' : 'Starters Growth Potential'}</p>
                  <p className="mt-1 text-xl font-black text-emerald-400">+4,150 KWD</p>
                  <p className="text-[10px] text-slate-500">{isAr ? '+2,500 سبرينج رولز وبطاطا' : '+2,500 side portions'}</p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <p className="text-xs font-bold text-slate-300">{isAr ? 'زيادة الحلويات المستهدفة' : 'Dessert Growth Potential'}</p>
                  <p className="mt-1 text-xl font-black text-emerald-400">+1,350 KWD</p>
                  <p className="text-[10px] text-slate-500">{isAr ? '+950 قطعة حلوى' : '+950 dessert units'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: Live Invoices & Customer Accounts */}
        {/* ======================================================== */}
        {activeTab === 'live-invoices' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/15 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Receipt className="text-emerald-400" size={20} />
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {isAr ? 'إدارة فواتير المبيعات الحية المسجلة بقاعدة البيانات' : 'Live Database Sales Invoices'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? 'إنشاء الفواتير، التحقق من المخزون، روابط الدفع الإلكتروني KNET، وإرسال الفواتير عبر الواتساب'
                      : 'Generate invoices, deduct stock, send KNET pay links, and dispatch via WhatsApp'}
                  </p>
                </div>
              </div>
            </div>

            {/* Embedded Live Panel Children */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              {liveChildren}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: 15 Strategic Exportable Reports */}
        {/* ======================================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <div>
                <h3 className="text-base font-bold text-white">
                  {isAr ? 'مركز التقارير الاستراتيجية الـ 15 المعتمدة' : '15 Strategic Enterprise Sales Reports'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? 'تقارير تنفيذية شاملة جاهزة للتصدير الفوري بضغطة زر بصيغة CSV المتوافقة 100% مع Excel والطباعة'
                    : 'Download ready-to-use CSV reports for executive boards, operations, and finance teams'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  STRATEGIC_15_REPORTS.forEach((rep) => {
                    handleExportCSV(
                      rep.filename,
                      `Report: ${rep.titleEn}\nGenerated For: Venture Foods Restaurant Management W.L.L.\nPeriod: October 2026 Live\nCategory: ${rep.categoryEn}\nSummary: ${rep.summaryEn}\nNet Sales Baseline: 167,092 KWD\nOrders: 30,543\n`
                    )
                  })
                }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8cc63f] to-[#00a99d] px-4 py-2 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:opacity-95"
              >
                <Download size={14} />
                <span>{isAr ? 'تصدير الـ 15 تقريراً دفعة واحدة ⚡' : 'Export All 15 Reports ⚡'}</span>
              </button>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STRATEGIC_15_REPORTS.map((rep) => (
                <div
                  key={rep.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition-all hover:border-emerald-500/40"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                        {isAr ? rep.categoryAr : rep.categoryEn}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">#{rep.id}</span>
                    </div>
                    <h4 className="mt-3 text-sm font-bold text-white">
                      {isAr ? rep.titleAr : rep.titleEn}
                    </h4>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      {isAr ? rep.summaryAr : rep.summaryEn}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-white/5 pt-4 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">
                      {rep.filename}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleExportCSV(
                          rep.filename,
                          `Report: ${rep.titleEn}\nCompany: Venture Foods Restaurant Management W.L.L.\nPeriod: October 2026\nCategory: ${rep.categoryEn}\nSummary: ${rep.summaryEn}\nSales Baseline: 167,092 KWD\nOrders: 30,543\nStatus: Audited & Verified\n`
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-all"
                    >
                      <Download size={13} />
                      <span>{isAr ? 'تحميل CSV' : 'Download'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
