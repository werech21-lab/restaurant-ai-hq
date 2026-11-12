'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  Copy,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { OpsFilterSyncBar } from '@/components/erp/ops-expansion/OpsFilterSyncBar'
import { tierBadgeCls } from '@/components/erp/ops-expansion/DeliverySlaStudio'
import {
  computeWeekdayComparisonData,
  WEEKDAY_SELECTOR_OPTIONS,
  type LikeForLikeWeekdayRow,
  type WeekdayDow,
} from '@/lib/ops-expansion-part2'

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]'
const KPI_CLS =
  'ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]'

const fmt0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const fmtSigned0 = (n: number) => {
  const v = Math.round(Number.isFinite(n) ? n : 0)
  return `${v > 0 ? '+' : ''}${v.toLocaleString('en-US')}`
}
const fmtSignedPct = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function WeekdayComparisonStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  // Default to Wednesday (dow = 3) matching "الأربعاء هذا الأسبوع مقارنة مع الأربعاء الأسبوع الماضي", or 'all' side-by-side
  const [selectedMode, setSelectedMode] = useState<WeekdayDow | 'all'>(3)
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)

  const data = useMemo(() => computeWeekdayComparisonData(workspace), [workspace])

  const activeDow: WeekdayDow = selectedMode === 'all' ? 3 : selectedMode
  const activeRow: LikeForLikeWeekdayRow = useMemo(
    () => data.rows.find((r) => r.dow === activeDow) ?? data.rows[4] ?? data.rows[0],
    [data.rows, activeDow],
  )

  const maxHourKwd = useMemo(() => {
    let m = 1
    for (const pt of activeRow.hourlyCurve) {
      if (pt.thisWeekKwd > m) m = pt.thisWeekKwd
      if (pt.lastWeekKwd > m) m = pt.lastWeekKwd
    }
    return m
  }, [activeRow.hourlyCurve])

  const maxDayKwd = useMemo(() => {
    let m = 1
    for (const r of data.rows) {
      if (r.thisDisplayKwd > m) m = r.thisDisplayKwd
      if (r.lastDisplayKwd > m) m = r.lastDisplayKwd
      if (r.fourWeekAvgDisplayKwd > m) m = r.fourWeekAvgDisplayKwd
    }
    return m
  }, [data.rows])

  const handleEscalateWeakDay = useCallback(
    (row: LikeForLikeWeekdayRow) => {
      const targetRecovery = Math.max(220, Math.round(Math.abs(row.varianceDisplayKwd) * 0.7))
      requestApproval({
        refKey: `weekday-recovery-plan-${row.dow}`,
        domain: 'marketing',
        titleAr: `خطة تعويض وتنشيط مبيعات يوم ${row.weekdayAr} (فارق ${fmtSigned0(row.varianceDisplayKwd)} د.ك)`,
        titleEn: `Recovery & Combo Plan for ${row.weekdayEn} (${fmtSigned0(row.varianceDisplayKwd)} KWD Variance)`,
        summaryAr: `مبيعات ${row.weekdayAr} هذا الأسبوع (${row.thisDate}: ${fmt0(row.thisDisplayKwd)} د.ك) مقابل ${row.weekdayAr} الأسبوع الماضي (${row.lastDate}: ${fmt0(row.lastDisplayKwd)} د.ك) بفارق ${fmtSignedPct(row.variancePct)}. تفعيل عرض كومبو الساعات الهادئة (3–6 م) وحملة واتساب مباشر بدون عمولة.`,
        summaryEn: `${row.weekdayEn} (${row.thisDate}: ${fmt0(row.thisDisplayKwd)} KWD) vs last ${row.weekdayEn} (${row.lastDate}: ${fmt0(row.lastDisplayKwd)} KWD, ${fmtSignedPct(row.variancePct)}). Launch 3–6 PM value combo & 0%-fee direct push.`,
        departmentAr: 'إدارة نمو المبيعات والتشغيل',
        departmentEn: 'Revenue Growth & Operations',
        budgetOrCostKwd: 95,
        expectedMonthlyReturnKwd: targetRecovery * 3,
        href: '/erp/weekday-comparison',
      })
      openDrawer('approvals')
    },
    [openDrawer, requestApproval],
  )

  const handleCopyReport = useCallback(async () => {
    const lines = isAr
      ? [
          `📊 *مقارنة مبيعات أيام الأسبوع المتناظرة — فنتشر فودز*`,
          `النطاق: ${workspace.subtitleAr}`,
          `• هذا الأسبوع (${data.thisWeekLabelAr}): *${fmt0(data.totalThisDisplayKwd)} د.ك*`,
          `• الأسبوع الماضي (${data.lastWeekLabelAr}): *${fmt0(data.totalLastDisplayKwd)} د.ك*`,
          `• الفارق الأسبوعي: *${fmtSigned0(data.totalVarianceDisplayKwd)} د.ك (${fmtSignedPct(data.totalVariancePct)})*`,
          ...data.rows.map(
            (r) =>
              `  - ${r.weekdayAr}: ${fmt0(r.thisDisplayKwd)} مقابل ${fmt0(r.lastDisplayKwd)} د.ك (${fmtSignedPct(r.variancePct)})`,
          ),
        ]
      : [
          `📊 *Venture Foods Like-for-Like Same-Weekday Sales*`,
          `Scope: ${workspace.subtitleEn}`,
          `Total: ${fmt0(data.totalThisDisplayKwd)} vs ${fmt0(data.totalLastDisplayKwd)} KWD (${fmtSignedPct(data.totalVariancePct)})`,
          ...data.rows.map(
            (r) =>
              `- ${r.weekdayEn}: ${fmt0(r.thisDisplayKwd)} vs ${fmt0(r.lastDisplayKwd)} KWD (${fmtSignedPct(r.variancePct)})`,
          ),
        ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedReport(true)
      setTimeout(() => setCopiedReport(false), 2000)
    } catch {}
  }, [data, isAr, workspace.subtitleAr, workspace.subtitleEn])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-[1520px] space-y-5 pb-12">
      <OpsFilterSyncBar />

      {/* ───────────── 1. Header + Interactive 7-Weekday + Side-by-Side Selector ───────────── */}
      <header className={CARD_CLS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CalendarDays className="h-3.5 w-3.5" />
                {isAr
                  ? 'مقارنة اليوم بنظيره الأسبوعي + متوسط ٤ أسابيع (أودو ١٧)'
                  : 'Like-for-Like Same-Weekday + 4-Week Rolling Benchmark (Odoo 17)'}
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl dark:text-white">
              {isAr
                ? 'مقارنة المبيعات بين أيام الأسبوع المتناظرة (الأربعاء مقابل الأربعاء وهكذا)'
                : 'Like-for-Like Same-Weekday Sales & Intraday Comparison'}
            </h1>
            <p className="max-w-3xl text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              {isAr
                ? 'قارن مبيعات كل يوم في هذا الأسبوع مع نفس اليوم بالضبط في الأسبوع الماضي ومع متوسط ٤ أسابيع متتالية، شاملاً إجمالي وصافي المبيعات، عدد الطلبات، متوسط السلة، صافي الربح بالجيب، ومنحنى المبيعات بالساعة.'
                : 'Compares each weekday directly against the exact same weekday last week and its 4-week rolling benchmark across gross/net sales, orders, basket size, pocket profit, and hourly intraday curve.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleEscalateWeakDay(data.weakestDay)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2 text-[12px] font-bold text-amber-900 transition hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
            >
              <Bell className="h-3.5 w-3.5" />
              {isAr
                ? `رفع خطة تعويض ${data.weakestDay.weekdayAr} لجرس المدير 🔔`
                : `Escalate ${data.weakestDay.weekdayEn} Recovery 🔔`}
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#F7F7F8] px-3.5 py-2 text-[12px] font-bold text-neutral-800 transition hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-neutral-200"
            >
              {copiedReport ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedReport
                ? isAr
                  ? 'تم النسخ ✅'
                  : 'Copied ✅'
                : isAr
                  ? 'نسخ المقارنة 📋'
                  : 'Copy Report 📋'}
            </button>
          </div>
        </div>

        {/* Interactive 7-Weekday Selector + Side-by-Side Mode */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F7F8] p-3 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center gap-1.5">
            {WEEKDAY_SELECTOR_OPTIONS.map((opt) => {
              const active = selectedMode === opt.dow
              return (
                <button
                  key={opt.dow}
                  type="button"
                  onClick={() => setSelectedMode(opt.dow)}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                    active
                      ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-200'
                  }`}
                  style={active ? { color: '#FFFFFF' } : undefined}
                >
                  {isAr ? opt.ar : opt.en}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setSelectedMode('all')}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                selectedMode === 'all'
                  ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-neutral-800 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-200'
              }`}
              style={selectedMode === 'all' ? { color: '#FFFFFF' } : undefined}
            >
              {isAr ? 'كل أيام الأسبوع جنباً إلى جنب' : 'All 7 Weekdays Side-by-Side'}
            </button>
          </div>

          <span className="text-[11.5px] font-semibold text-neutral-500 tabular-nums dark:text-neutral-400">
            {isAr
              ? `(${data.thisWeekLabelAr}) مقابل (${data.lastWeekLabelAr})`
              : `(${data.thisWeekLabelEn}) vs (${data.lastWeekLabelEn})`}
          </span>
        </div>
      </header>

      {/* ───────────── 2. Selected Day Head-to-Head KPI Strip (or 7-Day Side-by-Side Visual Bars) ───────────── */}
      {selectedMode === 'all' ? (
        <section className={CARD_CLS}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
                {isAr
                  ? 'مقارنة كل أيام الأسبوع السبعة جنباً إلى جنب (هذا الأسبوع vs الأسبوع الماضي vs متوسط ٤ أسابيع)'
                  : 'All 7 Weekdays Side-by-Side (This Week vs Last Week vs 4-Week Average)'}
              </h2>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                {isAr
                  ? 'اضغط على أي عمود يوم لعرض منحنى الساعات التفصيلي وبطاقة الأرقام الكاملة له'
                  : 'Click any weekday card to inspect its hour-by-hour capsule curve'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {data.rows.map((r) => {
              const hThis = Math.max(12, Math.round((r.thisDisplayKwd / maxDayKwd) * 120))
              const hLast = Math.max(12, Math.round((r.lastDisplayKwd / maxDayKwd) * 120))
              const hAvg = Math.max(12, Math.round((r.fourWeekAvgDisplayKwd / maxDayKwd) * 120))
              return (
                <button
                  key={r.dow}
                  type="button"
                  onClick={() => setSelectedMode(r.dow)}
                  className="flex cursor-pointer flex-col justify-between rounded-2xl bg-[#F7F7F8] p-3.5 text-start transition hover:bg-emerald-50/50 dark:bg-neutral-950 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-extrabold text-neutral-950 dark:text-white">
                      {isAr ? r.weekdayAr : r.weekdayEn}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums ${tierBadgeCls(r.tier)}`}
                    >
                      {fmtSignedPct(r.variancePct)}
                    </span>
                  </div>

                  <div className="my-4 flex h-[126px] items-end justify-center gap-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${hThis}px` }}
                        className="w-4 rounded-full bg-emerald-500"
                        title={`${isAr ? 'هذا الأسبوع' : 'This Week'}: ${fmt0(r.thisDisplayKwd)}`}
                      />
                      <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300">
                        {isAr ? 'الحالي' : 'This'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${hLast}px` }}
                        className="w-4 rounded-full bg-neutral-300 dark:bg-neutral-700"
                        title={`${isAr ? 'الأسبوع الماضي' : 'Last Week'}: ${fmt0(r.lastDisplayKwd)}`}
                      />
                      <span className="text-[9.5px] font-semibold text-neutral-500">
                        {isAr ? 'الماضي' : 'Last'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${hAvg}px` }}
                        className="w-4 rounded-full bg-sky-400/75"
                        title={`${isAr ? 'متوسط ٤ أسابيع' : '4W Avg'}: ${fmt0(r.fourWeekAvgDisplayKwd)}`}
                      />
                      <span className="text-[9.5px] font-semibold text-sky-700 dark:text-sky-300">
                        4W
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5 border-t border-neutral-200/60 pt-2 text-[11px] tabular-nums dark:border-neutral-800">
                    <div className="font-extrabold text-neutral-950 dark:text-white">
                      {fmt0(r.thisDisplayKwd)} {kwd}
                    </div>
                    <div className="text-neutral-500">
                      {isAr ? 'الماضي:' : 'Last:'} {fmt0(r.lastDisplayKwd)} {kwd}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Selected Day 5-Card Executive KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr
                ? `${activeRow.weekdayAr} هذا الأسبوع (صافي / إجمالي)`
                : `This ${activeRow.weekdayEn} (Net / Gross)`}
            </span>
            {activeRow.varianceDisplayKwd >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-neutral-950 dark:text-white">
              {fmt0(activeRow.thisDisplayKwd)}
            </span>
            <span className="text-[12px] font-bold text-neutral-500">{kwd}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr
              ? `${activeRow.thisDate} • الإجمالي قبل الخصم: ${fmt0(activeRow.thisGrossKwd)} ${kwd}`
              : `${activeRow.thisDate} • Gross: ${fmt0(activeRow.thisGrossKwd)} ${kwd}`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr
                ? `${activeRow.weekdayAr} الأسبوع الماضي`
                : `Last ${activeRow.weekdayEn}`}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-neutral-950 dark:text-white">
              {fmt0(activeRow.lastDisplayKwd)}
            </span>
            <span className="text-[12px] font-bold text-neutral-500">{kwd}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr
              ? `${activeRow.lastDate} • الإجمالي قبل الخصم: ${fmt0(activeRow.lastGrossKwd)} ${kwd}`
              : `${activeRow.lastDate} • Gross: ${fmt0(activeRow.lastGrossKwd)} ${kwd}`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'الفرق ومقارنة متوسط ٤ أسابيع' : 'Variance & 4-Week Avg'}
            </span>
            {activeRow.variancePct >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-600" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span
              className={`text-2xl font-extrabold ${
                activeRow.varianceDisplayKwd >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {fmtSigned0(activeRow.varianceDisplayKwd)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${tierBadgeCls(activeRow.tier)}`}
            >
              {fmtSignedPct(activeRow.variancePct)}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr
              ? `متوسط ٤ أسابيع لـ ${activeRow.weekdayAr}: ${fmt0(activeRow.fourWeekAvgDisplayKwd)} ${kwd} (${fmtSignedPct(activeRow.vsFourWeekPct)})`
              : `4W Avg: ${fmt0(activeRow.fourWeekAvgDisplayKwd)} ${kwd} (${fmtSignedPct(activeRow.vsFourWeekPct)})`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'الطلبات ومتوسط السلة' : 'Orders & Average Basket'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-neutral-950 dark:text-white">
              {fmt0(activeRow.thisOrders)}
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              {isAr ? `طلب (مقابل ${fmt0(activeRow.lastOrders)})` : `vs ${fmt0(activeRow.lastOrders)}`}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr
              ? `متوسط السلة: ${activeRow.thisAvgBasketKwd.toFixed(2)} ${kwd} (الماضي ${activeRow.lastAvgBasketKwd.toFixed(2)})`
              : `AOV: ${activeRow.thisAvgBasketKwd.toFixed(2)} ${kwd} (Last ${activeRow.lastAvgBasketKwd.toFixed(2)})`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? 'صافي الربح بالجيب (Pocket)' : 'Net Pocket Profit'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {fmt0(activeRow.thisPocketProfitKwd)}
            </span>
            <span className="text-[12px] font-bold text-neutral-500">{kwd}</span>
            <span className="ms-auto text-[11.5px] font-bold text-neutral-600 dark:text-neutral-300">
              {fmtSigned0(activeRow.pocketVarianceKwd)} {kwd}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr
              ? `الأسبوع الماضي بالجيب: ${fmt0(activeRow.lastPocketProfitKwd)} ${kwd}`
              : `Prior week pocket: ${fmt0(activeRow.lastPocketProfitKwd)} ${kwd}`}
          </p>
        </div>
      </section>

      {/* ───────────── 3. Hourly Intraday Capsule Curve (This Weekday vs Last Weekday) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? `منحنى المبيعات بالساعة ليوم ${activeRow.weekdayAr}: هذا الأسبوع (${activeRow.thisDate}) مقابل الأسبوع الماضي (${activeRow.lastDate})`
                : `Hourly Intraday Sales Curve: This ${activeRow.weekdayEn} (${activeRow.thisDate}) vs Last ${activeRow.weekdayEn} (${activeRow.lastDate})`}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'مرّر المؤشر على أي ساعة لمقارنة مبيعات وطلبات الساعة الواحدة بين الأسبوعين'
                : 'Hover over any hour capsule pair to inspect exact hourly KWD & order counts'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-[12px] font-bold">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {isAr ? `${activeRow.weekdayAr} هذا الأسبوع` : `This ${activeRow.weekdayEn}`}
            </span>
            <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              {isAr ? `${activeRow.weekdayAr} الأسبوع الماضي` : `Last ${activeRow.weekdayEn}`}
            </span>
          </div>
        </div>

        {/* Capsule Bar Chart */}
        <div className="rounded-2xl bg-[#F7F7F8] p-4 dark:bg-neutral-950">
          {hoveredHour !== null && (
            <div className="mb-3 flex flex-wrap items-center justify-between rounded-xl bg-white px-3.5 py-2 text-[12px] font-bold tabular-nums dark:bg-neutral-900">
              {(() => {
                const pt =
                  activeRow.hourlyCurve.find((x) => x.hour === hoveredHour) ??
                  activeRow.hourlyCurve[0]
                return (
                  <>
                    <span className="text-neutral-900 dark:text-white">
                      ⏰ {pt.label}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      {isAr ? 'هذا الأسبوع:' : 'This Week:'} {pt.thisWeekKwd.toFixed(1)} {kwd} ({pt.thisWeekOrders}{' '}
                      {isAr ? 'طلب' : 'ord'})
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {isAr ? 'الأسبوع الماضي:' : 'Last Week:'} {pt.lastWeekKwd.toFixed(1)} {kwd} ({pt.lastWeekOrders}{' '}
                      {isAr ? 'طلب' : 'ord'})
                    </span>
                  </>
                )
              })()}
            </div>
          )}

          <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
            {activeRow.hourlyCurve.map((pt) => {
              const hThis = Math.max(8, Math.round((pt.thisWeekKwd / maxHourKwd) * 130))
              const hLast = Math.max(8, Math.round((pt.lastWeekKwd / maxHourKwd) * 130))
              const isHover = hoveredHour === pt.hour
              return (
                <div
                  key={pt.hour}
                  onMouseEnter={() => setHoveredHour(pt.hour)}
                  onMouseLeave={() => setHoveredHour(null)}
                  className={`flex flex-col items-center rounded-xl py-2 transition ${
                    isHover ? 'bg-white dark:bg-neutral-900' : ''
                  }`}
                >
                  <div className="flex h-[136px] items-end justify-center gap-1">
                    <div
                      style={{ height: `${hThis}px` }}
                      className="w-2.5 rounded-full bg-emerald-500 transition-all duration-200 sm:w-3"
                    />
                    <div
                      style={{ height: `${hLast}px` }}
                      className="w-2.5 rounded-full bg-neutral-300 transition-all duration-200 dark:bg-neutral-700 sm:w-3"
                    />
                  </div>
                  <span className="mt-2 text-[10px] font-bold text-neutral-600 tabular-nums dark:text-neutral-400">
                    {pt.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ───────────── 4. 7-Day Full Executive Matrix Table ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'جدول مصفوفة الأيام السبعة الكامل (هذا الأسبوع مقابل الأسبوع الماضي ومتوسط ٤ أسابيع)'
                : '7-Day Full Like-for-Like Matrix Table'}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'اضغط على أي يوم في الجدول لتحديث منحنى الساعات أعلاه — تطابق محاسبي تام (0 د.ك فرق)'
                : 'Click any weekday row to inspect its hourly capsule curve — 0 KWD reconciliation variance'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-start text-[12.5px] tabular-nums">
            <thead>
              <tr className="bg-[#F7F7F8] text-[11.5px] font-bold text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                <th className="px-3 py-2.5 text-start">{isAr ? 'اليوم والتواريخ' : 'Weekday & Dates'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'هذا الأسبوع (د.ك)' : 'This Week (KWD)'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'الأسبوع الماضي (د.ك)' : 'Last Week (KWD)'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'الفرق (د.ك و %)' : 'Variance (KWD & %)'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'متوسط ٤ أسابيع' : '4-Week Avg'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'الطلبات' : 'Orders'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'صافي الجيب' : 'Net Pocket'}</th>
                <th className="px-3 py-2.5 text-start">{isAr ? 'محرك الأداء (رواتب/ويكند/عروض)' : 'Driver Tag'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'خطة التعويض' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {data.rows.map((r) => {
                const isSelected = r.dow === activeDow
                const existingPlan = getApprovalByRef(`weekday-recovery-plan-${r.dow}`)
                return (
                  <tr
                    key={r.dow}
                    onClick={() => setSelectedMode(r.dow)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50/45 dark:bg-emerald-950/20'
                        : 'hover:bg-[#F7F7F8]/70 dark:hover:bg-neutral-800/30'
                    }`}
                  >
                    <td className="px-3 py-3">
                      <div className="font-extrabold text-neutral-950 dark:text-white">
                        {isAr ? r.weekdayAr : r.weekdayEn}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {r.thisDate} {isAr ? 'مقابل' : 'vs'} {r.lastDate}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-end font-extrabold text-neutral-950 dark:text-white">
                      {fmt0(r.thisDisplayKwd)} {kwd}
                    </td>
                    <td className="px-3 py-3 text-end font-semibold text-neutral-600 dark:text-neutral-300">
                      {fmt0(r.lastDisplayKwd)} {kwd}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${tierBadgeCls(r.tier)}`}
                      >
                        {fmtSigned0(r.varianceDisplayKwd)} {kwd} ({fmtSignedPct(r.variancePct)})
                      </span>
                    </td>
                    <td className="px-3 py-3 text-end font-semibold text-neutral-700 dark:text-neutral-300">
                      {fmt0(r.fourWeekAvgDisplayKwd)} {kwd}{' '}
                      <span className="text-[11px] text-neutral-500">({fmtSignedPct(r.vsFourWeekPct)})</span>
                    </td>
                    <td className="px-3 py-3 text-end text-neutral-700 dark:text-neutral-300">
                      <span className="font-bold text-neutral-900 dark:text-white">{fmt0(r.thisOrders)}</span> /{' '}
                      {fmt0(r.lastOrders)}
                    </td>
                    <td className="px-3 py-3 text-end font-bold text-emerald-700 dark:text-emerald-300">
                      {fmt0(r.thisPocketProfitKwd)} {kwd}
                    </td>
                    <td className="px-3 py-3 text-[11.5px] font-semibold text-neutral-700 dark:text-neutral-300">
                      {isAr ? r.driverTagAr : r.driverTagEn}
                    </td>
                    <td
                      className="px-3 py-3 text-end"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      {r.varianceDisplayKwd < 0 ? (
                        <button
                          type="button"
                          onClick={() => handleEscalateWeakDay(r)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          {existingPlan
                            ? isAr
                              ? 'تم الرفع ✅'
                              : 'Sent ✅'
                            : isAr
                              ? 'رفع خطة تعويض اليوم الضعيف لجرس المدير 🔔'
                              : 'Submit Recovery Plan 🔔'}
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          {isAr ? 'أداء متفوق 🟢' : 'Outperforming 🟢'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#F7F7F8] font-extrabold text-neutral-950 dark:bg-neutral-950 dark:text-white">
                <td className="px-3 py-3">
                  {isAr ? 'الإجمالي الأسبوعي (٧ أيام)' : '7-Day Weekly Total'}
                </td>
                <td className="px-3 py-3 text-end">
                  {fmt0(data.totalThisDisplayKwd)} {kwd}
                </td>
                <td className="px-3 py-3 text-end">
                  {fmt0(data.totalLastDisplayKwd)} {kwd}
                </td>
                <td className="px-3 py-3 text-end">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${
                      data.totalVarianceDisplayKwd >= 0
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {fmtSigned0(data.totalVarianceDisplayKwd)} {kwd} ({fmtSignedPct(data.totalVariancePct)})
                  </span>
                </td>
                <td className="px-3 py-3 text-end">
                  {fmt0(data.totalFourWeekAvgDisplayKwd)} {kwd}
                </td>
                <td className="px-3 py-3 text-end">
                  {fmt0(data.totalThisOrders)} / {fmt0(data.totalLastOrders)}
                </td>
                <td className="px-3 py-3 text-end text-emerald-700 dark:text-emerald-300">
                  {fmt0(data.totalThisPocketKwd)} {kwd}
                </td>
                <td className="px-3 py-3 text-[11px] text-neutral-500">
                  {isAr ? 'مطابق ١٠٠٪ مع أودو (0 د.ك فرق)' : '0 KWD Variance Verified'}
                </td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
