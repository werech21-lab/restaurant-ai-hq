'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bike,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Plus,
  Search,
  Timer,
  Trophy,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  getBranchLabel,
  getBrandLabel,
} from '@/lib/aether/global-filter-engine'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import {
  computeDeliverySlaSnapshot,
  DELIVERY_CUSTOM_TRIPS_STORAGE_KEY,
  DELIVERY_FLEETS,
  DELIVERY_SLA_GREEN_MAX,
  DELIVERY_SLA_YELLOW_MAX,
  gradeDeliveryMinutes,
  type BranchId,
  type BrandId,
  type DeliveryFleetId,
  type EnrichedRiderTrip,
  type RiderTripRecord,
  type TrafficLightTier,
} from '@/lib/ops-expansion-part2'

const PAGE_SIZE = 12

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
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-[#F6F7F8] px-3.5 text-[14px] font-medium text-neutral-900 ring-1 ring-slate-200/80 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-[#0B1410] dark:text-white dark:ring-emerald-500/15 dark:focus:bg-[#101C17]'

export function tierBadgeCls(tier: TrafficLightTier): string {
  if (tier === 'green') {
    return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
  }
  if (tier === 'yellow') {
    return 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
  }
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
}

function tierEmoji(tier: TrafficLightTier): string {
  if (tier === 'green') return '🟢'
  if (tier === 'yellow') return '🟡'
  return '🔴'
}

function diffHmMinutes(pickup: string, delivered: string): number {
  const parse = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
    if (!m) return null
    return Number(m[1]) * 60 + Number(m[2])
  }
  const a = parse(pickup)
  const b = parse(delivered)
  if (a === null || b === null) return 20
  let d = b - a
  if (d < 0) d += 1440
  return Math.max(1, Math.min(180, d))
}

