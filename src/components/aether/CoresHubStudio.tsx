'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BRAND_SHARE_BASIS, sumShares } from '@/lib/aether/share-normalization'
import {
  Edit3,
  Megaphone,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import {
  formatInt,
  formatKwd,
  formatPct,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import { StateBlock, formatChartKwdTooltip } from '@/components/ui'
import type { OdooPeriodCube, OdooPeriodHourly } from '@/lib/odoo-live-connector'
import {
  formatPeriodCalendarWindow,
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  getBrandLabel,
  getBranchLabel,
  getPeriodLabel,
  resolveSummaryBucket,
  type GlobalBranch,
  type GlobalBrand,
} from '@/lib/aether/global-filter-engine'
import {
  deriveScopeCounts,
  formatArBrandsNoun,
  formatCoresBranchesCardTitle,
  formatCoresBrandsCardTitle,
  formatEnBrandsNoun,
} from '@/lib/odoo/scope-counts'
import { isBrokenOrEmptyCampaignName } from '@/lib/aether/period-delta'
import { shiftIsoDate } from '@/lib/erp-comparison-engine'
import {
  REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY,
  resolveCampaignDisplayName,
  sanitizeRealCampaigns,
  SOCIAL_AD_TYPE_OPTIONS,
  SOCIAL_CAMPAIGNS_STORAGE_KEY,
  type SocialAdType,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'
import {
  computeCoresHubSnapshot,
  UNATTRIBUTED_BRANCH_LABEL_AR,
  UNATTRIBUTED_BRANCH_LABEL_EN,
  type MenuDishRow,
} from '@/lib/aether/cores-hub-engine'
import {
  InteractiveDonutChart,
  InteractiveHorizontalRankList,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type HorizontalRankDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'

export type CoreTabId = 'marketing' | 'sales' | 'menu'
type MenuSortKey = 'sales' | 'units' | 'discount'
type MenuPageSize = 12 | 25 | 'all'

const f0 = (n: number | null | undefined, locale: FormatLocale = 'en') =>
  formatInt(n, locale)
const f1Pct = (n: number | null | undefined, locale: FormatLocale = 'en') =>
  formatPct(n, { locale, decimals: 1 })
const f2Pct = (n: number | null | undefined, locale: FormatLocale = 'en') =>
  formatPct(n, { locale, decimals: 2 })
const f3 = (n: number | null | undefined, locale: FormatLocale = 'en') =>
  formatKwd(n, { locale, showUnit: false, decimals: 3 })

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'rounded-2xl bg-white p-3.5 sm:p-5 ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:ring-emerald-500/10'

function EmeraldPillTabs<K extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { id: K; label: string; icon?: React.ReactNode }[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              active
                ? 'btn-colored bg-emerald-600 font-semibold text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
                : 'text-slate-600 hover:bg-white/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`}
          >
            {opt.icon ? <span className="shrink-0">{opt.icon}</span> : null}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CoresHubStudio({
  initialTab = 'sales',
  initialLiveCube = null,
}: {
  initialTab?: CoreTabId
  initialLiveCube?: OdooPeriodCube | null
} = {}) {
  const { locale } = useI18n()
  const resolvedLocale: FormatLocale = locale === 'en' ? 'en' : 'ar'
  const isAr = resolvedLocale === 'ar'
  const unavailableTip = getUnavailableTooltip(resolvedLocale)
  const { filters, workspace, liveSummary } = useGlobalFilter()

  const [activeTab, setActiveTab] = useState<CoreTabId>(initialTab)
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([])
  const [isAdFormOpen, setIsAdFormOpen] = useState(false)
  const [liveCube, setLiveCube] = useState<OdooPeriodCube | null>(initialLiveCube)
  const [periodHourly, setPeriodHourly] = useState<OdooPeriodHourly | null>(null)
  const [cubeLoading, setCubeLoading] = useState(false)
  const [cubeTimedOut, setCubeTimedOut] = useState(false)
  const [cubeError, setCubeError] = useState(false)
  const [cubeRetryTick, setCubeRetryTick] = useState(0)

  // Manual campaign form state (approved registry brands)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formBrand, setFormBrand] = useState<Exclude<GlobalBrand, 'all'>>('china-garden')
  const [formBranch, setFormBranch] = useState<GlobalBranch>('all')
  const [formAdType, setFormAdType] = useState<SocialAdType>('influencer')
  const [formName, setFormName] = useState('')
  const [formSpend, setFormSpend] = useState('150')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formCompareStartDate, setFormCompareStartDate] = useState('')
  const [formCompareEndDate, setFormCompareEndDate] = useState('')
  const [formItem, setFormItem] = useState('')

  // Menu tab state
  const [dishSearch, setDishSearch] = useState('')
  const [dishSort, setDishSort] = useState<MenuSortKey>('sales')
  const [menuPageSize, setMenuPageSize] = useState<MenuPageSize>(12)
  const [menuPage, setMenuPage] = useState(1)

  const periodWin = useMemo(
    () =>
      formatPeriodCalendarWindow(filters.period ?? 'month', {
        customFrom: filters.customFrom,
        customTo: filters.customTo,
        liveSummary,
      }),
    [filters.period, filters.customFrom, filters.customTo, liveSummary],
  )

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const qTab = params.get('tab') as CoreTabId | null
      if (qTab && ['marketing', 'sales', 'menu'].includes(qTab)) {
        setActiveTab(qTab)
      }
    } catch {}

    try {
      const rawReal = window.localStorage.getItem(REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY)
      if (rawReal !== null) {
        setCampaigns(sanitizeRealCampaigns(JSON.parse(rawReal)))
      } else {
        const legacyRaw = window.localStorage.getItem(SOCIAL_CAMPAIGNS_STORAGE_KEY)
        const migrated = legacyRaw ? sanitizeRealCampaigns(JSON.parse(legacyRaw)) : []
        setCampaigns(migrated)
        window.localStorage.setItem(REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY, JSON.stringify(migrated))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!formStartDate && periodWin.toInclusiveIso) {
      const end = periodWin.toInclusiveIso
      const start = shiftIsoDate(end, -2)
      const cmpEnd = shiftIsoDate(start, -1)
      const cmpStart = shiftIsoDate(cmpEnd, -2)
      setFormStartDate(start)
      setFormEndDate(end)
      setFormCompareStartDate(cmpStart)
      setFormCompareEndDate(cmpEnd)
    }
  }, [formStartDate, periodWin.toInclusiveIso])

  useEffect(() => {
    if (filters.brand !== 'all' && !editingId) {
      setFormBrand(filters.brand)
    }
  }, [filters.brand, editingId])

  useEffect(() => {
    if (!editingId) {
      setFormBranch(filters.branch)
    }
  }, [filters.branch, editingId])

  useEffect(() => {
    if (!isAdFormOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAdFormOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isAdFormOpen])

  // Fetch period-accurate OdooPeriodCube (`pos.order.line`, `pos.order`, `pos.payment`)
  useEffect(() => {
    if (!workspace.odooConnected || workspace.noData) {
      setLiveCube(null)
      setPeriodHourly(null)
      setCubeError(false)
      setCubeTimedOut(false)
      setCubeLoading(false)
      return
    }
    let cancelled = false
    const fromIso = periodWin.fromIso
    const toIso = periodWin.toInclusiveIso
    if (!fromIso || !toIso) return
    setCubeLoading(true)
    setCubeTimedOut(false)
    setCubeError(false)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    fetch(
      `/api/erp/live-comparison?dateA=${encodeURIComponent(fromIso)}&toA=${encodeURIComponent(toIso)}&dateB=${encodeURIComponent(fromIso)}&toB=${encodeURIComponent(toIso)}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error('HTTP_ERROR')
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        if (data?.cubeA) {
          setLiveCube(data.cubeA as OdooPeriodCube)
        } else {
          setLiveCube(null)
        }
        setPeriodHourly(data?.hourlyA ? (data.hourlyA as OdooPeriodHourly) : null)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLiveCube(null)
        setPeriodHourly(null)
        const timedOut = error instanceof DOMException && error.name === 'AbortError'
        setCubeTimedOut(timedOut)
        if (!timedOut) setCubeError(true)
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!cancelled) setCubeLoading(false)
      })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [
    periodWin.fromIso,
    periodWin.toInclusiveIso,
    workspace.odooConnected,
    workspace.noData,
    cubeRetryTick,
  ])

  const persistCampaigns = useCallback((next: SocialCampaign[]) => {
    const clean = sanitizeRealCampaigns(next)
    setCampaigns(clean)
    try {
      window.localStorage.setItem(REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY, JSON.stringify(clean))
    } catch {}
  }, [])

  const resetCampaignForm = useCallback(() => {
    setEditingId(null)
    setFormBrand(filters.brand !== 'all' ? filters.brand : 'china-garden')
    setFormBranch(filters.branch)
    setFormAdType('influencer')
    setFormName('')
    setFormSpend('150')
    setFormItem('')
  }, [filters.brand, filters.branch])

  const handleSaveCampaign = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const spend = Math.max(0, Number(formSpend) || 0)
      if (!formStartDate || !formEndDate) return
      const entry: SocialCampaign = {
        id: editingId ?? `real-camp-${Date.now()}`,
        brand: formBrand,
        branch: formBranch,
        adType: formAdType,
        campaignName: formName.trim(),
        spendKwd: spend,
        date: formStartDate,
        startDate: formStartDate,
        endDate: formEndDate >= formStartDate ? formEndDate : formStartDate,
        compareStartDate: formCompareStartDate || undefined,
        compareEndDate: formCompareEndDate || undefined,
        promotedItem: formItem.trim(),
      }
      if (editingId) {
        persistCampaigns(campaigns.map((c) => (c.id === editingId ? entry : c)))
      } else {
        persistCampaigns([entry, ...campaigns])
      }
      resetCampaignForm()
      setIsAdFormOpen(false)
    },
    [
      campaigns,
      editingId,
      formAdType,
      formBranch,
      formBrand,
      formCompareEndDate,
      formCompareStartDate,
      formEndDate,
      formItem,
      formName,
      formSpend,
      formStartDate,
      persistCampaigns,
      resetCampaignForm,
    ],
  )

  const handleEditCampaign = useCallback((c: SocialCampaign) => {
    setEditingId(c.id)
    setFormBrand(c.brand)
    setFormBranch(c.branch ?? 'all')
    setFormAdType(c.adType)
    setFormName(c.campaignName)
    setFormSpend(String(c.spendKwd))
    setFormStartDate(c.startDate ?? c.date)
    setFormEndDate(c.endDate ?? c.date)
    setFormCompareStartDate(c.compareStartDate ?? '')
    setFormCompareEndDate(c.compareEndDate ?? '')
    setFormItem(c.promotedItem ?? '')
    setIsAdFormOpen(true)
  }, [])

  const handleDeleteCampaign = useCallback(
    (id: string) => {
      persistCampaigns(campaigns.filter((c) => c.id !== id))
    },
    [campaigns, persistCampaigns],
  )

  const snapshot = useMemo(
    () => computeCoresHubSnapshot(filters, campaigns, liveSummary, liveCube, periodHourly),
    [filters, campaigns, liveSummary, liveCube, periodHourly],
  )

  const dateRangeLabel = snapshot.dateRangeLabel
  const lastSyncAt = snapshot.lastSyncAt
  const isStale24h = snapshot.isStale24h

  const filteredDishes = useMemo(() => {
    const q = dishSearch.trim().toLowerCase()
    const base = snapshot.menu.dishes.filter((d) => {
      if (!q) return true
      return (
        d.name.toLowerCase().includes(q) ||
        d.brandAr.toLowerCase().includes(q) ||
        d.brandEn.toLowerCase().includes(q)
      )
    })
    return [...base].sort((a: MenuDishRow, b: MenuDishRow) => {
      if (dishSort === 'units') return b.unitsSold - a.unitsSold
      if (dishSort === 'discount') return b.discountKwd - a.discountKwd
      return b.salesKwd - a.salesKwd
    })
  }, [snapshot.menu.dishes, dishSearch, dishSort])

  const pagedDishes = useMemo(() => {
    if (menuPageSize === 'all') return filteredDishes
    const start = (menuPage - 1) * menuPageSize
    return filteredDishes.slice(start, start + menuPageSize)
  }, [filteredDishes, menuPage, menuPageSize])

  const totalMenuPages =
    menuPageSize === 'all'
      ? 1
      : Math.max(1, Math.ceil(filteredDishes.length / menuPageSize))

  const timelineBars: MultiSeriesBarDatum[] = useMemo(
    () =>
      snapshot.sales.timeline.map((pt) => ({
        id: pt.id,
        label: isAr ? pt.labelAr : pt.labelEn,
        tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
        primaryValue: pt.salesKwd,
        primaryColor: pt.color ?? '#10B981',
        lines: [
          {
            label: isAr ? 'صافي مبيعات POS' : 'POS Net Sales',
            value: formatChartKwdTooltip(pt.salesKwd, resolvedLocale),
            bold: true,
          },
          {
            label: isAr ? 'الطلبات' : 'Orders',
            value: f0(pt.orders, resolvedLocale),
          },
        ],
      })),
    [snapshot.sales.timeline, isAr, resolvedLocale],
  )

  const hourlyBars: MultiSeriesBarDatum[] = useMemo(
    () =>
      snapshot.sales.hourly.map((pt) => ({
        id: pt.id,
        label: isAr ? pt.labelAr : pt.labelEn,
        tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
        primaryValue: pt.salesKwd,
        primaryColor: pt.color ?? '#10B981',
        lines: [
          {
            label: isAr ? 'صافي المبيعات' : 'Net Sales',
            value: formatChartKwdTooltip(pt.salesKwd, resolvedLocale),
            bold: true,
          },
          {
            label: isAr ? 'الطلبات' : 'Orders',
            value: f0(pt.orders, resolvedLocale),
          },
        ],
      })),
    [snapshot.sales.hourly, isAr, resolvedLocale],
  )

  const brandDonut: DonutSliceDatum[] = useMemo(
    () =>
      snapshot.sales.brandShare
        .filter((b) => b.salesKwd > 0)
        .map((b) => ({
          id: b.id,
          label: isAr ? b.labelAr : b.labelEn,
          value: b.salesKwd,
          valueFormatted: formatKwd(b.salesKwd, { locale: resolvedLocale }),
          pctFormatted: f1Pct(b.sharePct, resolvedLocale),
          color: b.color ?? '#10B981',
        })),
    [snapshot.sales.brandShare, isAr, resolvedLocale],
  )

  const channelRanks: HorizontalRankDatum[] = useMemo(
    () =>
      snapshot.sales.channelRanking.map((c) => ({
        id: c.id,
        label: isAr ? c.labelAr : c.labelEn,
        value: c.salesKwd,
        valueFormatted: formatKwd(c.salesKwd, { locale: resolvedLocale }),
        subLabel: `${f0(c.orders, resolvedLocale)} ${isAr ? 'طلب' : 'orders'} · ${f1Pct(c.sharePct, resolvedLocale)}`,
        color: c.color ?? '#10B981',
        lines: [
          {
            label: isAr ? 'صافي المبيعات' : 'Net Sales',
            value: formatKwd(c.salesKwd, { locale: resolvedLocale }),
            bold: true,
          },
          {
            label: isAr ? 'الطلبات' : 'Orders',
            value: f0(c.orders, resolvedLocale),
          },
          {
            label: isAr ? 'الحصة' : 'Share',
            value: f1Pct(c.sharePct, resolvedLocale),
          },
        ],
      })),
    [snapshot.sales.channelRanking, isAr, resolvedLocale],
  )

  const isInitialLoading = liveSummary === null
  const noOdooData =
    liveSummary !== null && (!workspace.odooConnected || workspace.noData || snapshot.noData)

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header & Core Tabs */}
      <div className={`${CARD_CLS} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {isAr
              ? 'نواة المبيعات والقنوات والمينيو والتسويق'
              : 'Sales, Channels, Menu & Marketing Core'}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? `الفترة المختارة: ${getPeriodLabel(filters.period, true)} (${dateRangeLabel})`
              : `Selected period: ${getPeriodLabel(filters.period, false)} (${dateRangeLabel})`}
          </p>
        </div>

        <EmeraldPillTabs<CoreTabId>
          ariaLabel={isAr ? 'أقسام النواة' : 'Core sections'}
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              id: 'sales',
              label: isAr ? 'المبيعات والقنوات' : 'Sales & Channels',
              icon: <TrendingUp className="h-4 w-4" />,
            },
            {
              id: 'menu',
              label: isAr ? 'مبيعات الأصناف (POS)' : 'POS Menu Items',
              icon: <UtensilsCrossed className="h-4 w-4" />,
            },
            {
              id: 'marketing',
              label: isAr ? 'التسويق والخصومات' : 'Marketing & Discounts',
              icon: <Megaphone className="h-4 w-4" />,
            },
          ]}
        />
      </div>

      <OdooPartialWarningBanner summary={liveSummary} isAr={isAr} />

      {/* Initial loading skeleton before liveSummary resolves */}
      {isInitialLoading ? (
        <StateBlock state="loading" locale={resolvedLocale} skeletonRows={4} />
      ) : null}

      {/* Disconnected / Empty Odoo state — zero invented numbers */}
      {noOdooData ? (
        <StateBlock
          state="empty"
          locale={resolvedLocale}
          title={isAr ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'No data from Odoo for this period'}
          description={
            isAr
              ? workspace.noDataMessageAr ||
                'تعذّر جلب سجلات نقاط البيع الفعليّة للفترة المحددة أو لا توجد حركات مسجّلة في Odoo.'
              : 'Could not retrieve POS records for the selected window or zero movements exist in Odoo.'
          }
        />
      ) : null}

      {/* =================================================================== */}
      {/* TAB 1: SALES & CHANNELS                                             */}
      {/* =================================================================== */}
      {!isInitialLoading && !noOdooData && activeTab === 'sales' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'إجمالي صافي المبيعات' : 'Total Net Sales'}
              </div>
              <div
                dir="ltr"
                data-kpi="net-sales"
                className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
              >
                {snapshot.sales.headline.netSalesKwd === null ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : (
                  <>
                    {f3(snapshot.sales.headline.netSalesKwd, resolvedLocale)}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      {isAr ? 'د.ك' : 'KWD'}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500 tabular-nums">
                {snapshot.sales.headline.orders === null ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : (
                  `${f0(snapshot.sales.headline.orders, resolvedLocale)} ${isAr ? 'طلب مسجّل' : 'POS orders'}`
                )}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="sum(pos.order.line.price_subtotal)"
              />
            </div>

            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'متوسط الفاتورة (AOV)' : 'Average Order Value'}
              </div>
              <div
                dir="ltr"
                className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
              >
                {snapshot.sales.headline.aovKwd === null ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : (
                  <>
                    {f3(snapshot.sales.headline.aovKwd, resolvedLocale)}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      {isAr ? 'د.ك' : 'KWD'}
                    </span>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {isAr ? 'صافي المبيعات ÷ عدد الطلبات' : 'Net sales ÷ orders'}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line + pos.order"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="محسوب بمعادلة"
                queryOrFormula="netSalesKwd / orders"
              />
            </div>

            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'القنوات المباشرة مقابل التطبيقات' : 'Direct vs Aggregators'}
              </div>
              {snapshot.sales.channelsUnavailable || (!liveCube && workspace.nullableSalesKwd === null) ? (
                <div
                  data-unavailable="true"
                  title={unavailableTip}
                  aria-label={unavailableTip}
                  className="mt-1.5 font-mono text-lg font-bold text-slate-700 dark:text-slate-200"
                >
                  {isAr ? 'غير متاح' : '—'}
                </div>
              ) : (
                <>
                  <div className="mt-1.5 font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    <span dir="ltr">{formatKwd(snapshot.sales.zeroCommSalesKwd, { locale: resolvedLocale })}</span>{' '}
                    {isAr ? 'مباشر' : 'direct'} ({f1Pct(snapshot.sales.zeroCommSharePct, resolvedLocale)})
                  </div>
                  <div className="mt-0.5 font-mono text-xs tabular-nums text-sky-700 dark:text-sky-300">
                    <span dir="ltr">{formatKwd(snapshot.sales.aggregatorSalesKwd, { locale: resolvedLocale })}</span>{' '}
                    {isAr ? 'تطبيقات' : 'apps'} ({f1Pct(snapshot.sales.aggregatorSharePct, resolvedLocale)})
                  </div>
                </>
              )}
              <KpiProvenanceBadge
                odooModel="pos.order.line + pos.payment"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="Classified by pos.payment_method_id & pos.config_id"
              />
            </div>

            <div data-unattributed-card="true" className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {isAr ? UNATTRIBUTED_BRANCH_LABEL_AR : UNATTRIBUTED_BRANCH_LABEL_EN}
              </div>
              {snapshot.sales.branchesUnavailable ? (
                <div
                  data-unavailable="true"
                  title={unavailableTip}
                  aria-label={unavailableTip}
                  className="mt-1.5 font-mono text-2xl font-bold text-slate-500 dark:text-slate-400"
                >
                  {isAr ? 'غير متاح' : '—'}
                </div>
              ) : (
                <>
                  <div
                    dir="ltr"
                    className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                  >
                    {f3(snapshot.sales.unattributedSalesKwd, resolvedLocale)}{' '}
                    <span className="text-xs font-normal">{isAr ? 'د.ك' : 'KWD'}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-600 tabular-nums dark:text-slate-300">
                    {f0(snapshot.sales.unattributedOrders, resolvedLocale)}{' '}
                    {isAr
                      ? 'طلب على نقاط بيع عامة غير مربوطة بفرع'
                      : 'orders on unmapped POS configs'}
                  </div>
                </>
              )}
              <KpiProvenanceBadge
                odooModel="pos.order + pos.config"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="POS orders where config_id has no unambiguous branch mapping"
              />
            </div>
          </div>

          {/* Daily Sales Timeline (hidden on 1-day windows so Hourly Profile takes its slot) */}
          {!snapshot.isSingleDayWindow ? (
            <div className={CARD_CLS}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr ? 'المسار اليومي لصافي المبيعات' : 'Daily Net Sales Timeline'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? `أقوى يوم في الفترة: ${snapshot.sales.strongestDayLabelAr} · ${dateRangeLabel} · د.ك`
                      : `Strongest day in window: ${snapshot.sales.strongestDayLabelEn} · ${dateRangeLabel} · KWD`}
                  </p>
                </div>
                <KpiProvenanceBadge
                  odooModel="pos.order.line"
                  dateRange={dateRangeLabel}
                  lastSyncAt={lastSyncAt}
                  isStale24h={isStale24h}
                  kind="فعلي"
                />
              </div>
              {timelineBars.length > 0 ? (
                <InteractiveHoverBarChart
                  data={timelineBars}
                  isAr={isAr}
                  primaryLegend={isAr ? 'صافي مبيعات POS' : 'POS Net Sales'}
                  yAxisLabel={isAr ? 'صافي المبيعات (د.ك)' : 'Net Sales (KWD)'}
                  xAxisLabel={isAr ? 'الأيام (توقيت الكويت)' : 'Days (Asia/Kuwait)'}
                  heightClass="h-56"
                />
              ) : (
                <StateBlock
                  state="empty"
                  compact
                  locale={resolvedLocale}
                  title={isAr ? 'لا توجد نقاط يومية لهذه الفترة' : 'No daily points in this window'}
                />
              )}
            </div>
          ) : null}

          {/* Hourly Profile (No 876 KWD quiet window upside) */}
          <div className={CARD_CLS}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'التوزيع الساعي لطلبات نقاط البيع' : 'Hourly POS Sales Profile'}
                </h2>
                <p className="text-xs text-slate-500 tabular-nums">
                  {cubeLoading && hourlyBars.length === 0
                    ? null
                    : snapshot.sales.hourlyUnavailable || (!liveCube && workspace.nullableSalesKwd === null)
                    ? (
                        <span data-unavailable="true" title={unavailableTip}>
                          {isAr ? 'غير متاح' : 'Not available'}
                        </span>
                      )
                    : snapshot.sales.peakHourSalesKwd <= 0
                      ? null
                      : isAr
                      ? `ذروة المبيعات: ${snapshot.sales.peakHourShortAr} (${formatKwd(snapshot.sales.peakHourSalesKwd, { locale: resolvedLocale })}) · الفترة 3–6 م: ${formatKwd(snapshot.sales.quietWindowSalesKwd, { locale: resolvedLocale })} (${f0(snapshot.sales.quietWindowOrders, resolvedLocale)} طلب)`
                      : `Peak hour: ${snapshot.sales.peakHourShortEn} (${formatKwd(snapshot.sales.peakHourSalesKwd, { locale: resolvedLocale })}) · 3–6 PM: ${formatKwd(snapshot.sales.quietWindowSalesKwd, { locale: resolvedLocale })} (${f0(snapshot.sales.quietWindowOrders, resolvedLocale)} orders)`}
                </p>
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="Grouped by Asia/Kuwait hour of pos.order.date_order"
              />
            </div>
            {cubeLoading && hourlyBars.length === 0 ? (
              <StateBlock state="loading" compact locale={resolvedLocale} skeletonRows={3} />
            ) : snapshot.sales.hourlyUnavailable || (!liveCube && workspace.nullableSalesKwd === null) ? (
              <div data-hourly-unavailable="true">
                <StateBlock
                  state="unavailable"
                  compact
                  locale={resolvedLocale}
                  onRetry={cubeTimedOut || cubeError ? () => setCubeRetryTick((n) => n + 1) : undefined}
                />
              </div>
            ) : hourlyBars.length > 0 ? (
              <InteractiveHoverBarChart
                data={hourlyBars}
                isAr={isAr}
                primaryLegend={isAr ? 'صافي المبيعات الساعية' : 'Hourly Net Sales'}
                yAxisLabel={isAr ? 'صافي المبيعات (د.ك)' : 'Net Sales (KWD)'}
                xAxisLabel={isAr ? 'الساعة (توقيت الكويت)' : 'Hour (Asia/Kuwait)'}
                heightClass="h-52"
              />
            ) : (
              <StateBlock
                state="empty"
                compact
                locale={resolvedLocale}
                title={isAr ? 'لا توجد بيانات ساعية لهذه الفترة' : 'No hourly data for this period'}
              />
            )}
            {snapshot.sales.hourlyReconciliation && hourlyBars.length > 0 ? (
              <p
                data-hourly-reconciled={snapshot.sales.hourlyReconciliation.reconciled ? 'true' : 'false'}
                className="mt-2 text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400"
              >
                {snapshot.sales.hourlyReconciliation.reconciled
                  ? isAr
                    ? `مجموع الساعات = إجمالي الفترة (${formatKwd(snapshot.sales.hourlyReconciliation.hourlySumKwd, { locale: resolvedLocale })}) · الفرق 0.000 د.ك`
                    : `Σ hourly = period total (${formatKwd(snapshot.sales.hourlyReconciliation.hourlySumKwd, { locale: resolvedLocale })}) · variance 0.000 KWD`
                  : isAr
                    ? `مجموع الساعات ${formatKwd(snapshot.sales.hourlyReconciliation.hourlySumKwd, { locale: resolvedLocale })} مقابل إجمالي الفترة ${formatKwd(snapshot.sales.hourlyReconciliation.periodTotalKwd, { locale: resolvedLocale })} — قيد المطابقة`
                    : `Σ hourly ${formatKwd(snapshot.sales.hourlyReconciliation.hourlySumKwd, { locale: resolvedLocale })} vs period total ${formatKwd(snapshot.sales.hourlyReconciliation.periodTotalKwd, { locale: resolvedLocale })} — pending reconciliation`}
              </p>
            ) : null}
          </div>

          {/* 3-Column Breakdown: Operational Locations + Unattributed | Brands | Channels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Operational Locations + Unattributed row */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {(() => {
                  const activeBucket = resolveSummaryBucket(filters, liveSummary)
                  const sc = deriveScopeCounts({
                    payload: liveCube ?? activeBucket,
                    summary: liveSummary,
                  })
                  const mappedRows = snapshot.sales.branchRanking.filter(
                    (b) => b.id !== 'unattributed',
                  ).length
                  return formatCoresBranchesCardTitle(
                    mappedRows > 0 ? mappedRows : sc.operationalUnitsCount,
                    resolvedLocale,
                  )
                })()}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAr
                  ? 'مبيعات الفروع المربوطة وسطر المبيعات غير المنسوبة دون أي توزيع اصطناعي'
                  : 'Mapped branch sales plus unattributed POS sales with zero forced allocation'}
              </p>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {snapshot.sales.branchesUnavailable ? (
                  <div
                    data-unavailable="true"
                    title={unavailableTip}
                    aria-label={unavailableTip}
                    className="py-6 text-center text-xs font-semibold text-slate-500"
                  >
                    {isAr ? 'غير متاح' : '—'}
                  </div>
                ) : (
                  snapshot.sales.branchRanking.map((b) => {
                    const isUnattr = b.id === 'unattributed'
                    return (
                      <div
                        key={b.id}
                        data-cores-branch-row={b.id}
                        className={`flex items-center justify-between gap-2 py-2.5 text-xs ${
                          isUnattr
                            ? 'rounded-lg px-2 font-semibold bg-slate-100 text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15'
                            : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold">
                            {isAr ? b.labelAr : b.labelEn}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                            <span data-cores-branch-orders={b.id}>{f0(b.orders, resolvedLocale)}</span>{' '}
                            {isAr ? 'طلب' : 'orders'} ·{' '}
                            {f1Pct(b.sharePct, resolvedLocale)}
                          </div>
                        </div>
                        <div
                          dir="ltr"
                          data-cores-branch-sales={b.id}
                          className="shrink-0 font-mono font-bold tabular-nums"
                        >
                          {formatKwd(b.salesKwd, { locale: resolvedLocale })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line + pos.config"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
              />
            </div>

            {/* Approved Brands */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {formatCoresBrandsCardTitle(
                  deriveScopeCounts({ summary: liveSummary }).brandsCount,
                  resolvedLocale,
                )}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAr ? 'توزيع المبيعات حسب العلامة التجارية في Odoo' : 'Sales split by brand in Odoo'}
              </p>
              <div className="mt-4">
                {snapshot.sales.brandsUnavailable ? (
                  <div
                    data-unavailable="true"
                    title={unavailableTip}
                    aria-label={unavailableTip}
                    className="py-6 text-center text-xs font-semibold text-slate-500"
                  >
                    {isAr ? 'غير متاح' : '—'}
                  </div>
                ) : brandDonut.length > 0 ? (
                  <InteractiveDonutChart
                    slices={brandDonut}
                    centerValue={formatKwd(
                      brandDonut.reduce((s, x) => s + x.value, 0),
                      { locale: resolvedLocale, showUnit: false },
                    )}
                    centerSubValue={isAr ? 'د.ك' : 'KWD'}
                    centerLabel={isAr ? 'العلامات' : 'Brands'}
                    isAr={isAr}
                  />
                ) : null}
              </div>
              {!snapshot.sales.brandsUnavailable ? (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                  {snapshot.sales.brandShare.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {isAr ? b.labelAr : b.labelEn}
                      </span>
                      <span
                        dir="ltr"
                        className="shrink-0 font-mono font-bold tabular-nums text-slate-900 dark:text-white"
                      >
                        {formatKwd(b.salesKwd, { locale: resolvedLocale })} ({f1Pct(b.sharePct, resolvedLocale)})
                      </span>
                    </div>
                  ))}
                  {snapshot.sales.brandShare.length > 1 ? (
                    <p data-brand-share-basis="true" className="pt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      <span dir="ltr" className="font-semibold tabular-nums">
                        Σ {f1Pct(sumShares(snapshot.sales.brandShare.map((b) => b.sharePct)), resolvedLocale)}
                      </span>
                      {' · '}
                      {isAr ? BRAND_SHARE_BASIS.ar : BRAND_SHARE_BASIS.en}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <KpiProvenanceBadge
                odooModel="pos.order.line + pos.category"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
              />
            </div>

            {/* Channels */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'قنوات البيع والتوصيل' : 'Sales & Delivery Channels'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAr ? 'حسب طرق الدفع وأجهزة نقاط البيع في Odoo' : 'Classified via POS payment methods & configs'}
              </p>
              <div className="mt-4">
                {snapshot.sales.channelsUnavailable || (!liveCube && workspace.nullableSalesKwd === null) ? (
                  <div
                    data-unavailable="true"
                    title={unavailableTip}
                    aria-label={unavailableTip}
                    className="py-6 text-center text-xs font-semibold text-slate-500"
                  >
                    {isAr ? 'غير متاح' : '—'}
                  </div>
                ) : (
                  <InteractiveHorizontalRankList items={channelRanks} isAr={isAr} />
                )}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line + pos.payment"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* =================================================================== */}
      {/* TAB 2: POS MENU ITEMS                                               */}
      {/* =================================================================== */}
      {!isInitialLoading && !noOdooData && activeTab === 'menu' ? (
        <div className="space-y-6">
          {false && (
            <UnlinkedSourceNotice
              titleAr="تكلفة الوصفات المعيارية (BOM) غير مربوطة بمصدر"
              titleEn="Standard Recipe BOM Costing — Not Linked to a Source"
              reasonAr="نعرض أدناه مبيعات وكميات وخصومات الأصناف الفعلية من سطور نقاط البيع (pos.order.line) فقط، دون أي تقدير لتكلفة المكونات أو هوامش ربح مخترعة."
              reasonEn="Showing actual POS item sales, quantities, and discounts from pos.order.line only, without any estimated food cost or invented margins."
            />
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'عدد الأصناف المباعة (أعلى الأصناف)' : 'Sold SKUs (Top Items)'}
              </div>
              <div
                dir="ltr"
                className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
              >
                {snapshot.menu.menuUnavailable ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : (
                  f0(snapshot.menu.totalActiveSkus, resolvedLocale)
                )}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
              />
            </div>

            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'إجمالي الوحدات المباعة' : 'Total Units Sold'}
              </div>
              <div
                dir="ltr"
                className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
              >
                {snapshot.menu.menuUnavailable ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : (
                  f0(snapshot.menu.totalUnitsSold, resolvedLocale)
                )}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="sum(pos.order.line.qty)"
              />
            </div>

            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'صافي مبيعات الأصناف المعروضة' : 'Displayed SKUs Net Sales'}
              </div>
              <div
                dir="ltr"
                className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
              >
                {snapshot.menu.menuUnavailable ? (
                  <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                    {isAr ? 'غير متاح' : '—'}
                  </span>
                ) : (
                  <>
                    {f3(snapshot.menu.totalSalesKwd, resolvedLocale)}{' '}
                    <span className="text-xs font-normal">{isAr ? 'د.ك' : 'KWD'}</span>
                  </>
                )}
              </div>
              <KpiProvenanceBadge
                odooModel="pos.order.line"
                dateRange={dateRangeLabel}
                lastSyncAt={lastSyncAt}
                isStale24h={isStale24h}
                kind="فعلي"
                queryOrFormula="sum(pos.order.line.price_subtotal)"
              />
            </div>
          </div>

          <div className={CARD_CLS}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  className="pointer-events-none absolute top-2.5 start-3 h-4 w-4 text-slate-400"
                  aria-hidden
                />
                <input
                  type="text"
                  value={dishSearch}
                  aria-label={isAr ? 'ابحث باسم الصنف أو العلامة' : 'Search item or brand'}
                  onChange={(e) => {
                    setDishSearch(e.target.value)
                    setMenuPage(1)
                  }}
                  placeholder={isAr ? 'ابحث باسم الصنف أو العلامة...' : 'Search item or brand...'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 ps-9 pe-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-white/5"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={dishSort}
                  aria-label={isAr ? 'ترتيب الأصناف' : 'Sort menu items'}
                  onChange={(e) => setDishSort(e.target.value as MenuSortKey)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                >
                  <option value="sales">{isAr ? 'ترتيب: الأعلى مبيعات' : 'Sort: Highest Sales'}</option>
                  <option value="units">{isAr ? 'ترتيب: الأعلى كمية' : 'Sort: Highest Units'}</option>
                  <option value="discount">{isAr ? 'ترتيب: الأعلى خصماً' : 'Sort: Highest Discount'}</option>
                </select>
                <select
                  value={String(menuPageSize)}
                  aria-label={isAr ? 'عدد الصفوف في الصفحة' : 'Items per page'}
                  onChange={(e) => {
                    const v = e.target.value
                    setMenuPageSize(v === 'all' ? 'all' : (Number(v) as 12 | 25))
                    setMenuPage(1)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                >
                  <option value="12">12</option>
                  <option value="25">25</option>
                  <option value="all">{isAr ? 'الكل' : 'All'}</option>
                </select>
              </div>
            </div>

            {cubeLoading && pagedDishes.length === 0 ? (
              <StateBlock state="loading" compact locale={resolvedLocale} skeletonRows={4} />
            ) : (cubeTimedOut || cubeError) && pagedDishes.length === 0 ? (
              <StateBlock
                state="error"
                compact
                locale={resolvedLocale}
                onRetry={() => setCubeRetryTick((n) => n + 1)}
              />
            ) : snapshot.menu.menuUnavailable && pagedDishes.length === 0 ? (
              <StateBlock state="unavailable" compact locale={resolvedLocale} />
            ) : pagedDishes.length === 0 ? (
              <StateBlock
                state="empty"
                compact
                locale={resolvedLocale}
                title={isAr ? 'لا توجد أصناف مطابقة في هذه الفترة' : 'No matching POS items in this period'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-white/10">
                      <th className="py-2.5 text-start">{isAr ? 'الصنف' : 'Item'}</th>
                      <th className="py-2.5 text-start">{isAr ? 'العلامة' : 'Brand'}</th>
                      <th className="py-2.5 text-end">{isAr ? 'الكمية' : 'Qty'}</th>
                      <th className="py-2.5 text-end">{isAr ? 'متوسط السعر الصافي' : 'Avg Net Price'}</th>
                      <th className="py-2.5 text-end">{isAr ? 'الخصم المسجّل' : 'POS Discount'}</th>
                      <th className="py-2.5 text-end">{isAr ? 'صافي المبيعات' : 'Net Sales'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-white/5">
                    {pagedDishes.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{d.name}</td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
                          {isAr ? d.brandAr : d.brandEn}
                        </td>
                        <td dir="ltr" className="py-2.5 text-end font-mono tabular-nums">
                          {f0(d.unitsSold, resolvedLocale)}
                        </td>
                        <td dir="ltr" className="py-2.5 text-end font-mono tabular-nums">
                          {formatKwd(d.unitPriceKwd, { locale: resolvedLocale })}
                        </td>
                        <td
                          dir="ltr"
                          className="py-2.5 text-end font-mono tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {formatKwd(d.discountKwd, { locale: resolvedLocale })} (
                          {f1Pct(d.avgDiscountPct, resolvedLocale)})
                        </td>
                        <td
                          dir="ltr"
                          className="py-2.5 text-end font-mono font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {formatKwd(d.salesKwd, { locale: resolvedLocale })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {menuPageSize !== 'all' && totalMenuPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="tabular-nums">
                  {isAr
                    ? `صفحة ${menuPage} من ${totalMenuPages}`
                    : `Page ${menuPage} of ${totalMenuPages}`}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={menuPage <= 1}
                    onClick={() => setMenuPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:border-white/10"
                  >
                    {isAr ? 'السابق' : 'Prev'}
                  </button>
                  <button
                    type="button"
                    disabled={menuPage >= totalMenuPages}
                    onClick={() => setMenuPage((p) => Math.min(totalMenuPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:border-white/10"
                  >
                    {isAr ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* =================================================================== */}
      {/* TAB 3: MARKETING & POS DISCOUNTS                                    */}
      {/* =================================================================== */}
      {!isInitialLoading && !noOdooData && activeTab === 'marketing' ? (
        <div className="space-y-6">
          {false && (
            <UnlinkedSourceNotice
              titleAr="منصات الإعلانات الخارجية وعائد المشاهير — غير مربوط بمصدر"
              titleEn="External Ad Platforms & Influencer Attribution — Not Linked to a Source"
              reasonAr="لا يوجد ربط برمجي مع منصات الإعلانات (Snap / TikTok / Meta) أو أكواد المشاهير في Odoo، لذلك أُزيلت مؤشرات العائد الثابتة وسلة العروض وخطط النمو الافتراضية. نعرض فقط خصومات الكاشير الفعلية المسجّلة في Odoo ومقارنة التواريخ اليدوية إن أدخلها المستخدم."
              reasonEn="External ad platforms and promo attribution are not connected to Odoo; static ROI, promo basket, and seeded campaigns were removed. Only actual Odoo POS discounts and user-entered date comparisons are shown."
            />
          )}

          {/* Actual Odoo POS Discounts Card */}
          {cubeLoading && !liveCube ? (
            <StateBlock state="loading" compact locale={resolvedLocale} skeletonRows={2} />
          ) : (cubeError || cubeTimedOut) && !liveCube ? (
            <StateBlock
              state="error"
              compact
              locale={resolvedLocale}
              onRetry={() => setCubeRetryTick((n) => n + 1)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className={KPI_CARD_CLS}>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'إجمالي خصومات نقاط البيع المسجّلة' : 'Recorded POS Line Discounts'}
                </div>
                <div
                  dir="ltr"
                  className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                >
                  {!liveCube ? (
                    <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                      {isAr ? 'غير متاح' : '—'}
                    </span>
                  ) : (
                    formatKwd(snapshot.marketing.posDiscountsKwd, { locale: resolvedLocale })
                  )}
                </div>
                <KpiProvenanceBadge
                  odooModel="pos.order.line"
                  dateRange={dateRangeLabel}
                  lastSyncAt={lastSyncAt}
                  isStale24h={isStale24h}
                  kind="فعلي"
                  queryOrFormula="sum(price_unit * qty * discount / 100)"
                />
              </div>

              <div className={KPI_CARD_CLS}>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'متوسط نسبة الخصم في POS' : 'Average POS Discount %'}
                </div>
                <div
                  dir="ltr"
                  className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                >
                  {!liveCube ? (
                    <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                      {isAr ? 'غير متاح' : '—'}
                    </span>
                  ) : (
                    f2Pct(snapshot.marketing.posAvgDiscountPct, resolvedLocale)
                  )}
                </div>
                <KpiProvenanceBadge
                  odooModel="pos.order.line"
                  dateRange={dateRangeLabel}
                  lastSyncAt={lastSyncAt}
                  isStale24h={isStale24h}
                  kind="محسوب بمعادلة"
                  queryOrFormula="totalDiscountKwd / grossBeforeDiscountKwd * 100"
                />
              </div>

              <div className={KPI_CARD_CLS}>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {isAr ? 'عدد السطور المخصومة في POS' : 'Discounted POS Lines'}
                </div>
                <div
                  dir="ltr"
                  className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                >
                  {!liveCube ? (
                    <span data-unavailable="true" title={unavailableTip} aria-label={unavailableTip}>
                      {isAr ? 'غير متاح' : '—'}
                    </span>
                  ) : (
                    f0(snapshot.marketing.posDiscountedLinesCount, resolvedLocale)
                  )}
                </div>
                <KpiProvenanceBadge
                  odooModel="pos.order.line"
                  dateRange={dateRangeLabel}
                  lastSyncAt={lastSyncAt}
                  isStale24h={isStale24h}
                  kind="فعلي"
                  queryOrFormula="count(pos.order.line where discount > 0)"
                />
              </div>
            </div>
          )}

          {/* User-entered Manual Campaign Window Comparison (0 seeded rows) */}
          <div className={CARD_CLS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr
                    ? 'سجل مقارنة فترات الحملات اليدوية بمبيعات Odoo اليومية'
                    : 'Manual Campaign Date Window Comparison vs Odoo Daily Sales'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {isAr
                    ? 'يقارن إجمالي مبيعات Odoo الفعلية في أيام الحملة مقابل الأيام المرجعية فقط دون نسبة عائد مفترضة.'
                    : 'Compares actual Odoo daily sales during user-logged dates vs baseline dates.'}
                </p>
              </div>
              <button
                type="button"
                aria-expanded={isAdFormOpen}
                onClick={() => {
                  resetCampaignForm()
                  setIsAdFormOpen((v) => !v)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              >
                {isAdFormOpen ? <X className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                <span>{isAr ? 'إضافة فترة حملة يدوية' : 'Log Campaign Window'}</span>
              </button>
            </div>

            {isAdFormOpen ? (
              <form
                onSubmit={handleSaveCampaign}
                className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div>
                  <label htmlFor="camp-brand" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {(() => {
                      const bc = deriveScopeCounts({ summary: liveSummary }).brandsCount
                      return isAr
                        ? `العلامة التجارية (${formatArBrandsNoun(bc)})`
                        : `Brand (${formatEnBrandsNoun(bc, 'lower')})`
                    })()}
                  </label>
                  <select
                    id="camp-brand"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value as Exclude<GlobalBrand, 'all'>)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                  >
                    {GLOBAL_BRAND_OPTIONS.filter((o) => o.id !== 'all').map((o) => (
                      <option key={o.id} value={o.id}>
                        {isAr ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="camp-branch" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'الفرع المستهدف' : 'Target Branch'}
                  </label>
                  <select
                    id="camp-branch"
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value as GlobalBranch)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                  >
                    {GLOBAL_BRANCH_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {isAr ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="camp-type" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'نوع الحملة' : 'Type'}
                  </label>
                  <select
                    id="camp-type"
                    value={formAdType}
                    onChange={(e) => setFormAdType(e.target.value as SocialAdType)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                  >
                    {SOCIAL_AD_TYPE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {isAr ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="camp-name" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'اسم الحملة' : 'Campaign Name'}
                  </label>
                  <input
                    id="camp-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                  />
                </div>

                <div>
                  <label htmlFor="camp-spend" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'التكلفة المدفوعة (د.ك)' : 'Spend (KWD)'}
                  </label>
                  <input
                    id="camp-spend"
                    type="number"
                    min="0"
                    step="0.001"
                    value={formSpend}
                    onChange={(e) => setFormSpend(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                  />
                </div>

                <div>
                  <label htmlFor="camp-start" className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'تاريخ البداية والنهاية' : 'Start & End Dates'}
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      id="camp-start"
                      type="date"
                      dir="ltr"
                      aria-label={isAr ? 'تاريخ بداية الحملة' : 'Campaign start date'}
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                    />
                    <input
                      id="camp-end"
                      type="date"
                      dir="ltr"
                      aria-label={isAr ? 'تاريخ نهاية الحملة' : 'Campaign end date'}
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdFormOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  >
                    {isAr ? 'حفظ الحملة' : 'Save'}
                  </button>
                </div>
              </form>
            ) : null}

            {snapshot.marketing.evaluations.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-white/10">
                {isAr
                  ? 'لا توجد حملات مسجّلة يدوياً (0 حملات افتراضية).'
                  : 'Zero manually logged campaigns (no seeded campaigns).'}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {snapshot.marketing.evaluations.map((ev) => {
                  const displayTitle = isBrokenOrEmptyCampaignName(ev.campaign.campaignName)
                    ? isAr
                      ? 'بدون حملة'
                      : 'No campaign'
                    : resolveCampaignDisplayName(ev.campaign, isAr)
                  return (
                    <div
                      key={ev.campaign.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {displayTitle} · {getBrandLabel(ev.campaign.brand, isAr)} (
                          {getBranchLabel(ev.campaign.branch ?? 'all', isAr)})
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                          <span dir="ltr">
                            {ev.startDate} → {ev.endDate}
                          </span>{' '}
                          · {isAr ? 'الإنفاق المدخل:' : 'Spend:'}{' '}
                          <span dir="ltr">
                            {formatKwd(ev.campaign.spendKwd, { locale: resolvedLocale })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-end font-mono tabular-nums">
                          <div>
                            {isAr ? 'فرق المبيعات اليومية:' : 'Daily Sales Delta:'}{' '}
                            {ev.noData ? (
                              <span
                                data-unavailable="true"
                                title={unavailableTip}
                                aria-label={unavailableTip}
                                className="font-bold text-slate-500"
                              >
                                {isAr ? 'غير متاح' : '—'}
                              </span>
                            ) : (
                              <span dir="ltr" className="font-bold">
                                {formatKwd(ev.liftSalesKwd, {
                                  locale: resolvedLocale,
                                  signed: true,
                                })}
                              </span>
                            )}
                          </div>
                          <KpiProvenanceBadge
                            odooModel="pos.order.line"
                            dateRange={`${ev.startDate} → ${ev.endDate}`}
                            lastSyncAt={lastSyncAt}
                            isStale24h={isStale24h}
                            kind="محسوب بمعادلة"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditCampaign(ev.campaign)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:hover:bg-white/10"
                          aria-label={isAr ? 'تعديل الحملة' : 'Edit campaign'}
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(ev.campaign.id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:hover:bg-rose-950/30"
                          aria-label={isAr ? 'حذف الحملة' : 'Delete campaign'}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CoresHubStudio
