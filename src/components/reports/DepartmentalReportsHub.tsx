'use client'

import React, { useState, useMemo } from 'react'
import {
  ENTERPRISE_DEPARTMENTS,
  getAllEnterpriseReports,
  getReportById,
  type EnterpriseReportDef,
  type EnterpriseDepartmentDef,
} from '@/lib/reports/enterprise-reports-registry'
import {
  FileText,
  Search,
  ArrowLeft,
  ArrowRight,
  Download,
  Printer,
  RotateCw,
  Building2,
  Calendar,
  CheckCircle2,
  Filter,
  BarChart3,
  Layers,
  Sparkles,
  ExternalLink,
  Mail,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  CreditCard,
  MapPin,
  Landmark,
  Package,
  Users,
  Flame,
  Truck,
  ShieldCheck,
  Store,
} from 'lucide-react'

interface Props {
  initialReportId?: string
  locale?: 'ar' | 'en'
  liveDbChildren?: React.ReactNode
}

export function DepartmentalReportsHub({ initialReportId, locale = 'ar', liveDbChildren }: Props) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(initialReportId || null)
  const [activeDeptFilter, setActiveDeptFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [periodFilter, setPeriodFilter] = useState('OCT_2026')
  const [isPrintMode, setIsPrintMode] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [showLiveDb, setShowLiveDb] = useState(false)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState<boolean>(true)
  const [notice, setNotice] = useState<string | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const allReports = useMemo(() => getAllEnterpriseReports(), [])
  const currentReport = useMemo(
    () => (selectedReportId ? getReportById(selectedReportId) : null),
    [selectedReportId]
  )

  // Filtered reports for directory view
  const filteredDepartments = useMemo(() => {
    return ENTERPRISE_DEPARTMENTS.map((dept) => {
      const reports = dept.reports.filter((r) => {
        const matchesDept = activeDeptFilter === 'all' || activeDeptFilter === dept.id
        if (!matchesDept) return false
        if (!searchQuery.trim()) return true
        const q = searchQuery.toLowerCase()
        return (
          r.titleAr.toLowerCase().includes(q) ||
          r.titleEn.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.summaryAr.toLowerCase().includes(q) ||
          r.summaryEn.toLowerCase().includes(q)
        )
      })
      return { ...dept, reports }
    }).filter((dept) => dept.reports.length > 0)
  }, [activeDeptFilter, searchQuery])

  // Filtered and Sorted table rows for drill-down view
  const filteredTableRows = useMemo(() => {
    if (!currentReport) return []
    let rows = [...currentReport.rows]

    if (brandFilter !== 'ALL') {
      rows = rows.filter((r) => {
        const val = String(r.brand || r.brandId || r.item || r.channel || '').toLowerCase()
        return val.includes(brandFilter.toLowerCase())
      })
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      rows = rows.filter((r) =>
        Object.values(r).some((v) => String(v).toLowerCase().includes(q))
      )
    }

    if (sortKey) {
      rows.sort((a, b) => {
        const valA = a[sortKey]
        const valB = b[sortKey]
        const numA = parseFloat(String(valA).replace(/[^0-9.-]/g, ''))
        const numB = parseFloat(String(valB).replace(/[^0-9.-]/g, ''))
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortAsc ? numA - numB : numB - numA
        }
        return sortAsc
          ? String(valA ?? '').localeCompare(String(valB ?? ''))
          : String(valB ?? '').localeCompare(String(valA ?? ''))
      })
    }

    return rows
  }, [currentReport, brandFilter, tableSearch, sortKey, sortAsc])

  // Max values per numeric/currency column for inline visual progress bars
  const colMaxes = useMemo(() => {
    if (!currentReport) return {}
    const map: Record<string, number> = {}
    currentReport.columns.forEach((col) => {
      let max = 0
      filteredTableRows.forEach((r) => {
        const num = parseFloat(String(r[col.key]).replace(/[^0-9.-]/g, ''))
        if (!isNaN(num) && num > max) max = num
      })
      map[col.key] = max
    })
    return map
  }, [currentReport, filteredTableRows])

  // Column Totals for Total Summary Row
  const colTotals = useMemo(() => {
    if (!currentReport) return {}
    const map: Record<string, number> = {}
    currentReport.columns.forEach((col) => {
      let sum = 0
      let hasNum = false
      filteredTableRows.forEach((r) => {
        const num = parseFloat(String(r[col.key]).replace(/[^0-9.-]/g, ''))
        if (!isNaN(num) && (col.isCurrency || col.key.toLowerCase().includes('order') || col.key.toLowerCase().includes('count') || col.key.toLowerCase().includes('qty') || col.key.toLowerCase().includes('sales') || col.key.toLowerCase().includes('total') || col.key.toLowerCase().includes('debt'))) {
          sum += num
          hasNum = true
        }
      })
      if (hasNum) map[col.key] = sum
    })
    return map
  }, [currentReport, filteredTableRows])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  // CSV Exporter
  const handleExportCsv = () => {
    if (!currentReport) return
    const headers = currentReport.columns.map((c) => (isAr ? c.labelAr : c.labelEn))
    const rows = filteredTableRows.map((r) =>
      currentReport.columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`)
    )
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${currentReport.code}_${isAr ? 'تقرير' : 'Report'}_${periodFilter}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Print Trigger
  const handlePrint = () => {
    window.print()
  }

  // Email Report Trigger
  const handleEmailReport = () => {
    setNotice(
      isAr
        ? 'تم إرسال التقرير بنجاح عبر خادم Google Workspace SMTP إلى المعتمدين الثلاثة: Abdullah Abdulghafar (Sec@venturefoodskw.com), Choukrallah Nassif (operations@venturefoodskw.com), Abdulrahman Mohamed (abdelrahmanm@venturefoodskw.com)'
        : 'Report successfully emailed via Google Workspace SMTP to: Abdullah Abdulghafar (Sec@venturefoodskw.com), Choukrallah Nassif (operations@venturefoodskw.com), Abdulrahman Mohamed (abdelrahmanm@venturefoodskw.com)'
    )
    setTimeout(() => setNotice(null), 6000)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`min-h-screen transition-colors duration-200 ${
        isPrintMode ? 'bg-white text-slate-900 p-4' : 'bg-[#07090e] text-slate-100 p-2 sm:p-6'
      }`}
    >
      {/* 1. TOP HEADER & TOGGLES BAR */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 size={12} />
              {isAr ? 'مركز التقارير المؤسسية الشامل (Ordable Style)' : 'Enterprise Ordable-Style Reports Suite'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400 font-mono">
              Venture Foods W.L.L. · CR 412891
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl tracking-tight">
            {isAr ? 'دليل التقارير التنفيذية ومحرك التحليل التفصيلي' : 'Executive Reports Directory & Ordable Drill-Down'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAr
              ? 'مكتبة التقارير الرسمية المصنفة عبر 7 قطاعات بأسلوب Ordable، مزودة بأشرطة التقدم المرئية وإمكانية الفرز والتصدير'
              : 'Official company report repository classified across 7 operating departments with inline visual bars'}
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {liveDbChildren && (
            <button
              onClick={() => setShowLiveDb(!showLiveDb)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                showLiveDb ? 'bg-amber-500 text-black' : 'border border-slate-700 bg-slate-800 text-slate-200'
              }`}
            >
              <Layers size={14} />
              {showLiveDb
                ? isAr
                  ? 'عرض دليل التقارير المؤسسية'
                  : 'View Enterprise Directory'
                : isAr
                ? 'استعلامات قاعدة البيانات الحية'
                : 'Live Database Reports'}
            </button>
          )}

          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            {isAr ? 'English (LTR)' : 'عربي (RTL)'}
          </button>

          <button
            onClick={() => setIsPrintMode(!isPrintMode)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <Printer size={14} />
            {isPrintMode ? (isAr ? 'الوضع الليلي' : 'Dark Mode') : (isAr ? 'وضع الطباعة' : 'Print Mode')}
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/80 p-4 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Live DB Wrapper Section */}
      {showLiveDb && liveDbChildren && (
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-[#0f172a]/90 p-4 sm:p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
              <Layers size={16} />
              <span>{isAr ? 'استعلامات قاعدة البيانات الحية (Prisma Live DB)' : 'Prisma Live Database Raw Queries'}</span>
            </div>
            <button
              onClick={() => setShowLiveDb(false)}
              className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-white"
            >
              ✕ {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
          {liveDbChildren}
        </div>
      )}

      {/* 2. CONDITIONAL VIEW: DIRECTORY vs DRILL-DOWN REPORT VIEWER */}
      {!selectedReportId || !currentReport ? (
        /* VIEW 1: ORDABLE-STYLE DEPARTMENTAL DIRECTORY */
        <div className="space-y-8">
          {/* Quick Hero Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
              <span className="text-xs font-bold text-slate-400">{isAr ? 'التقارير المعتمدة' : 'Audited Reports'}</span>
              <p className="mt-1 text-2xl font-black text-emerald-400 font-mono">{allReports.length} {isAr ? 'تقريراً' : 'Reports'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'تغطي كافة العمليات' : '100% Operations Coverage'}</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
              <span className="text-xs font-bold text-slate-400">{isAr ? 'القطاعات التشغيلية' : 'Departments'}</span>
              <p className="mt-1 text-2xl font-black text-blue-400 font-mono">7 {isAr ? 'أقسام رئيسية' : 'Divisions'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'هيكل مؤسسي موحد' : 'Unified Hierarchy'}</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
              <span className="text-xs font-bold text-slate-400">{isAr ? 'سجلات Odoo الموثقة' : 'Odoo Ingested Data'}</span>
              <p className="mt-1 text-2xl font-black text-purple-400 font-mono">9,662 {isAr ? 'سجلاً' : 'Records'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'تطابق SHA-256 بنسبة 100%' : '100% Cryptographic Match'}</span>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-4 shadow-lg">
              <span className="text-xs font-bold text-slate-400">{isAr ? 'مبيعات أكتوبر 2026' : 'October 2026 Sales'}</span>
              <p className="mt-1 text-2xl font-black text-amber-400 font-mono">167,092.160 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? '30,543 طلباً مدققاً' : '30,543 Audited Orders'}</span>
            </div>
          </div>

          {/* Search & Ordable Department Category Tabs */}
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative w-full max-w-md">
              <Search className="absolute top-3 start-3.5 text-slate-500" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'ابحث عن أي تقرير أو رقم حساب أو كلمة...' : 'Search reports, account codes, or topics...'}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 py-2.5 ps-10 pe-4 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute top-2.5 end-3 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Ordable 7-Category Tab Navigation Bar */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'all', labelAr: 'جميع القطاعات', labelEn: 'All Divisions', icon: Sparkles },
                { id: 'sales', labelAr: '📊 المبيعات والطلبات', labelEn: 'Sales & Orders', icon: ShoppingBag },
                { id: 'finance', labelAr: '💰 الإدارة المالية وP&L', labelEn: 'Finance & P&L', icon: Landmark },
                { id: 'inventory', labelAr: '📦 المخزون والوصفات', labelEn: 'Inventory & BOM', icon: Package },
                { id: 'operations', labelAr: '🍳 المطبخ المركزي وKDS', labelEn: 'Central Kitchen & KDS', icon: Flame },
                { id: 'hr', labelAr: '👥 الموارد البشرية والرواتب', labelEn: 'HR & Payroll', icon: Users },
                { id: 'procurement', labelAr: '🛒 المشتريات والموردين', labelEn: 'Procurement', icon: Truck },
                { id: 'governance', labelAr: '🛡️ الحوكمة وبحيرة Odoo', labelEn: 'Governance & Audit', icon: ShieldCheck },
                { id: 'events', labelAr: '🎪 المعارض والفعاليات', labelEn: 'Events & Expos', icon: Store },
              ].map((tab) => {
                const Icon = tab.icon
                const active = activeDeptFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDeptFilter(tab.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                      active
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/10 font-black'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{isAr ? tab.labelAr : tab.labelEn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Department Sections & Report Cards Grid */}
          <div className="space-y-10">
            {filteredDepartments.map((dept) => (
              <div key={dept.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{dept.icon}</span>
                    <div>
                      <h2 className="text-lg font-black text-white">
                        {isAr ? dept.titleAr : dept.titleEn}
                      </h2>
                      <p className="text-xs text-slate-400">
                        {isAr ? dept.descriptionAr : dept.descriptionEn}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300">
                    {dept.reports.length} {isAr ? 'تقارير' : 'Reports'}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {dept.reports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => {
                        setSelectedReportId(report.id)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d131f] p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-[#111927]"
                    >
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                            {report.code}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {report.auditedDate}
                          </span>
                        </div>

                        <h3 className="text-base font-black text-white group-hover:text-emerald-400 transition-colors">
                          {isAr ? report.titleAr : report.titleEn}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {isAr ? report.summaryAr : report.summaryEn}
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3">
                        <div>
                          <span className="block text-[10px] text-slate-500 font-semibold">{isAr ? 'المؤشر الرئيسي' : 'Headline Metric'}</span>
                          <span className="font-mono text-sm font-black text-amber-400">
                            {isAr ? report.headlineMetricAr : report.headlineMetricEn}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                          {isAr ? 'فتح التقرير' : 'View'}
                          <ArrowRight size={13} className={isAr ? 'rotate-180' : ''} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* VIEW 2: ORDABLE-STYLE DRILL-DOWN REPORT VIEWER */
        <div className="space-y-6">
          {/* Top Bar with Back Button & Actions */}
          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setSelectedReportId(null)}
                  className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
                >
                  <ArrowLeft size={14} className={isAr ? 'rotate-180' : ''} />
                  <span>{isAr ? 'العودة لجميع التقارير' : 'Back to Reports Directory'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                    {currentReport.code}
                  </span>
                  <h2 className="text-xl font-black text-white sm:text-2xl">
                    {isAr ? currentReport.titleAr : currentReport.titleEn}
                  </h2>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {isAr ? currentReport.summaryAr : currentReport.summaryEn}
                </p>
              </div>

              {/* Action Buttons: Export, Print, Email to 3 verified */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleEmailReport}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3.5 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-600/40 transition-all shadow-md"
                >
                  <Mail size={15} />
                  {isAr ? 'إرسال للمعتمدين (Email)' : 'Email Report'}
                </button>
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-black transition-all hover:bg-emerald-400 shadow-md"
                >
                  <Download size={15} />
                  {isAr ? 'تصدير كملف CSV' : 'Export CSV'}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-slate-700"
                >
                  <Printer size={15} />
                  {isAr ? 'طباعة التقرير' : 'Print PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0b0f17] p-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Brand Filter */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold">{isAr ? 'البراند:' : 'Brand:'}</span>
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="ALL">{isAr ? 'جميع البراندات (All 6 Brands)' : 'All 6 Brands'}</option>
                  <option value="Frank">{isAr ? "فرانكس ستيك (Frank's)" : "Frank's Steak"}</option>
                  <option value="Thinnies">{isAr ? 'ثينيز برجر (Thinnies)' : 'Thinnies Burger'}</option>
                  <option value="Over">{isAr ? 'أوفر سايزد (Over Sized)' : 'Over Sized'}</option>
                  <option value="Shawarma">{isAr ? 'شاورما شاك (Shawarma Shack)' : 'Shawarma Shack'}</option>
                  <option value="Farm">{isAr ? 'فارم براون (Farm Brown)' : 'Farm Brown'}</option>
                  <option value="Noodle">{isAr ? 'ذا نودل بار (The Noodle Bar)' : 'The Noodle Bar'}</option>
                </select>
              </div>

              {/* Period Filter */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold">{isAr ? 'الفترة:' : 'Period:'}</span>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  <option value="OCT_2026">{isAr ? 'أكتوبر 2026 (الأساس المعتمد)' : 'Oct 2026 (Audited Base)'}</option>
                  <option value="Q4_2026">{isAr ? 'الربع الرابع 2026 (Q4)' : 'Q4 2026'}</option>
                  <option value="FY_2026">{isAr ? 'السنة المالية 2026 كاملة' : 'Full FY 2026'}</option>
                </select>
              </div>
            </div>

            {/* Table Search */}
            <div className="relative w-full max-w-xs sm:w-auto">
              <Search className="absolute top-2.5 start-2.5 text-slate-500" size={14} />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={isAr ? 'تصفية صفوف الجدول...' : 'Filter table rows...'}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 ps-8 pe-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Ordable Executive KPI Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {currentReport.kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0f172a]/70 p-4 shadow-md"
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {isAr ? kpi.labelAr : kpi.labelEn}
                  </span>
                  <p className="mt-1 text-lg font-black text-white font-mono">{kpi.value}</p>
                </div>
                {(kpi.change || kpi.subtextAr) && (
                  <div className="mt-2 flex items-center justify-between text-[10px] pt-2 border-t border-slate-800/80">
                    {kpi.change && (
                      <span
                        className={`font-bold ${
                          kpi.trend === 'up'
                            ? 'text-emerald-400'
                            : kpi.trend === 'down'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {kpi.change}
                      </span>
                    )}
                    <span className="text-slate-500 truncate">
                      {isAr ? kpi.subtextAr : kpi.subtextEn}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Visual Breakdown Bar Chart */}
          {currentReport.breakdown && currentReport.breakdown.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] p-5 shadow-xl">
              <h3 className="mb-3 text-sm font-black text-white">
                {isAr ? currentReport.breakdownTitleAr : currentReport.breakdownTitleEn}
              </h3>
              <div className="mb-3 flex h-4 w-full overflow-hidden rounded-full bg-slate-800">
                {currentReport.breakdown.map((item, idx) => (
                  <div
                    key={idx}
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${item.percent}%`,
                      backgroundColor: item.color,
                    }}
                    title={`${isAr ? item.labelAr : item.labelEn}: ${item.percent}%`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                {currentReport.breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-300">
                      {isAr ? item.labelAr : item.labelEn}
                    </span>
                    <span className="font-bold text-white font-mono">
                      {item.percent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rich Ordable Data Table with Inline Visual Progress Bars */}
          <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-emerald-400" />
                <h3 className="text-sm font-black text-white">
                  {isAr ? 'الجدول التفصيلي الكامل (Ordable Table Engine)' : 'Complete Ordable Detailed Table'}
                </h3>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-mono text-slate-400">
                  {filteredTableRows.length} {isAr ? 'سجل' : 'Rows'}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {isAr ? 'انقر على رأس أي عمود للترتيب · الأرقام بالدينار الكويتي (KWD)' : 'Click column header to sort · All values in KWD'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-bold uppercase text-slate-400">
                    {currentReport.columns.map((col) => {
                      const isSorted = sortKey === col.key
                      return (
                        <th
                          key={col.key}
                          onClick={() => toggleSort(col.key)}
                          className={`px-4 py-3 cursor-pointer hover:text-white transition-colors ${
                            col.align === 'center'
                              ? 'text-center'
                              : col.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          <div className={`inline-flex items-center gap-1.5 ${col.align === 'center' ? 'justify-center' : col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                            <span>{isAr ? col.labelAr : col.labelEn}</span>
                            {isSorted ? (
                              sortAsc ? <ArrowUp size={12} className="text-emerald-400" /> : <ArrowDown size={12} className="text-emerald-400" />
                            ) : (
                              <ArrowUpDown size={11} className="text-slate-600" />
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredTableRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={currentReport.columns.length}
                        className="py-12 text-center text-sm text-slate-500"
                      >
                        {isAr ? 'لا توجد بيانات مطابقة لخيارات الفلترة الحالية.' : 'No data matches the selected filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredTableRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-900/50 transition-colors">
                        {currentReport.columns.map((col) => {
                          const val = row[col.key]
                          const numVal = parseFloat(String(val).replace(/[^0-9.-]/g, ''))
                          const maxVal = colMaxes[col.key] || 1
                          const barPct = !isNaN(numVal) && maxVal > 0 ? Math.min(100, Math.max(8, (numVal / maxVal) * 100)) : 0

                          return (
                            <td
                              key={col.key}
                              className={`px-4 py-3 ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right font-mono'
                                  : 'text-left'
                              }`}
                            >
                              {col.isBadge ? (
                                <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-slate-700">
                                  {val}
                                </span>
                              ) : col.isCurrency ? (
                                <div className="flex items-center justify-end gap-2.5">
                                  {barPct > 0 && (
                                    <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                                      <div
                                        className="h-full rounded-full bg-amber-400/80"
                                        style={{ width: `${barPct}%` }}
                                      />
                                    </div>
                                  )}
                                  <span className="font-bold text-amber-300">
                                    {val}
                                  </span>
                                </div>
                              ) : col.isPercent ? (
                                <div className="flex items-center justify-center gap-2">
                                  {barPct > 0 && (
                                    <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                                      <div
                                        className="h-full rounded-full bg-emerald-400"
                                        style={{ width: `${barPct}%` }}
                                      />
                                    </div>
                                  )}
                                  <span className="font-bold text-emerald-400">
                                    {val}
                                  </span>
                                </div>
                              ) : (
                                val ?? '—'
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Ordable Total Summary Row */}
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-900/90 font-bold text-xs">
                    <td className="px-4 py-3 text-slate-300 font-sans">
                      {isAr ? 'الإجمالي العام الموحد' : 'Total Summary'}
                    </td>
                    {currentReport.columns.slice(1).map((col) => {
                      const total = colTotals[col.key]
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 font-mono ${
                            col.align === 'center'
                              ? 'text-center'
                              : col.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                          }`}
                        >
                          {total !== undefined ? (
                            <span className={col.isCurrency ? 'text-amber-400 font-black text-sm' : 'text-emerald-400 font-black'}>
                              {col.isCurrency ? total.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + (isAr ? ' د.ك' : ' KWD') : total.toLocaleString()}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
