'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  Bike,
  Check,
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
import { OpsFilterSyncBar } from '@/components/erp/ops-expansion/OpsFilterSyncBar'
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
  'ae-bento-card rounded-2xl bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]'
const KPI_CLS =
  'ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-[#F7F7F8] px-3 text-[13px] font-medium text-neutral-900 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-neutral-950 dark:text-white'

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
  const isAr = locale === 'ar'
  const kwd = isAr ? 'د.ك' : 'KWD'
  const { workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [customTrips, setCustomTrips] = useState<RiderTripRecord[]>([])
  const [tierFilter, setTierFilter] = useState<'all' | TrafficLightTier>('all')
  const [fleetFilter, setFleetFilter] = useState<'all' | DeliveryFleetId>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showLogForm, setShowLogForm] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  // Quick trip logger state
  const [fBrand, setFBrand] = useState<BrandId>('china-garden')
  const [fBranch, setFBranch] = useState<BranchId>('salmiya')
  const [fFleet, setFFleet] = useState<DeliveryFleetId>('internal-fleet')
  const [fDriver, setFDriver] = useState('')
  const [fZone, setFZone] = useState('')
  const [fPickup, setFPickup] = useState('19:15')
  const [fDelivered, setFDelivered] = useState('19:33')
  const [fOrderKwd, setFOrderKwd] = useState('8.50')

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
      if (fleetFilter !== 'all' && t.fleetId !== fleetFilter) return false
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
  }, [snap.trips, tierFilter, fleetFilter, searchQuery])

  useEffect(() => {
    setPage(1)
  }, [tierFilter, fleetFilter, searchQuery, workspace.filters])

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
        brandId: fBrand,
        branchId: fBranch,
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
    [customTrips, fBranch, fBrand, fDelivered, fDriver, fFleet, fOrderKwd, fPickup, fZone, previewMins],
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
      openDrawer('approvals')
    },
    [openDrawer, requestApproval, snap.estimatedClaimableKwd],
  )

  const handleCopyReport = useCallback(async () => {
    const txt = isAr
      ? [
          `🛵 *تقرير مراقبة مدة توصيل الطلبات (استلام السائق ← باب الزبون)*`,
          `النطاق: ${workspace.subtitleAr}`,
          `• المتوسط العام: *${snap.meanMinutes.toFixed(1)} دقيقة*`,
          `• 🟢 أخضر جيد (≤ ${DELIVERY_SLA_GREEN_MAX} د): *${snap.greenPct}%* (${snap.greenCount})`,
          `• 🟡 أصفر متوسط (22.1–${DELIVERY_SLA_YELLOW_MAX} د): *${snap.yellowPct}%* (${snap.yellowCount})`,
          `• 🔴 أحمر سيء للغاية (> ${DELIVERY_SLA_YELLOW_MAX} د): *${snap.redPct}%* (${snap.redCount} طلب مهدد ببرودة الأكل)`,
          `• الأسرع: ${snap.bestFleet.shortAr} (${snap.bestFleet.meanMinutes.toFixed(1)} د) | الأبطأ: ${snap.worstFleet.shortAr} (${snap.worstFleet.meanMinutes.toFixed(1)} د)`,
        ].join('\n')
      : [
          `🛵 *Venture Foods Rider Delivery Duration SLA Report*`,
          `Scope: ${workspace.subtitleEn}`,
          `• Overall Mean: *${snap.meanMinutes.toFixed(1)} min*`,
          `• 🟢 Good (<=22m): ${snap.greenPct}% | 🟡 Average (22.1–32m): ${snap.yellowPct}% | 🔴 Very Bad (>32m): ${snap.redPct}%`,
          `• Fastest Fleet: ${snap.bestFleet.shortEn} (${snap.bestFleet.meanMinutes.toFixed(1)}m) vs Slowest: ${snap.worstFleet.shortEn} (${snap.worstFleet.meanMinutes.toFixed(1)}m)`,
        ].join('\n')
    try {
      await navigator.clipboard.writeText(txt)
      setCopiedSummary(true)
      setTimeout(() => setCopiedSummary(false), 2000)
    } catch {}
  }, [isAr, snap, workspace.subtitleAr, workspace.subtitleEn])

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-[1520px] space-y-5 pb-12">
      <OpsFilterSyncBar />

      {/* ───────────── 1. Header & Traffic-Light SLA Rules ───────────── */}
      <header className={CARD_CLS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Bike className="h-3.5 w-3.5" />
                {isAr
                  ? 'قياس صافي زمن الطريق: لحظة استلام السائق ← تسليم الزبون'
                  : 'Pure Rider Transit SLA: Bag Pickup → Customer Doorstep'}
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl dark:text-white">
              {isAr
                ? 'مراقبة مدة توصيل الطلبات وتقييم الأداء اللوني'
                : 'Rider Delivery Duration SLA & Traffic-Light Monitor'}
            </h1>
            <p className="max-w-3xl text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              {isAr
                ? 'تتبع دقيق لمدة التوصيل من لحظة استلام السائق للكيس الجاهز ولغاية توصيله للزبون عبر الفروع الـ 7 والبراندات الـ 6 وأساطيل التوصيل، مع تقييم فوري بالعلامة الخضراء والصفراء والحمراء.'
                : 'Monitors exact rider pickup-to-doorstep transit duration across all 7 branches, 6 brands, and 6 delivery fleets with strict 3-tier traffic-light grading.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLogForm((v) => !v)}
              className="btn-colored inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
              style={{ color: '#FFFFFF' }}
            >
              <Plus className="h-4 w-4" />
              {isAr ? '+ تسجيل رحلة توصيل' : '+ Log Rider Trip'}
            </button>

            <button
              type="button"
              onClick={handleCopyReport}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#F7F7F8] px-3.5 py-2 text-[12px] font-bold text-neutral-800 transition hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-neutral-200"
            >
              {copiedSummary ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSummary
                ? isAr
                  ? 'تم النسخ ✅'
                  : 'Copied ✅'
                : isAr
                  ? 'نسخ الملخص للواتساب 📋'
                  : 'Copy Summary 📋'}
            </button>
          </div>
        </div>

        {/* Strict 3-Tier Legend */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 rounded-2xl bg-[#F7F7F8] p-3 sm:grid-cols-3 dark:bg-neutral-950">
          <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 dark:bg-neutral-900">
            <span className="text-[12.5px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 أخضر — جيد (Good)' : '🟢 Green — Good'}
            </span>
            <span className="tabular-nums rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-extrabold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              ≤ 22.0 {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 dark:bg-neutral-900">
            <span className="text-[12.5px] font-bold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 أصفر — متوسط (Warning)' : '🟡 Yellow — Average'}
            </span>
            <span className="tabular-nums rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-extrabold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              22.1 – 32.0 {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 dark:bg-neutral-900">
            <span className="text-[12.5px] font-bold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 أحمر — سيء للغاية (Severe)' : '🔴 Red — Very Bad'}
            </span>
            <span className="tabular-nums rounded-full bg-rose-50 px-2.5 py-0.5 text-[11.5px] font-extrabold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              &gt; 32.0 {isAr ? 'دقيقة' : 'min'}
            </span>
          </div>
        </div>

        {/* Collapsible Trip Logger */}
        {showLogForm && (
          <form
            onSubmit={handleLogTrip}
            className="mt-4 space-y-3 rounded-2xl bg-[#F7F7F8] p-4 dark:bg-neutral-950"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-extrabold text-neutral-900 dark:text-white">
                {isAr
                  ? 'توثيق رحلة توصيل جديدة (حساب فوري من الاستلام حتى باب الزبون)'
                  : 'Log New Delivery Trip (Instant Pickup-to-Doorstep Grading)'}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-[11.5px] font-extrabold tabular-nums ${tierBadgeCls(previewGrade.tier)}`}
              >
                {tierEmoji(previewGrade.tier)} {previewMins.toFixed(1)} {isAr ? 'د — ' : 'm — '}
                {isAr ? previewGrade.labelAr : previewGrade.labelEn}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={fBrand}
                onChange={(e) => setFBrand(e.target.value as BrandId)}
                className={INPUT_CLS}
              >
                {APPROVED_BRAND_IDS.map((b) => (
                  <option key={b} value={b}>
                    {getBrandLabel(b, isAr)}
                  </option>
                ))}
              </select>

              <select
                value={fBranch}
                onChange={(e) => setFBranch(e.target.value as BranchId)}
                className={INPUT_CLS}
              >
                {APPROVED_BRANCH_IDS.map((br) => (
                  <option key={br} value={br}>
                    {getBranchLabel(br, isAr)}
                  </option>
                ))}
              </select>

              <select
                value={fFleet}
                onChange={(e) => setFFleet(e.target.value as DeliveryFleetId)}
                className={INPUT_CLS}
              >
                {DELIVERY_FLEETS.map((fl) => (
                  <option key={fl.id} value={fl.id}>
                    {isAr ? fl.ar : fl.en}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder={isAr ? 'اسم السائق / رقم الكابتن' : 'Driver / Rider Name'}
                value={fDriver}
                onChange={(e) => setFDriver(e.target.value)}
                className={INPUT_CLS}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="text"
                placeholder={isAr ? 'المنطقة / القطعة' : 'Zone / Area'}
                value={fZone}
                onChange={(e) => setFZone(e.target.value)}
                className={INPUT_CLS}
              />
              <div>
                <input
                  type="time"
                  value={fPickup}
                  onChange={(e) => setFPickup(e.target.value)}
                  className={`${INPUT_CLS} tabular-nums`}
                  title={isAr ? 'وقت استلام السائق' : 'Pickup Time'}
                />
              </div>
              <div>
                <input
                  type="time"
                  value={fDelivered}
                  onChange={(e) => setFDelivered(e.target.value)}
                  className={`${INPUT_CLS} tabular-nums`}
                  title={isAr ? 'وقت التسليم للزبون' : 'Delivered Time'}
                />
              </div>
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
                  className="btn-colored h-10 shrink-0 cursor-pointer rounded-xl bg-emerald-600 px-4 text-[12.5px] font-bold text-white hover:bg-emerald-700"
                  style={{ color: '#FFFFFF' }}
                >
                  {isAr ? 'حفظ ✅' : 'Save ✅'}
                </button>
              </div>
            </div>
          </form>
        )}
      </header>

      {/* ───────────── 2. KPI Summary Strip ───────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'متوسط مدة التوصيل للزبون' : 'Mean Pickup-to-Door'}
            </span>
            <Timer className="h-4 w-4 text-neutral-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-neutral-950 dark:text-white">
              {snap.meanMinutes.toFixed(1)}
            </span>
            <span className="text-[12.5px] font-bold text-neutral-500">
              {isAr ? 'دقيقة' : 'min'}
            </span>
            <span
              className={`ms-auto rounded-full px-2 py-0.5 text-[11px] font-extrabold ${tierBadgeCls(snap.overallTier)}`}
            >
              {tierEmoji(snap.overallTier)}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr ? `إجمالي ${snap.totalTrips} رحلة موثقة` : `Across ${snap.totalTrips} audited trips`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 أخضر — جيد (≤ 22 د)' : '🟢 Green — Good (≤22m)'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {snap.greenPct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              ({snap.greenCount})
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            {isAr ? 'وصول ساخن ومقرمش للزبون' : 'Arrived hot & crisp on time'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 أصفر — متوسط (22–32 د)' : '🟡 Yellow — Avg (22–32m)'}
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
              {snap.yellowPct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              ({snap.yellowCount})
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            {isAr ? 'إنذار مبكر — زحمة أو مشي مولات' : 'Warning zone — traffic or mall walk'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 أحمر سيء + خطر برودة' : '🔴 Red (>32m) & Cold Risk'}
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">
              {snap.redPct.toFixed(1)}%
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {snap.coldFoodRiskOrders} {isAr ? 'طلب حرج' : 'at risk'}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-rose-700/90 dark:text-rose-300/90 tabular-nums">
            {isAr
              ? `مطالبات تعويض مقدرة ~${snap.estimatedClaimableKwd} ${kwd}/شهر`
              : `Est. SLA claim value ~${snap.estimatedClaimableKwd} ${kwd}/mo`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'الأفضل مقابل الأبطأ' : 'Best vs Worst Fleet'}
            </span>
            <Trophy className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 space-y-1 text-[12px] tabular-nums">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                🟢 {isAr ? snap.bestFleet.shortAr : snap.bestFleet.shortEn}
              </span>
              <span className="font-extrabold text-neutral-900 dark:text-white">
                {snap.bestFleet.meanMinutes.toFixed(1)} {isAr ? 'د' : 'm'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-700 dark:text-rose-300">
                🔴 {isAr ? snap.worstFleet.shortAr : snap.worstFleet.shortEn}
              </span>
              <span className="font-extrabold text-neutral-900 dark:text-white">
                {snap.worstFleet.meanMinutes.toFixed(1)} {isAr ? 'د' : 'm'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── 3. Branch x Fleet Average Matrix (7 Branches x 6 Fleets) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'مصفوفة متوسط مدة التوصيل: الفروع السبعة × أساطيل ومنصات التوصيل'
                : 'Branch × Delivery Fleet Mean Transit Matrix (Minutes & Traffic-Light)'}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'تُظهر بالضبط أين يتفوق أسطولنا الداخلي و TMP مقابل تأخيرات دمج الطلبات في الفروع والمولات'
                : 'Pinpoints exact pickup-to-doorstep averages per branch and delivery fleet'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-start text-[12.5px] tabular-nums">
            <thead>
              <tr className="rounded-xl bg-[#F7F7F8] text-[11.5px] font-bold text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                <th className="px-3.5 py-3 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                {DELIVERY_FLEETS.map((fl) => (
                  <th key={fl.id} className="px-3 py-3 text-center">
                    {isAr ? fl.shortAr : fl.shortEn}
                  </th>
                ))}
                <th className="px-3.5 py-3 text-center">
                  {isAr ? 'متوسط الفرع' : 'Branch Mean'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {snap.branchFleetMatrix.map((row) => (
                <tr
                  key={row.branchId}
                  className="transition hover:bg-[#F7F7F8]/70 dark:hover:bg-neutral-800/30"
                >
                  <td className="px-3.5 py-3 font-extrabold text-neutral-950 dark:text-white">
                    {isAr ? row.branchAr : row.branchEn}
                  </td>
                  {DELIVERY_FLEETS.map((fl) => {
                    const cell = row.cells[fl.id]
                    if (cell.meanMinutes === null || cell.tier === null) {
                      return (
                        <td key={fl.id} className="px-3 py-3 text-center text-neutral-400">
                          —
                        </td>
                      )
                    }
                    return (
                      <td key={fl.id} className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${tierBadgeCls(cell.tier)}`}
                        >
                          {tierEmoji(cell.tier)} {cell.meanMinutes.toFixed(1)}
                          {isAr ? ' د' : 'm'}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3.5 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold ${tierBadgeCls(row.overallTier)}`}
                    >
                      {tierEmoji(row.overallTier)} {row.overallMeanMinutes.toFixed(1)}
                      {isAr ? ' د' : 'm'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F7F7F8] font-extrabold text-neutral-900 dark:bg-neutral-950 dark:text-white">
                <td className="px-3.5 py-3">
                  {isAr ? 'متوسط الأسطول الكلي' : 'Fleet Overall Mean'}
                </td>
                {snap.fleetSummaries.map((fl) => (
                  <td key={fl.fleetId} className="px-3 py-3 text-center">
                    {fl.tripCount > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold ${tierBadgeCls(fl.tier)}`}
                      >
                        {tierEmoji(fl.tier)} {fl.meanMinutes.toFixed(1)}
                        {isAr ? ' د' : 'm'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                ))}
                <td className="px-3.5 py-3 text-center">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-extrabold ${tierBadgeCls(snap.overallTier)}`}
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
            <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'سجل تدقيق رحلات التوصيل الفعلي (١٢ رحلة لكل صفحة)'
                : 'Live Rider Trip Audit Log (12 Trips / Page)'}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'كل رحلة حمراء (> 32 دقيقة) تتيح رفع مطالبة تعويض أو تنبيه فوري لجرس المدير بضغطة واحدة'
                : 'Every Red (>32m) delivery enables a 1-click SLA refund claim or Manager Bell alert'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', ar: `الكل (${snap.totalTrips})`, en: `All (${snap.totalTrips})` },
                { id: 'green', ar: `🟢 أخضر (${snap.greenCount})`, en: `🟢 Green (${snap.greenCount})` },
                { id: 'yellow', ar: `🟡 أصفر (${snap.yellowCount})`, en: `🟡 Yellow (${snap.yellowCount})` },
                { id: 'red', ar: `🔴 أحمر (${snap.redCount})`, en: `🔴 Red (${snap.redCount})` },
              ] as const
            ).map((p) => {
              const active = tierFilter === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTierFilter(p.id)}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                    active
                      ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                      : 'bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                  style={active ? { color: '#FFFFFF' } : undefined}
                >
                  {isAr ? p.ar : p.en}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'ابحث برقم الطلب، السائق، المنطقة، البراند أو الفرع...'
                  : 'Search order ref, rider, zone, brand, or branch...'
              }
              className={`${INPUT_CLS} ps-9`}
            />
          </div>

          <select
            value={fleetFilter}
            onChange={(e) => setFleetFilter(e.target.value as 'all' | DeliveryFleetId)}
            className={`${INPUT_CLS} sm:w-60`}
          >
            <option value="all">{isAr ? 'كل أساطيل وتطبيقات التوصيل' : 'All Delivery Fleets'}</option>
            {DELIVERY_FLEETS.map((fl) => (
              <option key={fl.id} value={fl.id}>
                {isAr ? fl.ar : fl.en}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-start text-[12.5px] tabular-nums">
            <thead>
              <tr className="bg-[#F7F7F8] text-[11.5px] font-bold text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                <th className="px-3 py-2.5 text-start">{isAr ? 'رقم الطلب' : 'Order Ref'}</th>
                <th className="px-3 py-2.5 text-start">{isAr ? 'المطعم والفرع' : 'Brand & Branch'}</th>
                <th className="px-3 py-2.5 text-start">{isAr ? 'السائق / المنصة' : 'Driver / Fleet'}</th>
                <th className="px-3 py-2.5 text-center">{isAr ? 'الاستلام 🛵' : 'Pickup 🛵'}</th>
                <th className="px-3 py-2.5 text-center">{isAr ? 'التسليم 🏠' : 'Delivered 🏠'}</th>
                <th className="px-3 py-2.5 text-center">{isAr ? 'المدة الصافية' : 'Transit Min'}</th>
                <th className="px-3 py-2.5 text-start">{isAr ? 'المنطقة' : 'Zone / Area'}</th>
                <th className="px-3 py-2.5 text-center">{isAr ? 'التقييم' : 'Rating'}</th>
                <th className="px-3 py-2.5 text-end">{isAr ? 'الإجراء الرقابي' : 'Governance Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {paginatedTrips.map((t) => {
                const claimStatus = getApprovalByRef(`delivery-sla-claim-${t.orderRef}`)
                return (
                  <tr
                    key={t.id}
                    className="transition hover:bg-[#F7F7F8]/70 dark:hover:bg-neutral-800/30"
                  >
                    <td className="px-3 py-3 font-extrabold text-neutral-950 dark:text-white">
                      <div>{t.orderRef}</div>
                      <div className="text-[11px] font-normal text-neutral-500">
                        {t.date} · {t.orderKwd.toFixed(2)} {kwd}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {isAr ? t.brandAr : t.brandEn}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {isAr ? t.branchAr : t.branchEn}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-neutral-800 dark:text-neutral-200">
                        {isAr ? t.fleetAr : t.fleetEn}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {isAr ? t.driverAr : t.driverEn}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-neutral-800 dark:text-neutral-200">
                      {t.pickupTimestamp}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-neutral-800 dark:text-neutral-200">
                      {t.deliveredTimestamp}
                    </td>
                    <td className="px-3 py-3 text-center font-extrabold text-neutral-950 dark:text-white">
                      {t.transitMinutes.toFixed(1)} {isAr ? 'د' : 'm'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {isAr ? t.zoneAr : t.zoneEn}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {t.distanceKm.toFixed(1)} {isAr ? 'كم' : 'km'}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold whitespace-nowrap ${tierBadgeCls(t.tier)}`}
                      >
                        {tierEmoji(t.tier)} {isAr ? t.tierLabelAr : t.tierLabelEn}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-end">
                      {t.tier === 'red' ? (
                        <button
                          type="button"
                          onClick={() => handleEscalateRedTrip(t)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1.5 text-[11.5px] font-bold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          {claimStatus
                            ? isAr
                              ? 'تم الرفع للمدير ✅'
                              : 'Escalated ✅'
                            : isAr
                              ? 'رفع مطالبة تعويض / تنبيه لجرس المدير 🔔'
                              : 'Claim / Alert Manager 🔔'}
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-neutral-500">
                          {isAr ? t.auditNoteAr : t.auditNoteEn}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer (12 trips/page) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F7F8] px-4 py-2.5 text-[12px] font-semibold text-neutral-600 tabular-nums dark:bg-neutral-950 dark:text-neutral-300">
          <span>
            {isAr
              ? `عرض ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredTrips.length)} من أصل ${filteredTrips.length} رحلة`
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredTrips.length)} of ${filteredTrips.length} trips`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-200"
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
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-200"
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
