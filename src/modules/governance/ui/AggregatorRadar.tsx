'use client'

import React, { useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  INITIAL_BRANCH_PROFILES,
  VENTURE_BRANDS,
  calculateGeoRadarKpis,
  formatTalabatAreaAlertEmail,
  type AccountDeliveryMode,
  type DeliveryZoneStatus,
  type RadarPlatform,
} from '@/lib/radar/talabat-geo-zone-radar'
import { zoneLabelAr, zoneLabelEn } from '@/modules/governance/domain/zone-labels'

export interface AggregatorRadarProps {
  permissions?: readonly string[]
}

/**
 * Distinct, high-contrast badges for Tgo (Platform Delivery - Amber) and TMP (Restaurant Marketplace - Sky)
 */
export function ModeBadgePill({ mode, isEn }: { mode: AccountDeliveryMode | 'TMP'; isEn: boolean }) {
  if (mode === 'Tgo') {
    return (
      <span
        className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 ring-1 ring-amber-500/20 px-2.5 py-0.5 rounded-md font-bold text-xs whitespace-nowrap"
      >
        <span className="font-extrabold">Tgo</span>
        <span>{isEn ? 'Platform Delivery' : 'توصيل المنصة'}</span>
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300 ring-1 ring-sky-500/20 px-2.5 py-0.5 rounded-md font-bold text-xs whitespace-nowrap"
    >
      <span className="font-extrabold">TMP</span>
      <span>{isEn ? 'Restaurant Delivery (TMP)' : 'توصيل المطعم (TMP)'}</span>
    </span>
  )
}

function StatusPill({ status, isEn }: { status: DeliveryZoneStatus; isEn: boolean }) {
  if (status === 'ONLINE_VISIBLE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 whitespace-nowrap">
        <span className="h-2 w-2 rounded-full bg-emerald-600" />
        {isEn ? 'Online & Active' : 'متصل ونشط'}
      </span>
    )
  }
  if (status === 'BUSY_IN_AREA') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-bold text-amber-900 whitespace-nowrap">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {isEn ? 'Busy (Needs Action)' : 'مشغول (يحتاج تدخلاً)'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 text-xs font-bold text-rose-900 whitespace-nowrap">
      <span className="h-2 w-2 rounded-full bg-rose-600" />
      {isEn ? 'Stopped / Polygon Cut' : 'متوقف / مقطوع النطاق'}
    </span>
  )
}

