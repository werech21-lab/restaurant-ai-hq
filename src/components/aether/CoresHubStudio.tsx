'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { KpiProvenanceBadge } from '@/components/erp/KpiProvenanceBadge'
import { OdooPartialWarningBanner } from '@/components/erp/OdooPartialWarningBanner'
import { UnlinkedSourceNotice } from '@/components/erp/UnlinkedSourceNotice'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
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

const f0 = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString('en-US')
const f1 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
const f2 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
const f3 = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'rounded-2xl bg-white p-4 ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:ring-emerald-500/10'

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
            className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 focus:outline-none ${
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
}: {
  initialTab?: CoreTabId
} = {}) {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace, liveSummary } = useGlobalFilter()

  const [activeTab, setActiveTab] = useState<CoreTabId>(initialTab)
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([])
  const [isAdFormOpen, setIsAdFormOpen] = useState(false)
  const [liveCube, setLiveCube] = useState<OdooPeriodCube | null>(null)
  const [cubeLoading, setCubeLoading] = useState(false)
  const [cubeTimedOut, setCubeTimedOut] = useState(false)

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

  // Fetch period-accurate OdooPeriodCube (`pos.order.line`, `pos.order`, `pos.payment`)
  useEffect(() => {
    let cancelled = false
    const fromIso = periodWin.fromIso
    const toIso = periodWin.toInclusiveIso
    if (!fromIso || !toIso) return
    setCubeLoading(true)
    setCubeTimedOut(false)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    fetch(
      `/api/erp/live-comparison?dateA=${encodeURIComponent(fromIso)}&toA=${encodeURIComponent(toIso)}&dateB=${encodeURIComponent(fromIso)}&toB=${encodeURIComponent(toIso)}`,
      { cache: 'no-store', signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.cubeA) {
          setLiveCube(data.cubeA as OdooPeriodCube)
        } else {
          setLiveCube(null)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLiveCube(null)
        setCubeTimedOut(error instanceof DOMException && error.name === 'AbortError')
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
  }, [periodWin.fromIso, periodWin.toInclusiveIso])

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
    () => computeCoresHubSnapshot(filters, campaigns, liveSummary, liveCube),
    [filters, campaigns, liveSummary, liveCube],
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
            value: `${f1(pt.salesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
            bold: true,
          },
          {
            label: isAr ? 'الطلبات' : 'Orders',
            value: f0(pt.orders),
          },
        ],
      })),
    [snapshot.sales.timeline, isAr],
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
            value: `${f1(pt.salesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
            bold: true,
          },
          {
            label: isAr ? 'الطلبات' : 'Orders',
            value: f0(pt.orders),
          },
        ],
      })),
    [snapshot.sales.hourly, isAr],
  )

  const brandDonut: DonutSliceDatum[] = useMemo(
    () =>
      snapshot.sales.brandShare
        .filter((b) => b.salesKwd > 0)
        .map((b) => ({
          id: b.id,
          label: isAr ? b.labelAr : b.labelEn,
          value: b.salesKwd,
          valueFormatted: `${f1(b.salesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
          pctFormatted: `${f1(b.sharePct)}%`,
          color: b.color ?? '#10B981',
        })),
    [snapshot.sales.brandShare, isAr],
  )

  const channelRanks: HorizontalRankDatum[] = useMemo(
    () =>
      snapshot.sales.channelRanking.map((c) => ({
        id: c.id,
        label: isAr ? c.labelAr : c.labelEn,
        value: c.salesKwd,
        valueFormatted: `${f1(c.salesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
        subLabel: `${f0(c.orders)} ${isAr ? 'طلب' : 'orders'} · ${f1(c.sharePct)}%`,
        color: c.color ?? '#10B981',
        lines: [
          {
            label: isAr ? 'صافي المبيعات' : 'Net Sales',
            value: `${f3(c.salesKwd)} ${isAr ? 'د.ك' : 'KWD'}`,
            bold: true,
          },
          {
            label: isAr ? 'الطلبات' : 'Orders',
            value: f0(c.orders),
          },
          {
            label: isAr ? 'الحصة' : 'Share',
            value: `${f1(c.sharePct)}%`,
          },
        ],
      })),
    [snapshot.sales.channelRanking, isAr],
  )

  const noOdooData = !workspace.odooConnected || workspace.noData || snapshot.noData

  return (
    <div className="space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header & Core Tabs */}
      <div className={`${CARD_CLS} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {isAr
              ? 'نواة المبيعات والقنوات والمينيو والتسويق'
              : 'Sales, Channels, Menu & Marketing Core'}
          </h1>
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

      {/* Disconnected / Empty Odoo state — zero invented numbers */}
      {noOdooData ? (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-8 text-center dark:border-amber-500/30 dark:bg-amber-950/20">
          <div className="text-base font-bold text-amber-950 dark:text-amber-200">
            {isAr
              ? 'لا توجد بيانات من Odoo لهذه الفترة'
              : 'No data from Odoo for this period'}
          </div>
          <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300/90">
            {workspace.noDataMessageAr ||
              (isAr
                ? 'تعذّر جلب سجلات نقاط البيع الفعليّة للفترة المحددة أو لا توجد حركات مسجّلة في Odoo.'
                : 'Could not retrieve POS records for the selected window or zero movements exist in Odoo.')}
          </p>
        </div>
      ) : null}

      {/* =================================================================== */}
      {/* TAB 1: SALES & CHANNELS                                             */}
      {/* =================================================================== */}
      {!noOdooData && activeTab === 'sales' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {isAr ? 'إجمالي صافي المبيعات' : 'Total Net Sales'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {liveCube
                  ? `${f3(liveCube.totals.netSalesKwd)} `
                  : workspace.nullableSalesKwd === null
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : `${f3(workspace.nullableSalesKwd)} `}
                {liveCube || workspace.nullableSalesKwd !== null ? (
                  <span className="text-xs font-normal text-slate-500">{isAr ? 'د.ك' : 'KWD'}</span>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {liveCube
                  ? `${f0(liveCube.totals.orders)} ${isAr ? 'طلب مسجّل' : 'POS orders'}`
                  : workspace.nullableOrders === null
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : `${f0(workspace.nullableOrders)} ${isAr ? 'طلب مسجّل' : 'POS orders'}`}
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
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {liveCube
                  ? `${f3(liveCube.totals.aovKwd)} `
                  : workspace.nullableAovKwd === null
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : `${f3(workspace.nullableAovKwd)} `}
                {liveCube || workspace.nullableAovKwd !== null ? (
                  <span className="text-xs font-normal text-slate-500">{isAr ? 'د.ك' : 'KWD'}</span>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
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
              {snapshot.sales.channelsUnavailable ? (
                <div className="mt-1.5 font-mono text-lg font-bold text-slate-700 dark:text-slate-200">
                  {isAr ? 'غير متاح' : '—'}
                </div>
              ) : (
                <>
                  <div className="mt-1.5 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {f1(snapshot.sales.zeroCommSalesKwd)} {isAr ? 'د.ك مباشر' : 'KWD direct'} (
                    {f1(snapshot.sales.zeroCommSharePct)}%)
                  </div>
                  <div className="mt-0.5 text-[11px] font-mono text-sky-700 dark:text-sky-300">
                    {f1(snapshot.sales.aggregatorSalesKwd)} {isAr ? 'د.ك تطبيقات' : 'KWD apps'} (
                    {f1(snapshot.sales.aggregatorSharePct)}%)
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

            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {isAr ? UNATTRIBUTED_BRANCH_LABEL_AR : UNATTRIBUTED_BRANCH_LABEL_EN}
              </div>
              {snapshot.sales.branchesUnavailable ? (
                <div className="mt-1.5 font-mono text-2xl font-bold text-amber-800 dark:text-amber-300">
                  {isAr ? 'غير متاح' : '—'}
                </div>
              ) : (
                <>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-amber-800 dark:text-amber-300">
                    {f3(snapshot.sales.unattributedSalesKwd)}{' '}
                    <span className="text-xs font-normal">{isAr ? 'د.ك' : 'KWD'}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-amber-700/90 dark:text-amber-300/80">
                    {f0(snapshot.sales.unattributedOrders)}{' '}
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

          {/* Daily Sales Timeline */}
          <div className={CARD_CLS}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'المسار اليومي لصافي المبيعات' : 'Daily Net Sales Timeline'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isAr
                    ? `أقوى يوم في الفترة: ${snapshot.sales.strongestDayLabelAr}`
                    : `Strongest day in window: ${snapshot.sales.strongestDayLabelEn}`}
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
                heightClass="h-56"
              />
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                {isAr ? 'لا توجد نقاط يومية لهذه الفترة' : 'No daily points in this window'}
              </div>
            )}
          </div>

          {/* Hourly Profile (No 876 KWD quiet window upside) */}
          <div className={CARD_CLS}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr ? 'التوزيع الساعي لطلبات نقاط البيع' : 'Hourly POS Sales Profile'}
                </h2>
                <p className="text-xs text-slate-500">
                  {snapshot.sales.hourlyUnavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : isAr
                      ? `ذروة المبيعات: ${snapshot.sales.peakHourLabelAr} · الفترة 3–6 م: ${f1(snapshot.sales.quietWindowSalesKwd)} د.ك (${f0(snapshot.sales.quietWindowOrders)} طلب)`
                      : `Peak hour: ${snapshot.sales.peakHourLabelEn} · 3–6 PM: ${f1(snapshot.sales.quietWindowSalesKwd)} KWD (${f0(snapshot.sales.quietWindowOrders)} orders)`}
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
            {snapshot.sales.hourlyUnavailable ? (
              <div className="py-8 text-center text-xs font-semibold text-amber-800 dark:text-amber-200">
                {isAr ? 'غير متاح' : '—'}
              </div>
            ) : cubeLoading && hourlyBars.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {isAr ? 'جاري تحميل التوزيع الساعي من Odoo...' : 'Loading hourly distribution from Odoo...'}
              </div>
            ) : cubeTimedOut && hourlyBars.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-amber-800 dark:text-amber-200">
                {isAr
                  ? 'انتهت مهلة جلب التوزيع الساعي من أودو.'
                  : 'The hourly chart request to Odoo timed out.'}
              </div>
            ) : hourlyBars.length > 0 ? (
              <InteractiveHoverBarChart
                data={hourlyBars}
                isAr={isAr}
                primaryLegend={isAr ? 'صافي المبيعات الساعية' : 'Hourly Net Sales'}
                heightClass="h-52"
              />
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                {isAr ? 'لا توجد بيانات ساعية لهذه الفترة' : 'No hourly data for this period'}
              </div>
            )}
          </div>

          {/* 3-Column Breakdown: 7 Branches + Unattributed | 6 Brands | Channels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Branches (7 + 8th Unattributed row) */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr
                  ? 'الفروع السبعة + غير منسوب لفرع'
                  : '7 Branches + Unattributed Row'}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isAr
                  ? 'مبيعات الفروع المربوطة وسطر المبيعات غير المنسوبة دون أي توزيع اصطناعي'
                  : 'Mapped branch sales plus unattributed POS sales with zero forced allocation'}
              </p>
              <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                {snapshot.sales.branchesUnavailable ? (
                  <div className="py-6 text-center text-xs font-semibold text-slate-500">
                    {isAr ? 'غير متاح' : '—'}
                  </div>
                ) : (
                  snapshot.sales.branchRanking.map((b) => {
                    const isUnattr = b.id === 'unattributed'
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center justify-between py-2.5 text-xs ${
                          isUnattr
                            ? 'rounded-lg bg-amber-50/70 px-2 font-semibold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200'
                            : ''
                        }`}
                      >
                        <div>
                          <div className="font-semibold">
                            {isAr ? b.labelAr : b.labelEn}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {f0(b.orders)} {isAr ? 'طلب' : 'orders'} · {f1(b.sharePct)}%
                          </div>
                        </div>
                        <div className="font-mono font-bold">
                          {f3(b.salesKwd)} {isAr ? 'د.ك' : 'KWD'}
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

            {/* 6 Brands */}
            <div className={CARD_CLS}>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'العلامات التجارية الست' : '6 Restaurant Brands'}
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isAr ? 'توزيع المبيعات حسب العلامة التجارية في Odoo' : 'Sales split by brand in Odoo'}
              </p>
              <div className="mt-4">
                {snapshot.sales.brandsUnavailable ? (
                  <div className="py-6 text-center text-xs font-semibold text-slate-500">
                    {isAr ? 'غير متاح' : '—'}
                  </div>
                ) : brandDonut.length > 0 ? (
                  <InteractiveDonutChart
                    slices={brandDonut}
                    centerValue={f0(brandDonut.reduce((s, x) => s + x.value, 0))}
                    centerSubValue={isAr ? 'د.ك' : 'KWD'}
                    centerLabel={isAr ? 'العلامات' : 'Brands'}
                    isAr={isAr}
                  />
                ) : null}
              </div>
              {!snapshot.sales.brandsUnavailable ? (
                <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
                  {snapshot.sales.brandShare.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2 text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {isAr ? b.labelAr : b.labelEn}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {f3(b.salesKwd)} {isAr ? 'د.ك' : 'KWD'} ({f1(b.sharePct)}%)
                      </span>
                    </div>
                  ))}
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
              <p className="mt-0.5 text-[11px] text-slate-500">
                {isAr ? 'حسب طرق الدفع وأجهزة نقاط البيع في Odoo' : 'Classified via POS payment methods & configs'}
              </p>
              <div className="mt-4">
                {snapshot.sales.channelsUnavailable ? (
                  <div className="py-6 text-center text-xs font-semibold text-slate-500">
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
      {!noOdooData && activeTab === 'menu' ? (
        <div className="space-y-6">
          <UnlinkedSourceNotice
            titleAr="تكلفة الوصفات المعيارية (BOM) غير مربوطة بمصدر"
            titleEn="Standard Recipe BOM Costing — Not Linked to a Source"
            reasonAr="نعرض أدناه مبيعات وكميات وخصومات الأصناف الفعلية من سطور نقاط البيع (pos.order.line) فقط، دون أي تقدير لتكلفة المكونات أو هوامش ربح مخترعة."
            reasonEn="Showing actual POS item sales, quantities, and discounts from pos.order.line only, without any estimated food cost or invented margins."
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500">
                {isAr ? 'عدد الأصناف المباعة (أعلى الأصناف)' : 'Sold SKUs (Top Items)'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {snapshot.menu.menuUnavailable
                  ? isAr
                    ? 'غير متاح'
                    : '—'
                  : f0(snapshot.menu.totalActiveSkus)}
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
              <div className="text-xs font-semibold text-slate-500">
                {isAr ? 'إجمالي الوحدات المباعة' : 'Total Units Sold'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {snapshot.menu.menuUnavailable
                  ? isAr
                    ? 'غير متاح'
                    : '—'
                  : f0(snapshot.menu.totalUnitsSold)}
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
              <div className="text-xs font-semibold text-slate-500">
                {isAr ? 'صافي مبيعات الأصناف المعروضة' : 'Displayed SKUs Net Sales'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {snapshot.menu.menuUnavailable ? (
                  isAr ? (
                    'غير متاح'
                  ) : (
                    '—'
                  )
                ) : (
                  <>
                    {f3(snapshot.menu.totalSalesKwd)}{' '}
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
                <Search className="pointer-events-none absolute top-2.5 right-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={dishSearch}
                  onChange={(e) => {
                    setDishSearch(e.target.value)
                    setMenuPage(1)
                  }}
                  placeholder={isAr ? 'ابحث باسم الصنف أو العلامة...' : 'Search item or brand...'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-9 pl-3 text-xs dark:border-white/10 dark:bg-white/5"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <select
                  value={dishSort}
                  onChange={(e) => setDishSort(e.target.value as MenuSortKey)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                >
                  <option value="sales">{isAr ? 'ترتيب: الأعلى مبيعات' : 'Sort: Highest Sales'}</option>
                  <option value="units">{isAr ? 'ترتيب: الأعلى كمية' : 'Sort: Highest Units'}</option>
                  <option value="discount">{isAr ? 'ترتيب: الأعلى خصماً' : 'Sort: Highest Discount'}</option>
                </select>
                <select
                  value={String(menuPageSize)}
                  onChange={(e) => {
                    const v = e.target.value
                    setMenuPageSize(v === 'all' ? 'all' : (Number(v) as 12 | 25))
                    setMenuPage(1)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                >
                  <option value="12">12</option>
                  <option value="25">25</option>
                  <option value="all">{isAr ? 'الكل' : 'All'}</option>
                </select>
              </div>
            </div>

            {cubeLoading && pagedDishes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {isAr ? 'جاري تحميل سطور الأصناف من Odoo...' : 'Loading item lines from Odoo...'}
              </div>
            ) : snapshot.menu.menuUnavailable && pagedDishes.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-amber-800 dark:text-amber-200">
                {isAr ? 'غير متاح' : '—'}
              </div>
            ) : pagedDishes.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {isAr ? 'لا توجد أصناف مطابقة في هذه الفترة' : 'No matching POS items in this period'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
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
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {pagedDishes.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{d.name}</td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300">
                          {isAr ? d.brandAr : d.brandEn}
                        </td>
                        <td className="py-2.5 text-end font-mono">{f0(d.unitsSold)}</td>
                        <td className="py-2.5 text-end font-mono">{f3(d.unitPriceKwd)}</td>
                        <td className="py-2.5 text-end font-mono text-amber-700 dark:text-amber-300">
                          {f3(d.discountKwd)} ({f1(d.avgDiscountPct)}%)
                        </td>
                        <td className="py-2.5 text-end font-mono font-bold text-slate-900 dark:text-white">
                          {f3(d.salesKwd)} {isAr ? 'د.ك' : 'KWD'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {menuPageSize !== 'all' && totalMenuPages > 1 ? (
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {isAr
                    ? `صفحة ${menuPage} من ${totalMenuPages}`
                    : `Page ${menuPage} of ${totalMenuPages}`}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={menuPage <= 1}
                    onClick={() => setMenuPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-white/10"
                  >
                    {isAr ? 'السابق' : 'Prev'}
                  </button>
                  <button
                    type="button"
                    disabled={menuPage >= totalMenuPages}
                    onClick={() => setMenuPage((p) => Math.min(totalMenuPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-white/10"
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
      {!noOdooData && activeTab === 'marketing' ? (
        <div className="space-y-6">
          <UnlinkedSourceNotice
            titleAr="منصات الإعلانات الخارجية وعائد المشاهير — غير مربوط بمصدر"
            titleEn="External Ad Platforms & Influencer Attribution — Not Linked to a Source"
            reasonAr="لا يوجد ربط برمجي مع منصات الإعلانات (Snap / TikTok / Meta) أو أكواد المشاهير في Odoo، لذلك أُزيلت مؤشرات العائد الثابتة وسلة العروض وخطط النمو الافتراضية. نعرض فقط خصومات الكاشير الفعلية المسجّلة في Odoo ومقارنة التواريخ اليدوية إن أدخلها المستخدم."
            reasonEn="External ad platforms and promo attribution are not connected to Odoo; static ROI, promo basket, and seeded campaigns were removed. Only actual Odoo POS discounts and user-entered date comparisons are shown."
          />

          {/* Actual Odoo POS Discounts Card */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={KPI_CARD_CLS}>
              <div className="text-xs font-semibold text-slate-500">
                {isAr ? 'إجمالي خصومات نقاط البيع المسجّلة' : 'Recorded POS Line Discounts'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {f3(snapshot.marketing.posDiscountsKwd)}{' '}
                <span className="text-xs font-normal">{isAr ? 'د.ك' : 'KWD'}</span>
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
              <div className="text-xs font-semibold text-slate-500">
                {isAr ? 'متوسط نسبة الخصم في POS' : 'Average POS Discount %'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {f2(snapshot.marketing.posAvgDiscountPct)}%
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
              <div className="text-xs font-semibold text-slate-500">
                {isAr ? 'عدد السطور المخصومة في POS' : 'Discounted POS Lines'}
              </div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {f0(snapshot.marketing.posDiscountedLinesCount)}
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
                onClick={() => {
                  resetCampaignForm()
                  setIsAdFormOpen((v) => !v)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {isAdFormOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{isAr ? 'إضافة فترة حملة يدوية' : 'Log Campaign Window'}</span>
              </button>
            </div>

            {isAdFormOpen ? (
              <form
                onSubmit={handleSaveCampaign}
                className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'العلامة التجارية (6 علامات)' : 'Brand (6 brands)'}
                  </label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value as Exclude<GlobalBrand, 'all'>)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                  >
                    {GLOBAL_BRAND_OPTIONS.filter((o) => o.id !== 'all').map((o) => (
                      <option key={o.id} value={o.id}>
                        {isAr ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'الفرع المستهدف' : 'Target Branch'}
                  </label>
                  <select
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value as GlobalBranch)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                  >
                    {GLOBAL_BRANCH_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {isAr ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'نوع الحملة' : 'Type'}
                  </label>
                  <select
                    value={formAdType}
                    onChange={(e) => setFormAdType(e.target.value as SocialAdType)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                  >
                    {SOCIAL_AD_TYPE_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {isAr ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'اسم الحملة' : 'Campaign Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'التكلفة المدفوعة (د.ك)' : 'Spend (KWD)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={formSpend}
                    onChange={(e) => setFormSpend(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {isAr ? 'تاريخ البداية والنهاية' : 'Start & End Dates'}
                  </label>
                  <div className="mt-1 flex gap-1.5">
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                    />
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-white/10 dark:bg-[#0B1410]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdFormOpen(false)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-white/10"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
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
                {snapshot.marketing.evaluations.map((ev) => (
                  <div
                    key={ev.campaign.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {resolveCampaignDisplayName(ev.campaign, isAr)} ·{' '}
                        {getBrandLabel(ev.campaign.brand, isAr)} (
                        {getBranchLabel(ev.campaign.branch ?? 'all', isAr)})
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {ev.startDate} → {ev.endDate} ·{' '}
                        {isAr ? 'الإنفاق المدخل:' : 'Spend:'} {f1(ev.campaign.spendKwd)}{' '}
                        {isAr ? 'د.ك' : 'KWD'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end font-mono">
                        <div>
                          {isAr ? 'فرق المبيعات اليومية:' : 'Daily Sales Delta:'}{' '}
                          <span className="font-bold">
                            {ev.liftSalesKwd >= 0 ? '+' : ''}
                            {f1(ev.liftSalesKwd)} {isAr ? 'د.ك' : 'KWD'}
                          </span>
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
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                        aria-label="edit"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(ev.campaign.id)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        aria-label="delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CoresHubStudio
