'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Bell,
  Check,
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
  type ActiveBranchId,
  type ActiveBrandId,
  type PrepSlaOrderTicket,
  type PrepSlaTier,
} from '@/lib/warehouse-prep-engine'

const CARD_CLS =
  'ae-bento-card bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#0D1614]'
const SUBCARD_CLS = 'rounded-2xl bg-[#F7F7F8] dark:bg-[#111E1B]'
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
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
        <span>🟢</span>
        <span>{compact ? (isAr ? 'جيد' : 'Good') : isAr ? 'أخضر — جيد' : 'Good (<=12m)'}</span>
      </span>
    )
  }
  if (tier === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
        <span>🟡</span>
        <span>
          {compact ? (isAr ? 'وسط' : 'Medium') : isAr ? 'أصفر — وسط' : 'Medium (12.1–18m)'}
        </span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
      <span>🔴</span>
      <span>
        {compact ? (isAr ? 'خطر وسيء' : 'Critical') : isAr ? 'أحمر — خطر وسيء' : 'Critical (>18m)'}
      </span>
    </span>
  )
}

export function OrderPrepSlaStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const T = useCallback((en: string, ar: string) => (isAr ? ar : en), [isAr])

  const { filters, setBranch, setBrand } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const snap = useMemo(() => computeOrderPrepSlaSnapshot(filters), [filters])

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
        titleAr: `تنبيه تأخير تجهيز طلب ${t.orderId} — ${t.branchNameAr} (${t.brandNameAr})`,
        titleEn: `Kitchen Prep SLA Alert ${t.orderId} — ${t.branchNameEn} (${t.brandNameEn})`,
        summaryAr: `وصل الطلب الساعة ${t.arrivedAt} وجهز الساعة ${t.readyAt} بمدة ${t.durationMmSs} (${f1(t.prepMinutes)} دقيقة · تصنيف ${t.tier === 'red' ? 'أحمر خطر' : 'أصفر وسط'}). السبب: ${t.delayRootCauseAr}.`,
        summaryEn: `Order arrived ${t.arrivedAt}, ready ${t.readyAt} — prep duration ${t.durationMmSs} (${f1(t.prepMinutes)} min). Root cause: ${t.delayRootCauseEn}.`,
        departmentAr: 'تشغيل المطابخ وضبط زمن التحضير (KDS)',
        departmentEn: 'Kitchen Operations & KDS SLA',
        budgetOrCostKwd: 0,
        expectedMonthlyReturnKwd: t.tier === 'red' ? 240 : 120,
        href: '/erp/prep-sla',
      })
      setToastMsg({
        ar: `تم رفع تنبيه تأخير المطبخ للطلب ${t.orderId} إلى جرس المدير 🔔`,
        en: `Kitchen delay alert for ${t.orderId} queued in Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3400)
    },
    [requestApproval],
  )

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1520px] space-y-5 pb-10 font-sans text-neutral-900 antialiased dark:text-slate-100"
    >
      {toastMsg ? (
        <div className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-emerald-800 shadow-xl ring-1 ring-emerald-500/25 dark:bg-neutral-900 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
        </div>
      ) : null}

      {/* ───────────── 1. Studio Header ───────────── */}
      <header className={`${CARD_CLS} flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between`}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Timer className="h-4 w-4" />
            </span>
            <h1 className="text-[20px] font-semibold tracking-tight text-neutral-950 sm:text-[22px] dark:text-white">
              {T(
                'Kitchen Order Preparation SLA Monitor',
                'مراقبة مدة تجهيز الطلبات حسب البراند والفرع (KDS SLA)',
              )}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              <span>{T('6 Brands · 7 Locations', '٦ براندات · ٧ فروع نشطة')}</span>
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-slate-400">
            {T(
              'Exact duration from POS/KDS order arrival to kitchen handoff — classified into Green (<=12m), Yellow (12.1–18m), and Red (>18m).',
              'قياس دقيق من لحظة وصول الطلب للفرع ولغاية جاهزية التسليم مع تصنيف كل طلب وحساب المعدل الوسطي لكل فرع ولكل براند.',
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(filters.brand !== 'all' || filters.branch !== 'all') ? (
            <button
              type="button"
              onClick={() => {
                setBrand('all')
                setBranch('all')
              }}
              className="cursor-pointer rounded-full bg-[#F7F7F8] px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#111E1B] dark:text-slate-200"
            >
              {T('Show All 6 Brands & 7 Branches', 'عرض كل البراندات والفروع')}
            </button>
          ) : null}

          <Link
            href={`/erp/feryal?prompt=${encodeURIComponent(
              isAr
                ? `حلّلي مدة تجهيز الطلبات بالمطابخ: المعدل الوسطي العام ${f1(snap.avgPrepMinutes)} دقيقة (P90 = ${f1(snap.p90PrepMinutes)} دقيقة)، أخضر جيد ${f1(snap.greenPct)}%، أصفر وسط ${f1(snap.yellowPct)}%، وأحمر خطر ${f1(snap.redPct)}%. أعطيني خطة تسريع فورية للفروع الأبطأ.`
                : `Analyze kitchen order prep SLA: avg ${f1(snap.avgPrepMinutes)}m (P90 ${f1(snap.p90PrepMinutes)}m), Green ${f1(snap.greenPct)}%, Yellow ${f1(snap.yellowPct)}%, Red ${f1(snap.redPct)}%.`,
            )}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{T('Ask Feryal ✨', 'اسأل فريال ✨')}</span>
          </Link>
        </div>
      </header>

      {/* ───────────── 2. Top 4 Traffic-Light SLA Summary KPIs ───────────── */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`${CARD_CLS} space-y-1.5`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">
              {T('Overall Average Prep Time', 'المعدل الوسطي لتجهيز الطلب')}
            </span>
            <PrepTrafficBadge tier={snap.overallTier} isAr={isAr} compact />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-2xl font-bold tracking-tight tabular-nums text-neutral-950 dark:text-white">
              {f1(snap.avgPrepMinutes)}{' '}
              <span className="text-xs font-semibold text-neutral-500">
                {isAr ? 'دقيقة' : 'min'}
              </span>
            </div>
            <span className="font-mono text-xs font-semibold tabular-nums text-neutral-500 dark:text-slate-400">
              {snap.avgDurationMmSs}
            </span>
          </div>
          <p className="text-[11px] tabular-nums text-neutral-400">
            {T(
              `P90 Peak Time: ${f1(snap.p90PrepMinutes)} min · ${f0(snap.totalTickets)} audited tickets`,
              `زمن الذروة P90: ${f1(snap.p90PrepMinutes)} د · ${f0(snap.totalTickets)} طلب مدقق`,
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setTierFilter(tierFilter === 'green' ? 'all' : 'green')}
          className={`${CARD_CLS} cursor-pointer space-y-1.5 text-start transition-all duration-150 hover:-translate-y-0.5 ${
            tierFilter === 'green' ? 'ring-2 ring-emerald-500/50' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              {T('🟢 Good (<= 12.0 min)', '🟢 أخضر — جيد (≤ 12.0 د)')}
            </span>
            <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {f0(snap.greenCount)} {isAr ? 'طلب' : 'orders'}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            {f1(snap.greenPct)}%
          </div>
          <p className="text-[11px] text-neutral-400">
            {T('Handed off smoothly within target SLA', 'طلبات جُهزت وسُلمت ضمن الزمن المثالي')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTierFilter(tierFilter === 'yellow' ? 'all' : 'yellow')}
          className={`${CARD_CLS} cursor-pointer space-y-1.5 text-start transition-all duration-150 hover:-translate-y-0.5 ${
            tierFilter === 'yellow' ? 'ring-2 ring-amber-500/50' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              {T('🟡 Medium (12.1 – 18.0 min)', '🟡 أصفر — وسط (12.1 – 18.0 د)')}
            </span>
            <span className="text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-300">
              {f0(snap.yellowCount)} {isAr ? 'طلب' : 'orders'}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums text-amber-700 dark:text-amber-300">
            {f1(snap.yellowPct)}%
          </div>
          <p className="text-[11px] text-neutral-400">
            {T('Moderate station pressure — watch closely', 'ضغط متوسط بالمطبخ يحتاج متابعة الوردية')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTierFilter(tierFilter === 'red' ? 'all' : 'red')}
          className={`${CARD_CLS} cursor-pointer space-y-1.5 text-start transition-all duration-150 hover:-translate-y-0.5 ${
            tierFilter === 'red' ? 'ring-2 ring-rose-500/50' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
              {T('🔴 Critical / Bad (> 18.0 min)', '🔴 أحمر — خطر وسيء (> 18.0 د)')}
            </span>
            <span className="text-xs font-semibold tabular-nums text-rose-700 dark:text-rose-300">
              {f0(snap.redCount)} {isAr ? 'طلب' : 'orders'}
            </span>
          </div>
          <div className="text-2xl font-bold tracking-tight tabular-nums text-rose-600 dark:text-rose-400">
            {f1(snap.redPct)}%
          </div>
          <p className="text-[11px] text-neutral-400">
            {T('High risk of cold food, rider wait & 1★ rating', 'خطر برودة الطبق وتأخير السائق وتقييم سلبي')}
          </p>
        </button>
      </section>

      {/* ───────────── 3. Branch & Brand Average Matrix ───────────── */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Per-Branch Average Matrix (7 Locations) */}
        <div className={CARD_CLS}>
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                {T(
                  'Average Prep Time by Branch (7 Locations)',
                  'المعدل الوسطي لتجهيز الطلب لكل فرع (٧ فروع)',
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                {T(
                  'Sorted slowest-first to spotlight kitchen bottlenecks.',
                  'مرتبة من الأبطأ إلى الأسرع لكشف نقاط الاختناق فوراً.',
                )}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 dark:border-white/[0.06]">
                  <th className="py-2 pe-2 text-start">{T('Branch', 'الفرع')}</th>
                  <th className="px-2 py-2 text-start">{T('Avg Prep', 'المعدل الوسطي')}</th>
                  <th className="px-2 py-2 text-start">{T('P90 Peak', 'ذروة P90')}</th>
                  <th className="px-2 py-2 text-start">{T('🟢 / 🟡 / 🔴 Mix', 'توزيع الأخضر / الأصفر / الأحمر')}</th>
                  <th className="py-2 ps-2 text-end">{T('Grade', 'التصنيف')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {snap.branchMatrix.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() =>
                      setBranch(filters.branch === row.id ? 'all' : (row.id as ActiveBranchId))
                    }
                    className="cursor-pointer transition-colors hover:bg-[#F7F7F8]/80 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-2.5 pe-2 font-semibold text-neutral-950 dark:text-white">
                      <div>{isAr ? row.nameAr : row.nameEn}</div>
                      <div className="text-[10.5px] font-normal text-neutral-400">
                        {f0(row.ticketCount)} {isAr ? 'طلب' : 'tickets'}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-bold tabular-nums text-neutral-950 dark:text-white">
                      {f1(row.avgPrepMinutes)} {isAr ? 'د' : 'm'}{' '}
                      <span className="font-mono text-[10.5px] font-normal text-neutral-400">
                        ({row.avgDurationMmSs})
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
                      {f1(row.p90PrepMinutes)} {isAr ? 'د' : 'm'}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex h-2 w-36 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div
                          style={{ width: `${row.greenPct}%` }}
                          className="bg-emerald-500/85"
                        />
                        <div
                          style={{ width: `${row.yellowPct}%` }}
                          className="bg-amber-400/90"
                        />
                        <div
                          style={{ width: `${row.redPct}%` }}
                          className="bg-rose-500/85"
                        />
                      </div>
                      <div className="mt-1 text-[10.5px] tabular-nums text-neutral-500 dark:text-slate-400">
                        🟢 {f1(row.greenPct)}% · 🟡 {f1(row.yellowPct)}% · 🔴 {f1(row.redPct)}%
                      </div>
                    </td>
                    <td className="py-2.5 ps-2 text-end">
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
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                {T(
                  'Average Prep Time by Brand (6 Brands)',
                  'المعدل الوسطي لتجهيز الطلب لكل براند (٦ براندات)',
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                {T(
                  'Click any brand to filter its exact station tickets.',
                  'اضغط على أي براند لتصفية تذاكر مطبخه وفروعه.',
                )}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 dark:border-white/[0.06]">
                  <th className="py-2 pe-2 text-start">{T('Brand', 'البراند')}</th>
                  <th className="px-2 py-2 text-start">{T('Avg Prep', 'المعدل الوسطي')}</th>
                  <th className="px-2 py-2 text-start">{T('P90 Peak', 'ذروة P90')}</th>
                  <th className="px-2 py-2 text-start">{T('🟢 / 🟡 / 🔴 Mix', 'توزيع الأخضر / الأصفر / الأحمر')}</th>
                  <th className="py-2 ps-2 text-end">{T('Grade', 'التصنيف')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {snap.brandMatrix.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() =>
                      setBrand(filters.brand === row.id ? 'all' : (row.id as ActiveBrandId))
                    }
                    className="cursor-pointer transition-colors hover:bg-[#F7F7F8]/80 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-2.5 pe-2 font-semibold text-neutral-950 dark:text-white">
                      <div>{isAr ? row.nameAr : row.nameEn}</div>
                      <div className="text-[10.5px] font-normal text-neutral-400">
                        {f0(row.ticketCount)} {isAr ? 'طلب' : 'tickets'}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 font-bold tabular-nums text-neutral-950 dark:text-white">
                      {f1(row.avgPrepMinutes)} {isAr ? 'د' : 'm'}{' '}
                      <span className="font-mono text-[10.5px] font-normal text-neutral-400">
                        ({row.avgDurationMmSs})
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
                      {f1(row.p90PrepMinutes)} {isAr ? 'د' : 'm'}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex h-2 w-36 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                        <div
                          style={{ width: `${row.greenPct}%` }}
                          className="bg-emerald-500/85"
                        />
                        <div
                          style={{ width: `${row.yellowPct}%` }}
                          className="bg-amber-400/90"
                        />
                        <div
                          style={{ width: `${row.redPct}%` }}
                          className="bg-rose-500/85"
                        />
                      </div>
                      <div className="mt-1 text-[10.5px] tabular-nums text-neutral-500 dark:text-slate-400">
                        🟢 {f1(row.greenPct)}% · 🟡 {f1(row.yellowPct)}% · 🔴 {f1(row.redPct)}%
                      </div>
                    </td>
                    <td className="py-2.5 ps-2 text-end">
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
          <div className="mb-3.5">
            <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {T(
                '6 Brands × 7 Locations Cross-Matrix (Average Prep Minutes)',
                'مصفوفة المعدل الوسطي للتجهيز (٦ براندات × ٧ فروع بالدقائق)',
              )}
            </h2>
            <p className="text-xs text-neutral-400">
              {T(
                'Green <= 12.0m · Yellow 12.1–18.0m · Red > 18.0m across every kitchen cell.',
                'خلية خضراء ≤ 12.0 د · صفراء 12.1–18.0 د · حمراء > 18.0 د لكل براند داخل كل فرع.',
              )}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 dark:border-white/[0.06]">
                  <th className="py-2 pe-3 text-start">{T('Brand \\ Branch', 'البراند \\ الفرع')}</th>
                  {snap.branchMatrix.map((loc) => (
                    <th key={loc.id} className="px-2 py-2 text-center">
                      {isAr ? loc.nameAr : loc.nameEn}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
                {snap.brandMatrix.map((br) => (
                  <tr key={br.id}>
                    <td className="py-2.5 pe-3 font-semibold text-neutral-950 dark:text-white">
                      {isAr ? br.nameAr : br.nameEn}
                    </td>
                    {snap.branchMatrix.map((loc) => {
                      const cell = cellLookup.get(`${br.id}::${loc.id}`)
                      if (!cell) {
                        return (
                          <td key={loc.id} className="px-2 py-2.5 text-center text-neutral-300">
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
                        <td key={loc.id} className="px-2 py-2 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${pillCls}`}
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
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500" />
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                {T(
                  'Peak-Hour Bottleneck Strip (12 PM – 1 AM)',
                  'شريط ساعات الذروة والاختناق بالمطابخ (12 ظهراً – 1 صباحاً)',
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                {T(
                  'Spotlights exact hours when red (>18m) tickets spike; click any hour bar to filter tickets.',
                  'يوضح متى تقفز الطلبات الحمراء (>18 دقيقة) خلال اليوم؛ اضغط على أي ساعة لتصفية التذاكر بالأسفل.',
                )}
              </p>
            </div>
          </div>

          {selectedHour !== null ? (
            <button
              type="button"
              onClick={() => setSelectedHour(null)}
              className="cursor-pointer rounded-full bg-[#F7F7F8] px-3 py-1 text-xs font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#111E1B] dark:text-slate-200"
            >
              {T('Clear Hour Filter ✕', 'إلغاء فلتر الساعة ✕')}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-7 gap-2 sm:grid-cols-14">
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
                className={`${SUBCARD_CLS} flex cursor-pointer flex-col items-center justify-between p-2.5 text-center transition-all duration-150 ${
                  active ? 'ring-2 ring-emerald-500' : 'hover:ring-1 hover:ring-neutral-300'
                }`}
              >
                <span className="text-[10.5px] font-semibold tabular-nums text-neutral-600 dark:text-slate-300">
                  {isAr ? h.labelAr : h.labelEn}
                </span>

                <div className="my-2 flex h-20 w-full items-end justify-center">
                  <div
                    style={{ height: `${barHeightPct}%` }}
                    className={`w-4 rounded-full transition-all ${barColor}`}
                  />
                </div>

                <div className="space-y-0.5 tabular-nums">
                  <div className="text-[11px] font-bold text-neutral-900 dark:text-white">
                    {h.totalTickets > 0 ? `${f1(h.avgPrepMinutes)}${isAr ? 'د' : 'm'}` : '—'}
                  </div>
                  <div
                    className={`text-[10px] font-semibold ${
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
            <h2 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
              {T(
                'Order Ticket Preparation Audit Ledger (12 Tickets / Page)',
                'سجل تدقيق تذاكر الطلبات الفردية (١٢ تذكرة بالصفحة)',
              )}
            </h2>
            <p className="text-xs text-neutral-400">
              {T(
                'Exact POS/KDS arrival -> ready timestamps, mm:ss prep duration, root cause, and 1-click Manager Bell escalation.',
                'توقيت وصول الطلب للفرع ولحظة جاهزيته بالدقيقة والثانية مع سبب التأخير وزر الرفع المباشر لجرس المدير.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Traffic-Light Filter Pills */}
            {(
              [
                { id: 'all', ar: 'الكل', en: 'All' },
                { id: 'green', ar: '🟢 أخضر — جيد', en: '🟢 Good' },
                { id: 'yellow', ar: '🟡 أصفر — وسط', en: '🟡 Medium' },
                { id: 'red', ar: '🔴 أحمر — خطر وسيء', en: '🔴 Critical' },
              ] as const
            ).map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setTierFilter(pill.id)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  tierFilter === pill.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : `${SUBCARD_CLS} text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-slate-200`
                }`}
              >
                {isAr ? pill.ar : pill.en}
              </button>
            ))}

            {/* Search Input */}
            <div className={`${SUBCARD_CLS} inline-flex h-8 items-center gap-1.5 px-3`}>
              <Search className="h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={T('Search order / branch…', 'ابحث برقم الطلب أو الفرع…')}
                className="w-36 bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white"
              />
            </div>

            {/* Pagination (`12 tickets/page`) */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="tabular-nums text-neutral-500 dark:text-slate-400">
                {safePage}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-700 hover:bg-emerald-50 disabled:opacity-40 dark:bg-[#111E1B] dark:text-slate-200"
                aria-label={T('Previous page', 'السابق')}
              >
                {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-700 hover:bg-emerald-50 disabled:opacity-40 dark:bg-[#111E1B] dark:text-slate-200"
                aria-label={T('Next page', 'التالي')}
              >
                {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-start text-xs">
            <thead>
              <tr className="border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 dark:border-white/[0.06]">
                <th className="py-2.5 pe-3 text-start">{T('Order ID', 'رقم الطلب')}</th>
                <th className="px-2.5 py-2.5 text-start">
                  {T('Arrived at Branch', 'لحظة وصول الطلب للفرع')}
                </th>
                <th className="px-2.5 py-2.5 text-start">
                  {T('Ready Handoff', 'لحظة جاهزية الطلب')}
                </th>
                <th className="px-2.5 py-2.5 text-start">
                  {T('Prep Duration', 'مدة التجهيز (mm:ss)')}
                </th>
                <th className="px-2.5 py-2.5 text-start">{T('Brand', 'البراند')}</th>
                <th className="px-2.5 py-2.5 text-start">{T('Branch', 'الفرع')}</th>
                <th className="px-2.5 py-2.5 text-start">{T('Channel', 'القناة')}</th>
                <th className="px-2.5 py-2.5 text-start">{T('Grade', 'التصنيف')}</th>
                <th className="px-2.5 py-2.5 text-start">{T('Delay Root Cause', 'التشخيص / سبب التأخير')}</th>
                <th className="py-2.5 ps-3 text-end">{T('Manager Bell', 'جرس المدير')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {visibleTickets.map((t) => {
                const refKey = `prep-sla-ticket:${t.orderId}`
                const queued = getApprovalByRef(refKey)
                return (
                  <tr
                    key={t.orderId}
                    className="transition-colors hover:bg-[#F7F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="py-3 pe-3 font-mono font-semibold tabular-nums text-neutral-950 dark:text-white">
                      <div>{t.orderId}</div>
                      <div className="font-sans text-[10.5px] font-normal text-neutral-400">
                        {t.dateIso}
                      </div>
                    </td>

                    <td dir="ltr" className="px-2.5 py-3 font-mono tabular-nums text-neutral-700 dark:text-slate-200">
                      {t.arrivedAt}
                    </td>

                    <td dir="ltr" className="px-2.5 py-3 font-mono tabular-nums text-neutral-700 dark:text-slate-200">
                      {t.readyAt}
                    </td>

                    <td className="px-2.5 py-3 tabular-nums">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-neutral-950 dark:text-white">
                        <Clock className="h-3 w-3 text-neutral-400" />
                        {t.durationMmSs}
                      </span>
                      <span className="ms-1 text-[10.5px] text-neutral-400">
                        ({f1(t.prepMinutes)} {isAr ? 'د' : 'm'})
                      </span>
                    </td>

                    <td className="px-2.5 py-3 font-semibold text-neutral-900 dark:text-white">
                      {isAr ? t.brandNameAr : t.brandNameEn}
                    </td>

                    <td className="px-2.5 py-3 font-medium text-neutral-700 dark:text-slate-200">
                      {isAr ? t.branchNameAr : t.branchNameEn}
                    </td>

                    <td className="px-2.5 py-3 text-neutral-600 dark:text-slate-300">
                      {isAr ? t.channelNameAr : t.channelNameEn}
                    </td>

                    <td className="px-2.5 py-3">
                      <PrepTrafficBadge tier={t.tier} isAr={isAr} />
                    </td>

                    <td className="max-w-[240px] px-2.5 py-3 text-[11.5px] leading-snug text-neutral-600 dark:text-slate-300">
                      {isAr ? t.delayRootCauseAr : t.delayRootCauseEn}
                    </td>

                    <td className="py-3 ps-3 text-end">
                      {queued ? (
                        <button
                          type="button"
                          onClick={() => openDrawer('approvals')}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-3 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{T('In Bell 🔔', 'بالجرس 🔔')}</span>
                        </button>
                      ) : t.tier !== 'green' ? (
                        <button
                          type="button"
                          onClick={() => handleEscalateTicketDelay(t)}
                          className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                            t.tier === 'red'
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-200'
                              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200'
                          }`}
                        >
                          <Bell className="h-3.5 w-3.5" />
                          <span>
                            {T(
                              'Escalate Kitchen Delay 🔔',
                              'رفع تنبيه تأخير المطبخ لجرس المدير 🔔',
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                          {T('On Time ✓', 'ضمن المعيار ✓')}
                        </span>
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
