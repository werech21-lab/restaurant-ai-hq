'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import {
  computeOrderPrepSlaSnapshot,
  type PrepSlaOrderTicket,
  type PrepSlaTier,
} from '@/lib/warehouse-prep-engine'

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
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
const TICKETS_PER_PAGE = 12

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

export function PrepTrafficBadge({
  tier,
  isAr,
  compact = false,
}: {
  tier: PrepSlaTier
  isAr: boolean
  compact?: boolean
}) {
  if (tier === 'green') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
        <span>🟢</span>
        <span>{compact ? (isAr ? 'جيد' : 'Good') : isAr ? 'أخضر — جيد' : 'Good (<=12.0m)'}</span>
      </span>
    )
  }
  if (tier === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <span>🟡</span>
        <span>
          {compact ? (isAr ? 'وسط' : 'Medium') : isAr ? 'أصفر — وسط' : 'Medium (12.1–18.0m)'}
        </span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[12px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
      <span>🔴</span>
      <span>
        {compact ? (isAr ? 'حرج' : 'Critical') : isAr ? 'أحمر — حرج' : 'Critical (>18.0m)'}
      </span>
    </span>
  )
}

export function OrderPrepSlaStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const snap = useMemo(() => computeOrderPrepSlaSnapshot(filters, workspace), [filters, workspace])

  const [tierFilter, setTierFilter] = useState<'all' | PrepSlaTier>('all')
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)

  useEffect(() => {
    setPage(1)
  }, [
    filters.period,
    filters.brand,
    filters.branch,
    filters.channel,
    filters.kuwaitSlice,
    tierFilter,
    selectedHour,
    searchQuery,
  ])

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return snap.tickets.filter((t) => {
      if (tierFilter !== 'all' && t.tier !== tierFilter) return false
      if (selectedHour !== null && t.hourIndex !== selectedHour) return false
      if (q) {
        const hay = `${t.orderId} ${t.brandNameAr} ${t.brandNameEn} ${t.branchNameAr} ${t.branchNameEn} ${t.channelNameAr} ${t.channelNameEn} ${t.delayRootCauseAr} ${t.delayRootCauseEn}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [searchQuery, selectedHour, snap.tickets, tierFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / TICKETS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const visibleTickets = useMemo(
    () => filteredTickets.slice((safePage - 1) * TICKETS_PER_PAGE, safePage * TICKETS_PER_PAGE),
    [filteredTickets, safePage],
  )

  const cellLookup = useMemo(() => {
    const map = new Map<string, { avgPrepMinutes: number; tier: PrepSlaTier; redPct: number }>()
    for (const c of snap.brandBranchCells) {
      map.set(`${c.brandId}::${c.branchId}`, {
        avgPrepMinutes: c.avgPrepMinutes,
        tier: c.tier,
        redPct: c.redPct,
      })
    }
    return map
  }, [snap.brandBranchCells])

  const maxHourTickets = useMemo(
    () => Math.max(1, ...snap.hourlyBottlenecks.map((h) => h.totalTickets)),
    [snap.hourlyBottlenecks],
  )

  const handleEscalateTicketDelay = useCallback(
    (t: PrepSlaOrderTicket) => {
      const refKey = `prep-sla-ticket:${t.orderId}`
      requestApproval({
        refKey,
        domain: 'operations',
        titleAr: `تنبيه تأخير تجهيز حرج ${t.orderId} — ${t.branchNameAr} (${t.brandNameAr})`,
        titleEn: `Critical Kitchen Prep Alert ${t.orderId} — ${t.branchNameEn} (${t.brandNameEn})`,
        summaryAr: `وصل الطلب الساعة ${t.arrivedAt} وجهز الساعة ${t.readyAt} بمدة ${t.durationMmSs} (${f1(t.prepMinutes)} دقيقة > 18.0 د). السبب: ${t.delayRootCauseAr}.`,
        summaryEn: `Order arrived ${t.arrivedAt}, ready ${t.readyAt} — prep duration ${t.durationMmSs} (${f1(t.prepMinutes)} min > 18.0m). Root cause: ${t.delayRootCauseEn}.`,
        departmentAr: 'تشغيل المطابخ وضبط زمن التحضير (KDS)',
        departmentEn: 'Kitchen Operations & KDS SLA',
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: 240,
        href: '/erp/prep-sla',
      })
      setToastMsg({
        ar: `تم تصعيد تأخير الطلب ${t.orderId} إلى جرس المدير 🔔`,
        en: `Escalated critical ticket ${t.orderId} to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [requestApproval],
  )

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-6 pb-12 font-sans text-[14px] sm:text-[15px] text-neutral-900 antialiased dark:text-slate-100"
    >
      {toastMsg ? (
        <div className="fixed bottom-20 lg:bottom-6 end-6 z-50 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[13.5px] font-semibold text-emerald-800 shadow-xl ring-1 ring-emerald-500/25 dark:bg-[#101C17] dark:text-emerald-300 dark:ring-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
        </div>
      ) : null}

      {/* ───────────── 1. Slim Contextual Bar ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Timer className="h-4 w-4" />
          </span>
          <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
            {T(
              'KDS Prep SLA: Green <= 12.0m • Yellow 12.1–18.0m • Red > 18.0m',
              'زمن تجهيز المطبخ (KDS): أخضر ≤ 12.0 د • أصفر 12.1–18.0 د • أحمر حرج > 18.0 د',
            )}
          </p>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{T('6 Brands · 7 Branches', '٦ براندات · ٧ فروع')}</span>
          </span>
        </div>

        <Link
          href={`/erp/feryal-ai?prompt=${encodeURIComponent(
            isAr
              ? `حلّلي مدة تجهيز الطلبات بالمطابخ: المعدل الوسطي العام ${f1(snap.avgPrepMinutes)} دقيقة (P90 = ${f1(snap.p90PrepMinutes)} دقيقة)، أخضر جيد ${f1(snap.greenPct)}%، أصفر وسط ${f1(snap.yellowPct)}%، وأحمر حرج ${f1(snap.redPct)}%. أعطيني خطة تسريع فورية للفروع الأبطأ.`
              : `Analyze kitchen order prep SLA: avg ${f1(snap.avgPrepMinutes)}m (P90 ${f1(snap.p90PrepMinutes)}m), Green ${f1(snap.greenPct)}%, Yellow ${f1(snap.yellowPct)}%, Red ${f1(snap.redPct)}%.`,
          )}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-50 px-3.5 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-400/25"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>{T('Ask Feryal ✨', 'اسأل فريال ✨')}</span>
        </Link>
      </div>

      {/* ───────────── 2. Top 4 Traffic-Light SLA Summary KPIs (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={`${KPI_CARD_CLS} space-y-1.5`}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
              {T('Avg Prep Time', 'المعدل الوسطي للتجهيز')}
            </span>
            <PrepTrafficBadge tier={snap.overallTier} isAr={isAr} compact />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white">
              {f1(snap.avgPrepMinutes)}{' '}
              <span className="text-[12px] sm:text-[14px] font-semibold text-neutral-500">
                {isAr ? 'د' : 'min'}
              </span>
            </div>
            <span className="font-mono text-[11.5px] sm:text-[13px] font-semibold tabular-nums text-neutral-500 dark:text-slate-400">
              {snap.avgDurationMmSs}
            </span>
          </div>
          <p className="text-[11.5px] sm:text-[12.5px] leading-snug tabular-nums text-neutral-400">
            {T(
              `P90: ${f1(snap.p90PrepMinutes)}m · ${f0(snap.totalTickets)} tickets`,
              `ذروة P90: ${f1(snap.p90PrepMinutes)} د · ${f0(snap.totalTickets)} طلب`,
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTierFilter(tierFilter === 'green' ? 'all' : 'green')}
          className={`${KPI_CARD_CLS} cursor-pointer space-y-1.5 text-start transition-all duration-150 hover:-translate-y-0.5 ${
            tierFilter === 'green' ? 'ring-2 ring-emerald-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="rounded-xl bg-emerald-50 px-2 py-0.5 text-[11.5px] sm:text-[12px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              {T('🟢 <= 12.0m', '🟢 ≤ 12.0 د')}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {f0(snap.greenCount)}
            </span>
          </div>
          <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            {f1(snap.greenPct)}%
          </div>
          <p className="text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-400">
            {T('Handed off within target SLA', 'سُلمت ضمن الزمن المثالي')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTierFilter(tierFilter === 'yellow' ? 'all' : 'yellow')}
          className={`${KPI_CARD_CLS} cursor-pointer space-y-1.5 text-start transition-all duration-150 hover:-translate-y-0.5 ${
            tierFilter === 'yellow' ? 'ring-2 ring-amber-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="rounded-xl bg-amber-50 px-2 py-0.5 text-[11.5px] sm:text-[12px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              {T('🟡 12.1–18.0m', '🟡 12.1–18.0 د')}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-amber-800 dark:text-amber-300">
              {f0(snap.yellowCount)}
            </span>
          </div>
          <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-amber-700 dark:text-amber-300">
            {f1(snap.yellowPct)}%
          </div>
          <p className="text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-400">
            {T('Moderate station pressure', 'ضغط متوسط تحت المتابعة')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTierFilter(tierFilter === 'red' ? 'all' : 'red')}
          className={`${KPI_CARD_CLS} cursor-pointer space-y-1.5 text-start transition-all duration-150 hover:-translate-y-0.5 ${
            tierFilter === 'red' ? 'ring-2 ring-rose-500/60' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="rounded-xl bg-rose-50 px-2 py-0.5 text-[11.5px] sm:text-[12px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
              {T('🔴 > 18.0m', '🔴 > 18.0 د')}
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              {f0(snap.redCount)}
            </span>
          </div>
          <div className="text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
            {f1(snap.redPct)}%
          </div>
          <p className="text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-400">
            {T('Critical delays for Escalate ↗', 'حالات حرجة مؤهلة للتصعيد')}
          </p>
        </button>
      </section>

      {/* ───────────── 3. Branch & Brand Average Matrix ───────────── */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Per-Branch Average Matrix (7 Locations) */}
        <div className={CARD_CLS}>
          <div className="mb-4">
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Average Prep Time by Branch (7 Locations)',
                'المعدل الوسطي لتجهيز الطلب لكل فرع (٧ فروع)',
              )}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {T(
                'Sorted slowest-first to spotlight kitchen station load.',
                'مرتبة من الأبطأ إلى الأسرع لكشف ضغط خطوط التحضير.',
              )}
            </p>
          </div>

          <div className={TABLE_SCROLL_CLS}>
            <table className="w-full min-w-[560px] border-collapse text-start text-[14px] sm:text-[14.5px]">
              <thead>
                <tr className="border-b border-neutral-100 text-[12.5px] font-semibold text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                  <th className="sticky start-0 z-10 bg-white py-2.5 pe-2 text-start whitespace-nowrap dark:bg-[#101C17]">
                    {T('Branch', 'الفرع')}
                  </th>
                  <th className="px-2 py-2.5 text-start whitespace-nowrap">{T('Avg Prep', 'المعدل الوسطي')}</th>
                  <th className="px-2 py-2.5 text-start whitespace-nowrap">{T('P90 Peak', 'ذروة P90')}</th>
                  <th className="px-2 py-2.5 text-start whitespace-nowrap">
                    {T('🟢 / 🟡 / 🔴 Mix', 'توزيع الأخضر / الأصفر / الأحمر')}
                  </th>
                  <th className="py-2.5 ps-2 text-end whitespace-nowrap">{T('Grade', 'التصنيف')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {snap.branchMatrix.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-[#F6F7F8]/80 dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky start-0 z-10 bg-white py-3 pe-2 font-semibold whitespace-nowrap text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      <div>{isAr ? row.nameAr : row.nameEn}</div>
                      <div className="text-[12px] font-normal text-neutral-400">
                        {f0(row.ticketCount)} {isAr ? 'طلب' : 'tickets'}
                      </div>
                    </td>
                    <td className="px-2 py-3 font-bold tabular-nums text-neutral-950 dark:text-white">
                      {f1(row.avgPrepMinutes)} {isAr ? 'د' : 'm'}{' '}
                      <span className="font-mono text-[12px] font-normal text-neutral-400">
                        ({row.avgDurationMmSs})
                      </span>
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
                      {f1(row.p90PrepMinutes)} {isAr ? 'د' : 'm'}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex h-2 w-36 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.08]">
                        <div style={{ width: `${row.greenPct}%` }} className="bg-emerald-500/85" />
                        <div style={{ width: `${row.yellowPct}%` }} className="bg-amber-400/90" />
                        <div style={{ width: `${row.redPct}%` }} className="bg-rose-500/85" />
                      </div>
                      <div className="mt-1 text-[12px] tabular-nums text-neutral-500 dark:text-slate-400">
                        🟢 {f1(row.greenPct)}% · 🟡 {f1(row.yellowPct)}% · 🔴 {f1(row.redPct)}%
                      </div>
                    </td>
                    <td className="py-3 ps-2 text-end">
                      <PrepTrafficBadge tier={row.tier} isAr={isAr} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-Brand Average Matrix (6 Brands) */}
        <div className={CARD_CLS}>
          <div className="mb-4">
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Average Prep Time by Brand (6 Brands)',
                'المعدل الوسطي لتجهيز الطلب لكل براند (٦ براندات)',
              )}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {T(
                'Station speed comparison across all 6 Venture Foods concepts.',
                'مقارنة سرعة خطوط التحضير عبر كافة البراندات الستة.',
              )}
            </p>
          </div>

          <div className={TABLE_SCROLL_CLS}>
            <table className="w-full min-w-[560px] border-collapse text-start text-[14px] sm:text-[14.5px]">
              <thead>
                <tr className="border-b border-neutral-100 text-[12.5px] font-semibold text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                  <th className="sticky start-0 z-10 bg-white py-2.5 pe-2 text-start whitespace-nowrap dark:bg-[#101C17]">
                    {T('Brand', 'البراند')}
                  </th>
                  <th className="px-2 py-2.5 text-start whitespace-nowrap">{T('Avg Prep', 'المعدل الوسطي')}</th>
                  <th className="px-2 py-2.5 text-start whitespace-nowrap">{T('P90 Peak', 'ذروة P90')}</th>
                  <th className="px-2 py-2.5 text-start whitespace-nowrap">
                    {T('🟢 / 🟡 / 🔴 Mix', 'توزيع الأخضر / الأصفر / الأحمر')}
                  </th>
                  <th className="py-2.5 ps-2 text-end whitespace-nowrap">{T('Grade', 'التصنيف')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {snap.brandMatrix.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-[#F6F7F8]/80 dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky start-0 z-10 bg-white py-3 pe-2 font-semibold whitespace-nowrap text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      <div>{isAr ? row.nameAr : row.nameEn}</div>
                      <div className="text-[12px] font-normal text-neutral-400">
                        {f0(row.ticketCount)} {isAr ? 'طلب' : 'tickets'}
                      </div>
                    </td>
                    <td className="px-2 py-3 font-bold tabular-nums text-neutral-950 dark:text-white">
                      {f1(row.avgPrepMinutes)} {isAr ? 'د' : 'm'}{' '}
                      <span className="font-mono text-[12px] font-normal text-neutral-400">
                        ({row.avgDurationMmSs})
                      </span>
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
                      {f1(row.p90PrepMinutes)} {isAr ? 'د' : 'm'}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex h-2 w-36 overflow-hidden rounded-full bg-neutral-100 dark:bg-white/[0.08]">
                        <div style={{ width: `${row.greenPct}%` }} className="bg-emerald-500/85" />
                        <div style={{ width: `${row.yellowPct}%` }} className="bg-amber-400/90" />
                        <div style={{ width: `${row.redPct}%` }} className="bg-rose-500/85" />
                      </div>
                      <div className="mt-1 text-[12px] tabular-nums text-neutral-500 dark:text-slate-400">
                        🟢 {f1(row.greenPct)}% · 🟡 {f1(row.yellowPct)}% · 🔴 {f1(row.redPct)}%
                      </div>
                    </td>
                    <td className="py-3 ps-2 text-end">
                      <PrepTrafficBadge tier={row.tier} isAr={isAr} compact />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6 × 7 Brand × Location Cross-Matrix */}
      {snap.brandMatrix.length > 1 && snap.branchMatrix.length > 1 ? (
        <section className={CARD_CLS}>
          <div className="mb-4">
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
              {T(
                '6 Brands × 7 Locations Cross-Matrix (Average Prep Minutes)',
                'مصفوفة المعدل الوسطي للتجهيز (٦ براندات × ٧ فروع بالدقائق)',
              )}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {T(
                'Green <= 12.0m · Yellow 12.1–18.0m · Red > 18.0m across every kitchen cell.',
                'خلية خضراء ≤ 12.0 د · صفراء 12.1–18.0 د · حمراء > 18.0 د لكل براند داخل كل فرع.',
              )}
            </p>
          </div>
          <div className={TABLE_SCROLL_CLS}>
            <table className="w-full min-w-[880px] border-collapse text-start text-[14px]">
              <thead>
                <tr className="border-b border-neutral-100 text-[12.5px] font-semibold text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                  <th className="sticky start-0 z-10 bg-white py-2.5 pe-3 text-start whitespace-nowrap dark:bg-[#101C17]">
                    {T('Brand \\ Branch', 'البراند \\ الفرع')}
                  </th>
                  {snap.branchMatrix.map((loc) => (
                    <th key={loc.id} className="px-2 py-2.5 text-center whitespace-nowrap">
                      {isAr ? loc.nameAr : loc.nameEn}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {snap.brandMatrix.map((br) => (
                  <tr key={br.id}>
                    <td className="sticky start-0 z-10 bg-white py-3 pe-3 font-semibold whitespace-nowrap text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      {isAr ? br.nameAr : br.nameEn}
                    </td>
                    {snap.branchMatrix.map((loc) => {
                      const cell = cellLookup.get(`${br.id}::${loc.id}`)
                      if (!cell) {
                        return (
                          <td key={loc.id} className="px-2 py-3 text-center text-neutral-300">
                            —
                          </td>
                        )
                      }
                      const pillCls =
                        cell.tier === 'green'
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                          : cell.tier === 'yellow'
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                      return (
                        <td key={loc.id} className="px-2 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-semibold tabular-nums ${pillCls}`}
                          >
                            <span>
                              {cell.tier === 'green' ? '🟢' : cell.tier === 'yellow' ? '🟡' : '🔴'}
                            </span>
                            <span>
                              {f1(cell.avgPrepMinutes)} {isAr ? 'د' : 'm'}
                            </span>
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ───────────── 4. Peak-Hour Bottleneck Strip (12 PM – 1 AM) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Flame className="h-5 w-5 text-rose-500" />
            <div>
              <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
                {T(
                  'Peak-Hour Bottleneck Strip (12 PM – 1 AM)',
                  'شريط ساعات الذروة والاختناق بالمطابخ (12 ظهراً – 1 صباحاً)',
                )}
              </h2>
              <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
                {T(
                  'Click any hour capsule to inspect tickets from that service window.',
                  'اضغط على أي ساعة لتصفية تذاكر الطلبات الخاصة بها بالأسفل.',
                )}
              </p>
            </div>
          </div>

          {selectedHour !== null ? (
            <button
              type="button"
              onClick={() => setSelectedHour(null)}
              className="shrink-0 cursor-pointer whitespace-nowrap rounded-xl bg-neutral-100/90 px-3.5 py-2 text-[13px] font-medium text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/[0.06] dark:text-slate-200"
            >
              {T('Clear Hour Filter ✕', 'إلغاء فلتر الساعة ✕')}
            </button>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 pb-1 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-14 sm:overflow-visible">
          {snap.hourlyBottlenecks.map((h) => {
            const active = selectedHour === h.hourIndex
            const barHeightPct = Math.max(16, Math.round((h.totalTickets / maxHourTickets) * 100))
            const barColor =
              h.redCount > 0 && h.redSharePct >= 25
                ? 'bg-rose-500/85'
                : h.avgPrepMinutes > 12
                  ? 'bg-amber-400/90'
                  : 'bg-emerald-500/85'
            return (
              <button
                key={h.hourIndex}
                type="button"
                onClick={() => setSelectedHour(active ? null : h.hourIndex)}
                className={`${SUBCARD_CLS} flex w-[56px] shrink-0 sm:w-auto cursor-pointer flex-col items-center justify-between p-2.5 text-center transition-all duration-150 ${
                  active ? 'ring-2 ring-emerald-500' : 'hover:ring-1 hover:ring-neutral-300'
                }`}
              >
                <span className="text-[11.5px] font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
                  {isAr ? h.labelAr : h.labelEn}
                </span>

                <div className="my-2 flex h-20 w-full items-end justify-center">
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-4 rounded-full transition-all ${barColor}`}
                  />
                </div>

                <div className="space-y-0.5 tabular-nums">
                  <div className="text-[12px] font-bold text-neutral-900 dark:text-white">
                    {h.totalTickets > 0 ? `${f1(h.avgPrepMinutes)}${isAr ? 'د' : 'm'}` : '—'}
                  </div>
                  <div
                    className={`text-[11px] font-semibold ${
                      h.redCount > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {h.redCount > 0 ? `🔴 ${h.redCount}` : '🟢 0'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ───────────── 5. Paginated Order Ticket Audit Table (12 Tickets / Page) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Order Ticket Preparation Audit Ledger (12 Tickets / Page)',
                'سجل تدقيق تذاكر الطلبات الفردية (١٢ تذكرة بالصفحة)',
              )}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {T(
                'Green & Yellow tickets stay clean; only genuine Red (>18.0m) critical delays display Escalate ↗.',
                'التذاكر الخضراء والصفراء تُعرض بهدوء؛ ويظهر زر تصعيد ↗ فقط للطلبات الحمراء الحرجة (> 18.0 دقيقة).',
              )}
            </p>
          </div>

          <div className="flex max-w-full flex-col gap-2.5 sm:flex-row sm:items-center">
            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All' },
                  { id: 'green', ar: '🟢 أخضر', en: '🟢 Good' },
                  { id: 'yellow', ar: '🟡 أصفر', en: '🟡 Medium' },
                  { id: 'red', ar: '🔴 حرج', en: '🔴 Critical' },
                ] as const
              ).map((pill) => {
                const active = tierFilter === pill.id
                return (
                  <button
                    key={pill.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTierFilter(pill.id)}
                    className={`${SEGMENT_BTN_CLS} ${
                      active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? pill.ar : pill.en}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className={`${SUBCARD_CLS} inline-flex h-9 flex-1 sm:flex-initial items-center gap-1.5 px-3.5`}>
                <Search className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={T('Search order / branch…', 'ابحث برقم الطلب أو الفرع…')}
                  className="w-full sm:w-40 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
                />
              </div>

              <div className="flex shrink-0 items-center gap-1.5 text-[13px]">
                <span className="tabular-nums text-neutral-500 dark:text-slate-400">
                  {safePage}/{totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-[#F6F7F8] text-neutral-700 hover:bg-emerald-50 disabled:opacity-40 dark:bg-[#0B1410] dark:text-slate-200"
                  aria-label={T('Previous page', 'السابق')}
                >
                  {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-[#F6F7F8] text-neutral-700 hover:bg-emerald-50 disabled:opacity-40 dark:bg-[#0B1410] dark:text-slate-200"
                  aria-label={T('Next page', 'التالي')}
                >
                  {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[1120px] border-collapse text-start text-[14px] sm:text-[14.5px]">
            <thead>
              <tr className="border-b border-neutral-100 text-[12.5px] font-semibold text-neutral-500 dark:border-white/[0.06] dark:text-slate-400">
                <th className="sticky start-0 z-10 bg-white py-3 pe-3 text-start whitespace-nowrap dark:bg-[#101C17]">
                  {T('Order ID', 'رقم الطلب')}
                </th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">
                  {T('Arrived at Branch', 'لحظة وصول الطلب')}
                </th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">{T('Ready Handoff', 'لحظة الجاهزية')}</th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">
                  {T('Prep Duration', 'مدة التجهيز (mm:ss)')}
                </th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">{T('Brand', 'البراند')}</th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">{T('Branch', 'الفرع')}</th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">{T('Channel', 'القناة')}</th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">{T('Grade', 'التصنيف')}</th>
                <th className="px-2.5 py-3 text-start whitespace-nowrap">{T('Diagnosis', 'التشخيص')}</th>
                <th className="py-3 ps-3 text-end whitespace-nowrap">{T('Action', 'الإجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {visibleTickets.map((t) => {
                const refKey = `prep-sla-ticket:${t.orderId}`
                const queued = getApprovalByRef(refKey)
                return (
                  <tr
                    key={t.orderId}
                    className="transition-colors hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky start-0 z-10 bg-white py-3.5 pe-3 font-mono font-semibold whitespace-nowrap tabular-nums text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      <div>{t.orderId}</div>
                      <div className="font-sans text-[12px] font-normal text-neutral-400">
                        {t.dateIso}
                      </div>
                    </td>

                    <td
                      dir="ltr"
                      className="px-2.5 py-3.5 font-mono tabular-nums text-neutral-700 dark:text-slate-200"
                    >
                      {t.arrivedAt}
                    </td>

                    <td
                      dir="ltr"
                      className="px-2.5 py-3.5 font-mono tabular-nums text-neutral-700 dark:text-slate-200"
                    >
                      {t.readyAt}
                    </td>

                    <td className="px-2.5 py-3.5 tabular-nums">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-neutral-950 dark:text-white">
                        <Clock className="h-3.5 w-3.5 text-neutral-400" />
                        {t.durationMmSs}
                      </span>
                      <span className="ms-1 text-[12px] text-neutral-400">
                        ({f1(t.prepMinutes)} {isAr ? 'د' : 'm'})
                      </span>
                    </td>

                    <td className="px-2.5 py-3.5 font-semibold text-neutral-900 dark:text-white">
                      {isAr ? t.brandNameAr : t.brandNameEn}
                    </td>

                    <td className="px-2.5 py-3.5 font-medium text-neutral-700 dark:text-slate-200">
                      {isAr ? t.branchNameAr : t.branchNameEn}
                    </td>

                    <td className="px-2.5 py-3.5 text-neutral-600 dark:text-slate-300">
                      {isAr ? t.channelNameAr : t.channelNameEn}
                    </td>

                    <td className="px-2.5 py-3.5">
                      <PrepTrafficBadge tier={t.tier} isAr={isAr} compact />
                    </td>

                    <td className="max-w-[260px] px-2.5 py-3.5 text-[13px] leading-snug text-neutral-600 dark:text-slate-300">
                      {isAr ? t.delayRootCauseAr : t.delayRootCauseEn}
                    </td>

                    <td className="py-3.5 ps-3 text-end">
                      {t.tier === 'red' ? (
                        queued ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            {T('Escalated ✓', 'تم التصعيد ✓')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="رفع تنبيه تأخير المطبخ لجرس المدير 🔔"
                            onClick={() => handleEscalateTicketDelay(t)}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-rose-200/80 bg-rose-50/70 px-3 text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                          >
                            {T('Escalate ↗', 'تصعيد ↗')}
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
          </table>
        </div>
      </section>
    </div>
  )
}
