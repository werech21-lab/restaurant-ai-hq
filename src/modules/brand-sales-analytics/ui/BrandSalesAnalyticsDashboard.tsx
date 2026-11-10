'use client'

import { useMemo, useState } from 'react'
import {
  ACTION_PLAYBOOKS,
  CATEGORY_BREAKDOWN,
  OCTOBER_BRAND_SCORECARDS,
  OCTOBER_CHANNEL_SCORECARDS,
  SLOW_MOVERS_LIST,
  TOP_BEST_SELLERS,
  computeFilteredDashboard,
  type BrandKey,
  type ChannelKey,
  type PlaybookAction,
  type SlowMoverItem,
} from '@/lib/analytics/brand-sales-october-data'

type Props = {
  locale?: string
}

export function BrandSalesAnalyticsDashboard({ locale = 'ar' }: Props) {
  const [lang, setLang] = useState<'ar' | 'en'>(locale === 'en' ? 'en' : 'ar')
  const en = lang === 'en'
  const [isLightMode, setIsLightMode] = useState(false)

  // Interactive filters
  const [selectedBrand, setSelectedBrand] = useState<BrandKey>('ALL')
  const [selectedChannel, setSelectedChannel] = useState<ChannelKey>('ALL')
  const [dataSource, setDataSource] = useState<'october' | 'livedb' | 'uploaded'>('october')

  // Playbook execution modal state
  const [activePlaybookModal, setActivePlaybookModal] = useState<{
    item: SlowMoverItem
    playbook: PlaybookAction
  } | null>(null)
  const [playbookAppliedNotice, setPlaybookAppliedNotice] = useState<string | null>(null)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  // Calculate live filtered state based on brand + channel
  const dashboard = useMemo(() => {
    return computeFilteredDashboard(selectedBrand, selectedChannel)
  }, [selectedBrand, selectedChannel])

  const maxBrandSales = useMemo(
    () => Math.max(...OCTOBER_BRAND_SCORECARDS.map((b) => b.netSalesKwd)),
    [],
  )
  const maxBrandAov = useMemo(
    () => Math.max(...OCTOBER_BRAND_SCORECARDS.map((b) => b.avgOrderValueKwd)),
    [],
  )

  const maxChannelSales = useMemo(
    () => Math.max(...OCTOBER_CHANNEL_SCORECARDS.map((c) => c.netSalesKwd)),
    [],
  )
  const maxChannelAov = useMemo(
    () => Math.max(...OCTOBER_CHANNEL_SCORECARDS.map((c) => c.avgOrderValueKwd)),
    [],
  )

  // Theme styles
  const bgClass = isLightMode
    ? 'bg-slate-50 text-slate-900 border-slate-200'
    : 'bg-[#0a0d12] text-mist-100 border-white/10'
  const cardBgClass = isLightMode
    ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
    : 'bg-[#0f141c] border-white/10 text-mist-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
  const tableHeaderBg = isLightMode ? 'bg-slate-100 text-slate-700' : 'bg-black/40 text-mist-400'

  function handleBrandClick(brandName: string) {
    if (selectedBrand === brandName) {
      setSelectedBrand('ALL')
    } else {
      setSelectedBrand(brandName as BrandKey)
    }
  }

  function handleChannelClick(channelName: string) {
    if (selectedChannel === channelName) {
      setSelectedChannel('ALL')
    } else {
      setSelectedChannel(channelName as ChannelKey)
    }
  }

  function handleApplyPlaybook(item: SlowMoverItem) {
    const pb = ACTION_PLAYBOOKS.find((p) => p.id === item.recommendedPlaybookId) || ACTION_PLAYBOOKS[0]
    setActivePlaybookModal({ item, playbook: pb })
  }

  function handleConfirmPlaybook() {
    if (activePlaybookModal) {
      setPlaybookAppliedNotice(
        en
          ? `⚡ Playbook "${activePlaybookModal.playbook.titleEn}" successfully deployed for "${activePlaybookModal.item.nameEn}". Operational recipe & pricing updated.`
          : `⚡ تم تفعيل خطة العمل "${activePlaybookModal.playbook.titleAr}" بنجاح للصنف "${activePlaybookModal.item.nameAr}". تم تحديث الوصفة والعرض بالمنيو.`,
      )
      setActivePlaybookModal(null)
      setTimeout(() => setPlaybookAppliedNotice(null), 6000)
    }
  }

  return (
    <div
      className={`min-h-screen space-y-6 p-4 sm:p-6 transition-colors duration-200 ${bgClass}`}
      dir={en ? 'ltr' : 'rtl'}
    >
      {/* Top Header & Executive Control Bar */}
      <header className={`rounded-3xl border p-6 transition-all ${cardBgClass}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-gold-400/40 bg-gold-400/10 px-2.5 py-0.5 text-[11px] font-black tracking-wider text-gold-300">
                AETHERBI · VENTURE FOODS W.L.L.
              </span>
              <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                OCTOBER 2026 VERIFIED MODEL
              </span>
            </div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {en
                ? '📊 Brand Sales, Channel Scorecard & Menu Engineering Intelligence'
                : '📊 لوحة تحليل المبيعات، القنوات، وهندسة المنيو الذكية (Venture Foods)'}
            </h1>
            <p className="max-w-3xl text-xs sm:text-sm text-mist-400">
              {en
                ? 'Multi-brand consolidated analytics: 7 Brands · 11 Channels · 364 Menu Items · Interactive click-to-filter cross-filtering with slow-movers playbook automation.'
                : 'التحليل التفاعلي الشامل لمبيعات المجموعة: 7 براندات · 11 قناة بيع · 364 صنف منيو · فلاتر النقر المباشر اللحظية مع محرك تحريك الأصناف الراكدة.'}
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              🌐 {en ? 'عربي (RTL)' : 'English (LTR)'}
            </button>
            <button
              type="button"
              onClick={() => setIsLightMode((prev) => !prev)}
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
            >
              {isLightMode ? '🌙 Dark Obsidian' : '☀️ Light / Print Mode'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-gold-400/30 bg-gold-400/15 px-3.5 py-2 text-xs font-black text-gold-200 hover:bg-gold-400/25"
            >
              🖨️ {en ? 'Print / PDF' : 'طباعة التقرير PDF'}
            </button>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-black text-ink-950 shadow-md hover:brightness-110"
            >
              📤 {en ? 'Upload CSV/Excel' : 'رفع ملف مبيعات جديد'}
            </button>
          </div>
        </div>

        {/* Data Source Selector & Active Filters Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-mist-400">
              {en ? 'Data Source:' : 'مصدر البيانات:'}
            </span>
            <button
              type="button"
              onClick={() => setDataSource('october')}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                dataSource === 'october'
                  ? 'bg-emerald-500 text-ink-950 shadow-sm'
                  : 'border border-white/15 bg-white/5 text-mist-300 hover:bg-white/10'
              }`}
            >
              ✨ {en ? 'October 2026 Model (167,092 KWD)' : 'نموذج أكتوبر 2026 المعتمد (167,092 د.ك)'}
            </button>
            <button
              type="button"
              onClick={() => setDataSource('livedb')}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                dataSource === 'livedb'
                  ? 'bg-emerald-500 text-ink-950 shadow-sm'
                  : 'border border-white/15 bg-white/5 text-mist-300 hover:bg-white/10'
              }`}
            >
              🗄️ {en ? 'Live DB Ingest' : 'قاعدة البيانات الحية'}
            </button>
            {uploadedFileName ? (
              <span className="rounded-lg border border-teal-400/40 bg-teal-500/15 px-3 py-1 text-xs font-bold text-teal-200">
                📄 {uploadedFileName}
              </span>
            ) : null}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-mist-300">
              <span>{en ? 'Brand:' : 'البراند:'}</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value as BrandKey)}
                className="rounded-lg border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white"
              >
                <option value="ALL">{en ? 'All Brands (7)' : 'كل البراندات (7)'}</option>
                <option value="China Garden">China Garden (تشاينا جاردن)</option>
                <option value="Frank's">Frank&apos;s (فرانكس ستيك)</option>
                <option value="Tahina">Tahina (شاورما طحينة)</option>
                <option value="Farm Brown">Farm Brown (فارم براون)</option>
                <option value="The Noodle Bar">The Noodle Bar (ذا نودل بار)</option>
                <option value="Karak Cafeteria">Karak Cafeteria (كرك كافتيريا)</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-xs text-mist-300">
              <span>{en ? 'Channel:' : 'القناة:'}</span>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value as ChannelKey)}
                className="rounded-lg border border-white/15 bg-black/50 px-2.5 py-1 text-xs text-white"
              >
                <option value="ALL">{en ? 'All Channels (11)' : 'كل القنوات (11)'}</option>
                <option value="Shop Sales">Shop Sales (مبيعات الصالة)</option>
                <option value="Talabat Go">Talabat Go (طلبات جو 17%)</option>
                <option value="Keeta">Keeta (كيتا)</option>
                <option value="Talabat MP">Talabat MP (طلبات ماركتبليس 10%)</option>
                <option value="Deliveroo Core">Deliveroo Core (ديليفرو)</option>
                <option value="Direct">Direct (الموقع المباشر)</option>
                <option value="Snoonu">Snoonu (سنونو)</option>
                <option value="Jahez">Jahez (جاهز)</option>
                <option value="Phone">Phone (الهاتف والبدالة)</option>
                <option value="Deliveroo MP">Deliveroo MP (ديليفرو ماركت)</option>
                <option value="Whatsapp">Whatsapp (واتساب)</option>
              </select>
            </label>

            {(selectedBrand !== 'ALL' || selectedChannel !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedBrand('ALL')
                  setSelectedChannel('ALL')
                }}
                className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
              >
                ✕ {en ? 'Clear Filters' : 'إلغاء الفلترة'}
              </button>
            )}
          </div>
        </div>

        {playbookAppliedNotice ? (
          <p className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-4 py-2.5 text-xs font-semibold text-emerald-200">
            {playbookAppliedNotice}
          </p>
        ) : null}
      </header>

      {/* TOP 6 KPI CARDS */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <article className={`rounded-2xl border p-4 transition-all ${cardBgClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">
            {en ? 'Net sales' : 'صافي المبيعات'}
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-300 font-mono" dir="ltr">
            KWD {dashboard.kpi.netSalesKwd.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-mist-400">
            {en ? 'After discounts, KWD' : 'بعد الخصومات، د.ك'}
          </p>
        </article>

        <article className={`rounded-2xl border p-4 transition-all ${cardBgClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">
            {en ? 'Orders' : 'عدد الطلبات'}
          </p>
          <p className="mt-2 text-2xl font-black text-white font-mono" dir="ltr">
            {dashboard.kpi.orders.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-mist-400">
            {en ? 'Distinct orders' : 'طلبات منفصلة'}
          </p>
        </article>

        <article className={`rounded-2xl border p-4 transition-all ${cardBgClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">
            {en ? 'Average order value' : 'متوسط قيمة الطلب'}
          </p>
          <p className="mt-2 text-2xl font-black text-gold-300 font-mono" dir="ltr">
            KWD {dashboard.kpi.avgOrderValueKwd.toFixed(3)}
          </p>
          <p className="mt-1 text-[11px] text-mist-400">
            {en ? 'Net sales ÷ orders' : 'صافي المبيعات ÷ الطلبات'}
          </p>
        </article>

        <article className={`rounded-2xl border p-4 transition-all ${cardBgClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">
            {en ? 'Items sold' : 'القطع المباعة'}
          </p>
          <p className="mt-2 text-2xl font-black text-white font-mono" dir="ltr">
            {dashboard.kpi.itemsSold.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-mist-400">
            {en ? '2.61 items per order' : '2.61 صنف لكل طلب'}
          </p>
        </article>

        <article className={`rounded-2xl border p-4 transition-all ${cardBgClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">
            {en ? 'Discounts given' : 'إجمالي الخصومات'}
          </p>
          <p className="mt-2 text-2xl font-black text-amber-300 font-mono" dir="ltr">
            KWD {dashboard.kpi.discountsGivenKwd.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-mist-400">
            {en ? '2.4% of gross sales' : '2.4% من إجمالي المبيعات'}
          </p>
        </article>

        <article className={`rounded-2xl border p-4 transition-all ${cardBgClass}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">
            {en ? 'Share of group sales' : 'الحصة من مبيعات المجموعة'}
          </p>
          <p className="mt-2 text-2xl font-black text-sky-300 font-mono" dir="ltr">
            {dashboard.kpi.shareOfGroupPercent.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] text-mist-400">
            {selectedBrand === 'ALL'
              ? en
                ? "100.0% of the brand's sales"
                : '100.0% مبيعات المجموعة'
              : en
                ? `Share of ${selectedBrand}`
                : `حصة ${selectedBrand}`}
          </p>
        </article>
      </section>

      {/* 4 HIGHLIGHTS CARDS */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`rounded-2xl border p-4 ${cardBgClass}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <span>🛵</span>
            <span>{en ? 'Biggest channel' : 'القناة الأكبر'}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist-200">
            {en ? dashboard.highlights.biggestChannelTextEn : dashboard.highlights.biggestChannelTextAr}
          </p>
        </div>

        <div className={`rounded-2xl border p-4 ${cardBgClass}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-gold-300">
            <span>⭐</span>
            <span>{en ? 'Best seller' : 'الصنف الأكثر مبيعاً'}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist-200">
            {en ? dashboard.highlights.bestSellerTextEn : dashboard.highlights.bestSellerTextAr}
          </p>
        </div>

        <div className={`rounded-2xl border p-4 ${cardBgClass}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
            <span>📊</span>
            <span>{en ? 'Menu concentration' : 'تركيز المنيو (Pareto)'}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist-200">
            {en ? dashboard.highlights.menuConcentrationTextEn : dashboard.highlights.menuConcentrationTextAr}
          </p>
        </div>

        <div className={`rounded-2xl border p-4 ${cardBgClass}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
            <span>🥤</span>
            <span>{en ? 'Add-ons per order' : 'الإضافات لكل 100 طلب'}</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-mist-200">
            {en ? dashboard.highlights.addOnsTextEn : dashboard.highlights.addOnsTextAr}
          </p>
        </div>
      </section>

      {/* =========================================================================
          SECTION 1: BRANDS SECTION (Interactive Horizontal Bar Charts & Scorecard)
         ========================================================================= */}
      <section className={`rounded-3xl border p-6 space-y-6 ${cardBgClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-black text-white">
              {en ? '🏪 Brand Performance & Comparative Scorecard' : '🏪 أداء البراندات وجدول المقارنة التنافسي'}
            </h2>
            <p className="text-xs text-mist-400">
              {en
                ? 'Click any brand bar or table row to filter the entire dashboard by that brand.'
                : 'اضغط على أي شريط براند أو صف بالجدول لفلترة الصفحة كاملة على هذا البراند مباشرة.'}
            </p>
          </div>
          {selectedBrand !== 'ALL' && (
            <span className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              {en ? `Active Filter: ${selectedBrand}` : `مفلتر حالياً: ${selectedBrand}`}
            </span>
          )}
        </div>

        {/* 2 Clickable Horizontal Charts Side-by-Side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chart 1: Net Sales by Brand */}
          <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-mist-300">
              {en ? 'Net sales by brand (KWD)' : 'صافي المبيعات حسب البراند (د.ك)'}
            </h3>
            <div className="space-y-2.5">
              {OCTOBER_BRAND_SCORECARDS.map((b) => {
                const isSelected = selectedBrand === b.brand
                const pct = Math.round((b.netSalesKwd / maxBrandSales) * 100)
                const isLow = b.lowOrderWarning
                return (
                  <div
                    key={b.brand}
                    onClick={() => handleBrandClick(b.brand)}
                    className={`group cursor-pointer rounded-xl p-2 transition ${
                      isSelected
                        ? 'bg-emerald-500/20 ring-1 ring-emerald-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={isSelected ? 'text-emerald-300 font-bold' : 'text-white'}>
                        {en ? b.brand : b.brandAr}
                        {isLow ? (
                          <span className="ms-1.5 text-[10px] text-amber-400">
                            ({en ? '<200 orders' : '<200 طلب'})
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-mist-200" dir="ltr">
                        KWD {b.netSalesKwd.toLocaleString()} ({b.sharePercent}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isSelected
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                            : isLow
                              ? 'bg-slate-500'
                              : 'bg-gradient-to-r from-[#8cc63f] to-[#00a99d] group-hover:brightness-110'
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chart 2: Average Order Value by Brand */}
          <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-mist-300">
              {en ? 'Average order value by brand (KWD)' : 'متوسط قيمة الطلب حسب البراند (د.ك)'}
            </h3>
            <div className="space-y-2.5">
              {OCTOBER_BRAND_SCORECARDS.map((b) => {
                const isSelected = selectedBrand === b.brand
                const pct = Math.round((b.avgOrderValueKwd / maxBrandAov) * 100)
                return (
                  <div
                    key={b.brand}
                    onClick={() => handleBrandClick(b.brand)}
                    className={`group cursor-pointer rounded-xl p-2 transition ${
                      isSelected
                        ? 'bg-emerald-500/20 ring-1 ring-emerald-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={isSelected ? 'text-emerald-300 font-bold' : 'text-white'}>
                        {en ? b.brand : b.brandAr}
                      </span>
                      <span className="font-mono text-gold-300 font-bold" dir="ltr">
                        KWD {b.avgOrderValueKwd.toFixed(3)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isSelected
                            ? 'bg-gradient-to-r from-gold-400 to-amber-300'
                            : 'bg-gradient-to-r from-[#e5a93b] to-[#d97706] group-hover:brightness-110'
                        }`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Brand Scorecard 10-Column Table with Inline Progress Bars */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">
              {en ? 'Brand Scorecard (10 Metrics)' : 'جدول أداء البراندات الكامل (Brand Scorecard)'}
            </h3>
            <span className="text-xs text-mist-400">
              {en ? 'Sorted by October Net Sales' : 'مرتب تنازلياً حسب مبيعات أكتوبر'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[1020px] w-full text-xs">
              <thead className={tableHeaderBg}>
                <tr>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Brand' : 'البراند'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Orders' : 'الطلبات'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Net sales' : 'صافي المبيعات'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Share of group' : 'حصة المجموعة'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Avg order' : 'متوسط الطلب'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Items / order' : 'صنف/طلب'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Discount rate' : 'نسبة الخصم'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Drinks %' : 'المشروبات %'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Starters %' : 'المقبلات %'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Best seller' : 'الصنف الأفضل'}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.brands.map((row) => {
                  const pct = (row.netSalesKwd / maxBrandSales) * 100
                  const isSelected = selectedBrand === row.brand
                  return (
                    <tr
                      key={row.brand}
                      onClick={() => handleBrandClick(row.brand)}
                      className={`cursor-pointer border-t border-white/5 transition ${
                        isSelected ? 'bg-emerald-500/15' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="px-3 py-3 font-bold text-white">
                        {en ? row.brand : row.brandAr}
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold" dir="ltr">
                        {row.orders.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-emerald-300" dir="ltr">
                            {row.netSalesKwd.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            KWD
                          </span>
                          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-gold-300" dir="ltr">
                        {row.sharePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono" dir="ltr">
                        {row.avgOrderValueKwd.toFixed(2)} KWD
                      </td>
                      <td className="px-3 py-3 font-mono" dir="ltr">
                        {row.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 font-mono text-amber-300" dir="ltr">
                        {row.discountRatePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono text-sky-300" dir="ltr">
                        {row.drinksPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono text-teal-300" dir="ltr">
                        {row.startersPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-semibold text-mist-100">
                        {en ? row.bestSellerEn : row.bestSellerAr}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: CHANNELS SECTION (Interactive Horizontal Bar Charts & Scorecard)
         ========================================================================= */}
      <section className={`rounded-3xl border p-6 space-y-6 ${cardBgClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-black text-white">
              {en ? '🛵 Channel Scorecard & Delivery Aggregators' : '🛵 بطاقة أداء قنوات البيع ومنصات التوصيل'}
            </h2>
            <p className="text-xs text-mist-400">
              {en
                ? 'Shop Sales, Talabat Go/MP, Keeta, Deliveroo, Direct Web, Snoonu, Jahez, Phone, and Whatsapp.'
                : 'مبيعات الصالة، طلبات جو وماركتبليس، كيتا، ديليفرو، الموقع والتطبيق المباشر، سنونو، جاهز، الهاتف، والواتساب.'}
            </p>
          </div>
          {selectedChannel !== 'ALL' && (
            <span className="rounded-xl border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-300">
              {en ? `Active Filter: ${selectedChannel}` : `مفلتر حالياً: ${selectedChannel}`}
            </span>
          )}
        </div>

        {/* 2 Clickable Horizontal Charts Side-by-Side */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chart 1: Net Sales by Channel */}
          <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-mist-300">
              {en ? 'Net sales by channel (KWD)' : 'صافي المبيعات حسب القناة (د.ك)'}
            </h3>
            <div className="space-y-2">
              {OCTOBER_CHANNEL_SCORECARDS.map((c) => {
                const isSelected = selectedChannel === c.channel
                const pct = Math.round((c.netSalesKwd / maxChannelSales) * 100)
                return (
                  <div
                    key={c.channel}
                    onClick={() => handleChannelClick(c.channel)}
                    className={`group cursor-pointer rounded-xl p-1.5 transition ${
                      isSelected
                        ? 'bg-sky-500/20 ring-1 ring-sky-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={isSelected ? 'text-sky-300 font-bold' : 'text-white'}>
                        {en ? c.channel : c.channelAr}
                      </span>
                      <span className="font-mono text-mist-200" dir="ltr">
                        KWD {c.netSalesKwd.toLocaleString()} ({c.sharePercent}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isSelected
                            ? 'bg-gradient-to-r from-sky-400 to-indigo-300'
                            : 'bg-gradient-to-r from-sky-500 to-teal-400 group-hover:brightness-110'
                        }`}
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chart 2: Average Order Value by Channel */}
          <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-mist-300">
              {en ? 'Average order value by channel (KWD)' : 'متوسط قيمة الطلب حسب القناة (د.ك)'}
            </h3>
            <div className="space-y-2">
              {OCTOBER_CHANNEL_SCORECARDS.map((c) => {
                const isSelected = selectedChannel === c.channel
                const pct = Math.round((c.avgOrderValueKwd / maxChannelAov) * 100)
                const isHighAov = c.avgOrderValueKwd >= 9.0
                return (
                  <div
                    key={c.channel}
                    onClick={() => handleChannelClick(c.channel)}
                    className={`group cursor-pointer rounded-xl p-1.5 transition ${
                      isSelected
                        ? 'bg-sky-500/20 ring-1 ring-sky-400'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className={isSelected ? 'text-sky-300 font-bold' : 'text-white'}>
                        {en ? c.channel : c.channelAr}
                        {isHighAov ? (
                          <span className="ms-1.5 text-[10px] text-emerald-300 font-bold">
                            (★ High AOV)
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-gold-300 font-bold" dir="ltr">
                        KWD {c.avgOrderValueKwd.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isSelected
                            ? 'bg-gradient-to-r from-gold-400 to-amber-300'
                            : isHighAov
                              ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
                              : 'bg-gradient-to-r from-[#d97706] to-[#b45309] group-hover:brightness-110'
                        }`}
                        style={{ width: `${Math.max(3, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Channel Scorecard Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white">
              {en ? 'Channel Scorecard (10 Metrics)' : 'جدول أداء القنوات الكامل (Channel Scorecard)'}
            </h3>
            <span className="text-xs text-mist-400">
              {en ? '11 Channels Tracked' : 'متابعة شاملة لـ 11 قناة بيع'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[1020px] w-full text-xs">
              <thead className={tableHeaderBg}>
                <tr>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Channel' : 'القناة'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Orders' : 'الطلبات'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Net sales' : 'صافي المبيعات'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Share' : 'الحصة'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Avg order' : 'متوسط الطلب'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Items / order' : 'صنف/طلب'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Discount rate' : 'نسبة الخصم'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Drinks %' : 'المشروبات %'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Starters %' : 'المقبلات %'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Desserts %' : 'الحلويات %'}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.channels.map((row) => {
                  const isSelected = selectedChannel === row.channel
                  return (
                    <tr
                      key={row.channel}
                      onClick={() => handleChannelClick(row.channel)}
                      className={`cursor-pointer border-t border-white/5 transition ${
                        isSelected ? 'bg-sky-500/15' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="px-3 py-3 font-bold text-white">
                        {en ? row.channel : row.channelAr}
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold" dir="ltr">
                        {row.orders.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-emerald-300" dir="ltr">
                        {row.netSalesKwd.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        KWD
                      </td>
                      <td className="px-3 py-3 font-mono font-semibold text-gold-300" dir="ltr">
                        {row.sharePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono font-bold text-white" dir="ltr">
                        {row.avgOrderValueKwd.toFixed(2)} KWD
                      </td>
                      <td className="px-3 py-3 font-mono" dir="ltr">
                        {row.itemsPerOrder.toFixed(2)}
                      </td>
                      <td className="px-3 py-3 font-mono text-amber-300" dir="ltr">
                        {row.discountRatePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono text-sky-300" dir="ltr">
                        {row.drinksPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono text-teal-300" dir="ltr">
                        {row.startersPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 font-mono text-pink-300" dir="ltr">
                        {row.dessertsPercent.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: MENU ENGINEERING MATRIX & CATEGORY BREAKDOWN
         ========================================================================= */}
      <section className={`rounded-3xl border p-6 space-y-6 ${cardBgClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-black text-white">
              {en ? '🍳 Menu Engineering Matrix & Category Breakdown' : '🍳 تحليل هندسة المنيو ومصفوفة ربحية الأصناف'}
            </h2>
            <p className="text-xs text-mist-400">
              {en
                ? 'Classification by profitability (margin %) and popularity (volume units sold).'
                : 'تصنيف الأصناف حسب الربحية (هامش المساهمة) والشعبية (كمية المبيعات).'}
            </p>
          </div>
        </div>

        {/* 4 Quadrants Visual */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-lg">⭐</span>
              <span className="rounded-md bg-emerald-400/20 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                TOP PERFORMERS (الأصناف الذهبية الرائدة)
              </span>
            </div>
            <p className="text-sm font-black text-white">
              {en ? 'High Popularity & High Profit' : 'شعبية عالية + ربحية مرتفعة'}
            </p>
            <p className="text-xs text-mist-300">
              {en
                ? 'Chicken Noodles, Beef Mongolian, Dynamite Shrimp, Philly CheeseSteak.'
                : 'نودلز دجاج، بيف منغولي، ديناميت شرمب، فيلي تشيز ستيك.'}
            </p>
            <p className="text-[11px] font-semibold text-emerald-300">
              {en ? 'Action: Maintain quality & prime display.' : 'الإجراء: تثبيت المعايير ومواقع الصدارة.'}
            </p>
          </div>

          <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-lg">🐎</span>
              <span className="rounded-md bg-sky-400/20 px-2 py-0.5 text-[10px] font-black text-sky-300">
                HIGH-DEMAND STAPLES (الأصناف عالية الطلب)
              </span>
            </div>
            <p className="text-sm font-black text-white">
              {en ? 'High Popularity & Modest Margin' : 'شعبية عالية + هامش معتدل'}
            </p>
            <p className="text-xs text-mist-300">
              {en
                ? 'Egg Fried Rice, Szechuan Beef, Chicken Fillet Meal.'
                : 'أرز مقلي بالبيض، لحم سيشوان، وجبة فيليه دجاج.'}
            </p>
            <p className="text-[11px] font-semibold text-sky-300">
              {en ? 'Action: Micro-price tweak / combo pairing.' : 'الإجراء: تعديل طفيف في السعر أو ربط بمشروب.'}
            </p>
          </div>

          <div className="rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-lg">🧩</span>
              <span className="rounded-md bg-gold-400/20 px-2 py-0.5 text-[10px] font-black text-gold-300">
                HIGH-MARGIN (أصناف واعدة عالية الربح)
              </span>
            </div>
            <p className="text-sm font-black text-white">
              {en ? 'Low Popularity & High Profit' : 'شعبية منخفضة + ربحية ممتازة'}
            </p>
            <p className="text-xs text-mist-300">
              {en
                ? 'Sriracha Chicken Noodles, Chapati Box (6 pcs).'
                : 'نودلز دجاج سريراتشا، بوكس شباتي كرك (6 حبات).'}
            </p>
            <p className="text-[11px] font-semibold text-gold-300">
              {en ? 'Action: Upsell & hero banner promotion.' : 'الإجراء: اقتراح الكاشير وترويج المنصات.'}
            </p>
          </div>

          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-lg">🐶</span>
              <span className="rounded-md bg-rose-400/20 px-2 py-0.5 text-[10px] font-black text-rose-300">
                SLOW-MOVING (الأصناف الراكدة ضعيفة الأداء)
              </span>
            </div>
            <p className="text-sm font-black text-white">
              {en ? 'Low Popularity & Low Margin' : 'شعبية منخفضة + ربحية ضعيفة'}
            </p>
            <p className="text-xs text-mist-300">
              {en
                ? 'Steamed Edamame, Fried Banana, Kimchi Soup.'
                : 'إدامامي مسلوق، موز مقلي، شوربة كيمتشي.'}
            </p>
            <p className="text-[11px] font-semibold text-rose-300">
              {en ? 'Action: Deploy 7 Action Playbooks or retire.' : 'الإجراء: تطبيق كتيب الإجراءات الـ 7 أو الحذف.'}
            </p>
          </div>
        </div>

        {/* Category Share Progress Bars */}
        <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-mist-300">
            {en ? 'Sales by Menu Category' : 'توزيع المبيعات حسب تصنيفات المنيو'}
          </h3>
          <div className="space-y-2">
            {CATEGORY_BREAKDOWN.map((cat) => (
              <div key={cat.nameEn} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>{en ? cat.nameEn : cat.nameAr}</span>
                  <span className="font-mono text-emerald-300" dir="ltr">
                    KWD {cat.salesKwd.toLocaleString()} ({cat.sharePercent}%) · {cat.itemsSold.toLocaleString()} items
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400"
                    style={{ width: `${cat.sharePercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 15 Best Sellers Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-white">
            {en ? 'Top Best Sellers & Margin Matrix' : 'قائمة أفضل الأصناف مبيعاً ومصفوفة الهامش'}
          </h3>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[920px] w-full text-xs">
              <thead className={tableHeaderBg}>
                <tr>
                  <th className="px-3 py-3 text-start font-bold">#</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Item Name' : 'اسم الصنف'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Brand' : 'البراند'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Category' : 'التصنيف'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Price' : 'السعر'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Units Sold' : 'الكمية المباعة'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Sales (KWD)' : 'المبيعات (د.ك)'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Margin %' : 'الهامش %'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Class' : 'التصنيف'}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.bestSellers.map((item, idx) => (
                  <tr key={item.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-mono text-mist-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-white">
                      {en ? item.nameEn : item.nameAr}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-gold-300">{item.brand}</td>
                    <td className="px-3 py-2.5 text-mist-300">
                      {en ? item.categoryEn : item.categoryAr}
                    </td>
                    <td className="px-3 py-2.5 font-mono" dir="ltr">
                      {item.priceKwd.toFixed(3)} KWD
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold" dir="ltr">
                      {item.unitsSold.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-bold text-emerald-300" dir="ltr">
                      {item.salesKwd.toLocaleString(undefined, { minimumFractionDigits: 1 })} KWD
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sky-300 font-bold" dir="ltr">
                      {item.marginPercent.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                          item.classification === 'TopPerformer'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : item.classification === 'HighDemand'
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-400/30'
                              : 'bg-gold-500/20 text-gold-300 border border-gold-400/30'
                        }`}
                      >
                        {item.classification}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: SLOW MOVERS & 7 ACTION PLAYBOOKS ENGINE
         ========================================================================= */}
      <section className={`rounded-3xl border p-6 space-y-6 ${cardBgClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-black text-white">
              {en
                ? '⚡ Slow Movers Engine & 7 Action Playbooks'
                : '⚡ محرك معالجة الأصناف الراكدة والبطيئة (7 Action Playbooks)'}
            </h2>
            <p className="text-xs text-mist-400">
              {en
                ? 'Automated diagnostics and tactical intervention recipes to revive underperforming dishes.'
                : 'تشخيص فوري للأصناف الراكدة مع خطط تدخل تشغيلية وترويجية مباشرة لرفع مبيعاتها.'}
            </p>
          </div>
        </div>

        {/* 7 Action Playbooks Cards Preview */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ACTION_PLAYBOOKS.map((pb) => (
            <div
              key={pb.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2"
            >
              <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-mist-300">
                PLAYBOOK #{pb.id}
              </span>
              <p className="text-xs font-black text-white">{en ? pb.titleEn : pb.titleAr}</p>
              <p className="text-[11px] leading-relaxed text-mist-300">
                {en ? pb.taglineEn : pb.taglineAr}
              </p>
              <p className="text-[10px] font-bold text-emerald-300 pt-1 border-t border-white/10">
                📈 {en ? pb.expectedImpactEn : pb.expectedImpactAr}
              </p>
            </div>
          ))}
        </div>

        {/* Slow Movers Action Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-white">
            {en ? 'Identified Slow Movers & Recommended Actions' : 'الأصناف البطيئة المرصودة والإجراء الموصى به'}
          </h3>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[940px] w-full text-xs">
              <thead className={tableHeaderBg}>
                <tr>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Dish Name' : 'اسم الصنف'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Brand' : 'البراند'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Category' : 'التصنيف'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Price' : 'السعر'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Units Sold' : 'الكمية المباعة'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Sales' : 'المبيعات'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Recommended Playbook' : 'الخطة الموصى بها'}</th>
                  <th className="px-3 py-3 text-start font-bold">{en ? 'Action' : 'التنفيذ'}</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.slowMovers.map((item) => (
                  <tr key={item.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-bold text-white">
                      {en ? item.nameEn : item.nameAr}
                    </td>
                    <td className="px-3 py-3 font-semibold text-gold-300">{item.brand}</td>
                    <td className="px-3 py-3 text-mist-300">
                      {en ? item.categoryEn : item.categoryAr}
                    </td>
                    <td className="px-3 py-3 font-mono" dir="ltr">
                      {item.priceKwd.toFixed(3)} KWD
                    </td>
                    <td className="px-3 py-3 font-mono text-rose-300 font-bold" dir="ltr">
                      {item.unitsSold} {en ? 'units' : 'حبة'}
                    </td>
                    <td className="px-3 py-3 font-mono" dir="ltr">
                      {item.salesKwd.toFixed(3)} KWD
                    </td>
                    <td className="px-3 py-3 font-semibold text-sky-300">
                      {en ? item.playbookTitleEn : item.playbookTitleAr}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => handleApplyPlaybook(item)}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[11px] font-black text-ink-950 shadow-sm hover:brightness-110"
                      >
                        ⚡ {en ? 'Apply Playbook' : 'تفعيل الإجراء'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODAL: Apply Playbook Modal */}
      {activePlaybookModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          dir={en ? 'ltr' : 'rtl'}
        >
          <div className="w-full max-w-xl rounded-3xl border border-emerald-400/40 bg-[#0f141c] p-6 text-mist-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  {en ? 'Playbook Execution Engine' : 'محرك تنفيذ خطط معالجة الأصناف'}
                </p>
                <h3 className="text-base font-black text-white">
                  {en ? activePlaybookModal.playbook.titleEn : activePlaybookModal.playbook.titleAr}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePlaybookModal(null)}
                className="rounded-xl border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="font-bold text-white">
                  {en ? 'Target Item:' : 'الصنف المستهدف:'}{' '}
                  <span className="text-gold-300">
                    {en ? activePlaybookModal.item.nameEn : activePlaybookModal.item.nameAr}
                  </span>
                </p>
                <p className="text-mist-400 mt-1">
                  {en
                    ? `Brand: ${activePlaybookModal.item.brand} · Price: ${activePlaybookModal.item.priceKwd.toFixed(3)} KWD · Sold: ${activePlaybookModal.item.unitsSold} units`
                    : `البراند: ${activePlaybookModal.item.brand} · السعر: ${activePlaybookModal.item.priceKwd.toFixed(3)} د.ك · المبيعات: ${activePlaybookModal.item.unitsSold} حبة`}
                </p>
              </div>

              <div>
                <p className="font-bold text-emerald-300">
                  {en ? 'Execution Strategy:' : 'خطة التنفيذ التشغيلية:'}
                </p>
                <p className="mt-1 text-mist-200">
                  {en ? activePlaybookModal.playbook.descriptionEn : activePlaybookModal.playbook.descriptionAr}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3">
                <p className="font-bold text-emerald-200">
                  {en ? 'Projected Revenue Lift:' : 'الأثر المالي المتوقع:'}
                </p>
                <p className="mt-0.5 text-mist-100">
                  {en ? activePlaybookModal.playbook.expectedImpactEn : activePlaybookModal.playbook.expectedImpactAr}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setActivePlaybookModal(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold hover:bg-white/5"
              >
                {en ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPlaybook}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-black text-ink-950 shadow-md hover:brightness-110"
              >
                {en ? 'Confirm & Deploy to Menu' : 'تأكيد وتفعيل الإجراء بالمنيو'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Upload New Sales File */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          dir={en ? 'ltr' : 'rtl'}
        >
          <div className="w-full max-w-lg rounded-3xl border border-emerald-400/40 bg-[#0f141c] p-6 text-mist-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white">
                {en ? '📤 Upload Sales Spreadsheet (Excel / CSV)' : '📤 رفع ملف مبيعات جديد (Excel / CSV)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="rounded-xl border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-mist-300">
                {en
                  ? 'Upload POS settlements, Talabat/Keeta sales exports, or consolidated orders sheet. The browser will parse it locally without uploading megabytes.'
                  : 'أرفق ملف مبيعات الصالة أو كشوف المنصات الشهرية. يقرأ المتصفح البيانات محلياً ويحدّث مؤشرات اللوحة فوراً.'}
              </p>

              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-black/30 p-8 text-center cursor-pointer hover:border-emerald-400">
                <span className="text-3xl">📁</span>
                <span className="mt-2 text-xs font-bold text-white">
                  {en ? 'Click to select Excel / CSV file' : 'اضغط لاختيار ملف Excel أو CSV من جهازك'}
                </span>
                <span className="mt-1 text-[11px] text-mist-400">.xlsx · .xls · .csv</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setUploadedFileName(f.name)
                      setDataSource('uploaded')
                      setShowUploadModal(false)
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
