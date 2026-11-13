'use client'

import React, { useCallback, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { tierBadgeCls } from '@/components/erp/ops-expansion/DeliverySlaStudio'
import {
  computeWeekdayComparisonData,
  WEEKDAY_SELECTOR_OPTIONS,
  type LikeForLikeWeekdayRow,
  type TrafficLightTier,
  type WeekdayDow,
} from '@/lib/ops-expansion-part2'

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SUBCARD_CLS =
  'rounded-2xl bg-[#F6F7F8] ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
const TABLE_SCROLL_CLS = 'overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0'

const fmt0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const fmtSigned0 = (n: number) => {
  const v = Math.round(Number.isFinite(n) ? n : 0)
  return `${v > 0 ? '+' : ''}${v.toLocaleString('en-US')}`
}
const fmtSignedPct = (n: number) => {
  const v = Number.isFinite(n) ? n : 0
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

function tierDot(tier: TrafficLightTier): string {
  if (tier === 'green') return '🟢'
  if (tier === 'yellow') return '🟡'
  return '🔴'
}

export function WeekdayComparisonStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { filters, workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  // Default to Wednesday (dow = 3) matching same-weekday benchmark, or 'all' side-by-side
  const [selectedMode, setSelectedMode] = useState<WeekdayDow | 'all'>(3)
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)
  const [copiedReport, setCopiedReport] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)

  const data = useMemo(
    () => computeWeekdayComparisonData(workspace),
    [workspace, filters.brand, filters.branch, filters.channel, filters.period, filters.kuwaitSlice],
  )

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
        summaryAr: `مبيعات ${row.weekdayAr} هذا الأسبوع (${row.thisDate}: ${fmt0(row.thisDisplayKwd)} د.ك) مقابل ${row.weekdayAr} الأسبوع الماضي (${row.lastDate}: ${fmt0(row.lastDisplayKwd)} د.ك) بفارق ${fmtSignedPct(row.variancePct)} وأقل من متوسط ٤ أسابيع (${fmtSignedPct(row.vsFourWeekPct)}). تفعيل عرض كومبو الساعات الهادئة (3–6 م) وحملة طلب مباشر بدون عمولة.`,
        summaryEn: `${row.weekdayEn} (${row.thisDate}: ${fmt0(row.thisDisplayKwd)} KWD) vs last ${row.weekdayEn} (${row.lastDate}: ${fmt0(row.lastDisplayKwd)} KWD, ${fmtSignedPct(row.variancePct)}, 4W ${fmtSignedPct(row.vsFourWeekPct)}). Launch 3–6 PM value combo & 0%-fee direct push.`,
        departmentAr: 'إدارة نمو المبيعات والتشغيل',
        departmentEn: 'Revenue Growth & Operations',
        budgetOrCostKwd: 95,
        expectedMonthlyReturnKwd: targetRecovery * 3,
        href: '/erp/weekday-comparison',
      })
      setToastMsg({
        ar: `تم تصعيد خطة تعويض يوم ${row.weekdayAr} إلى جرس المدير 🔔`,
        en: `Escalated ${row.weekdayEn} recovery plan to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [requestApproval],
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
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-6 pb-12 font-sans text-[14px] sm:text-[15px] text-neutral-900 antialiased dark:text-slate-100"
    >
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-[14px] font-medium text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
          </div>
          <button
            type="button"
            onClick={() => openDrawer('approvals')}
            className="cursor-pointer rounded-xl border border-emerald-300/70 bg-white px-3 py-1 text-[12.5px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-[#101C17] dark:text-emerald-200"
          >
            {isAr ? 'فتح جرس المدير' : 'Open Bell'}
          </button>
        </div>
      )}

      {/* ───────────── 1. Slim Contextual Bar ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CalendarDays className="h-4 w-4" />
          </span>
          <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
            {isAr
              ? `مقارنة اليوم بنظيره الأسبوعي + متوسط ٤ أسابيع (أودو ١٧) • ${workspace.subtitleAr}`
              : `Like-for-Like Same-Weekday + 4W Rolling Benchmark (Odoo 17) • ${workspace.subtitleEn}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyReport}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3.5 text-[13px] font-semibold text-neutral-800 ring-1 ring-slate-900/[0.05] transition hover:bg-neutral-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
        >
          {copiedReport ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4 shrink-0" />
          )}
          <span>
            {copiedReport
              ? isAr
                ? 'تم النسخ ✓'
                : 'Copied ✓'
              : isAr
                ? 'نسخ المقارنة'
                : 'Copy Report'}
          </span>
        </button>
      </div>

      {/* ───────────── 2. Selected Day 4-Card Executive KPI Strip (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-emerald-800 dark:text-emerald-300">
              {isAr
                ? `${activeRow.weekdayAr} هذا الأسبوع`
                : `This ${activeRow.weekdayEn}`}
            </span>
            {activeRow.varianceDisplayKwd >= 0 ? (
              <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 shrink-0 text-rose-600" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {fmt0(activeRow.thisDisplayKwd)}
            </span>
            <span className="text-[12px] sm:text-[13.5px] font-semibold text-neutral-500">{kwd}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `الماضي (${activeRow.lastDate}): ${fmt0(activeRow.lastDisplayKwd)} ${kwd}`
              : `Last (${activeRow.lastDate}): ${fmt0(activeRow.lastDisplayKwd)} ${kwd}`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
              {isAr ? 'الفرق ومقارنة ٤ أسابيع' : 'Variance & 4W Avg'}
            </span>
            {activeRow.variancePct >= 0 ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <TrendingDown className="h-4 w-4 shrink-0 text-rose-600" />
            )}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span
              className={`text-xl sm:text-3xl font-semibold tracking-tight ${
                activeRow.varianceDisplayKwd >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {fmtSigned0(activeRow.varianceDisplayKwd)}
            </span>
            <span
              className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${tierBadgeCls(activeRow.tier)}`}
            >
              {fmtSignedPct(activeRow.variancePct)}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `٤ أسابيع: ${fmt0(activeRow.fourWeekAvgDisplayKwd)} ${kwd} (${fmtSignedPct(activeRow.vsFourWeekPct)})`
              : `4W: ${fmt0(activeRow.fourWeekAvgDisplayKwd)} ${kwd} (${fmtSignedPct(activeRow.vsFourWeekPct)})`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
              {isAr ? 'الطلبات ومتوسط السلة' : 'Orders & Basket'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {fmt0(activeRow.thisOrders)}
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              {isAr ? `/ ${fmt0(activeRow.lastOrders)}` : `/ ${fmt0(activeRow.lastOrders)}`}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `السلة: ${activeRow.thisAvgBasketKwd.toFixed(2)} ${kwd} (الماضي ${activeRow.lastAvgBasketKwd.toFixed(2)})`
              : `AOV: ${activeRow.thisAvgBasketKwd.toFixed(2)} ${kwd} (Last ${activeRow.lastAvgBasketKwd.toFixed(2)})`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-emerald-800 dark:text-emerald-300">
              {isAr ? 'صافي الجيب (Pocket)' : 'Net Pocket Profit'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
              {fmt0(activeRow.thisPocketProfitKwd)}
            </span>
            <span className="text-[12px] sm:text-[13.5px] font-semibold text-neutral-500">{kwd}</span>
            <span className="ms-auto text-[11.5px] font-bold text-neutral-600 dark:text-slate-300">
              {fmtSigned0(activeRow.pocketVarianceKwd)}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `الماضي بالجيب: ${fmt0(activeRow.lastPocketProfitKwd)} ${kwd}`
              : `Prior pocket: ${fmt0(activeRow.lastPocketProfitKwd)} ${kwd}`}
          </p>
        </div>
      </section>

      {/* ───────────── 3. Hourly Intraday Capsule Curve + Touch-Scrollable Weekday Segmented Control ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[16px] sm:text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? `منحنى المبيعات بالساعة ليوم ${activeRow.weekdayAr}: هذا الأسبوع (${activeRow.thisDate}) مقابل الأسبوع الماضي (${activeRow.lastDate})`
                : `Hourly Intraday Sales Curve: This ${activeRow.weekdayEn} (${activeRow.thisDate}) vs Last ${activeRow.weekdayEn} (${activeRow.lastDate})`}
            </h2>
            <p className="text-[13px] sm:text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? `(${data.thisWeekLabelAr}) مقابل (${data.lastWeekLabelAr}) — اختر أي يوم لعرض منحنى الساعات`
                : `(${data.thisWeekLabelEn}) vs (${data.lastWeekLabelEn}) — select any weekday curve`}
            </p>
          </div>

          <div role="tablist" className={SEGMENT_TRACK_CLS}>
            {WEEKDAY_SELECTOR_OPTIONS.map((opt) => {
              const active = selectedMode === opt.dow
              return (
                <button
                  key={opt.dow}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedMode(opt.dow)}
                  className={`${SEGMENT_BTN_CLS} ${
                    active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                  }`}
                >
                  {isAr ? opt.ar : opt.en}
                </button>
              )
            })}

            <button
              type="button"
              role="tab"
              aria-selected={selectedMode === 'all'}
              onClick={() => setSelectedMode('all')}
              className={`${SEGMENT_BTN_CLS} ${
                selectedMode === 'all' ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
              }`}
            >
              {isAr ? '٧ أيام جنباً إلى جنب' : '7-Day Side-by-Side'}
            </button>
          </div>
        </div>

        {/* Optional 7-Day Side-by-Side Visual Bars when 'all' mode is toggled */}
        {selectedMode === 'all' && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {data.rows.map((r) => {
              const hThis = Math.max(12, Math.round((r.thisDisplayKwd / maxDayKwd) * 116))
              const hLast = Math.max(12, Math.round((r.lastDisplayKwd / maxDayKwd) * 116))
              const hAvg = Math.max(12, Math.round((r.fourWeekAvgDisplayKwd / maxDayKwd) * 116))
              return (
                <button
                  key={r.dow}
                  type="button"
                  onClick={() => setSelectedMode(r.dow)}
                  className={`flex cursor-pointer flex-col justify-between border border-neutral-200/60 p-3.5 text-start transition hover:border-emerald-400/60 dark:border-white/[0.06] ${SUBCARD_CLS}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-extrabold text-neutral-950 dark:text-white">
                      {isAr ? r.weekdayAr : r.weekdayEn}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${tierBadgeCls(r.tier)}`}
                    >
                      {fmtSignedPct(r.variancePct)}
                    </span>
                  </div>

                  <div className="my-4 flex h-[122px] items-end justify-center gap-2.5">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${hThis}px` }}
                        className="w-4 rounded-full bg-emerald-500"
                        title={`${isAr ? 'هذا الأسبوع' : 'This Week'}: ${fmt0(r.thisDisplayKwd)}`}
                      />
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        {isAr ? 'الحالي' : 'This'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${hLast}px` }}
                        className="w-4 rounded-full bg-neutral-300 dark:bg-slate-600"
                        title={`${isAr ? 'الأسبوع الماضي' : 'Last Week'}: ${fmt0(r.lastDisplayKwd)}`}
                      />
                      <span className="text-[10px] font-semibold text-neutral-500">
                        {isAr ? 'الماضي' : 'Last'}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div
                        style={{ height: `${hAvg}px` }}
                        className="w-4 rounded-full bg-sky-400/75"
                        title={`${isAr ? 'متوسط ٤ أسابيع' : '4W Avg'}: ${fmt0(r.fourWeekAvgDisplayKwd)}`}
                      />
                      <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                        4W
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5 border-t border-neutral-200/60 pt-2 text-[12px] tabular-nums dark:border-white/[0.06]">
                    <div className="font-extrabold text-neutral-950 dark:text-white">
                      {fmt0(r.thisDisplayKwd)} {kwd}
                    </div>
                    <div className="text-neutral-500 dark:text-slate-400">
                      {isAr ? 'الماضي:' : 'Last:'} {fmt0(r.lastDisplayKwd)} {kwd}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Capsule Bar Chart */}
        <div className={`p-4 ${SUBCARD_CLS}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] font-bold">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {isAr ? `${activeRow.weekdayAr} هذا الأسبوع` : `This ${activeRow.weekdayEn}`}
              </span>
              <span className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-slate-600" />
                {isAr ? `${activeRow.weekdayAr} الأسبوع الماضي` : `Last ${activeRow.weekdayEn}`}
              </span>
            </div>

            {hoveredHour !== null && (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200/70 bg-white px-3.5 py-1.5 text-[12.5px] font-bold tabular-nums dark:border-white/[0.08] dark:bg-[#101C17]">
                {(() => {
                  const pt =
                    activeRow.hourlyCurve.find((x) => x.hour === hoveredHour) ??
                    activeRow.hourlyCurve[0]
                  return (
                    <>
                      <span className="text-neutral-900 dark:text-white">⏰ {pt.label}</span>
                      <span className="text-emerald-700 dark:text-emerald-300">
                        {isAr ? 'الحالي:' : 'This:'} {pt.thisWeekKwd.toFixed(1)} {kwd} (
                        {pt.thisWeekOrders})
                      </span>
                      <span className="text-neutral-600 dark:text-slate-300">
                        {isAr ? 'الماضي:' : 'Last:'} {pt.lastWeekKwd.toFixed(1)} {kwd} (
                        {pt.lastWeekOrders})
                      </span>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          <div dir="ltr" className="grid grid-cols-7 lg:grid-cols-14 gap-2 items-end">
            {activeRow.hourlyCurve.map((pt) => {
              const hThis = Math.max(10, Math.round((pt.thisWeekKwd / maxHourKwd) * 108))
              const hLast = Math.max(10, Math.round((pt.lastWeekKwd / maxHourKwd) * 108))
              const isHover = hoveredHour === pt.hour
              return (
                <button
                  key={pt.hour}
                  type="button"
                  onMouseEnter={() => setHoveredHour(pt.hour)}
                  onMouseLeave={() => setHoveredHour(null)}
                  onClick={() => setHoveredHour(isHover ? null : pt.hour)}
                  className={`flex min-w-0 cursor-pointer flex-col items-center justify-end rounded-xl px-1 py-2 transition ${
                    isHover
                      ? 'bg-white ring-2 ring-emerald-500/70 shadow-xs dark:bg-[#101C17]'
                      : 'hover:bg-white/70 dark:hover:bg-[#101C17]/60'
                  }`}
                >
                  <span className="mb-1 whitespace-nowrap text-[10.5px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {Math.round(pt.thisWeekKwd)}
                  </span>
                  <div className="flex h-28 w-full items-end justify-center gap-1">
                    <div
                      style={{ height: `${hThis}px` }}
                      className="w-2.5 rounded-t-md rounded-b-xs bg-emerald-500 transition-all duration-200 sm:w-3"
                    />
                    <div
                      style={{ height: `${hLast}px` }}
                      className="w-2.5 rounded-t-md rounded-b-xs bg-neutral-300 transition-all duration-200 dark:bg-slate-600 sm:w-3"
                    />
                  </div>
                  <span className="mt-1.5 whitespace-nowrap text-[10.5px] sm:text-[11px] font-bold text-neutral-600 tabular-nums dark:text-slate-400">
                    {pt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ───────────── 4. 7-Day Full Executive Matrix Table ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'جدول مصفوفة الأيام السبعة الكامل (هذا الأسبوع مقابل الأسبوع الماضي ومتوسط ٤ أسابيع)'
                : '7-Day Full Like-for-Like Matrix Table'}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? 'اضغط على أي يوم لتحديث المنحنى أعلاه — يظهر زر التصعيد فقط لليوم الحرج الفعلي دون ضوضاء'
                : 'Click any weekday row to inspect its hourly curve — Escalate ↗ shown strictly on Red critical outlier'}
            </p>
          </div>
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[1040px] border-collapse text-start text-[14px] sm:text-[14.5px] tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-[#F6F7F8] text-[12.5px] font-bold text-neutral-600 dark:border-white/[0.08] dark:bg-[#0B1410] dark:text-slate-300">
                <th className="sticky start-0 z-10 bg-[#F6F7F8] px-3.5 py-3 text-start whitespace-nowrap dark:bg-[#0B1410]">
                  {isAr ? 'اليوم والتواريخ' : 'Weekday & Dates'}
                </th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'هذا الأسبوع (د.ك)' : 'This Week (KWD)'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'الأسبوع الماضي (د.ك)' : 'Last Week (KWD)'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'الفرق والتقييم' : 'Variance & Tier'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'متوسط ٤ أسابيع' : '4-Week Avg'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'الطلبات' : 'Orders'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'صافي الجيب' : 'Net Pocket'}</th>
                <th className="px-3.5 py-3 text-start whitespace-nowrap">{isAr ? 'محرك الأداء' : 'Driver Tag'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
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
                        : 'hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="sticky start-0 z-10 bg-white px-3.5 py-3.5 whitespace-nowrap dark:bg-[#101C17]">
                      <div className="font-extrabold text-neutral-950 dark:text-white">
                        {isAr ? r.weekdayAr : r.weekdayEn}
                      </div>
                      <div className="text-[12px] text-neutral-500 dark:text-slate-400">
                        {r.thisDate} {isAr ? 'مقابل' : 'vs'} {r.lastDate}
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 text-end font-extrabold text-neutral-950 dark:text-white">
                      {fmt0(r.thisDisplayKwd)} {kwd}
                    </td>
                    <td className="px-3.5 py-3.5 text-end font-semibold text-neutral-600 dark:text-slate-300">
                      {fmt0(r.lastDisplayKwd)} {kwd}
                    </td>
                    <td className="px-3.5 py-3.5 text-end whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-extrabold ${tierBadgeCls(r.tier)}`}
                      >
                        {tierDot(r.tier)} {fmtSigned0(r.varianceDisplayKwd)} {kwd} ({fmtSignedPct(r.variancePct)})
                      </span>
                    </td>
                    <td className="px-3.5 py-3.5 text-end font-semibold text-neutral-700 dark:text-slate-300">
                      {fmt0(r.fourWeekAvgDisplayKwd)} {kwd}{' '}
                      <span className="text-[12px] text-neutral-400">({fmtSignedPct(r.vsFourWeekPct)})</span>
                    </td>
                    <td className="px-3.5 py-3.5 text-end text-neutral-700 dark:text-slate-300">
                      <span className="font-bold text-neutral-900 dark:text-white">{fmt0(r.thisOrders)}</span> /{' '}
                      {fmt0(r.lastOrders)}
                    </td>
                    <td className="px-3.5 py-3.5 text-end font-bold text-emerald-700 dark:text-emerald-300">
                      {fmt0(r.thisPocketProfitKwd)} {kwd}
                    </td>
                    <td className="px-3.5 py-3.5 text-[13px] font-medium text-neutral-700 dark:text-slate-300">
                      {isAr ? r.driverTagAr : r.driverTagEn}
                    </td>
                    <td
                      className="px-3.5 py-3.5 text-end whitespace-nowrap"
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                    >
                      {r.tier === 'red' ? (
                        existingPlan ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            {isAr ? 'تم التصعيد ✓' : 'Escalated ✓'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEscalateWeakDay(r)}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-rose-200/80 bg-rose-50/70 px-3 text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                          >
                            {isAr ? 'تصعيد ↗' : 'Escalate ↗'}
                          </button>
                        )
                      ) : (
                        <span className="select-none text-neutral-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200/80 bg-[#F6F7F8] font-extrabold text-neutral-950 dark:border-white/[0.08] dark:bg-[#0B1410] dark:text-white">
                <td className="sticky start-0 z-10 bg-[#F6F7F8] px-3.5 py-3.5 whitespace-nowrap dark:bg-[#0B1410]">
                  {isAr ? 'الإجمالي الأسبوعي (٧ أيام)' : '7-Day Weekly Total'}
                </td>
                <td className="px-3.5 py-3.5 text-end">
                  {fmt0(data.totalThisDisplayKwd)} {kwd}
                </td>
                <td className="px-3.5 py-3.5 text-end">
                  {fmt0(data.totalLastDisplayKwd)} {kwd}
                </td>
                <td className="px-3.5 py-3.5 text-end">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[12.5px] font-extrabold ${
                      data.totalVarianceDisplayKwd >= 0
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {fmtSigned0(data.totalVarianceDisplayKwd)} {kwd} ({fmtSignedPct(data.totalVariancePct)})
                  </span>
                </td>
                <td className="px-3.5 py-3.5 text-end">
                  {fmt0(data.totalFourWeekAvgDisplayKwd)} {kwd}
                </td>
                <td className="px-3.5 py-3.5 text-end">
                  {fmt0(data.totalThisOrders)} / {fmt0(data.totalLastOrders)}
                </td>
                <td className="px-3.5 py-3.5 text-end text-emerald-700 dark:text-emerald-300">
                  {fmt0(data.totalThisPocketKwd)} {kwd}
                </td>
                <td className="px-3.5 py-3.5 text-[12.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'مطابق ١٠٠٪ مع أودو (0 د.ك فرق)' : '0 KWD Variance Verified'}
                </td>
                <td className="px-3.5 py-3.5 text-end text-neutral-300 dark:text-slate-600">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