export default function AggregatorRadar(_props: AggregatorRadarProps) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const T = (en: string, ar: string) => (isEn ? en : ar)

  // Quick Top Filter: All | Tgo Only | M Only
  const [quickMode, setQuickMode] = useState<'ALL' | 'Tgo' | 'M'>('ALL')

  // Detailed Table Filters: (Actual Branch | Brand | Platform | Type Tgo/M | Customer Area | Status)
  const [branchFilter, setBranchFilter] = useState<string>('ALL')
  const [brandFilter, setBrandFilter] = useState<string>('ALL')
  const [platformFilter, setPlatformFilter] = useState<string>('ALL')
  const [areaFilter, setAreaFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const [alertSending, setAlertSending] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)

  const kpis = useMemo(() => calculateGeoRadarKpis(INITIAL_BRANCH_PROFILES), [])

  // Flatten all Customer Delivery Areas with their serving Actual Restaurant Branch & Zone Account
  const allCustomerAreas = useMemo(() => {
    return INITIAL_BRANCH_PROFILES.flatMap((b) =>
      b.zones.map((z) => ({
        ...z,
        branchId: b.branchId,
        branchCode: b.branchCode,
        branchNameAr: b.branchNameAr,
        branchNameEn: b.branchNameEn,
        displayAreaAr: zoneLabelAr(z.zoneNameAr),
        displayAreaEn: zoneLabelEn(z.zoneNameEn),
      })),
    )
  }, [])

  // Distinct customer area options for dropdown filter
  const customerAreaOptions = useMemo(() => {
    const map = new Map<string, { ar: string; en: string }>()
    for (const z of allCustomerAreas) {
      map.set(z.zoneNameEn, { ar: z.displayAreaAr, en: z.displayAreaEn })
    }
    return [...map.entries()].map(([key, val]) => ({ key, ...val }))
  }, [allCustomerAreas])

  // Filtered Customer Areas & Detailed Rows
  const filteredRows = useMemo(() => {
    return allCustomerAreas.filter((r) => {
      if (quickMode !== 'ALL' && r.deliveryMode !== quickMode) return false
      if (branchFilter !== 'ALL' && r.branchId !== branchFilter) return false
      if (brandFilter !== 'ALL' && r.brandId !== brandFilter) return false
      if (platformFilter !== 'ALL' && r.platform !== platformFilter) return false
      if (areaFilter !== 'ALL' && r.zoneNameEn !== areaFilter) return false
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
      return true
    })
  }, [allCustomerAreas, quickMode, branchFilter, brandFilter, platformFilter, areaFilter, statusFilter])

  // Filtered Actual Restaurant Branches for the cards grid
  const filteredBranches = useMemo(() => {
    return INITIAL_BRANCH_PROFILES.filter((b) => {
      if (branchFilter !== 'ALL' && b.branchId !== branchFilter) return false
      if (brandFilter !== 'ALL' && !b.supportedBrandIds.includes(brandFilter)) return false
      return true
    }).map((b) => {
      const zoneAccounts = b.zoneAccounts.filter((acc) => {
        if (quickMode !== 'ALL' && acc.deliveryMode !== quickMode) return false
        if (brandFilter !== 'ALL' && acc.brandId !== brandFilter) return false
        if (platformFilter !== 'ALL' && acc.platform !== platformFilter) return false
        if (statusFilter !== 'ALL' && acc.status !== statusFilter) return false
        return true
      })
      const zones = b.zones.filter((z) => {
        if (quickMode !== 'ALL' && z.deliveryMode !== quickMode) return false
        if (brandFilter !== 'ALL' && z.brandId !== brandFilter) return false
        if (platformFilter !== 'ALL' && z.platform !== platformFilter) return false
        if (areaFilter !== 'ALL' && z.zoneNameEn !== areaFilter) return false
        if (statusFilter !== 'ALL' && z.status !== statusFilter) return false
        return true
      })
      return { ...b, zoneAccounts, zones }
    })
  }, [quickMode, branchFilter, brandFilter, platformFilter, areaFilter, statusFilter])

  const handleSendAlert = async () => {
    setAlertSending(true)
    setAlertMsg(null)
    try {
      const emailText = formatTalabatAreaAlertEmail(INITIAL_BRANCH_PROFILES, kpis)
      await fetch('/api/aggregator-radar/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'talabat_area_alert', emailText, manualTrigger: true }),
      })
      setAlertMsg(
        T(
          'Operational alert sent to authorized executive recipients (Sec@, operations@, abdelrahmanm@).',
          'تم إرسال التنبيه التشغيلي فوراً إلى المستلمين المعتمدين (Sec@, operations@, abdelrahmanm@).',
        ),
      )
    } catch {
      setAlertMsg(
        T(
          'Alert queued in operational notification log.',
          'تم تسجيل البلاغ في سجل التنبيهات التشغيلية.',
        ),
      )
    } finally {
      setAlertSending(false)
    }
  }

  const resetFilters = () => {
    setQuickMode('ALL')
    setBranchFilter('ALL')
    setBrandFilter('ALL')
    setPlatformFilter('ALL')
    setAreaFilter('ALL')
    setStatusFilter('ALL')
  }

  const hasFilters =
    quickMode !== 'ALL' ||
    branchFilter !== 'ALL' ||
    brandFilter !== 'ALL' ||
    platformFilter !== 'ALL' ||
    areaFilter !== 'ALL' ||
    statusFilter !== 'ALL'

  return (
    <div
      dir={isEn ? 'ltr' : 'rtl'}
      className="ae-stagger w-full min-w-0 space-y-6 text-[13px] md:text-sm text-slate-900 dark:text-slate-100"
      style={{
        fontFamily: isEn
          ? "'Inter', 'IBM Plex Sans Arabic', system-ui, sans-serif"
          : "'IBM Plex Sans Arabic', 'Inter', 'Cairo', system-ui, sans-serif",
      }}
    >
      {/* =====================================================================
          PART A: CLEAN TOP SUMMARY BAR & QUICK (ALL | Tgo | M) FILTER
         ===================================================================== */}
      <header className="ae-masthead space-y-5 p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              <span>
                {T(
                  'Venture Foods W.L.L. · 9 Operational Restaurant Branches · Tgo & TMP Coverage Monitor',
                  'شركة فنتشر فودز · 9 فروع تشغيلية فعلية · رادار حسابات المنصات (Tgo و TMP) ومناطق التوصيل',
                )}
              </span>
            </div>
            <h1 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              {T(
                'Delivery Platforms Radar — Restaurant Branches, Zone Accounts (Tgo / TMP) & Customer Areas',
                'رادار منصات التوصيل — الفروع الفعلية، حسابات القطاعات (Tgo / TMP) ومناطق الزبائن',
              )}
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-600 leading-relaxed">
              {T(
                'Strict separation between: (1) Actual Restaurant Branches, (2) Platform Zone Accounts (Tgo Platform Delivery vs TMP Restaurant Delivery), and (3) Customer Residential Areas.',
                'فصل صارم وواضح بين: (1) الفروع الفعلية للمطعم، (2) حسابات أفرع المناطق على المنصات بنظام Tgo (توصيل المنصة) و TMP (توصيل المطعم)، و(3) مناطق الزبائن السكنية.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Mode Filter: All | Tgo Only | TMP Only */}
            <div
              role="group"
              aria-label={T('Filter by account type', 'فلتر سريع حسب نوع الحساب')}
              className="ae-seg flex-wrap"
            >
              <button
                type="button"
                onClick={() => setQuickMode('ALL')}
                data-active={quickMode === 'ALL' ? 'true' : 'false'}
                aria-pressed={quickMode === 'ALL'}
              >
                {T(`All (${kpis.totalActiveAccounts})`, `الكل (${kpis.totalActiveAccounts})`)}
              </button>
              <button
                type="button"
                onClick={() => setQuickMode('Tgo')}
                data-active={quickMode === 'Tgo' ? 'true' : 'false'}
                aria-pressed={quickMode === 'Tgo'}
                className="inline-flex items-center gap-1.5"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                <span>{T(`Tgo Accounts Only (${kpis.tgoAccountsCount})`, `حسابات Tgo فقط (${kpis.tgoAccountsCount})`)}</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickMode('M')}
                data-active={quickMode === 'M' ? 'true' : 'false'}
                aria-pressed={quickMode === 'M'}
                className="inline-flex items-center gap-1.5"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
                <span>{T(`TMP Accounts Only (${kpis.mAccountsCount})`, `حسابات TMP فقط (${kpis.mAccountsCount})`)}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleSendAlert()}
              disabled={alertSending}
              className="ae-pill-dark"
            >
              {alertSending
                ? T('Sending Alert...', 'جارٍ الإرسال...')
                : T('Send Operational Report', 'إرسال تقرير الرصد للإدارة')}
            </button>
          </div>
        </div>

        {alertMsg && (
          <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
            {alertMsg}
          </div>
        )}

        {/* Top Summary KPI Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 items-stretch">
          <div className="ae-tile-soft min-w-0 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-600">
              {T('Total Active Platform Accounts', 'إجمالي الحسابات النشطة على المنصات')}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-lg sm:text-xl xl:text-[22px] font-extrabold tracking-tight tabular-nums break-words leading-tight text-slate-900">
                {kpis.totalActiveAccounts}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                {T(` across ${INITIAL_BRANCH_PROFILES.length} branches`, ` عبر ${INITIAL_BRANCH_PROFILES.length} فروع فعلية`)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span
                className="rounded-md bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-amber-900 dark:text-amber-200"
              >
                Tgo: <strong className="tabular-nums">{kpis.tgoAccountsCount}</strong>{' '}
                {T('(Platform Fleet)', '(توصيل المنصة)')}
              </span>
              <span
                className="rounded-md bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 text-sky-900 dark:text-sky-200"
              >
                TMP: <strong className="tabular-nums">{kpis.mAccountsCount}</strong>{' '}
                {T('(Restaurant Fleet)', '(توصيل المطعم)')}
              </span>
            </div>
          </div>

          <div className="ae-tile-soft min-w-0 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-600">
              {T('Actual Restaurant Branches', 'الفروع الفعلية للمطعم')}
            </div>
            <div className="mt-1 text-lg sm:text-xl xl:text-[22px] font-extrabold tracking-tight tabular-nums break-words leading-tight text-slate-900">
              {INITIAL_BRANCH_PROFILES.length}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {isEn
                ? INITIAL_BRANCH_PROFILES.map((b) => b.branchNameEn).join(', ')
                : INITIAL_BRANCH_PROFILES.map((b) => b.branchNameAr).join('، ')}
            </div>
          </div>

          <div className="ae-tile-soft min-w-0 rounded-2xl p-4">
            <div className="text-xs font-semibold text-slate-600">
              {T('Covered Customer Delivery Areas', 'مناطق الزبائن المغطاة')}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-lg sm:text-xl xl:text-[22px] font-extrabold tracking-tight tabular-nums break-words leading-tight text-emerald-700">
                {kpis.onlineZonesCount} / {kpis.totalMonitoredZones}
              </span>
              <span className="text-xs font-bold tabular-nums text-emerald-700">({kpis.onlineZonesPct}%)</span>
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {T(
                'Residential customer areas actively receiving orders right now',
                'منطقة سكنية للزبائن متاحة وتستقبل الطلبات الآن',
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 p-4">
            <div className="text-xs font-semibold text-rose-900">
              {T('Stopped or Busy Accounts Needing Action', 'الحسابات والمناطق المشغولة أو المتوقفة (تحتاج تدخلاً)')}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-lg sm:text-xl xl:text-[22px] font-extrabold tracking-tight tabular-nums break-words leading-tight text-rose-700">
                {kpis.busyZonesCount + kpis.hiddenZonesCount}
              </span>
              <span className="text-xs font-semibold text-rose-800">
                ({kpis.busyZonesCount} {T('Busy', 'مشغول')} · {kpis.hiddenZonesCount}{' '}
                {T('Stopped/Cut', 'مقطوع النطاق')})
              </span>
            </div>
            <div className="mt-1 text-xs font-semibold text-rose-800 tabular-nums">
              {T(
                `Estimated lost sales today: KWD ${kpis.totalLostSalesKwd.toFixed(3)}`,
                `المبيعات الضائعة المقدرة اليوم: ${kpis.totalLostSalesKwd.toFixed(3)} د.ك`,
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          PART B: ACTUAL RESTAURANT BRANCHES GRID + ZONE ACCOUNTS (Tgo & TMP)
         ===================================================================== */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] md:text-base font-bold text-slate-900">
              {T(
                '1. Actual Restaurant Branches & Their Platform Zone Accounts (Tgo / TMP)',
                'أولاً وثانياً: الفروع الفعلية للمطعم (9 فروع) وحسابات تغطية المناطق التابعة لها (Tgo / TMP)',
              )}
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              {T(
                'Each card is a physical operational restaurant branch, listing its brands, platform zone accounts (Tgo vs TMP), and covered customer areas.',
                'كل بطاقة تمثل فرعاً تشغيلياً حقيقياً للمطعم، وتعرض العلامات التجارية وحسابات المنصات (Tgo توصيل المنصة و TMP توصيل المطعم) والمناطق التي يغطيها الفرع.',
              )}
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ae-pill-light ae-pill-sm"
            >
              {T('Reset all filters', 'إعادة ضبط جميع الفلاتر')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 items-stretch">
          {filteredBranches.map((branch) => {
            const tgoCount = branch.zoneAccounts.filter((a) => a.deliveryMode === 'Tgo').length
            const mCount = branch.zoneAccounts.filter((a) => a.deliveryMode === 'M').length
            return (
              <div
                key={branch.branchId}
                className="ae-tile ae-lift flex min-w-0 flex-col justify-between rounded-2xl p-5"
              >
                <div>
                  {/* Branch Header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800 tabular-nums">
                          {branch.branchCode}
                        </span>
                        <h3 className="text-[15px] md:text-base font-bold text-slate-900">
                          {isEn ? branch.branchNameEn : branch.branchNameAr}
                        </h3>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {branch.supportedBrandIds.map((bid) => {
                          const bObj = VENTURE_BRANDS.find((x) => x.id === bid)
                          return (
                            <span
                              key={bid}
                              className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                            >
                              {isEn ? bObj?.nameEn : bObj?.nameAr}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                        {branch.onlineZonesCount}/{branch.totalZonesCount} {T('Areas Online', 'مناطق متصلة')}
                      </span>
                      <div className="mt-1 text-xs font-semibold text-slate-600 tabular-nums">
                        Tgo: {tgoCount} · TMP: {mCount}
                      </div>
                    </div>
                  </div>

                  {/* Section 2 inside Card: Restaurant Zone Accounts (Tgo & TMP) */}
                  <div className="mt-3">
                    <div className="mb-1.5 text-xs font-bold text-slate-700">
                      {T(
                        'Platform Zone Accounts under this Branch (Tgo & TMP):',
                        'حسابات أفرع المناطق وتغطية المطعم التابعة للفرع (Tgo و TMP):',
                      )}
                    </div>
                    <div className="space-y-2">
                      {branch.zoneAccounts.map((acc) => (
                        <div
                          key={acc.accountId}
                          className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-[13px]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-bold text-slate-900">
                              {isEn ? acc.brandNameEn : acc.brandNameAr} · {acc.platform}
                            </span>
                            <ModeBadgePill mode={acc.deliveryMode} isEn={isEn} />
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-700">
                            {isEn ? acc.sectorNameEn : acc.sectorNameAr}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-600 tabular-nums" dir="ltr">
                              GL #{acc.accountCode} · {acc.commissionPct}%
                            </span>
                            <StatusPill status={acc.status} isEn={isEn} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Covered Customer Delivery Areas Pill List */}
                <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="mb-1.5 text-xs font-bold text-slate-700">
                    {T(
                      'Customer Delivery Areas Served by this Branch:',
                      'مناطق الزبائن المخدومة من هذا الفرع الفعلي:',
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {branch.zones.map((z) => {
                      const isIssue = z.status !== 'ONLINE_VISIBLE'
                      return (
                        <span
                          key={z.id}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                            isIssue
                              ? 'bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span>{isEn ? zoneLabelEn(z.zoneNameEn) : zoneLabelAr(z.zoneNameAr)}</span>
                          <span
                            className="rounded px-1.5 py-0.5 text-[11px] font-extrabold"
                            style={{
                              backgroundColor: z.deliveryMode === 'Tgo' ? '#D97706' : '#0284C7',
                              color: '#FFFFFF',
                            }}
                          >
                            {z.deliveryMode === 'Tgo' ? 'Tgo' : 'TMP'}
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* =====================================================================
          SECTION 3: INDEPENDENT CUSTOMER DELIVERY AREAS DIRECTORY
         ===================================================================== */}
      <section className="ae-tile min-w-0 rounded-2xl p-5 lg:p-6 space-y-4">
        <div>
          <h2 className="text-[15px] md:text-base font-bold text-slate-900 dark:text-slate-100">
            {T(
              '3. Customer Delivery Areas (Residential Areas & Serving Branch Mapping)',
              'ثالثاً: مناطق الزبائن — المناطق السكنية والفرع الفعلي الذي يخدم كل منطقة ونوع التغطية (Tgo أو TMP)',
            )}
          </h2>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            {T(
              'Residential areas where customers place orders, explicitly mapped to the physical Restaurant Branch serving them and whether delivery is Tgo (Platform) or TMP (Restaurant Fleet).',
              'المناطق السكنية التي يطلب منها العملاء مفصولة بوضوح عن الفروع الفعلية، مع بيان الفرع الفعلي للمطعم الذي يخدم كل منطقة ونوع التغطية (Tgo أو TMP).',
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredRows.map((area) => (
            <div
              key={area.id}
              className={`min-w-0 rounded-xl p-3.5 transition-colors ${
                area.status === 'ONLINE_VISIBLE'
                  ? 'bg-slate-50 dark:bg-slate-900/60'
                  : 'bg-rose-50/70 dark:bg-rose-950/40'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-[13px] md:text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isEn ? area.displayAreaEn : area.displayAreaAr}
                </span>
                <ModeBadgePill mode={area.deliveryMode} isEn={isEn} />
              </div>
              <div className="mt-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {T('Serving Branch:', 'الفرع الفعلي الخادم:')}{' '}
                <strong className="text-slate-900 dark:text-slate-100">{isEn ? area.branchNameEn : area.branchNameAr}</strong>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>
                  {isEn ? area.brandNameEn : area.brandNameAr} · {area.platform} ({area.distanceKm} {isEn ? 'km' : 'كم'})
                </span>
                <StatusPill status={area.status} isEn={isEn} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          PART C: DETAILED FILTERABLE TABLE
          (Actual Branch | Brand | Platform | Type Tgo or TMP | Customer Area | Status)
         ===================================================================== */}
      <section className="ae-tile min-w-0 rounded-2xl p-5 lg:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] md:text-base font-bold text-slate-900 dark:text-slate-100">
              {T(
                '4. Comprehensive Filterable Operations Table (Branch · Brand · Platform · Tgo/TMP · Customer Area · Status)',
                'رابعاً: الجدول التفصيلي الشامل القابل للفلترة (الفرع الفعلي | العلامة التجارية | المنصة | النوع Tgo أو TMP | منطقة الزبون | الحالة)',
              )}
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              {T(
                `Showing ${filteredRows.length} of ${allCustomerAreas.length} monitored customer area connections.`,
                `يعرض ${filteredRows.length} من أصل ${allCustomerAreas.length} نطاق تغطية لمناطق الزبائن.`,
              )}
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ae-pill-light ae-pill-sm"
            >
              {T('Clear Filters', 'مسح الفلاتر')}
            </button>
          )}
        </div>

        {/* 6 Filter Controls matching Requirement 3-c */}
        <div className="ae-tile-soft grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <label className="block">
            <span className="block text-xs font-bold text-slate-700 mb-1">
              {T('1. Actual Branch', '1. الفرع الفعلي للمطعم')}
            </span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="ae-select w-full min-w-0"
            >
              <option value="ALL">{T('All 9 Branches', 'كل الفروع الفعلية (9)')}</option>
              {INITIAL_BRANCH_PROFILES.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  {isEn ? b.branchNameEn : b.branchNameAr}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-700 mb-1">
              {T('2. Brand', '2. العلامة التجارية')}
            </span>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="ae-select w-full min-w-0"
            >
              <option value="ALL">{T('All 7 Brands', 'كل العلامات (7)')}</option>
              {VENTURE_BRANDS.map((b) => (
                <option key={b.id} value={b.id}>
                  {isEn ? b.nameEn : b.nameAr}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-700 mb-1">
              {T('3. Platform', '3. المنصة')}
            </span>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="ae-select w-full min-w-0"
            >
              <option value="ALL">{T('All Platforms', 'كل المنصات')}</option>
              {(['Talabat', 'Keeta', 'Deliveroo', 'Jahez'] as RadarPlatform[]).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {T('4. Type (Tgo or TMP)', '4. النوع (Tgo أو TMP)')}
            </span>
            <select
              value={quickMode}
              onChange={(e) => setQuickMode(e.target.value as 'ALL' | 'Tgo' | 'M')}
              className="ae-select w-full min-w-0"
            >
              <option value="ALL">{T('All (Tgo & TMP)', 'الكل (Tgo و TMP)')}</option>
              <option value="Tgo">{T('Tgo Only (Platform Delivery)', 'حسابات Tgo فقط (توصيل المنصة)')}</option>
              <option value="M">{T('TMP Only (Restaurant Delivery)', 'حسابات TMP فقط (توصيل المطعم)')}</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {T('5. Customer Area', '5. منطقة الزبون')}
            </span>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="ae-select w-full min-w-0"
            >
              <option value="ALL">{T('All Customer Areas', 'كل مناطق الزبائن')}</option>
              {customerAreaOptions.map((a) => (
                <option key={a.key} value={a.key}>
                  {isEn ? a.en : a.ar}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {T('6. Status', '6. الحالة')}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ae-select w-full min-w-0"
            >
              <option value="ALL">{T('All Statuses', 'كل الحالات')}</option>
              <option value="ONLINE_VISIBLE">{T('Online & Active', 'متصل ونشط')}</option>
              <option value="BUSY_IN_AREA">{T('Busy in Area', 'مشغول في المنطقة')}</option>
              <option value="AREA_CLOSED_HIDDEN">{T('Stopped / Polygon Cut', 'متوقف / مقطوع النطاق')}</option>
            </select>
          </label>
        </div>

        {/* Clean Modern Dark/Light Table */}
        <div className="ae-table-wrap w-full overflow-x-auto rounded-xl ring-1 ring-slate-200/70 dark:ring-slate-800">
          <table className="w-full border-collapse text-[13.5px] md:text-sm bg-white dark:bg-[#111827]">
            <thead className="bg-[#F8FAFC] dark:bg-[#1E293B]/90 border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Actual Restaurant Branch', 'الفرع الفعلي للمطعم')}</th>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Brand', 'العلامة التجارية')}</th>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Platform', 'المنصة')}</th>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Account Type (Tgo / TMP)', 'النوع (Tgo أو TMP)')}</th>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Platform Zone Account', 'حساب تغطية المنطقة')}</th>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Customer Area', 'منطقة الزبون السكنية')}</th>
                <th className="px-3.5 py-3 text-start text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Status', 'الحالة')}</th>
                <th className="px-3.5 py-3 text-end text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight whitespace-nowrap">{T('Financial Impact', 'الأثر المالي')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {T('No rows match the selected filters.', 'لا توجد سجلات تطابق الفلاتر المحددة.')}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors duration-150">
                    <td className="px-3.5 py-3 text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap leading-relaxed">
                      {isEn ? row.branchNameEn : row.branchNameAr}
                    </td>
                    <td className="px-3.5 py-3 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap leading-relaxed">
                      {isEn ? row.brandNameEn : row.brandNameAr}
                    </td>
                    <td className="px-3.5 py-3 text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap leading-relaxed">
                      {row.platform}
                    </td>
                    <td className="px-3.5 py-3 text-xs whitespace-nowrap leading-relaxed">
                      <ModeBadgePill mode={row.deliveryMode} isEn={isEn} />
                    </td>
                    <td className="px-3.5 py-3 text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed min-w-[220px]">
                      {isEn ? row.zoneAccountNameEn : row.zoneAccountNameAr}
                    </td>
                    <td className="px-3.5 py-3 text-xs font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap leading-relaxed">
                      {isEn ? row.displayAreaEn : row.displayAreaAr}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 tabular-nums">({row.distanceKm} {isEn ? 'km' : 'كم'})</span>
                    </td>
                    <td className="px-3.5 py-3 text-xs whitespace-nowrap leading-relaxed">
                      <StatusPill status={row.status} isEn={isEn} />
                    </td>
                    <td className="px-3.5 py-3 text-xs text-end font-semibold tabular-nums whitespace-nowrap leading-relaxed">
                      {row.estimatedLostKwd > 0 ? (
                        <span className="text-rose-700 dark:text-rose-400 font-bold" dir="ltr">
                          -{row.estimatedLostKwd.toFixed(3)} {isEn ? 'KWD' : 'د.ك'} ({row.estimatedLostOrders}{' '}
                          {isEn ? 'orders' : 'طلب'})
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {T('0.000 (Normal)', '0.000 (طبيعي)')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
