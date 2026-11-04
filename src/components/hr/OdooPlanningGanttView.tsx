'use client'

import React, { useState, useMemo } from 'react'
import {
  Calendar,
  Clock,
  Users,
  Building2,
  CheckCircle2,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Briefcase,
  Store,
} from 'lucide-react'
import {
  ODOO_WORKFORCE_UNITS_6,
  ODOO_LEADERSHIP_SALARY_BENCHMARKS,
  GANTT_DAYS_CONFIG,
  GANTT_SHIFT_LEGEND,
  ODOO_GANTT_SCHEDULE_ROWS,
  TOTAL_OFFICIAL_WORKFORCE,
  type ShiftType,
} from '@/lib/hr/odoo-hr-dashboard-data'

interface Props {
  locale: 'ar' | 'en'
}

export function OdooPlanningGanttView({ locale }: Props) {
  const isAr = locale === 'ar'

  const [activeBranchFilter, setActiveBranchFilter] = useState('ALL')
  const [activeShiftFilter, setActiveShiftFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeWeekOffset, setActiveWeekOffset] = useState(0)

  // Filtered employees for the Gantt
  const filteredSchedule = useMemo(() => {
    return ODOO_GANTT_SCHEDULE_ROWS.filter((row) => {
      if (activeBranchFilter !== 'ALL' && !row.branchAr.includes(activeBranchFilter) && !row.branchEn.includes(activeBranchFilter)) {
        return false
      }
      if (activeShiftFilter !== 'ALL') {
        const hasShift = row.days.some((d) => d.type === activeShiftFilter)
        if (!hasShift) return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        row.empNameAr.toLowerCase().includes(q) ||
        row.empNameEn.toLowerCase().includes(q) ||
        row.empCode.toLowerCase().includes(q) ||
        row.jobTitleAr.toLowerCase().includes(q) ||
        row.jobTitleEn.toLowerCase().includes(q) ||
        row.branchAr.toLowerCase().includes(q) ||
        row.brandAr.toLowerCase().includes(q)
      )
    })
  }, [activeBranchFilter, activeShiftFilter, searchQuery])

  return (
    <div className="space-y-8" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ----------------------------------------------------------------------- */}
      {/* 1. WORKFORCE DISTRIBUTION (166 EMPLOYEES ACROSS 6 OPERATIONAL UNITS)     */}
      {/* ----------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                <Users size={14} />
                {isAr ? 'لوحة تحكم القوة العاملة (أودو الرسمية)' : 'Official Odoo Workforce Dashboard'}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400 font-mono">
                {isAr ? `${TOTAL_OFFICIAL_WORKFORCE} موظفاً فعلياً` : `${TOTAL_OFFICIAL_WORKFORCE} Total Staff`}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {isAr ? 'توزيع القوة العاملة الفعلي حسب الوحدات التشغيلية' : 'Workforce Distribution by Operational Unit'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'إحصاء دقيق للقوة العاملة الموزعة على 6 قطاعات تشغيلية وإدارية رئيسية'
                : 'Audited headcount distributed across 6 major operational & administrative units'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {ODOO_WORKFORCE_UNITS_6.map((unit) => (
            <div
              key={unit.id}
              className="rounded-2xl border border-white/10 bg-[#121824] p-4 flex flex-col justify-between space-y-3 hover:border-white/20 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{unit.icon}</span>
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {unit.pct.toFixed(1)}%
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-black text-white leading-tight">
                  {isAr ? unit.nameAr : unit.nameEn}
                </h3>
                <p className="mt-1 text-[11px] text-slate-400 leading-normal">
                  {isAr ? unit.subtextAr : unit.subtextEn}
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black font-mono text-white">
                    {unit.count}
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {isAr ? 'موظفاً' : 'Staff'}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${unit.pct}%`,
                      backgroundColor: unit.color,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* 2. LEADERSHIP & KEY ROLES SALARY SCALE (ODOO APPROVED BENCHMARKS)         */}
      {/* ----------------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                <Briefcase size={14} />
                {isAr ? 'سلم الرواتب المعتمدة للوظائف والقيادات' : 'Approved Leadership Salary Benchmarks'}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                {isAr ? '10 وظائف رئيسية من لوحة أودو' : '10 Key Positions from Odoo'}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {isAr ? 'هيكل الرواتب المعتمدة للقيادات والوظائف التشغيلية' : 'Executive & Operational Leadership Compensation Benchmark'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'سلم الرواتب التعاقدية المعتمدة لنظام حماية الأجور (WPS) في بنك الكويت الوطني'
                : 'Audited contractual base salaries registered for NBK WPS Payroll protection'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121824] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-12">#</th>
                  <th className="px-4 py-3 text-right">{isAr ? 'المسمى الوظيفي والمسؤولية' : 'Position / Role'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'القطاع الإداري' : 'Department Unit'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'الدرجة التنظيمية' : 'Organizational Tier'}</th>
                  <th className="px-4 py-3 text-right">{isAr ? 'الراتب المعتمد (د.ك)' : 'Approved Salary (KWD)'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'حالة الاعتماد' : 'WPS Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {ODOO_LEADERSHIP_SALARY_BENCHMARKS.map((item) => (
                  <tr key={item.rank} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-center font-mono text-xs text-slate-500 font-bold">
                      {item.rank}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-black text-white block text-sm">
                        {isAr ? item.roleAr : item.roleEn}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {isAr ? item.roleEn : item.roleAr}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-0.5 text-slate-300 font-semibold border border-slate-700">
                        {isAr ? item.categoryAr : item.categoryEn}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-semibold text-amber-300">
                      {isAr ? item.levelAr : item.levelEn}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-base font-black text-emerald-400">
                        {item.salaryKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 size={12} />
                        {isAr ? item.statusAr : item.statusEn}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* 3. WEEKLY PLANNING GANTT (ODOO SHIFT ROSTER & SCHEDULE)                  */}
      {/* ----------------------------------------------------------------------- */}
      <div className="space-y-4">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-400">
                <Calendar size={14} />
                {isAr ? 'مخطط الشفتات الأسبوعي (أودو Gantt)' : 'Weekly Shift Planning (Odoo Gantt)'}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                {isAr ? 'نظام الـ 48 ساعة أسبوعياً' : '48 Hours/Week Standard'}
              </span>
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {isAr ? 'جدول تخطيط الشفتات الأسبوعي الملون لموظفي الفروع والمطابخ' : 'Color-Coded Weekly Shift Schedule for Store & Kitchen Crews'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'محاكاة كاملة لشاشة Planning Gantt في أودو: شفتات صباحية، مسائية ذروة، إسناد معارض، وإجازات'
                : 'Direct simulation of Odoo Planning Gantt: Morning, Evening Peak, Event Support & Days Off'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Week navigation */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#121824] px-2 py-1 text-xs">
              <button
                onClick={() => setActiveWeekOffset((w) => w - 1)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title={isAr ? 'الأسبوع السابق' : 'Previous Week'}
              >
                <ChevronRight size={14} />
              </button>
              <span className="font-bold text-white px-2">
                {activeWeekOffset === 0
                  ? isAr
                    ? 'الأسبوع الحالي (نوفمبر 2026)'
                    : 'Current Week (Nov 2026)'
                  : activeWeekOffset > 0
                  ? isAr
                    ? `الأسبوع القادم (+${activeWeekOffset})`
                    : `Next Week (+${activeWeekOffset})`
                  : isAr
                  ? `الأسبوع الماضي (${activeWeekOffset})`
                  : `Past Week (${activeWeekOffset})`}
              </span>
              <button
                onClick={() => setActiveWeekOffset((w) => w + 1)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title={isAr ? 'الأسبوع القادم' : 'Next Week'}
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Shift Legend & Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121824] p-3 rounded-2xl border border-white/10">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-400">{isAr ? 'دليل الألوان:' : 'Shift Legend:'}</span>
            {GANTT_SHIFT_LEGEND.map((leg) => (
              <button
                key={leg.type}
                onClick={() => setActiveShiftFilter(activeShiftFilter === leg.type ? 'ALL' : leg.type)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border transition-all ${
                  leg.colorBg
                } ${leg.colorBorder} ${leg.colorText} ${
                  activeShiftFilter === leg.type ? 'ring-2 ring-white' : 'opacity-90 hover:opacity-100'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${leg.badgeColor}`} />
                <span>{isAr ? leg.labelAr : leg.labelEn}</span>
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، الفرع، أو الكود...' : 'Search by name, branch or code...'}
              className="w-full rounded-xl border border-white/10 bg-[#0a0d12] py-1.5 pr-8 pl-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Gantt Table Container */}
        <div className="rounded-2xl border border-white/10 bg-[#121824] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-slate-300 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3 text-right w-64 min-w-[220px]">
                    {isAr ? 'الموظف والفرع والبراند' : 'Employee & Branch'}
                  </th>
                  {GANTT_DAYS_CONFIG.map((day) => (
                    <th key={day.key} className="px-2 py-3 text-center min-w-[130px]">
                      <span className="block text-white font-bold">{isAr ? day.nameAr : day.nameEn}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{isAr ? '8 ساعات' : '8h Planned'}</span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center w-24">
                    {isAr ? 'إجمالي الساعات' : 'Total Hours'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {filteredSchedule.map((row) => (
                  <tr key={row.empCode} className="hover:bg-white/[0.02] transition-colors">
                    {/* Employee Profile Header Column */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          #{row.empCode}
                        </span>
                        <div>
                          <p className="font-black text-white text-xs leading-tight">
                            {isAr ? row.empNameAr : row.empNameEn}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            {isAr ? row.jobTitleAr : row.jobTitleEn}
                          </p>
                          <p className="text-[9px] text-emerald-400 font-semibold mt-0.5">
                            {isAr ? row.branchAr : row.branchEn}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Gantt Day Columns with Colored Shift Pills */}
                    {row.days.map((day) => {
                      const isMorning = day.type === 'morning'
                      const isPeak = day.type === 'evening_peak'
                      const isEvent = day.type === 'event_support'
                      const isOff = day.type === 'day_off'

                      return (
                        <td key={day.dayKey} className="px-1.5 py-2 text-center align-middle">
                          <div
                            className={`rounded-xl border p-2 text-center transition-all ${
                              isMorning
                                ? 'border-sky-500/40 bg-sky-950/40 text-sky-200 hover:border-sky-400'
                                : isPeak
                                ? 'border-amber-500/40 bg-amber-950/40 text-amber-200 hover:border-amber-400'
                                : isEvent
                                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400'
                                : 'border-slate-800 bg-slate-900/40 text-slate-500'
                            }`}
                          >
                            <span className="block text-[11px] font-black leading-tight">
                              {isMorning
                                ? isAr
                                  ? 'صباحي'
                                  : 'Morning'
                                : isPeak
                                ? isAr
                                  ? 'ذروة مسائي'
                                  : 'Peak Eve'
                                : isEvent
                                ? isAr
                                  ? 'إسناد فعاليات'
                                  : 'Event Supp'
                                : isAr
                                ? 'إجازة'
                                : 'Day Off'}
                            </span>
                            <span className="block text-[10px] font-mono mt-0.5 opacity-80 leading-none">
                              {isAr ? day.timeRangeAr : day.timeRangeEn}
                            </span>
                          </div>
                        </td>
                      )
                    })}

                    {/* Total Weekly Hours */}
                    <td className="px-3 py-3 text-center font-mono font-bold text-white">
                      <span className="inline-flex rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-emerald-400">
                        {row.weeklyHours}{isAr ? ' س' : 'h'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-white/10 bg-white/5 font-bold text-white">
                <tr>
                  <td className="px-4 py-3 text-right uppercase tracking-wider text-slate-300">
                    {isAr ? 'إجمالي الساعات المخططة:' : 'Total Planned Shift Hours:'}
                  </td>
                  {GANTT_DAYS_CONFIG.map((day) => (
                    <td key={day.key} className="px-2 py-3 text-center font-mono text-emerald-400 text-xs">
                      {filteredSchedule.length * 8}{isAr ? ' س' : 'h'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-mono text-amber-400 text-sm">
                    {filteredSchedule.length * 48}{isAr ? ' س' : 'h'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Live Planning KPIs Bar */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#121824] p-3 text-center">
            <span className="text-[11px] text-slate-400">{isAr ? 'إجمالي الساعات المجدولة' : 'Weekly Scheduled Hours'}</span>
            <p className="mt-1 text-xl font-black text-white font-mono">7,968 {isAr ? 'ساعة' : 'Hrs'}</p>
            <span className="text-[10px] text-emerald-400 font-bold">{isAr ? '166 موظفاً × 48 ساعة' : '166 Staff × 48h'}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121824] p-3 text-center">
            <span className="text-[11px] text-slate-400">{isAr ? 'تغطية ساعات الذروة' : 'Peak Hours Coverage'}</span>
            <p className="mt-1 text-xl font-black text-amber-400 font-mono">100%</p>
            <span className="text-[10px] text-slate-400">{isAr ? 'الخميس والجمعة والسبت' : 'Thu, Fri & Sat Fully Covered'}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121824] p-3 text-center">
            <span className="text-[11px] text-slate-400">{isAr ? 'ساعات إسناد كشتة المارينا' : 'Kashta Marina Event Support'}</span>
            <p className="mt-1 text-xl font-black text-emerald-400 font-mono">240 {isAr ? 'ساعة' : 'Hrs'}</p>
            <span className="text-[10px] text-emerald-300">{isAr ? 'شفتات إسناد إضافية' : 'Event Shifts Active'}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#121824] p-3 text-center">
            <span className="text-[11px] text-slate-400">{isAr ? 'مطابقة قانون العمل الكويتي' : 'Kuwait Labor Law Compliance'}</span>
            <p className="mt-1 text-xl font-black text-blue-400 font-mono">مادة 64</p>
            <span className="text-[10px] text-slate-400">{isAr ? 'يوم راحة أسبوعي إلزامي' : 'Mandatory 24h Day Off'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