export function DeliverySlaStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { filters, workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [customTrips, setCustomTrips] = useState<RiderTripRecord[]>([])
  const [tierFilter, setTierFilter] = useState<'all' | TrafficLightTier>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showLogForm, setShowLogForm] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)

  // Field trip logger state (inherits global Brand & Branch automatically when scoped)
  const [fFleet, setFFleet] = useState<DeliveryFleetId>('internal-fleet')
  const [fDriver, setFDriver] = useState('')
  const [fZone, setFZone] = useState('')
  const [fPickup, setFPickup] = useState('19:15')
  const [fDelivered, setFDelivered] = useState('19:33')
  const [fOrderKwd, setFOrderKwd] = useState('8.50')

  const resolvedBrand: BrandId = useMemo(
    () =>
      filters.brand !== 'all' && (APPROVED_BRAND_IDS as readonly string[]).includes(filters.brand)
        ? (filters.brand as BrandId)
        : 'china-garden',
    [filters.brand],
  )

  const resolvedBranch: BranchId = useMemo(
    () =>
      filters.branch !== 'all' && (APPROVED_BRANCH_IDS as readonly string[]).includes(filters.branch)
        ? (filters.branch as BranchId)
        : 'salmiya',
    [filters.branch],
  )

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DELIVERY_CUSTOM_TRIPS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setCustomTrips(parsed)
      }
    } catch {}
  }, [])

  const snap = useMemo(
    () => computeDeliverySlaSnapshot(workspace, customTrips),
    [workspace, customTrips],
  )

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return snap.trips.filter((t) => {
      if (tierFilter !== 'all' && t.tier !== tierFilter) return false
      if (!q) return true
      return (
        t.orderRef.toLowerCase().includes(q) ||
        t.driverAr.toLowerCase().includes(q) ||
        t.driverEn.toLowerCase().includes(q) ||
        t.zoneAr.toLowerCase().includes(q) ||
        t.zoneEn.toLowerCase().includes(q) ||
        t.brandAr.toLowerCase().includes(q) ||
        t.brandEn.toLowerCase().includes(q) ||
        t.branchAr.toLowerCase().includes(q) ||
        t.branchEn.toLowerCase().includes(q) ||
        t.fleetAr.toLowerCase().includes(q) ||
        t.fleetEn.toLowerCase().includes(q)
      )
    })
  }, [snap.trips, tierFilter, searchQuery])

  useEffect(() => {
    setPage(1)
  }, [
    tierFilter,
    searchQuery,
    filters.brand,
    filters.branch,
    filters.channel,
    filters.period,
    filters.kuwaitSlice,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedTrips = useMemo(
    () => filteredTrips.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredTrips, safePage],
  )

  const previewMins = useMemo(() => diffHmMinutes(fPickup, fDelivered), [fPickup, fDelivered])
  const previewGrade = useMemo(() => gradeDeliveryMinutes(previewMins), [previewMins])

  const handleLogTrip = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const rec: RiderTripRecord = {
        id: `dlv-custom-${Date.now()}`,
        orderRef: `VF-${Math.floor(89000 + Math.random() * 900)}`,
        date: new Date().toISOString().slice(0, 10),
        brandId: resolvedBrand,
        branchId: resolvedBranch,
        fleetId: fFleet,
        driverAr: fDriver.trim() || 'سائق موثق',
        driverEn: fDriver.trim() || 'Verified Rider',
        pickupTimestamp: fPickup,
        deliveredTimestamp: fDelivered,
        transitMinutes: previewMins,
        zoneAr: fZone.trim() || 'منطقة العميل',
        zoneEn: fZone.trim() || 'Customer Zone',
        distanceKm: 3.2,
        orderKwd: Math.max(1, Number(fOrderKwd) || 8.5),
        auditNoteAr: `توثيق ميداني: استلام ${fPickup} وتسليم ${fDelivered}`,
        auditNoteEn: `Field log: pickup ${fPickup} -> handoff ${fDelivered}`,
      }
      const next = [rec, ...customTrips]
      setCustomTrips(next)
      try {
        window.localStorage.setItem(DELIVERY_CUSTOM_TRIPS_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      setShowLogForm(false)
      setFDriver('')
      setFZone('')
    },
    [
      customTrips,
      fDelivered,
      fDriver,
      fFleet,
      fOrderKwd,
      fPickup,
      fZone,
      previewMins,
      resolvedBranch,
      resolvedBrand,
    ],
  )

  const handleEscalateRedTrip = useCallback(
    (trip: EnrichedRiderTrip) => {
      requestApproval({
        refKey: `delivery-sla-claim-${trip.orderRef}`,
        domain: 'delivery-radar',
        titleAr: `مطالبة تعويض وتنبيه تأخير أحمر (${trip.transitMinutes.toFixed(1)} د) — طلب ${trip.orderRef}`,
        titleEn: `Red Delivery Delay Claim (${trip.transitMinutes.toFixed(1)}m) — Order ${trip.orderRef}`,
        summaryAr: `تأخر توصيل الطلب ${trip.orderRef} (${trip.brandAr} · ${trip.branchAr} ← ${trip.zoneAr}) عبر ${trip.fleetAr} من ${trip.pickupTimestamp} حتى ${trip.deliveredTimestamp} (${trip.transitMinutes.toFixed(1)} دقيقة > 32 د). رفع مطالبة تعويض للمنصة وتعميم منع دمج الطلبات.`,
        summaryEn: `Order ${trip.orderRef} (${trip.brandEn} · ${trip.branchEn} -> ${trip.zoneEn}) via ${trip.fleetEn} took ${trip.transitMinutes.toFixed(1)}m (${trip.pickupTimestamp}–${trip.deliveredTimestamp}). Submit aggregator SLA claim & block order stacking.`,
        departmentAr: 'إدارة التشغيل ورقابة التوصيل',
        departmentEn: 'Operations & Delivery SLA Control',
        budgetOrCostKwd: Number(trip.orderKwd.toFixed(2)),
        expectedMonthlyReturnKwd: Math.max(320, snap.estimatedClaimableKwd),
        href: '/erp/delivery-sla',
      })
      setToastMsg({
        ar: `تم تصعيد تأخير الرحلة ${trip.orderRef} إلى جرس المدير 🔔`,
        en: `Escalated red trip ${trip.orderRef} to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [requestApproval, snap.estimatedClaimableKwd],
  )

  const handleCopyReport = useCallback(async () => {
    const txt = isAr
      ? [
          `🛵 *تقرير مراقبة مدة توصيل الطلبات (استلام السائق ← باب الزبون)*`,
          `النطاق: ${workspace.subtitleAr}`,
          `• المتوسط العام: *${snap.meanMinutes.toFixed(1)} دقيقة*`,
          `• 🟢 أخضر جيد (≤ ${DELIVERY_SLA_GREEN_MAX} د): *${snap.greenPct}%* (${snap.greenCount})`,
          `• 🟡 أصفر متوسط (22.1–${DELIVERY_SLA_YELLOW_MAX} د): *${snap.yellowPct}%* (${snap.yellowCount})`,
          `• 🔴 أحمر حرج (> ${DELIVERY_SLA_YELLOW_MAX} د): *${snap.redPct}%* (${snap.redCount})`,
          `• الأسرع: ${snap.bestFleet.shortAr} (${snap.bestFleet.meanMinutes.toFixed(1)} د) | الأبطأ: ${snap.worstFleet.shortAr} (${snap.worstFleet.meanMinutes.toFixed(1)} د)`,
        ].join('\n')
      : [
          `🛵 *Venture Foods Rider Delivery Duration SLA Report*`,
          `Scope: ${workspace.subtitleEn}`,
          `• Overall Mean: *${snap.meanMinutes.toFixed(1)} min*`,
          `• 🟢 Good (<=22m): ${snap.greenPct}% | 🟡 Average (22.1–32m): ${snap.yellowPct}% | 🔴 Critical (>32m): ${snap.redPct}%`,
          `• Fastest Fleet: ${snap.bestFleet.shortEn} (${snap.bestFleet.meanMinutes.toFixed(1)}m) vs Slowest: ${snap.worstFleet.shortEn} (${snap.worstFleet.meanMinutes.toFixed(1)}m)`,
        ].join('\n')
    try {
      await navigator.clipboard.writeText(txt)
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    } catch {}
  }, [isAr, snap, workspace.subtitleAr, workspace.subtitleEn])

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

      {/* ───────────── 1. Slim Contextual Bar & Collapsible Trip Logger ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <Bike className="h-4 w-4" />
            </span>
            <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
              {isAr
                ? `استلام السائق ← باب الزبون • 🟢 ≤ 22 د • 🟡 22.1–32 د • 🔴 > 32 د • ${workspace.subtitleAr}`
                : `Pickup → Doorstep • 🟢 ≤ 22m • 🟡 22.1–32m • 🔴 > 32m • ${workspace.subtitleEn}`}
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setShowLogForm((v) => !v)}
              className="btn-colored inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 text-[13px] font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              style={{ color: '#FFFFFF' }}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{isAr ? '+ تسجيل رحلة توصيل' : '+ Log Rider Trip'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#F6F7F8] px-3.5 text-[13px] font-semibold text-neutral-800 ring-1 ring-slate-900/[0.05] transition hover:bg-neutral-200/70 dark:bg-[#0B1410] dark:text-slate-200 dark:ring-emerald-500/15"
            >
              {copiedSummary ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4 shrink-0" />
              )}
              <span>
                {copiedSummary
                  ? isAr
                    ? 'تم النسخ ✓'
                    : 'Copied ✓'
                  : isAr
                    ? 'نسخ الملخص'
                    : 'Copy Summary'}
              </span>
            </button>
          </div>
        </div>

        {/* Collapsible Trip Logger (inherits active Global Filter Brand/Branch, zero duplicate dropdowns) */}
        {showLogForm && (
          <form onSubmit={handleLogTrip} className={`mt-3.5 space-y-3.5 p-3.5 sm:p-4 ${SUBCARD_CLS}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'توثيق رحلة توصيل ميدانية جديدة:' : 'Log Field Rider Trip:'}
                </span>
                <span className="rounded-xl bg-white px-2.5 py-0.5 text-[12px] font-semibold text-neutral-700 ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:text-slate-300 dark:ring-emerald-500/15">
                  {getBrandLabel(resolvedBrand, isAr)} · {getBranchLabel(resolvedBranch, isAr)}
                </span>
              </div>
              <span
                className={`rounded-xl px-3 py-1 text-[12px] font-extrabold tabular-nums ${tierBadgeCls(previewGrade.tier)}`}
              >
                {tierEmoji(previewGrade.tier)} {previewMins.toFixed(1)} {isAr ? 'د — ' : 'm — '}
                {isAr ? previewGrade.labelAr : previewGrade.labelEn}
              </span>
            </div>

            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              {DELIVERY_FLEETS.map((fl) => {
                const active = fFleet === fl.id
                return (
                  <button
                    key={fl.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFFleet(fl.id)}
                    className={`${SEGMENT_BTN_CLS} ${
                      active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? fl.shortAr : fl.shortEn}
                  </button>
                )
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input
                type="text"
                placeholder={isAr ? 'اسم السائق / رقم الكابتن' : 'Driver / Rider Name'}
                value={fDriver}
                onChange={(e) => setFDriver(e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder={isAr ? 'المنطقة / القطعة' : 'Zone / Area'}
                value={fZone}
                onChange={(e) => setFZone(e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="time"
                value={fPickup}
                onChange={(e) => setFPickup(e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
                title={isAr ? 'وقت استلام السائق' : 'Pickup Time'}
              />
              <input
                type="time"
                value={fDelivered}
                onChange={(e) => setFDelivered(e.target.value)}
                className={`${INPUT_CLS} tabular-nums`}
                title={isAr ? 'وقت التسليم للزبون' : 'Delivered Time'}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={fOrderKwd}
                  onChange={(e) => setFOrderKwd(e.target.value)}
                  className={`${INPUT_CLS} tabular-nums`}
                  placeholder={kwd}
                />
                <button
                  type="submit"
                  className="btn-colored h-10 shrink-0 cursor-pointer rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700"
                  style={{ color: '#FFFFFF' }}
                >
                  {isAr ? 'حفظ ✓' : 'Save ✓'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ───────────── 2. KPI Summary Strip (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
              {isAr ? 'متوسط التوصيل للزبون' : 'Mean Pickup-to-Door'}
            </span>
            <Timer className="h-4 w-4 shrink-0 text-neutral-400" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {snap.meanMinutes.toFixed(1)}
            </span>
            <span className="text-[12px] sm:text-[13.5px] font-semibold text-neutral-500">
              {isAr ? 'د' : 'min'}
            </span>
            <span
              className={`ms-auto rounded-lg px-2 py-0.5 text-[11px] font-bold ${tierBadgeCls(snap.overallTier)}`}
            >
              {tierEmoji(snap.overallTier)}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `${snap.totalTrips} رحلة • الأسرع: ${snap.bestFleet.shortAr} (${snap.bestFleet.meanMinutes.toFixed(1)} د)`
              : `${snap.totalTrips} trips • Best: ${snap.bestFleet.shortEn} (${snap.bestFleet.meanMinutes.toFixed(1)}m)`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 جيد (≤ 22 د)' : '🟢 Good (≤22m)'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
              {snap.greenPct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">({snap.greenCount})</span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {isAr ? 'وصول ساخن ومقرمش للزبون' : 'Arrived hot & crisp on time'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 متوسط (22–32 د)' : '🟡 Avg (22–32m)'}
            </span>
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-amber-700 dark:text-amber-300">
              {snap.yellowPct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">({snap.yellowCount})</span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {isAr ? 'زحمة ذروة أو مشي مولات' : 'Peak traffic or mall walk'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 حرج (> 32 د)' : '🔴 Critical (>32m)'}
            </span>
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-rose-700 dark:text-rose-300">
              {snap.redPct.toFixed(1)}%
            </span>
            <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {snap.coldFoodRiskOrders}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] sm:text-[12.5px] leading-snug text-rose-700/90 tabular-nums dark:text-rose-300/90">
            {isAr
              ? `تعويض مقدر ~${snap.estimatedClaimableKwd} ${kwd}/شهر`
              : `Claimable ~${snap.estimatedClaimableKwd} ${kwd}/mo`}
          </p>
        </div>
      </section>

      {/* ───────────── 3. Branch x Fleet Average Matrix (7 Branches x 6 Fleets) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] sm:text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'مصفوفة متوسط مدة التوصيل: الفروع السبعة × أساطيل ومنصات التوصيل'
                : 'Branch × Delivery Fleet Mean Transit Matrix (Minutes & Traffic-Light)'}
            </h2>
            <p className="text-[13px] sm:text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? 'تُظهر بالضبط أين يتفوق أسطولنا الداخلي و TMP مقابل تأخيرات دمج الطلبات في المولات'
                : 'Pinpoints exact pickup-to-doorstep averages per branch and delivery fleet'}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Trophy className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {isAr
                ? `${snap.bestFleet.shortAr} (${snap.bestFleet.meanMinutes.toFixed(1)} د) مقابل ${snap.worstFleet.shortAr} (${snap.worstFleet.meanMinutes.toFixed(1)} د)`
                : `${snap.bestFleet.shortEn} (${snap.bestFleet.meanMinutes.toFixed(1)}m) vs ${snap.worstFleet.shortEn} (${snap.worstFleet.meanMinutes.toFixed(1)}m)`}
            </span>
          </span>
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[920px] border-collapse text-start text-[14px] sm:text-[14.5px] tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-[#F6F7F8] text-[12.5px] font-bold text-neutral-600 dark:border-white/[0.08] dark:bg-[#0B1410] dark:text-slate-300">
                <th className="sticky start-0 z-10 bg-[#F6F7F8] px-4 py-3 text-start whitespace-nowrap dark:bg-[#0B1410]">
                  {isAr ? 'الفرع' : 'Branch'}
                </th>
                {DELIVERY_FLEETS.map((fl) => (
                  <th key={fl.id} className="px-3 py-3 text-center whitespace-nowrap">
                    {isAr ? fl.shortAr : fl.shortEn}
                  </th>
                ))}
                <th className="px-4 py-3 text-center whitespace-nowrap">
                  {isAr ? 'متوسط الفرع' : 'Branch Mean'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {snap.branchFleetMatrix.map((row) => (
                <tr
                  key={row.branchId}
                  className="transition hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]"
                >
                  <td className="sticky start-0 z-10 bg-white px-4 py-3.5 font-bold whitespace-nowrap text-neutral-950 dark:bg-[#101C17] dark:text-white">
                    {isAr ? row.branchAr : row.branchEn}
                  </td>
                  {DELIVERY_FLEETS.map((fl) => {
                    const cell = row.cells[fl.id]
                    if (cell.meanMinutes === null || cell.tier === null) {
                      return (
                        <td key={fl.id} className="px-3 py-3.5 text-center text-neutral-300 dark:text-slate-600">
                          —
                        </td>
                      )
                    }
                    return (
                      <td key={fl.id} className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-bold ${tierBadgeCls(cell.tier)}`}
                        >
                          {tierEmoji(cell.tier)} {cell.meanMinutes.toFixed(1)}
                          {isAr ? ' د' : 'm'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-extrabold ${tierBadgeCls(row.overallTier)}`}
                    >
                      {tierEmoji(row.overallTier)} {row.overallMeanMinutes.toFixed(1)}
                      {isAr ? ' د' : 'm'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200/80 bg-[#F6F7F8] font-extrabold text-neutral-950 dark:border-white/[0.08] dark:bg-[#0B1410] dark:text-white">
                <td className="sticky start-0 z-10 bg-[#F6F7F8] px-4 py-3.5 whitespace-nowrap dark:bg-[#0B1410]">
                  {isAr ? 'متوسط الأسطول الكلي' : 'Fleet Overall Mean'}
                </td>
                {snap.fleetSummaries.map((fl) => (
                  <td key={fl.fleetId} className="px-3 py-3.5 text-center">
                    {fl.tripCount > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12.5px] font-extrabold ${tierBadgeCls(fl.tier)}`}
                      >
                        {tierEmoji(fl.tier)} {fl.meanMinutes.toFixed(1)}
                        {isAr ? ' د' : 'm'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                ))}
                <td className="px-4 py-3.5 text-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-extrabold ${tierBadgeCls(snap.overallTier)}`}
                  >
                    {tierEmoji(snap.overallTier)} {snap.meanMinutes.toFixed(1)}
                    {isAr ? ' د' : 'm'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ───────────── 4. Paginated Live Trip Audit Table (12 trips/page) ───────────── */}
      <section className={CARD_CLS}>
        <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'سجل تدقيق رحلات التوصيل الفعلي (١٢ رحلة لكل صفحة)'
                : 'Live Rider Trip Audit Log (12 Trips / Page)'}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? 'تظهر أزرار التصعيد فقط على الحالات الحرجة الحمراء (> 32 دقيقة) لمنع ضوضاء التنبيهات'
                : 'Compact escalation pill appears strictly on genuine Red (>32m) outliers'}
            </p>
          </div>

          <div className="flex max-w-full flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'بحث برقم الطلب أو السائق أو المنطقة...'
                    : 'Search order, rider, or zone...'
                }
                className={`${INPUT_CLS} h-9 ps-9 text-[13px]`}
              />
            </div>

            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              {(
                [
                  { id: 'all', ar: `الكل (${snap.totalTrips})`, en: `All (${snap.totalTrips})` },
                  { id: 'green', ar: `🟢 (${snap.greenCount})`, en: `🟢 (${snap.greenCount})` },
                  { id: 'yellow', ar: `🟡 (${snap.yellowCount})`, en: `🟡 (${snap.yellowCount})` },
                  { id: 'red', ar: `🔴 (${snap.redCount})`, en: `🔴 (${snap.redCount})` },
                ] as const
              ).map((p) => {
                const active = tierFilter === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTierFilter(p.id)}
                    className={`${SEGMENT_BTN_CLS} ${
                      active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? p.ar : p.en}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[1040px] border-collapse text-start text-[14px] sm:text-[14.5px] tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-[#F6F7F8] text-[12.5px] font-bold text-neutral-600 dark:border-white/[0.08] dark:bg-[#0B1410] dark:text-slate-300">
                <th className="sticky start-0 z-10 bg-[#F6F7F8] px-3.5 py-3 text-start whitespace-nowrap dark:bg-[#0B1410]">
                  {isAr ? 'رقم الطلب' : 'Order Ref'}
                </th>
                <th className="px-3.5 py-3 text-start whitespace-nowrap">{isAr ? 'المطعم والفرع' : 'Brand & Branch'}</th>
                <th className="px-3.5 py-3 text-start whitespace-nowrap">{isAr ? 'المنصة والسائق' : 'Fleet & Rider'}</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">{isAr ? 'الاستلام' : 'Pickup'}</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">{isAr ? 'التسليم' : 'Delivered'}</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">{isAr ? 'المدة الصافية' : 'Transit'}</th>
                <th className="px-3.5 py-3 text-start whitespace-nowrap">{isAr ? 'المنطقة والملاحظة' : 'Zone & Audit Note'}</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">{isAr ? 'الحالة' : 'SLA Tier'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {paginatedTrips.map((t) => {
                const claimStatus = getApprovalByRef(`delivery-sla-claim-${t.orderRef}`)
                return (
                  <tr
                    key={t.id}
                    className="transition hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky start-0 z-10 bg-white px-3.5 py-3.5 font-mono font-bold whitespace-nowrap text-neutral-950 dark:bg-[#101C17] dark:text-white">
                      <div>{t.orderRef}</div>
                      <div className="font-sans text-[12px] font-normal text-neutral-400">
                        {t.date} · {t.orderKwd.toFixed(2)} {kwd}
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {isAr ? t.brandAr : t.brandEn}
                      </div>
                      <div className="text-[12.5px] text-neutral-500 dark:text-slate-400">
                        {isAr ? t.branchAr : t.branchEn}
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5">
                      <div className="font-semibold text-neutral-800 dark:text-slate-200">
                        {isAr ? t.fleetAr : t.fleetEn}
                      </div>
                      <div className="text-[12.5px] text-neutral-500 dark:text-slate-400">
                        {isAr ? t.driverAr : t.driverEn}
                      </div>
                    </td>
                    <td
                      dir="ltr"
                      className="px-3 py-3.5 text-center font-mono font-medium text-neutral-700 dark:text-slate-200"
                    >
                      {t.pickupTimestamp}
                    </td>
                    <td
                      dir="ltr"
                      className="px-3 py-3.5 text-center font-mono font-medium text-neutral-700 dark:text-slate-200"
                    >
                      {t.deliveredTimestamp}
                    </td>
                    <td className="px-3 py-3.5 text-center font-mono font-extrabold text-neutral-950 dark:text-white">
                      {t.transitMinutes.toFixed(1)} {isAr ? 'د' : 'm'}
                    </td>
                    <td className="max-w-[260px] px-3.5 py-3.5">
                      <div className="font-medium text-neutral-800 dark:text-slate-200">
                        {isAr ? t.zoneAr : t.zoneEn}{' '}
                        <span className="text-[12px] text-neutral-400">
                          ({t.distanceKm.toFixed(1)} {isAr ? 'كم' : 'km'})
                        </span>
                      </div>
                      <div className="truncate text-[12.5px] text-neutral-500 dark:text-slate-400">
                        {isAr ? t.auditNoteAr : t.auditNoteEn}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold whitespace-nowrap ${tierBadgeCls(t.tier)}`}
                      >
                        {tierEmoji(t.tier)} {isAr ? t.tierLabelAr : t.tierLabelEn}
                      </span>
                    </td>
                    <td className="px-3.5 py-3.5 text-end">
                      {t.tier === 'red' ? (
                        claimStatus ? (
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
                            onClick={() => handleEscalateRedTrip(t)}
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
          </table>
        </div>

        {/* Pagination Footer (12 trips/page) */}
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-neutral-600 tabular-nums dark:text-slate-300 ${SUBCARD_CLS}`}
        >
          <span>
            {isAr
              ? `عرض ${filteredTrips.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredTrips.length)} من أصل ${filteredTrips.length} رحلة`
              : `Showing ${filteredTrips.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredTrips.length)} of ${filteredTrips.length} trips`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-neutral-200/70 bg-white px-3 text-[12.5px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#101C17] dark:text-slate-200"
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {isAr ? 'السابق' : 'Prev'}
            </button>
            <span className="px-2 font-extrabold text-neutral-900 dark:text-white">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-neutral-200/70 bg-white px-3 text-[12.5px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#101C17] dark:text-slate-200"
            >
              {isAr ? 'التالي' : 'Next'}
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
