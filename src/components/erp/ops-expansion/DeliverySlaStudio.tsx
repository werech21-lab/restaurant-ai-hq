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
  'ae-bento-card rounded-2xl border border-neutral-200/70 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:bg-[#0D1614]'
const KPI_CLS =
  'ae-kpi-card rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:bg-[#0D1614]'
const SUBCARD_CLS = 'rounded-2xl bg-[#F7F7F8] dark:bg-[#111E1B]'
const INPUT_CLS =
  'h-10 w-full rounded-xl border border-neutral-200/70 bg-[#F7F7F8] px-3.5 text-[14px] font-medium text-neutral-900 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-white dark:focus:bg-[#0D1614]'

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
            className="cursor-pointer rounded-full border border-emerald-300/70 bg-white px-3 py-1 text-[12.5px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-[#0D1614] dark:text-emerald-200"
          >
            {isAr ? 'فتح جرس المدير' : 'Open Bell'}
          </button>
        </div>
      )}

      {/* ───────────── 1. Header & Traffic-Light SLA Rules ───────────── */}
      <header className={CARD_CLS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Bike className="h-3.5 w-3.5" />
                {isAr
                  ? 'قياس صافي زمن الطريق: لحظة استلام السائق ← تسليم الزبون'
                  : 'Pure Rider Transit SLA: Bag Pickup → Customer Doorstep'}
              </span>
              <span className="inline-flex items-center rounded-full border border-neutral-200/80 bg-[#F7F7F8] px-3 py-1 text-[12px] font-medium text-neutral-600 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-slate-300">
                {isAr ? workspace.subtitleAr : workspace.subtitleEn}
              </span>
            </div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-neutral-950 sm:text-[26px] dark:text-white">
              {isAr
                ? 'مراقبة مدة توصيل الطلبات وتقييم الأداء اللوني'
                : 'Rider Delivery Duration SLA & Traffic-Light Monitor'}
            </h1>
            <p className="max-w-4xl text-[14px] leading-relaxed text-neutral-600 dark:text-slate-400">
              {isAr
                ? 'تتبع دقيق لمدة التوصيل من لحظة استلام السائق للكيس الجاهز ولغاية توصيله للزبون عبر الفروع الـ 7 والبراندات الـ 6 وأساطيل التوصيل، مرتبط مباشرة بشريط الفلتر العلوي الموحد.'
                : 'Monitors exact rider pickup-to-doorstep transit duration across all 7 branches, 6 brands, and 6 delivery fleets, synchronized directly with the unified global filter bar.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLogForm((v) => !v)}
              className="btn-colored inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
              style={{ color: '#FFFFFF' }}
            >
              <Plus className="h-4 w-4" />
              {isAr ? '+ تسجيل رحلة توصيل' : '+ Log Rider Trip'}
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-neutral-200/70 bg-[#F7F7F8] px-3.5 py-2 text-[13px] font-semibold text-neutral-800 transition hover:bg-neutral-200/70 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-slate-200"
            >
              {copiedSummary ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedSummary
                ? isAr
                  ? 'تم النسخ ✓'
                  : 'Copied ✓'
                : isAr
                  ? 'نسخ الملخص'
                  : 'Copy Summary'}
            </button>
          </div>
        </div>

        {/* Strict 3-Tier Legend */}
        <div className={`mt-4 grid grid-cols-1 gap-3 p-3 sm:grid-cols-3 ${SUBCARD_CLS}`}>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200/60 bg-white px-4 py-2.5 dark:border-white/[0.06] dark:bg-[#0D1614]">
            <span className="text-[13.5px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 أخضر — جيد (Good)' : '🟢 Green — Good'}
            </span>
            <span className="tabular-nums rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12.5px] font-extrabold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              ≤ 22.0 {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200/60 bg-white px-4 py-2.5 dark:border-white/[0.06] dark:bg-[#0D1614]">
            <span className="text-[13.5px] font-bold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 أصفر — متوسط (Warning)' : '🟡 Yellow — Average'}
            </span>
            <span className="tabular-nums rounded-full bg-amber-50 px-2.5 py-0.5 text-[12.5px] font-extrabold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              22.1 – 32.0 {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200/60 bg-white px-4 py-2.5 dark:border-white/[0.06] dark:bg-[#0D1614]">
            <span className="text-[13.5px] font-bold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 أحمر — حرج (Critical)' : '🔴 Red — Critical'}
            </span>
            <span className="tabular-nums rounded-full bg-rose-50 px-2.5 py-0.5 text-[12.5px] font-extrabold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              &gt; 32.0 {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
        </div>

        {/* Collapsible Trip Logger (inherits active Global Filter Brand/Branch, zero duplicate dropdowns) */}
        {showLogForm && (
          <form onSubmit={handleLogTrip} className={`mt-4 space-y-3.5 p-4 ${SUBCARD_CLS}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-bold text-neutral-900 dark:text-white">
                  {isAr
                    ? 'توثيق رحلة توصيل ميدانية جديدة:'
                    : 'Log Field Rider Trip:'}
                </span>
                <span className="rounded-full border border-neutral-200/80 bg-white px-3 py-0.5 text-[12.5px] font-semibold text-neutral-700 dark:border-white/[0.08] dark:bg-[#0D1614] dark:text-slate-300">
                  {getBrandLabel(resolvedBrand, isAr)} · {getBranchLabel(resolvedBranch, isAr)}
                </span>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12.5px] font-extrabold tabular-nums ${tierBadgeCls(previewGrade.tier)}`}
              >
                {tierEmoji(previewGrade.tier)} {previewMins.toFixed(1)} {isAr ? 'د — ' : 'm — '}
                {isAr ? previewGrade.labelAr : previewGrade.labelEn}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {DELIVERY_FLEETS.map((fl) => {
                const active = fFleet === fl.id
                return (
                  <button
                    key={fl.id}
                    type="button"
                    onClick={() => setFFleet(fl.id)}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      active
                        ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                        : 'border border-neutral-200/70 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-white/[0.08] dark:bg-[#0D1614] dark:text-slate-300'
                    }`}
                    style={active ? { color: '#FFFFFF' } : undefined}
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
      </header>

      {/* ───────────── 2. KPI Summary Strip (28px–32px Crisp Values) ───────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-neutral-500 dark:text-slate-400">
              {isAr ? 'متوسط مدة التوصيل للزبون' : 'Mean Pickup-to-Door'}
            </span>
            <Timer className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight text-neutral-950 dark:text-white">
              {snap.meanMinutes.toFixed(1)}
            </span>
            <span className="text-[13.5px] font-bold text-neutral-500">
              {isAr ? 'دقيقة' : 'min'}
            </span>
            <span
              className={`ms-auto rounded-full px-2.5 py-0.5 text-[12px] font-extrabold ${tierBadgeCls(snap.overallTier)}`}
            >
              {tierEmoji(snap.overallTier)}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr ? `إجمالي ${snap.totalTrips} رحلة موثقة` : `Across ${snap.totalTrips} audited trips`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 أخضر — جيد (≤ 22 د)' : '🟢 Green — Good (≤22m)'}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">
              {snap.greenPct.toFixed(1)}%
            </span>
            <span className="text-[13px] font-semibold text-neutral-500">
              ({snap.greenCount})
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-slate-400">
            {isAr ? 'وصول ساخن ومقرمش للزبون' : 'Arrived hot & crisp on time'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 أصفر — متوسط (22–32 د)' : '🟡 Yellow — Avg (22–32m)'}
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight text-amber-700 dark:text-amber-300">
              {snap.yellowPct.toFixed(1)}%
            </span>
            <span className="text-[13px] font-semibold text-neutral-500">
              ({snap.yellowCount})
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-slate-400">
            {isAr ? 'إنذار مبكر — زحمة ذروة أو مشي مولات' : 'Peak traffic or mall walk window'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 أحمر حرج (> 32 د)' : '🔴 Red Critical (>32m)'}
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight text-rose-700 dark:text-rose-300">
              {snap.redPct.toFixed(1)}%
            </span>
            <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {snap.coldFoodRiskOrders} {isAr ? 'حرج' : 'critical'}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-rose-700/90 dark:text-rose-300/90 tabular-nums">
            {isAr
              ? `مطالبات تعويض مقدرة ~${snap.estimatedClaimableKwd} ${kwd}/شهر`
              : `Est. SLA claim value ~${snap.estimatedClaimableKwd} ${kwd}/mo`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-neutral-500 dark:text-slate-400">
              {isAr ? 'الأسرع مقابل الأبطأ' : 'Fastest vs Slowest'}
            </span>
            <Trophy className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2 tabular-nums">
            <span className="text-[28px] sm:text-[32px] leading-none font-extrabold tracking-tight text-emerald-700 dark:text-emerald-300">
              {snap.bestFleet.meanMinutes.toFixed(1)}
            </span>
            <span className="text-[13px] font-semibold text-neutral-500">
              {isAr ? `د (${snap.bestFleet.shortAr})` : `m (${snap.bestFleet.shortEn})`}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `الأبطأ: ${snap.worstFleet.shortAr} (${snap.worstFleet.meanMinutes.toFixed(1)} د)`
              : `Slowest: ${snap.worstFleet.shortEn} (${snap.worstFleet.meanMinutes.toFixed(1)}m)`}
          </p>
        </div>
      </section>

      {/* ───────────── 3. Branch x Fleet Average Matrix (7 Branches x 6 Fleets) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'مصفوفة متوسط مدة التوصيل: الفروع السبعة × أساطيل ومنصات التوصيل'
                : 'Branch × Delivery Fleet Mean Transit Matrix (Minutes & Traffic-Light)'}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? 'تُظهر بالضبط أين يتفوق أسطولنا الداخلي و TMP مقابل تأخيرات دمج الطلبات في المولات'
                : 'Pinpoints exact pickup-to-doorstep averages per branch and delivery fleet'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-start text-[14px] sm:text-[14.5px] tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-[#F7F7F8] text-[12.5px] font-bold text-neutral-600 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-slate-300">
                <th className="px-4 py-3 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                {DELIVERY_FLEETS.map((fl) => (
                  <th key={fl.id} className="px-3 py-3 text-center">
                    {isAr ? fl.shortAr : fl.shortEn}
                  </th>
                ))}
                <th className="px-4 py-3 text-center">
                  {isAr ? 'متوسط الفرع' : 'Branch Mean'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {snap.branchFleetMatrix.map((row) => (
                <tr
                  key={row.branchId}
                  className="transition hover:bg-[#F7F7F8]/70 dark:hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3.5 font-bold text-neutral-950 dark:text-white">
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
              <tr className="border-t border-neutral-200/80 bg-[#F7F7F8] font-extrabold text-neutral-950 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-white">
                <td className="px-4 py-3.5">
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

          <div className="flex flex-wrap items-center gap-2">
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

            <div className="flex flex-wrap items-center gap-1.5">
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
                    onClick={() => setTierFilter(p.id)}
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
                      active
                        ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                        : 'border border-neutral-200/70 bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-slate-300'
                    }`}
                    style={active ? { color: '#FFFFFF' } : undefined}
                  >
                    {isAr ? p.ar : p.en}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-start text-[14px] sm:text-[14.5px] tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-[#F7F7F8] text-[12.5px] font-bold text-neutral-600 dark:border-white/[0.08] dark:bg-[#111E1B] dark:text-slate-300">
                <th className="px-3.5 py-3 text-start">{isAr ? 'رقم الطلب' : 'Order Ref'}</th>
                <th className="px-3.5 py-3 text-start">{isAr ? 'المطعم والفرع' : 'Brand & Branch'}</th>
                <th className="px-3.5 py-3 text-start">{isAr ? 'المنصة والسائق' : 'Fleet & Rider'}</th>
                <th className="px-3 py-3 text-center">{isAr ? 'الاستلام' : 'Pickup'}</th>
                <th className="px-3 py-3 text-center">{isAr ? 'التسليم' : 'Delivered'}</th>
                <th className="px-3 py-3 text-center">{isAr ? 'المدة الصافية' : 'Transit'}</th>
                <th className="px-3.5 py-3 text-start">{isAr ? 'المنطقة والملاحظة' : 'Zone & Audit Note'}</th>
                <th className="px-3 py-3 text-center">{isAr ? 'الحالة' : 'SLA Tier'}</th>
                <th className="px-3.5 py-3 text-end">{isAr ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {paginatedTrips.map((t) => {
                const claimStatus = getApprovalByRef(`delivery-sla-claim-${t.orderRef}`)
                return (
                  <tr
                    key={t.id}
                    className="transition hover:bg-[#F7F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="px-3.5 py-3.5 font-mono font-bold text-neutral-950 dark:text-white">
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
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-neutral-200/70 bg-white px-3 text-[12.5px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#0D1614] dark:text-slate-200"
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
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-neutral-200/70 bg-white px-3 text-[12.5px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#0D1614] dark:text-slate-200"
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
