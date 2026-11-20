'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { BRAND_SHARE_BASIS, sumShares } from '@/lib/aether/share-normalization'
import {
  Building2,
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
import { StateBlock, formatChartKwdTooltip } from '@/components/ui'
import type { OdooPeriodCube, OdooPeriodHourly } from '@/lib/odoo-live-connector'
import {
  formatPeriodCalendarWindow,
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  getBrandLabel,
  getBranchLabel,
  getPeriodLabel,
  type GlobalBranch,
  type GlobalBrand,
} from '@/lib/aether/global-filter-engine'
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
  'ae-bento-card relative overflow-visible rounded-2xl bg-white p-4 sm:p-6 shadow-[0_2px_6px_rgba(30,58,95,0.03)] ring-1 ring-[#1E3A5F]/[0.08] dark:bg-[#0F172A] dark:ring-slate-400/15'
const KPI_CARD_CLS =
  'relative overflow-visible flex min-w-0 flex-col justify-between rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_2px_6px_rgba(30,58,95,0.03)] ring-1 ring-[#1E3A5F]/[0.08] dark:bg-[#0F172A] dark:ring-slate-400/15'

export function resolveDynamicKpiGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 md:grid-cols-2'
  if (count === 3 || count === 6) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
}

function renderDynamicKpiRows(cards: readonly { key: string; node: React.ReactNode }[]) {
  if (cards.length === 0) return null
  if (cards.length === 5) {
    return (
      <div className="space-y-4">
        <div className={`grid gap-4 ${resolveDynamicKpiGridClass(3)}`}>
          {cards.slice(0, 3).map((item) => (
            <React.Fragment key={item.key}>{item.node}</React.Fragment>
          ))}
        </div>
        <div className={`grid gap-4 ${resolveDynamicKpiGridClass(2)}`}>
          {cards.slice(3).map((item) => (
            <React.Fragment key={item.key}>{item.node}</React.Fragment>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={`grid gap-4 ${resolveDynamicKpiGridClass(cards.length)}`}>
      {cards.map((item) => (
        <React.Fragment key={item.key}>{item.node}</React.Fragment>
      ))}
    </div>
  )
}

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
      className="flex flex-nowrap shrink-0 max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl bg-neutral-100/90 p-1 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
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

  // Manual campaign form state (strictly 6 approved brands)
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

  // Zero-sale channels / brands / branches are listed calmly in one line, never as 0.000 rows or cards.
  const idleChannels = snapshot.sales.channelRanking.filter((c) => !(c.salesKwd > 0))
  const idleBrands = snapshot.sales.brandShare.filter((b) => !(b.salesKwd > 0))
  const visibleCoreBranches = useMemo(
    () =>
      snapshot.sales.branchRanking.filter((b) => {
        const isZero = Math.abs(b.salesKwd) <= 0.0005 && (b.orders ?? 0) === 0
        return !isZero
      }),
    [snapshot.sales.branchRanking],
  )
  const idleCoreBranches = useMemo(
    () =>
      snapshot.sales.branchRanking.filter(
        (b) => b.id !== 'unattributed' && Math.abs(b.salesKwd) <= 0.0005 && (b.orders ?? 0) === 0,
      ),
    [snapshot.sales.branchRanking],
  )
  const hasVisibleCoreUnattributed = useMemo(
    () =>
      !snapshot.sales.branchesUnavailable &&
      (Math.abs(snapshot.sales.unattributedSalesKwd ?? 0) > 0.0005 ||
        (snapshot.sales.unattributedOrders ?? 0) > 0),
    [
      snapshot.sales.branchesUnavailable,
      snapshot.sales.unattributedOrders,
      snapshot.sales.unattributedSalesKwd,
    ],
  )
  const topCoreBranch = useMemo(
    () =>
      snapshot.sales.branchesUnavailable
        ? null
        : (snapshot.sales.branchRanking.find(
            (b) => b.id !== 'unattributed' && b.salesKwd > 0.0005,
          ) ?? null),
    [snapshot.sales.branchRanking, snapshot.sales.branchesUnavailable],
  )
  const topMenuDish = useMemo(
    () =>
      snapshot.menu.menuUnavailable
        ? null
        : (snapshot.menu.dishes.find((d) => d.salesKwd > 0.0005) ?? null),
    [snapshot.menu.dishes, snapshot.menu.menuUnavailable],
  )
  const channelRanks: HorizontalRankDatum[] = useMemo(
    () =>
      snapshot.sales.channelRanking.filter((c) => c.salesKwd > 0).map((c) => ({
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
    <div className="min-w-0 space-y-6 pb-24 sm:pb-10" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header & Core Tabs */}
      <div className={`${CARD_CLS} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="min-w-0 flex-1">
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

        <div className="shrink-0 max-w-full">
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
      </div>

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
          {(() => {
            const salesKpiCards: { key: string; node: React.ReactNode }[] = [
              {
                key: 'total-net-sales',
                node: (
                  <article className={KPI_CARD_CLS}>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isAr ? 'إجمالي صافي المبيعات' : 'Total Net Sales'}
                      </div>
                      <div
                        dir="ltr"
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
                    </div>
                    <KpiProvenanceBadge
                      odooModel="pos.order.line"
                      dateRange={dateRangeLabel}
                      lastSyncAt={lastSyncAt}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula="sum(pos.order.line.price_subtotal)"
                    />
                  </article>
                ),
              },
            ]

            if (
              (snapshot.sales.headline.aovKwd !== null &&
                snapshot.sales.headline.aovKwd > 0.0005) ||
              snapshot.sales.headline.netSalesKwd === null
            ) {
              salesKpiCards.push({
                key: 'average-order-value',
                node: (
                  <article className={KPI_CARD_CLS}>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isAr ? 'متوسط قيمة الطلب' : 'Average Order Value'}
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
                    </div>
                    <KpiProvenanceBadge
                      odooModel="pos.order.line + pos.order"
                      dateRange={dateRangeLabel}
                      lastSyncAt={lastSyncAt}
                      isStale24h={isStale24h}
                      kind="محسوب بمعادلة"
                      queryOrFormula="netSalesKwd / orders"
                    />
                  </article>
                ),
              })
            }

            if (
              !snapshot.sales.channelsUnavailable &&
              !(!liveCube && workspace.nullableSalesKwd === null) &&
              (snapshot.sales.zeroCommSalesKwd > 0.0005 ||
                snapshot.sales.aggregatorSalesKwd > 0.0005)
            ) {
              salesKpiCards.push({
                key: 'direct-vs-aggregators',
                node: (
                  <article className={KPI_CARD_CLS}>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {isAr ? 'القنوات المباشرة مقابل التطبيقات' : 'Direct vs Aggregators'}
                      </div>
                      <div className="mt-1.5 font-mono text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                        <span dir="ltr">{formatKwd(snapshot.sales.zeroCommSalesKwd, { locale: resolvedLocale })}</span>{' '}
                        {isAr ? 'مباشر' : 'direct'} ({f1Pct(snapshot.sales.zeroCommSharePct, resolvedLocale)})
                      </div>
                      <div className="mt-0.5 font-mono text-xs tabular-nums text-[#0F766E] dark:text-emerald-300">
                        <span dir="ltr">{formatKwd(snapshot.sales.aggregatorSalesKwd, { locale: resolvedLocale })}</span>{' '}
                        {isAr ? 'تطبيقات' : 'apps'} ({f1Pct(snapshot.sales.aggregatorSharePct, resolvedLocale)})
                      </div>
                    </div>
                    <KpiProvenanceBadge
                      odooModel="pos.order.line + pos.payment"
                      dateRange={dateRangeLabel}
                      lastSyncAt={lastSyncAt}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula="Classified by pos.payment_method_id & pos.config_id"
                    />
                  </article>
                ),
              })
            }

            if (topCoreBranch !== null) {
              const topBranchLabel = isAr ? topCoreBranch.labelAr : topCoreBranch.labelEn
              salesKpiCards.push({
                key: 'top-performing-branch',
                node: (
                  <article className={KPI_CARD_CLS}>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {isAr ? 'الفرع الأعلى أداءً' : 'Top Performing Branch'}
                        </div>
                        <span
                          dir="ltr"
                          className="shrink-0 whitespace-nowrap rounded-full bg-[#D1FAE5] px-2 py-0.5 text-xs font-bold tabular-nums text-[#1E3A5F] ring-1 ring-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25"
                        >
                          {f1Pct(topCoreBranch.sharePct, resolvedLocale)}
                        </span>
                      </div>
                      <div
                        title={topBranchLabel}
                        className="mt-1 min-w-0 truncate text-sm font-bold text-emerald-700 dark:text-emerald-300"
                      >
                        {topBranchLabel}
                      </div>
                      <div
                        dir="ltr"
                        className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white"
                      >
                        {f3(topCoreBranch.salesKwd, resolvedLocale)}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          {isAr ? 'د.ك' : 'KWD'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                        {f0(topCoreBranch.orders, resolvedLocale)} {isAr ? 'طلب' : 'orders'}
                      </div>
                    </div>
                    <KpiProvenanceBadge
                      odooModel="pos.order.line + pos.config"
                      dateRange={dateRangeLabel}
                      lastSyncAt={lastSyncAt}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula="max(pos.order net sales by mapped branch)"
                    />
                  </article>
                ),
              })
            }

            if (hasVisibleCoreUnattributed) {
              salesKpiCards.push({
                key: 'unattributed-branch',
                node: (
                  <article data-unattributed-card="true" className={KPI_CARD_CLS}>
                    <div>
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {isAr ? UNATTRIBUTED_BRANCH_LABEL_AR : UNATTRIBUTED_BRANCH_LABEL_EN}
                      </div>
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
                    </div>
                    <KpiProvenanceBadge
                      odooModel="pos.order + pos.config"
                      dateRange={dateRangeLabel}
                      lastSyncAt={lastSyncAt}
                      isStale24h={isStale24h}
                      kind="فعلي"
                      queryOrFormula="POS orders where config_id has no unambiguous branch mapping"
                    />
                  </article>
                ),
              })
            }

            return renderDynamicKpiRows(salesKpiCards)
          })()}

          {/* Daily Sales Timeline (hidden on 1-day windows so Hourly Profile takes its slot) */}
          {!snapshot.isSingleDayWindow ? (
            <div className={CARD_CLS}>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr ? 'المسار اليومي لصافي المبيعات' : 'Daily Net Sales Timeline'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isAr
                      ? `أقوى يوم في الفترة: ${snapshot.sales.strongestDayLabelAr} · ${dateRangeLabel} · د.ك`
                      : `Strongest day in window: ${snapshot.sales.strongestDayLabelEn} · ${dateRangeLabel} · KWD`}
                  </p>
                </div>
                <div className="shrink-0">
                  <KpiProvenanceBadge
                    odooModel="pos.order.line"
                    dateRange={dateRangeLabel}
                    lastSyncAt={lastSyncAt}
                    isStale24h={isStale24h}
                    kind="فعلي"
                  />
                </div>
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
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
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
              <div className="shrink-0">
                <KpiProvenanceBadge
                  odooModel="pos.order"
                  dateRange={dateRangeLabel}
                  lastSyncAt={lastSyncAt}
                  isStale24h={isStale24h}
                  kind="فعلي"
                  queryOrFormula="Grouped by Asia/Kuwait hour of pos.order.date_order"
                />
              </div>
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
                    ? `مجموع الساعات ${formatKwd(snapshot.sales.hourlyReconciliation.hourlySumKwd, { locale: resolvedLocale })} · إجمالي الفترة ${formatKwd(snapshot.sales.hourlyReconciliation.periodTotalKwd, { locale: resolvedLocale })}`
                    : `Σ hourly ${formatKwd(snapshot.sales.hourlyReconciliation.hourlySumKwd, { locale: resolvedLocale })} · period total ${formatKwd(snapshot.sales.hourlyReconciliation.periodTotalKwd, { locale: resolvedLocale })}`}
              </p>
            ) : null}
          </div>

          {/* 3-Column Breakdown: Mapped Branches (+ Unattributed if > 0) | 6 Brands | Channels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Branches */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {hasVisibleCoreUnattributed
                  ? isAr
                    ? 'الفروع السبعة + غير منسوب لفرع'
                    : '7 Branches + Unattributed Row'
                  : isAr
                    ? 'أداء الفروع المربوطة'
                    : 'Mapped Restaurant Branches'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAr
                  ? 'فروع مربوطة في نقاط بيع أودو 17 — صافي المبيعات والطلبات دون أي توزيع اصطناعي'
                  : 'Mapped Odoo 17 POS branch locations — net sales & orders with zero forced allocation'}
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
                  <>
                    {visibleCoreBranches.map((b) => {
                      const isUnattr = b.id === 'unattributed'
                      const branchLabel = isAr ? b.labelAr : b.labelEn
                      return (
                        <div
                          key={b.id}
                          className={`flex items-center justify-between gap-2 min-w-0 py-2.5 text-xs ${
                            isUnattr
                              ? 'rounded-lg px-2 font-semibold bg-slate-100 text-slate-700 ring-1 ring-slate-300/60 dark:bg-white/[0.06] dark:text-slate-200 dark:ring-white/15'
                              : ''
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                                isUnattr
                                  ? 'bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-emerald-600/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                              }`}
                            >
                              <Building2 className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4
                                title={branchLabel}
                                className="min-w-0 flex-1 truncate font-semibold text-slate-900 dark:text-white"
                              >
                                {branchLabel}
                              </h4>
                              <div className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                                {f0(b.orders, resolvedLocale)} {isAr ? 'طلب' : 'orders'}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                            <span
                              dir="ltr"
                              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                                isUnattr
                                  ? 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                  : 'bg-[#D1FAE5] text-[#1E3A5F] ring-1 ring-emerald-500/25 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/25'
                              }`}
                            >
                              {f1Pct(b.sharePct, resolvedLocale)}
                            </span>
                            <span dir="ltr" className="shrink-0 whitespace-nowrap font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                              {formatKwd(b.salesKwd, { locale: resolvedLocale })}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    {idleCoreBranches.length > 0 ? (
                      <p data-idle-branches="true" className="py-2 text-xs text-slate-500 dark:text-slate-400">
                        {isAr ? 'بلا مبيعات في هذه الفترة: ' : 'No sales in this period: '}
                        {idleCoreBranches.map((b) => (isAr ? b.labelAr : b.labelEn)).join(isAr ? '، ' : ', ')}
                      </p>
                    ) : null}
                  </>
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

            {/* 6 Brands */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'العلامات التجارية الست' : '6 Restaurant Brands'}
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
                    centerLabel={isAr ? 'مبيعات الأصناف' : 'Item sales'}
                    isAr={isAr}
                  />
                ) : null}
                {snapshot.sales.brandReconciliation ? (
                  <p data-brand-reconciliation="true" className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                    {Math.abs(snapshot.sales.brandReconciliation.gapKwd) < 0.0005 ? (
                      <>✓ {isAr ? 'مطابق لصافي نقاط البيع' : 'Matches POS net sales'}</>
                    ) : (
                      <>
                        {isAr ? 'مبيعات الأصناف حسب العلامة' : 'Item sales by brand'}{' '}
                        <span dir="ltr" className="font-semibold tabular-nums">{formatKwd(snapshot.sales.brandReconciliation.brandTotalKwd, { locale: resolvedLocale })}</span>
                        {' · '}
                        {isAr ? 'صافي نقاط البيع' : 'POS net'}{' '}
                        <span dir="ltr" className="font-semibold tabular-nums">{formatKwd(snapshot.sales.brandReconciliation.posNetKwd, { locale: resolvedLocale })}</span>
                        {' · '}
                        {isAr ? 'الفرق' : 'gap'}{' '}
                        <span dir="ltr" className="font-semibold tabular-nums">{formatKwd(snapshot.sales.brandReconciliation.gapKwd, { locale: resolvedLocale })}</span>
                        {isAr
                          ? ' — خصومات على مستوى الطلب ورسوم التوصيل وأصناف خارج العلامات الست.'
                          : ' — order-level discounts, delivery fees and items outside the six brands.'}
                      </>
                    )}
                  </p>
                ) : null}
                {snapshot.sales.registerReconciliation ? (
                  <div data-register-reconciliation="true" className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-[#1E3A5F] dark:text-slate-100">
                      {isAr ? 'مطابقة صناديق نقاط البيع' : 'POS register reconciliation'}
                    </p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {snapshot.sales.registerReconciliation.rows.map((row) => (
                        <li key={row.configId} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate" title={row.configName}>
                            {row.configName}
                            <span className="ms-1 text-xs text-[#4F6673]">
                              {row.bucket === 'exhibition-booths'
                                ? isAr
                                  ? 'بوثات المعارض'
                                  : 'Exhibition booths'
                                : row.bucket === 'school-canteen'
                                  ? isAr
                                    ? 'مقاصف المدارس'
                                    : 'School canteens'
                                  : isAr
                                    ? 'مطاعم'
                                    : 'Restaurants'}
                            </span>
                          </span>
                          <span dir="ltr" className="shrink-0 whitespace-nowrap font-semibold tabular-nums">
                            {formatKwd(row.netKwd, { locale: resolvedLocale })}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {isAr ? 'مجموع الصناديق المشمولة' : 'Included registers'}{' '}
                      <span dir="ltr" className="font-semibold tabular-nums">
                        {formatKwd(snapshot.sales.registerReconciliation.includedNetKwd, { locale: resolvedLocale })}
                      </span>
                      {' · '}
                      {isAr ? 'صافي الشركة' : 'Company net'}{' '}
                      <span dir="ltr" className="font-semibold tabular-nums">
                        {formatKwd(snapshot.sales.registerReconciliation.companyNetKwd, { locale: resolvedLocale })}
                      </span>
                      {Math.abs(snapshot.sales.registerReconciliation.gapKwd) >= 0.0005 ? (
                        <>
                          {' · '}
                          {isAr ? 'الفرق' : 'Gap'}{' '}
                          <span dir="ltr" className="font-semibold tabular-nums">
                            {formatKwd(snapshot.sales.registerReconciliation.gapKwd, { locale: resolvedLocale })}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                ) : null}
              </div>
              {!snapshot.sales.brandsUnavailable ? (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                  {snapshot.sales.brandShare.filter((b) => b.salesKwd > 0).map((b) => {
                    const brandTitle = isAr ? b.labelAr : b.labelEn
                    return (
                      <div key={b.id} className="flex items-center justify-between gap-2 min-w-0 py-2 text-xs">
                        <span
                          title={brandTitle}
                          className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200"
                        >
                          {brandTitle}
                        </span>
                        <span
                          dir="ltr"
                          className="shrink-0 whitespace-nowrap font-mono font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {formatKwd(b.salesKwd, { locale: resolvedLocale })} ({f1Pct(b.sharePct, resolvedLocale)})
                        </span>
                      </div>
                    )
                  })}
                  {idleBrands.length > 0 ? (
                    <p data-idle-brands="true" className="py-2 text-xs text-slate-500 dark:text-slate-400">
                      {isAr ? 'بلا مبيعات في هذه الفترة: ' : 'No sales in this period: '}
                      {idleBrands.map((b) => (isAr ? b.labelAr : b.labelEn)).join(isAr ? '، ' : ', ')}
                    </p>
                  ) : null}
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
                  <>
                    <InteractiveHorizontalRankList items={channelRanks} isAr={isAr} />
                    {idleChannels.length > 0 ? (
                      <p data-idle-channels="true" className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {isAr ? 'بلا مبيعات في هذه الفترة: ' : 'No sales in this period: '}
                        {idleChannels.map((c) => (isAr ? c.labelAr : c.labelEn)).join(isAr ? '، ' : ', ')}
                      </p>
                    ) : null}
                  </>
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
          {!snapshot.menu.menuUnavailable && snapshot.menu.dishes.length > 0
            ? (() => {
                const menuKpiCards: { key: string; node: React.ReactNode }[] = [
                  {
                    key: 'sold-skus',
                    node: (
                      <article className={KPI_CARD_CLS}>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {isAr ? 'عدد الأصناف المباعة (أعلى الأصناف)' : 'Sold SKUs (Top Items)'}
                          </div>
                          <div
                            dir="ltr"
                            className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                          >
                            {f0(snapshot.menu.totalActiveSkus, resolvedLocale)}
                          </div>
                        </div>
                        <KpiProvenanceBadge
                          odooModel="pos.order.line"
                          dateRange={dateRangeLabel}
                          lastSyncAt={lastSyncAt}
                          isStale24h={isStale24h}
                          kind="فعلي"
                        />
                      </article>
                    ),
                  },
                  {
                    key: 'total-units',
                    node: (
                      <article className={KPI_CARD_CLS}>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {isAr ? 'إجمالي الوحدات المباعة' : 'Total Units Sold'}
                          </div>
                          <div
                            dir="ltr"
                            className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                          >
                            {f0(snapshot.menu.totalUnitsSold, resolvedLocale)}
                          </div>
                        </div>
                        <KpiProvenanceBadge
                          odooModel="pos.order.line"
                          dateRange={dateRangeLabel}
                          lastSyncAt={lastSyncAt}
                          isStale24h={isStale24h}
                          kind="فعلي"
                          queryOrFormula="sum(pos.order.line.qty)"
                        />
                      </article>
                    ),
                  },
                  {
                    key: 'displayed-skus-sales',
                    node: (
                      <article className={KPI_CARD_CLS}>
                        <div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {isAr ? 'صافي مبيعات الأصناف المعروضة' : 'Displayed SKUs Net Sales'}
                          </div>
                          <div
                            dir="ltr"
                            className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                          >
                            {f3(snapshot.menu.totalSalesKwd, resolvedLocale)}{' '}
                            <span className="text-xs font-normal">{isAr ? 'د.ك' : 'KWD'}</span>
                          </div>
                        </div>
                        <KpiProvenanceBadge
                          odooModel="pos.order.line"
                          dateRange={dateRangeLabel}
                          lastSyncAt={lastSyncAt}
                          isStale24h={isStale24h}
                          kind="فعلي"
                          queryOrFormula="sum(pos.order.line.price_subtotal)"
                        />
                      </article>
                    ),
                  },
                ]

                if (topMenuDish !== null) {
                  menuKpiCards.push({
                    key: 'top-menu-dish',
                    node: (
                      <article className={KPI_CARD_CLS}>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {isAr ? 'الصنف الأعلى مبيعاً' : 'Top Selling Item'}
                          </div>
                          <div
                            title={topMenuDish.name}
                            className="mt-1 min-w-0 truncate text-sm font-bold text-emerald-700 dark:text-emerald-300"
                          >
                            {topMenuDish.name}
                          </div>
                          <div
                            dir="ltr"
                            className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white"
                          >
                            {f3(topMenuDish.salesKwd, resolvedLocale)}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              {isAr ? 'د.ك' : 'KWD'}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
                            {f0(topMenuDish.unitsSold, resolvedLocale)} {isAr ? 'وحدة' : 'units'}
                          </div>
                        </div>
                        <KpiProvenanceBadge
                          odooModel="pos.order.line"
                          dateRange={dateRangeLabel}
                          lastSyncAt={lastSyncAt}
                          isStale24h={isStale24h}
                          kind="فعلي"
                          queryOrFormula="max(pos.order.line.price_subtotal by product_id)"
                        />
                      </article>
                    ),
                  })
                }

                return renderDynamicKpiRows(menuKpiCards)
              })()
            : null}

          <div className={CARD_CLS}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1">
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

              <div className="flex flex-nowrap shrink-0 items-center gap-2 text-xs">
                <select
                  value={dishSort}
                  aria-label={isAr ? 'ترتيب الأصناف' : 'Sort menu items'}
                  onChange={(e) => setDishSort(e.target.value as MenuSortKey)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
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
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
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
              <StateBlock
                state="unavailable"
                compact
                locale={resolvedLocale}
                description={
                  isAr
                    ? 'تعذّر التحقق من قراءات أصناف نقاط البيع حالياً — لا تُعرض أرقام تقديرية.'
                    : 'POS menu item metrics could not be verified right now — no estimated figures shown.'
                }
              />
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
                      <th className="whitespace-nowrap py-2.5 text-start">{isAr ? 'الصنف' : 'Item'}</th>
                      <th className="whitespace-nowrap py-2.5 text-start">{isAr ? 'العلامة' : 'Brand'}</th>
                      <th className="whitespace-nowrap py-2.5 text-end">{isAr ? 'الكمية' : 'Qty'}</th>
                      <th className="whitespace-nowrap py-2.5 text-end">{isAr ? 'متوسط السعر الصافي' : 'Avg Net Price'}</th>
                      <th className="whitespace-nowrap py-2.5 text-end">{isAr ? 'الخصم المسجّل' : 'POS Discount'}</th>
                      <th className="whitespace-nowrap py-2.5 text-end">{isAr ? 'صافي المبيعات' : 'Net Sales'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums dark:divide-white/5">
                    {pagedDishes.map((d) => (
                      <tr key={d.id}>
                        <td
                          title={d.name}
                          className="max-w-[260px] truncate py-2.5 pe-3 font-semibold text-slate-900 dark:text-white"
                        >
                          {d.name}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pe-3 text-slate-600 dark:text-slate-300">
                          {isAr ? d.brandAr : d.brandEn}
                        </td>
                        <td dir="ltr" className="whitespace-nowrap py-2.5 text-end font-mono tabular-nums">
                          {f0(d.unitsSold, resolvedLocale)}
                        </td>
                        <td dir="ltr" className="whitespace-nowrap py-2.5 text-end font-mono tabular-nums">
                          {formatKwd(d.unitPriceKwd, { locale: resolvedLocale })}
                        </td>
                        <td
                          dir="ltr"
                          className="whitespace-nowrap py-2.5 text-end font-mono tabular-nums text-slate-700 dark:text-slate-300"
                        >
                          {formatKwd(d.discountKwd, { locale: resolvedLocale })} (
                          {f1Pct(d.avgDiscountPct, resolvedLocale)})
                        </td>
                        <td
                          dir="ltr"
                          className="whitespace-nowrap py-2.5 text-end font-mono font-bold tabular-nums text-slate-900 dark:text-white"
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
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="tabular-nums">
                  {isAr
                    ? `صفحة ${menuPage} من ${totalMenuPages}`
                    : `Page ${menuPage} of ${totalMenuPages}`}
                </span>
                <div className="flex flex-nowrap shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={menuPage <= 1}
                    onClick={() => setMenuPage((p) => Math.max(1, p - 1))}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:border-white/10"
                  >
                    {isAr ? 'السابق' : 'Prev'}
                  </button>
                  <button
                    type="button"
                    disabled={menuPage >= totalMenuPages}
                    onClick={() => setMenuPage((p) => Math.min(totalMenuPages, p + 1))}
                    className="shrink-0 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 dark:border-white/10"
                  >
                    {isAr ? 'التالي' : 'Next'}
                  </button>
                </div>
              </div>
            ) : null}

            <KpiProvenanceBadge
              odooModel="pos.order.line"
              dateRange={dateRangeLabel}
              lastSyncAt={lastSyncAt}
              isStale24h={isStale24h}
              kind="فعلي"
              queryOrFormula="pos.order.line grouped by product_id"
            />
          </div>
        </div>
      ) : null}

      {/* =================================================================== */}
      {/* TAB 3: MARKETING & POS DISCOUNTS                                    */}
      {/* =================================================================== */}
      {!isInitialLoading && !noOdooData && activeTab === 'marketing' ? (
        <div className="space-y-6">
          {/* Actual Odoo POS Discounts Cards */}
          {cubeLoading && !liveCube ? (
            <StateBlock state="loading" compact locale={resolvedLocale} skeletonRows={2} />
          ) : (cubeError || cubeTimedOut) && !liveCube ? (
            <StateBlock
              state="error"
              compact
              locale={resolvedLocale}
              onRetry={() => setCubeRetryTick((n) => n + 1)}
            />
          ) : !liveCube ? (
            <StateBlock
              state="unavailable"
              compact
              locale={resolvedLocale}
              title={isAr ? 'خصومات نقاط البيع غير متاحة حالياً' : 'Recorded POS Line Discounts — Unavailable'}
              description={
                isAr
                  ? 'بانتظار مكعب سطور نقاط البيع التفصيلي (pos.order.line) للفترة المحددة.'
                  : 'Detailed POS order-line discount metrics require the live period cube (pos.order.line).'
              }
            />
          ) : (
            (() => {
              const marketingKpiCards: { key: string; node: React.ReactNode }[] = [
                {
                  key: 'pos-discounts-kwd',
                  node: (
                    <article className={KPI_CARD_CLS}>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {isAr ? 'إجمالي خصومات نقاط البيع المسجّلة' : 'Recorded POS Line Discounts'}
                        </div>
                        <div
                          dir="ltr"
                          className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {formatKwd(snapshot.marketing.posDiscountsKwd, { locale: resolvedLocale })}
                        </div>
                      </div>
                      <KpiProvenanceBadge
                        odooModel="pos.order.line"
                        dateRange={dateRangeLabel}
                        lastSyncAt={lastSyncAt}
                        isStale24h={isStale24h}
                        kind="فعلي"
                        queryOrFormula="sum(price_unit * qty * discount / 100)"
                      />
                    </article>
                  ),
                },
                {
                  key: 'pos-avg-discount-pct',
                  node: (
                    <article className={KPI_CARD_CLS}>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {isAr ? 'متوسط نسبة الخصم في POS' : 'Average POS Discount %'}
                        </div>
                        <div
                          dir="ltr"
                          className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {f2Pct(snapshot.marketing.posAvgDiscountPct, resolvedLocale)}
                        </div>
                      </div>
                      <KpiProvenanceBadge
                        odooModel="pos.order.line"
                        dateRange={dateRangeLabel}
                        lastSyncAt={lastSyncAt}
                        isStale24h={isStale24h}
                        kind="محسوب بمعادلة"
                        queryOrFormula="totalDiscountKwd / grossBeforeDiscountKwd * 100"
                      />
                    </article>
                  ),
                },
                {
                  key: 'pos-discounted-lines',
                  node: (
                    <article className={KPI_CARD_CLS}>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {isAr ? 'عدد السطور المخصومة في POS' : 'Discounted POS Lines'}
                        </div>
                        <div
                          dir="ltr"
                          className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {f0(snapshot.marketing.posDiscountedLinesCount, resolvedLocale)}
                        </div>
                      </div>
                      <KpiProvenanceBadge
                        odooModel="pos.order.line"
                        dateRange={dateRangeLabel}
                        lastSyncAt={lastSyncAt}
                        isStale24h={isStale24h}
                        kind="فعلي"
                        queryOrFormula="count(pos.order.line where discount > 0)"
                      />
                    </article>
                  ),
                },
              ]

              if (snapshot.marketing.evaluations.length > 0) {
                marketingKpiCards.push({
                  key: 'logged-campaign-windows',
                  node: (
                    <article className={KPI_CARD_CLS}>
                      <div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {isAr ? 'فترات الحملات المسجّلة' : 'Logged Campaign Windows'}
                        </div>
                        <div
                          dir="ltr"
                          className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white"
                        >
                          {f0(snapshot.marketing.evaluations.length, resolvedLocale)}
                        </div>
                      </div>
                      <KpiProvenanceBadge
                        odooModel="pos.order.line"
                        dateRange={dateRangeLabel}
                        lastSyncAt={lastSyncAt}
                        isStale24h={isStale24h}
                        kind="محسوب بمعادلة"
                        queryOrFormula="Compared against Odoo daily POS sales"
                      />
                    </article>
                  ),
                })
              }

              return renderDynamicKpiRows(marketingKpiCards)
            })()
          )}

          {/* User-entered Manual Campaign Window Comparison (0 seeded rows) */}
          <div className={CARD_CLS}>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
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
                className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
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
                    {isAr ? 'العلامة التجارية (6 علامات)' : 'Brand (6 brands)'}
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
                  <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <input
                      id="camp-start"
                      type="date"
                      dir="ltr"
                      aria-label={isAr ? 'تاريخ بداية الحملة' : 'Campaign start date'}
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
                    />
                    <input
                      id="camp-end"
                      type="date"
                      dir="ltr"
                      aria-label={isAr ? 'تاريخ نهاية الحملة' : 'Campaign end date'}
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10 dark:bg-[#0B1410]"
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
                  const fullCampaignLabel = `${displayTitle} · ${getBrandLabel(ev.campaign.brand, isAr)} (${getBranchLabel(ev.campaign.branch ?? 'all', isAr)})`
                  return (
                    <div
                      key={ev.campaign.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10"
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          title={fullCampaignLabel}
                          className="truncate font-bold text-slate-900 dark:text-white"
                        >
                          {fullCampaignLabel}
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
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-end font-mono tabular-nums">
                          <div className="whitespace-nowrap">
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
                          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:hover:bg-white/10"
                          aria-label={isAr ? 'تعديل الحملة' : 'Edit campaign'}
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(ev.campaign.id)}
                          className="shrink-0 rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:hover:bg-rose-950/30"
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
