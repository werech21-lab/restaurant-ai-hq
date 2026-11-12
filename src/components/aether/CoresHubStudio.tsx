'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Bell,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Megaphone,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import {
  GLOBAL_BRAND_OPTIONS,
  getPeriodLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'
import {
  evaluateCampaignOdooHalo,
  isDemoSocialCampaign,
  REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY,
  sanitizeRealCampaigns,
  SEEDED_SOCIAL_CAMPAIGNS,
  SOCIAL_AD_TYPE_OPTIONS,
  SOCIAL_CAMPAIGNS_STORAGE_KEY,
  type CampaignHaloEvaluation,
  type SocialAdType,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'
import {
  computeCoresHubSnapshot,
  simulateDishPriceAndCost,
  type DishSimpleTag,
  type MenuDishRow,
  type SalesPoint,
} from '@/lib/aether/cores-hub-engine'
import {
  InteractiveDonutChart,
  InteractiveHorizontalRankList,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type HorizontalRankDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
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
      className="inline-flex flex-wrap items-center gap-1 rounded-full bg-[#F1F5F9] p-1 ring-1 ring-slate-900/[0.06] select-none dark:bg-[#0C141B] dark:ring-white/[0.08]"
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
            className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap transition-all duration-150 focus:outline-none sm:text-[13.5px] ${
              active
                ? 'btn-colored bg-emerald-600 text-white shadow-sm dark:bg-emerald-500 dark:text-[#04130D]'
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

type CoreTabId = 'marketing' | 'sales' | 'menu'
type MenuSortKey = 'profit' | 'units' | 'sales' | 'costPct'
type MenuPageSize = 12 | 25 | 'all'
type MenuRankView = 'split' | 'heroes' | 'bleeders'

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
const fArInt = (n: number) =>
  Math.max(0, Math.round(Number.isFinite(n) ? n : 0))
    .toString()
    .replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] ?? d)

const CARD_CLS =
  'ae-bento-card bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-[#111A22]'
const KPI_CARD_CLS =
  'ae-kpi-card bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:bg-[#111A22]'
const SOFT_SCOPE_PILL_CLS =
  'bg-neutral-100 text-neutral-800 dark:bg-emerald-950/70 dark:text-emerald-200 font-medium text-[12.5px] px-2.5 py-1 rounded-full'

const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3 text-[14px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-[#0F1821] dark:text-white'

const BRAND_CHOICES = GLOBAL_BRAND_OPTIONS.filter(
  (b): b is { id: Exclude<GlobalBrand, 'all'>; ar: string; en: string } => b.id !== 'all',
)

const CORE_TABS: readonly {
  id: CoreTabId
  ar: string
  en: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'marketing', ar: 'التسويق وإعلانات المشاهير', en: 'Marketing & Influencer Ads', icon: Megaphone },
  { id: 'sales', ar: 'المبيعات والقنوات', en: 'Sales & Channels', icon: TrendingUp },
  { id: 'menu', ar: 'هندسة المينيو', en: 'Menu Engineering', icon: UtensilsCrossed },
] as const

const TAG_FILTERS: readonly {
  id: 'all' | DishSimpleTag
  ar: string
  en: string
  subAr: string
  subEn: string
}[] = [
  { id: 'all', ar: 'الكل', en: 'All', subAr: 'كل الأصناف', subEn: 'All menu items' },
  {
    id: 'golden',
    ar: 'أبطال الربح ⭐',
    en: 'Profit Heroes ⭐',
    subAr: 'مبيعات عالية + هامش عالٍ',
    subEn: 'High Sales + High Margin',
  },
  {
    id: 'reprice',
    ar: 'شعبي بربح ضعيف 🐎',
    en: 'Plowhorses 🐎',
    subAr: 'مبيعات عالية + هامش ضعيف',
    subEn: 'High Sales + Low Margin',
  },
  {
    id: 'box-gem',
    ar: 'كنوز مخفية 💎',
    en: 'Hidden Gems 💎',
    subAr: 'هامش عالٍ + طلب منخفض',
    subEn: 'High Margin + Low Volume',
  },
  {
    id: 'slow',
    ar: 'يحتاج مراجعة ⚠️',
    en: 'Needs Review ⚠️',
    subAr: 'مبيعات ضعيفة + هامش ضعيف',
    subEn: 'Low Sales + Low Margin',
  },
] as const

export function CoresHubStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace, liveSummary, setBrand, setBranch, setChannel } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [activeTab, setActiveTab] = useState<CoreTabId>('marketing')
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([])
  const [showDemoCampaigns, setShowDemoCampaigns] = useState(false)
  const [isAdFormOpen, setIsAdFormOpen] = useState(false)
  const [expandedPlays, setExpandedPlays] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Campaign inline form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formBrand, setFormBrand] = useState<Exclude<GlobalBrand, 'all'>>('china-garden')
  const [formAdType, setFormAdType] = useState<SocialAdType>('influencer')
  const [formName, setFormName] = useState('')
  const [formSpend, setFormSpend] = useState('150')
  const [formStartDate, setFormStartDate] = useState('2026-10-29')
  const [formEndDate, setFormEndDate] = useState('2026-10-31')
  const [formItem, setFormItem] = useState('')

  // Menu tab local filters, pagination (default 12 rows), ranking view & Price/Cost Simulator Drawer
  const [dishTagFilter, setDishTagFilter] = useState<'all' | DishSimpleTag>('all')
  const [dishSearch, setDishSearch] = useState('')
  const [dishSort, setDishSort] = useState<MenuSortKey>('profit')
  const [menuPageSize, setMenuPageSize] = useState<MenuPageSize>(12)
  const [menuPage, setMenuPage] = useState(1)
  const [menuRankView, setMenuRankView] = useState<MenuRankView>('split')
  const [selectedDish, setSelectedDish] = useState<MenuDishRow | null>(null)
  const [simDeltaPrice, setSimDeltaPrice] = useState(0.1)
  const [simCostSavePct, setSimCostSavePct] = useState(0)
  const [simRetentionPct, setSimRetentionPct] = useState(95)
  const [simPromoLiftPct, setSimPromoLiftPct] = useState(0)

  // Hydrate real saved Venture Foods campaigns (zero unmarked demo campaigns mixed in) + optional URL ?tab=
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
    setHydrated(true)
  }, [])

  // Sync default form brand when user picks a specific brand in TopFilterBar
  useEffect(() => {
    if (filters.brand !== 'all' && !editingId) {
      setFormBrand(filters.brand)
    }
  }, [filters.brand, editingId])

  const persistCampaigns = useCallback((next: SocialCampaign[]) => {
    const cleanReal = next.filter((c) => !isDemoSocialCampaign(c.id))
    setCampaigns(cleanReal)
    try {
      window.localStorage.setItem(REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY, JSON.stringify(cleanReal))
    } catch {}
  }, [])

  const copyText = useCallback((id: string, text: string) => {
    try {
      navigator.clipboard?.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000)
    } catch {}
  }, [])

  const resetCampaignForm = useCallback(() => {
    setEditingId(null)
    setFormBrand(filters.brand !== 'all' ? filters.brand : 'china-garden')
    setFormAdType('influencer')
    setFormName('')
    setFormSpend('150')
    setFormStartDate('2026-10-29')
    setFormEndDate('2026-10-31')
    setFormItem('')
    setIsAdFormOpen(false)
  }, [filters.brand])

  const upsertCampaignFromForm = useCallback((): SocialCampaign => {
    const cleanName =
      formName.trim() || (isAr ? 'حملة سوشيال ومشاهير' : 'Social Media Campaign')
    const spend = Math.max(0, Number(formSpend) || 0)
    const rawStart = /^\d{4}-\d{2}-\d{2}$/.test(formStartDate) ? formStartDate : '2026-10-29'
    const rawEnd = /^\d{4}-\d{2}-\d{2}$/.test(formEndDate) ? formEndDate : rawStart
    const startIso = rawStart <= rawEnd ? rawStart : rawEnd
    const endIso = rawStart <= rawEnd ? rawEnd : rawStart

    if (editingId) {
      const updated: SocialCampaign = {
        id: editingId,
        brand: formBrand,
        adType: formAdType,
        campaignName: cleanName,
        spendKwd: spend,
        date: startIso,
        startDate: startIso,
        endDate: endIso,
        promotedItem: formItem.trim(),
      }
      persistCampaigns(campaigns.map((c) => (c.id === editingId ? updated : c)))
      return updated
    }

    const created: SocialCampaign = {
      id: `camp-${Date.now()}`,
      brand: formBrand,
      adType: formAdType,
      campaignName: cleanName,
      spendKwd: spend,
      date: startIso,
      startDate: startIso,
      endDate: endIso,
      promotedItem: formItem.trim(),
    }
    persistCampaigns([created, ...campaigns])
    return created
  }, [
    campaigns,
    editingId,
    formAdType,
    formBrand,
    formEndDate,
    formItem,
    formName,
    formSpend,
    formStartDate,
    isAr,
    persistCampaigns,
  ])

  const handleSaveCampaign = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      upsertCampaignFromForm()
      resetCampaignForm()
    },
    [resetCampaignForm, upsertCampaignFromForm],
  )

  const submitCampaignApproval = useCallback(
    (c: SocialCampaign, ev?: CampaignHaloEvaluation) => {
      const evalRow = ev ?? evaluateCampaignOdooHalo(c, filters.branch, filters.channel)
      requestApproval({
        refKey: `campaign:${c.id}`,
        domain: 'marketing',
        titleAr: `اعتماد حملة تسويق: ${c.campaignName} (${evalRow.brandAr})`,
        titleEn: `Approve Ad Campaign: ${c.campaignName} (${evalRow.brandEn})`,
        summaryAr: `الفترة ${evalRow.startDate} ← ${evalRow.endDate} (${evalRow.windowDays} أيام) • الميزانية ${f0(c.spendKwd)} د.ك • الصافي المتوقع ${evalRow.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(evalRow.netProfitAfterAdKwd)} د.ك.`,
        summaryEn: `Window ${evalRow.startDate} -> ${evalRow.endDate} (${evalRow.windowDays}d) • Spend ${f0(c.spendKwd)} KWD • Net ${evalRow.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(evalRow.netProfitAfterAdKwd)} KWD.`,
        departmentAr: 'إدارة التسويق والنمو',
        departmentEn: 'Marketing & Growth',
        budgetOrCostKwd: c.spendKwd,
        expectedMonthlyReturnKwd: Math.max(0, Math.round(evalRow.netProfitAfterAdKwd)),
        href: '/erp/cores?tab=marketing',
      })
    },
    [filters.branch, filters.channel, requestApproval],
  )

  const handleEditCampaign = useCallback((c: SocialCampaign) => {
    setEditingId(c.id)
    setFormBrand(c.brand)
    setFormAdType(c.adType)
    setFormName(c.campaignName)
    setFormSpend(String(c.spendKwd))
    setFormStartDate(c.startDate ?? c.date)
    setFormEndDate(c.endDate ?? c.startDate ?? c.date)
    setFormItem(c.promotedItem ?? '')
    setIsAdFormOpen(true)
  }, [])

  const handleDeleteCampaign = useCallback(
    (id: string) => {
      const remaining = campaigns.filter((c) => c.id !== id)
      persistCampaigns(remaining)
      if (editingId === id) resetCampaignForm()
    },
    [campaigns, editingId, persistCampaigns, resetCampaignForm],
  )

  const togglePlayDrawer = useCallback((id: string) => {
    setExpandedPlays((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const snap = useMemo(
    () => computeCoresHubSnapshot(filters, hydrated ? campaigns : [], liveSummary),
    [filters, campaigns, hydrated, liveSummary],
  )

  const displayedEvaluations = useMemo<CampaignHaloEvaluation[]>(() => {
    const merged = showDemoCampaigns ? [...campaigns, ...SEEDED_SOCIAL_CAMPAIGNS] : campaigns
    const scoped =
      filters.brand === 'all' ? merged : merged.filter((c) => c.brand === filters.brand)
    return scoped.map((c) => evaluateCampaignOdooHalo(c, filters.branch, filters.channel))
  }, [campaigns, showDemoCampaigns, filters.brand, filters.branch, filters.channel])

  const kwdSuffix = isAr ? 'د.ك' : 'KWD'

  // =========================================================================
  // Chart Data Builders (Exact Hover Numbers)
  // =========================================================================
  const marketingChartData = useMemo<MultiSeriesBarDatum[]>(() => {
    return snap.marketing.chartPoints.map((pt) => ({
      id: pt.id,
      label: isAr ? pt.labelAr : pt.labelEn,
      tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
      primaryValue: pt.organicSalesKwd,
      secondaryValue: pt.promoAdSalesKwd,
      badgeText: `${f0(pt.orders)} ${isAr ? 'طلب' : 'ord'}`,
      badgeTone: pt.netProfitKwd >= 0 ? 'emerald' : 'rose',
      lines: [
        {
          label: isAr ? 'إجمالي المبيعات:' : 'Total Sales:',
          value: `${f1(pt.totalSalesKwd)} ${kwdSuffix}`,
          bold: true,
        },
        {
          label: isAr ? 'المبيعات الطبيعية:' : 'Organic Sales:',
          value: `${f1(pt.organicSalesKwd)} ${kwdSuffix}`,
        },
        {
          label: isAr ? 'مبيعات العروض والإعلانات:' : 'Promo & Ad Sales:',
          value: `${f1(pt.promoAdSalesKwd)} ${kwdSuffix}`,
          tone: 'emerald',
        },
        {
          label: isAr ? 'عدد الطلبات:' : 'Orders:',
          value: `${f0(pt.orders)} ${isAr ? 'طلب' : 'orders'}`,
        },
        {
          label: isAr ? 'تكلفة الخصومات والإعلانات:' : 'Ad & Discount Cost:',
          value: `${f1(pt.marketingCostKwd)} ${kwdSuffix}`,
          tone: 'amber',
        },
        {
          label: isAr ? 'الصافي بالجيب:' : 'Net Profit:',
          value: `${f1(pt.netProfitKwd)} ${kwdSuffix}`,
          tone: pt.netProfitKwd >= 0 ? 'emerald' : 'rose',
          bold: true,
        },
      ],
    }))
  }, [snap.marketing.chartPoints, isAr, kwdSuffix])

  const salesTimelineData = useMemo<MultiSeriesBarDatum[]>(() => {
    return snap.sales.timeline.map((pt) => ({
      id: pt.id,
      label: isAr ? pt.labelAr : pt.labelEn,
      tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
      primaryValue: pt.salesKwd,
      primaryColor: pt.color ?? '#38BDF8',
      badgeText: `${f0(pt.orders)} ${isAr ? 'طلب' : 'ord'}`,
      badgeTone: 'emerald',
      lines: [
        {
          label: isAr ? 'المبيعات:' : 'Sales:',
          value: `${f1(pt.salesKwd)} ${kwdSuffix}`,
          tone: 'emerald',
          bold: true,
        },
        {
          label: isAr ? 'عدد الطلبات:' : 'Orders:',
          value: `${f0(pt.orders)} ${isAr ? 'طلب' : 'orders'}`,
        },
        {
          label: isAr ? 'متوسط الفاتورة:' : 'Avg Bill:',
          value: `${f2(pt.aovKwd)} ${kwdSuffix}`,
          bold: true,
        },
      ],
    }))
  }, [snap.sales.timeline, isAr, kwdSuffix])

  const salesHourlyData = useMemo<MultiSeriesBarDatum[]>(() => {
    return snap.sales.hourly.map((pt) => ({
      id: pt.id,
      label: isAr ? pt.labelAr : pt.labelEn,
      tooltipTitle: isAr ? pt.tooltipTitleAr : pt.tooltipTitleEn,
      primaryValue: pt.salesKwd,
      primaryColor: pt.color ?? '#94A3B8',
      badgeText: `${f1(pt.sharePct)}%`,
      badgeTone: pt.color === '#10B981' ? 'emerald' : pt.color === '#F59E0B' ? 'amber' : 'neutral',
      lines: [
        {
          label: isAr ? 'المبيعات:' : 'Sales:',
          value: `${f1(pt.salesKwd)} ${kwdSuffix}`,
          bold: true,
        },
        {
          label: isAr ? 'عدد الطلبات:' : 'Orders:',
          value: `${f0(pt.orders)} ${isAr ? 'طلب' : 'orders'}`,
        },
        {
          label: isAr ? 'متوسط الفاتورة:' : 'Avg Bill:',
          value: `${f2(pt.aovKwd)} ${kwdSuffix}`,
        },
        {
          label: isAr ? 'حصة الساعة:' : 'Hour Share:',
          value: `${f1(pt.sharePct)}%`,
        },
      ],
    }))
  }, [snap.sales.hourly, isAr, kwdSuffix])

  const toRankItems = useCallback(
    (
      rows: SalesPoint[],
      dimension: 'brand' | 'branch' | 'channel',
      activeFilterId: string,
    ): HorizontalRankDatum[] =>
      rows.map((r, idx) => {
        const isActive = activeFilterId !== 'all' && activeFilterId === r.id
        const isDirectZeroFee =
          dimension === 'channel' && (r.id === 'dine-in' || r.id === 'takeaway-direct')

        let barClassName = 'bg-neutral-300 dark:bg-neutral-700'
        let dotClassName = 'bg-neutral-400 dark:bg-neutral-500'
        if (isActive || isDirectZeroFee || (dimension !== 'channel' && idx === 0)) {
          barClassName = 'bg-emerald-500/85'
          dotClassName = 'bg-emerald-500'
        } else if (
          (dimension === 'channel' && idx < 4) ||
          (dimension !== 'channel' && (idx === 1 || idx === 2))
        ) {
          barClassName = 'bg-sky-500/80'
          dotClassName = 'bg-sky-500'
        }

        return {
          id: r.id,
          label: isAr ? r.labelAr : r.labelEn,
          subLabel: `${f0(r.orders)} ${isAr ? 'طلب' : 'orders'} · ${isAr ? 'متوسط' : 'Avg'} ${f2(r.aovKwd)} ${kwdSuffix}`,
          value: r.salesKwd,
          valueFormatted: `${f0(r.displaySalesKwd)} ${kwdSuffix}`,
          barClassName,
          dotClassName,
          badgeText: `${f1(r.sharePct)}%`,
          active: isActive,
          lines: [
            {
              label: isAr ? 'المبيعات:' : 'Sales:',
              value: `${f1(r.salesKwd)} ${kwdSuffix}`,
              bold: true,
            },
            {
              label: isAr ? 'الطلبات:' : 'Orders:',
              value: `${f0(r.orders)}`,
            },
            {
              label: isAr ? 'متوسط الفاتورة:' : 'Avg Bill:',
              value: `${f2(r.aovKwd)} ${kwdSuffix}`,
            },
            {
              label: isAr ? 'الحصة:' : 'Share:',
              value: `${f1(r.sharePct)}%`,
              tone: 'emerald',
            },
          ],
        }
      }),
    [isAr, kwdSuffix],
  )

  const openDishSimulator = useCallback((dish: MenuDishRow) => {
    setSelectedDish(dish)
    setSimDeltaPrice(
      dish.recommendedDeltaPriceKwd > 0 ? dish.recommendedDeltaPriceKwd : 0.1,
    )
    setSimCostSavePct(dish.recommendedCostSavePct)
    setSimRetentionPct(95)
    setSimPromoLiftPct(dish.recommendedPromoLiftPct)
  }, [])

  // Reset Menu pagination to Page 1 whenever search, quadrant, sort, or global filter changes
  useEffect(() => {
    setMenuPage(1)
  }, [dishTagFilter, dishSearch, dishSort, menuPageSize, filters])

  // Close Price & Cost Simulator Drawer on Escape key
  useEffect(() => {
    if (!selectedDish) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDish(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedDish])

  const filteredDishes = useMemo(() => {
    const q = dishSearch.trim().toLowerCase()
    return snap.menu.dishes
      .filter((d) => {
        if (dishTagFilter !== 'all' && d.tag !== dishTagFilter) return false
        if (
          q &&
          !d.name.toLowerCase().includes(q) &&
          !d.brandAr.toLowerCase().includes(q) &&
          !d.brandEn.toLowerCase().includes(q)
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        if (dishSort === 'units') return b.unitsSold - a.unitsSold
        if (dishSort === 'sales') return b.salesKwd - a.salesKwd
        if (dishSort === 'costPct') return b.foodCostPct - a.foodCostPct || b.costGapPct - a.costGapPct
        return b.netProfitKwd - a.netProfitKwd
      })
  }, [snap.menu.dishes, dishTagFilter, dishSearch, dishSort])

  const menuTotalPages = useMemo(() => {
    if (menuPageSize === 'all') return 1
    return Math.max(1, Math.ceil(filteredDishes.length / menuPageSize))
  }, [filteredDishes.length, menuPageSize])

  const safeMenuPage = Math.min(menuPage, menuTotalPages)
  const paginatedDishes = useMemo(() => {
    if (menuPageSize === 'all') return filteredDishes
    const start = (safeMenuPage - 1) * menuPageSize
    return filteredDishes.slice(start, start + menuPageSize)
  }, [filteredDishes, menuPageSize, safeMenuPage])

  const menuStartRow =
    filteredDishes.length === 0
      ? 0
      : menuPageSize === 'all'
        ? 1
        : (safeMenuPage - 1) * menuPageSize + 1
  const menuEndRow =
    filteredDishes.length === 0
      ? 0
      : menuPageSize === 'all'
        ? filteredDishes.length
        : Math.min(filteredDishes.length, safeMenuPage * menuPageSize)

  const simResult = useMemo(() => {
    if (!selectedDish) return null
    return simulateDishPriceAndCost({
      monthlyUnitsSold: selectedDish.monthlyUnitsSold,
      unitPriceKwd: selectedDish.unitPriceKwd,
      unitCostKwd: selectedDish.unitCostKwd,
      deltaPriceKwd: simDeltaPrice,
      costSavePct: simCostSavePct,
      retentionPct: simRetentionPct,
      promoLiftPct: simPromoLiftPct,
      channelFeePct: snap.menu.effectiveChannelFeePct,
    })
  }, [
    selectedDish,
    simDeltaPrice,
    simCostSavePct,
    simRetentionPct,
    simPromoLiftPct,
    snap.menu.effectiveChannelFeePct,
  ])

  const marketingDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const org = Math.max(0, snap.marketing.kpis.organicSalesKwd)
    const promo = Math.max(0, snap.marketing.kpis.promoAdSalesKwd)
    const tot = Math.max(1, org + promo)
    return [
      {
        id: 'organic',
        label: isAr ? 'المبيعات الطبيعية' : 'Organic Sales',
        value: org,
        valueFormatted: `${f0(org)} ${kwdSuffix}`,
        pctFormatted: `${f1((org / tot) * 100)}%`,
        color: '#94A3B8',
      },
      {
        id: 'promo',
        label: isAr ? 'العروض والإعلانات' : 'Promo & Ad Sales',
        value: promo,
        valueFormatted: `${f0(promo)} ${kwdSuffix}`,
        pctFormatted: `${f1((promo / tot) * 100)}%`,
        color: '#10B981',
      },
    ]
  }, [isAr, kwdSuffix, snap.marketing.kpis])

  const salesDirectVsAggregatorSlices = useMemo<DonutSliceDatum[]>(() => {
    return [
      {
        id: 'zero-fee-direct',
        label: isAr ? 'الصالة والاستلام المباشر' : 'Dine-In + Direct Pickup',
        subLabel: isAr
          ? `صافي الهامش ${f1(snap.sales.directNetMarginPct)}% (٠٪ عمولة)`
          : `Net Margin ${f1(snap.sales.directNetMarginPct)}% (0% fee)`,
        value: Math.max(0, snap.sales.zeroCommSalesKwd),
        valueFormatted: `${f0(snap.sales.zeroCommDisplayKwd)} ${kwdSuffix}`,
        pctFormatted: `${f1(snap.sales.zeroCommSharePct)}%`,
        color: '#10B981',
      },
      {
        id: 'aggregator-apps',
        label: isAr ? 'تطبيقات التوصيل' : 'Delivery Apps',
        subLabel: isAr
          ? `صافي الهامش ${f1(snap.sales.aggregatorNetMarginPct)}% (بعد العمولة)`
          : `Net Margin ${f1(snap.sales.aggregatorNetMarginPct)}% (after fees)`,
        value: Math.max(0, snap.sales.aggregatorSalesKwd),
        valueFormatted: `${f0(snap.sales.aggregatorDisplayKwd)} ${kwdSuffix}`,
        pctFormatted: `${f1(snap.sales.aggregatorSharePct)}%`,
        color: '#0EA5E9',
      },
    ]
  }, [isAr, kwdSuffix, snap.sales])

  const menuTagDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const groups: {
      id: DishSimpleTag
      ar: string
      en: string
      subAr: string
      subEn: string
      color: string
    }[] = [
      {
        id: 'golden',
        ar: 'أبطال الربح ⭐',
        en: 'Profit Heroes ⭐',
        subAr: 'ثبّت بالصدارة',
        subEn: 'High Sales + High Margin',
        color: '#10B981',
      },
      {
        id: 'reprice',
        ar: 'شعبي بربح ضعيف 🐎',
        en: 'Plowhorses 🐎',
        subAr: 'ارفع +١٠٠ فلس / كومبو',
        subEn: 'High Sales + Low Margin',
        color: '#F59E0B',
      },
      {
        id: 'box-gem',
        ar: 'كنوز مخفية 💎',
        en: 'Hidden Gems 💎',
        subAr: 'أبرزه بالتطبيقات',
        subEn: 'High Margin + Low Volume',
        color: '#0EA5E9',
      },
      {
        id: 'slow',
        ar: 'يحتاج مراجعة ⚠️',
        en: 'Needs Review ⚠️',
        subAr: 'راجع الوصفة',
        subEn: 'Low Sales + Low Margin',
        color: '#94A3B8',
      },
    ]
    const totalProfit = Math.max(1, snap.menu.totalNetProfitKwd)
    return groups.map((g) => {
      const val = snap.menu.dishes
        .filter((d) => d.tag === g.id)
        .reduce((acc, d) => acc + Math.max(0, d.netProfitKwd), 0)
      return {
        id: g.id,
        label: isAr ? g.ar : g.en,
        subLabel: isAr ? g.subAr : g.subEn,
        value: val,
        valueFormatted: `${f0(val)} ${kwdSuffix}`,
        pctFormatted: `${f1((val / totalProfit) * 100)}%`,
        color: g.color,
      }
    })
  }, [isAr, kwdSuffix, snap.menu.dishes, snap.menu.totalNetProfitKwd])

  const formatDishSimWhatsapp = useCallback(
    (dish: MenuDishRow) => {
      if (!simResult) return ''
      const deltaFils = Math.round(simDeltaPrice * 1000)
      if (!isAr) {
        return `*Menu Pricing & Recipe Action — ${dish.brandEn}*\n• Dish: ${dish.name} (${dish.tagEn})\n• Price Change: ${f2(dish.unitPriceKwd)} -> ${f2(simResult.newPriceKwd)} KWD (${deltaFils >= 0 ? `+${deltaFils}` : deltaFils} fils)\n• Ardiya Recipe Saving: -${simCostSavePct}% (Cost ${f2(dish.unitCostKwd)} -> ${f2(simResult.newUnitCostKwd)} KWD)\n• Assumptions: ${simRetentionPct}% volume retention, ${f1(snap.menu.effectiveChannelFeePct)}% app fee\n• Conservative Monthly Net Gain: ${simResult.monthlyNetGainKwd >= 0 ? '+' : ''}${f0(simResult.monthlyNetGainKwd)} KWD / mo`
      }
      return `*قرار تسعير وهندسة صنف — ${dish.brandAr}*\n• الطبق: ${dish.name} (${dish.tagAr})\n• تعديل السعر: ${f2(dish.unitPriceKwd)} ← ${f2(simResult.newPriceKwd)} د.ك (${deltaFils >= 0 ? `+${deltaFils}` : deltaFils} فلس)\n• ضبط وصفة العارضية: -${simCostSavePct}% (التكلفة ${f2(dish.unitCostKwd)} ← ${f2(simResult.newUnitCostKwd)} د.ك)\n• افتراض متحفظ: ثبات ${simRetentionPct}% من الكمية بعد خصم عمولة ${f1(snap.menu.effectiveChannelFeePct)}%\n• الربح الصافي الإضافي بالجيب: ${simResult.monthlyNetGainKwd >= 0 ? '+' : ''}${f0(simResult.monthlyNetGainKwd)} د.ك شهرياً`
    },
    [
      isAr,
      simDeltaPrice,
      simCostSavePct,
      simRetentionPct,
      simResult,
      snap.menu.effectiveChannelFeePct,
    ],
  )

  const formatCampaignWhatsapp = (ev: CampaignHaloEvaluation) => {
    if (!isAr) {
      return `*Ad ROI Check — ${ev.brandEn}*\n• Campaign: ${ev.campaign.campaignName} (${ev.adTypeEn})\n• Window: ${ev.startDate} -> ${ev.endDate} (${ev.windowDays}d) | Spend: ${f0(ev.campaign.spendKwd)} KWD\n• Prior ${ev.windowDays}d: ${f1(ev.before3dSalesKwd)} KWD -> Campaign ${ev.windowDays}d: ${f1(ev.after3dSalesKwd)} KWD\n• Real Sales Lift: ${ev.liftSalesKwd >= 0 ? '+' : ''}${f1(ev.liftSalesKwd)} KWD (${ev.liftOrders >= 0 ? '+' : ''}${ev.liftOrders} orders)\n• Net Profit After Ad: ${ev.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(ev.netProfitAfterAdKwd)} KWD\n• Verdict: ${ev.verdictEn}`
    }
    return `*نتيجة إعلان — ${ev.brandAr}*\n• الحملة: ${ev.campaign.campaignName} (${ev.adTypeAr})\n• الفترة: ${ev.startDate} ← ${ev.endDate} (${ev.windowDays} أيام) | المدفوع: ${f0(ev.campaign.spendKwd)} د.ك\n• المبيعات قبل (${ev.windowDays} أيام): ${f1(ev.before3dSalesKwd)} د.ك ← خلال الحملة: ${f1(ev.after3dSalesKwd)} د.ك\n• زيادة المبيعات الفعلية: ${ev.liftSalesKwd >= 0 ? '+' : ''}${f1(ev.liftSalesKwd)} د.ك (${ev.liftOrders >= 0 ? '+' : ''}${ev.liftOrders} طلب)\n• الربح الصافي بعد خصم الإعلان: ${ev.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(ev.netProfitAfterAdKwd)} د.ك\n• القرار: ${ev.verdictAr}`
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 pb-10">
      {/* ───────────── Page Header & 3 Crisp Core EmeraldPillTabs + Social Reviews Link Pill ───────────── */}
      <header className="ae-bento-card flex flex-col gap-3 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:flex-row lg:items-center lg:justify-between dark:bg-[#111A22]">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-neutral-950 sm:text-[25px] dark:text-white">
            {isAr ? 'المبيعات والتسويق والمنتجات' : 'Sales, Marketing & Menu'}
          </h1>
          <p className="mt-0.5 text-[14px] text-neutral-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <EmeraldPillTabs<CoreTabId>
            ariaLabel={isAr ? 'أقسام المركز' : 'Core Hub Tabs'}
            value={activeTab}
            onChange={setActiveTab}
            options={CORE_TABS.map((t) => {
              const Icon = t.icon
              return {
                id: t.id,
                label: isAr ? t.ar : t.en,
                icon: <Icon className="h-3.5 w-3.5" />,
              }
            })}
          />

          <Link
            href="/erp/social-reviews"
            className="ae-bento-subcard inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-bold text-slate-700 transition-colors duration-150 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300"
          >
            <span>{isAr ? 'التقييمات ومنصات التواصل ↗' : 'Social & App Reviews ↗'}</span>
          </Link>
        </div>
      </header>

      {/* =====================================================================
          TAB 1: التسويق وإعلانات المشاهير (Marketing, Social/Influencer ROI & 6 Growth Plays)
         ===================================================================== */}
      {activeTab === 'marketing' ? (
        <div className="space-y-4">
          {/* 1. 4 Crisp Non-Duplicate Odoo-Derived Marketing KPIs ("One Metric, One Place") */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: Return per 1 KWD Ad (4.6x) */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                {isAr ? 'عائد كل ١ د.ك إعلان' : 'Return per 1 KWD Ad'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 sm:text-[32px] dark:text-emerald-400"
              >
                {f1(snap.marketing.kpis.roasPer1Kwd)}x
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr ? 'مبيعات لكل ١ د.ك عروض وإعلان' : 'Sales per 1 KWD promo & ad spend'}
              </p>
            </article>

            {/* KPI 2: Discounts & Ad Spend (1,158 KWD) */}
            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'تكلفة الخصومات والإعلانات' : 'Discounts & Ad Spend'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  {f1(snap.marketing.kpis.marketingCostPctOfSales)}%{' '}
                  {isAr ? 'من المبيعات' : 'of sales'}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-neutral-950 sm:text-[32px] dark:text-white"
              >
                {f0(snap.marketing.kpis.totalMarketingCostKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr ? 'خصومات الكاشير والتطبيقات والحملات' : 'POS discounts, app promos & ads'}
              </p>
            </article>

            {/* KPI 3: Net Cash After Ads (4,205 KWD) */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الصافي النقدي بعد الإعلانات' : 'Net Cash After Ads'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {isAr ? 'فائض العروض' : 'Net Surplus'}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 sm:text-[32px] dark:text-emerald-400"
              >
                {f0(snap.marketing.kpis.netAfterAdSpendKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr
                  ? 'مبيعات العروض بعد خصم تكلفة الإعلان والخصم'
                  : 'Promo sales retained after discounts & ad spend'}
              </p>
            </article>

            {/* KPI 4: Promo vs Organic Avg Bill */}
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'متوسط فاتورة العرض مقابل الطبيعي' : 'Promo vs Organic Avg Bill'}
                </span>
                <span
                  dir="ltr"
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums ${
                    snap.marketing.kpis.aovDeltaPct >= 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {snap.marketing.kpis.aovDeltaPct >= 0 ? '+' : ''}
                  {f1(snap.marketing.kpis.aovDeltaPct)}%
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f2(snap.marketing.kpis.promoAovKwd)}{' '}
                <span className="text-[14px] font-semibold text-neutral-400">
                  vs {f2(snap.marketing.kpis.organicAovKwd)} {kwdSuffix}
                </span>
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr
                  ? `فرق السلة: ${snap.marketing.kpis.aovDeltaKwd >= 0 ? '+' : ''}${f2(snap.marketing.kpis.aovDeltaKwd)} د.ك للطلب`
                  : `Basket delta: ${snap.marketing.kpis.aovDeltaKwd >= 0 ? '+' : ''}${f2(snap.marketing.kpis.aovDeltaKwd)} KWD/order`}
              </p>
            </article>
          </section>

          {/* 2. Finance V2 Bento Split: 8-Col Stacked Capsule Chart + 4-Col Promo Mix Donut */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr
                      ? 'المبيعات الطبيعية مقابل العروض والإعلانات'
                      : 'Organic vs Promo/Ad Sales & Net Profit'}
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr
                      ? 'مرّر الماوس على أي يوم لمعرفة المبيعات، الطلبات، تكلفة الإعلان، والصافي'
                      : 'Hover any capsule to inspect exact KWD, orders, ad cost, and net profit'}
                  </p>
                </div>
                <Link
                  href="/erp/before-after"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-100 px-3.5 text-xs font-medium text-neutral-800 transition-colors duration-150 hover:bg-neutral-200/80 hover:text-neutral-950 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
                >
                  <span>{isAr ? 'مقارنة قبل وبعد' : 'Before & After'}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <InteractiveHoverBarChart
                data={marketingChartData}
                isAr={isAr}
                primaryLegend={isAr ? 'المبيعات الطبيعية' : 'Organic Sales'}
                secondaryLegend={isAr ? 'مبيعات العروض والإعلانات' : 'Promo & Ad Sales'}
                primaryColor="#94A3B8"
                secondaryColor="#10B981"
                stacked
                heightClass="h-64"
              />
            </div>

            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-4`}>
              <div className="mb-3">
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr ? 'حصة العروض والطبيعي' : 'Promo vs Organic Mix'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr ? 'نسبة العروض داخل الدائرة والصافي بالأسفل' : 'Promo share centered · net cash row below'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={marketingDonutSlices}
                centerValue={`${f1(snap.marketing.kpis.promoSharePct)}%`}
                centerLabel={isAr ? 'حصة العروض' : 'Promo Share'}
                summaryPill={{
                  label: isAr ? 'صافي العروض النقدي' : 'Net Pocket Cash',
                  value: `+${f0(snap.marketing.kpis.netAfterAdSpendKwd)} ${kwdSuffix}`,
                  tone: 'emerald',
                }}
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* 3. Social Media & Influencer Ad ROI Calculator (Collapsible Form + Gated Demo Toggle) */}
          <section className={CARD_CLS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr
                    ? 'حاسبة أثر إعلانات السوشيال والمشاهير'
                    : 'Social Media & Influencer Ad ROI Calculator'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? 'تقارن مبيعات أودو ٣ أيام قبل الإعلان بـ ٣ أيام بعده وتخصم الأكل والعمولة وسعر الإعلان'
                    : 'Compares real Odoo POS sales 3 days before vs 3 days after ad date, net of food, fees & spend'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDemoCampaigns((v) => !v)}
                  aria-pressed={showDemoCampaigns}
                  className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-all duration-150 ${
                    showDemoCampaigns
                      ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200/80 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/70'
                  }`}
                >
                  <span>
                    {showDemoCampaigns
                      ? isAr
                        ? 'إخفاء الأمثلة التوضيحية 🧪'
                        : 'Hide Demo Examples 🧪'
                      : isAr
                        ? 'عرض أمثلة توضيحية 🧪'
                        : 'Show Demo Examples 🧪'}
                  </span>
                </button>

                {isAdFormOpen ? (
                  <button
                    type="button"
                    onClick={resetCampaignForm}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-100 px-3.5 text-xs font-medium text-neutral-800 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.08] dark:text-slate-200"
                  >
                    <span>{isAr ? 'إغلاق النموذج ✕' : 'Close Form ✕'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAdFormOpen(true)}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
                  >
                    <span>
                      {isAr
                        ? '+ فحص إعلان مشهور جديد'
                        : '+ Check New Influencer Ad'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Collapsible 7-Field Input Form (Start Date + End Date + Manager Approval Request) */}
            {isAdFormOpen ? (
              <form
                onSubmit={handleSaveCampaign}
                className="mt-4 rounded-2xl bg-[#F7F7F8] p-4 transition-all duration-150 dark:bg-white/[0.03]"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'المطعم' : 'Brand'}
                    </label>
                    <select
                      value={formBrand}
                      onChange={(e) => setFormBrand(e.target.value as Exclude<GlobalBrand, 'all'>)}
                      className={INPUT_CLS}
                    >
                      {BRAND_CHOICES.map((b) => (
                        <option key={b.id} value={b.id}>
                          {isAr ? b.ar : b.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'نوع الإعلان' : 'Ad Type'}
                    </label>
                    <select
                      value={formAdType}
                      onChange={(e) => setFormAdType(e.target.value as SocialAdType)}
                      className={INPUT_CLS}
                    >
                      {SOCIAL_AD_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {isAr ? opt.ar : opt.en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'اسم الحملة أو المشهور' : 'Campaign or Influencer'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={
                        isAr
                          ? 'مثال: تغطية بلوقر أو إعلان تيك توك...'
                          : 'e.g. Food blogger or TikTok reel...'
                      }
                      className={INPUT_CLS}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'المبلغ المدفوع (د.ك)' : 'Ad Spend (KWD)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      required
                      value={formSpend}
                      onChange={(e) => setFormSpend(e.target.value)}
                      className={`${INPUT_CLS} tabular-nums`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'تاريخ البداية' : 'Start Date'}
                    </label>
                    <input
                      type="date"
                      required
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className={`${INPUT_CLS} tabular-nums`}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'تاريخ النهاية' : 'End Date'}
                    </label>
                    <input
                      type="date"
                      required
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className={`${INPUT_CLS} tabular-nums`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 sm:max-w-md">
                    <input
                      type="text"
                      value={formItem}
                      onChange={(e) => setFormItem(e.target.value)}
                      placeholder={
                        isAr
                          ? 'الصنف المعلن عنه (اختياري) — مثال: داينمايت شرمب أو فيلي ستيك'
                          : 'Promoted Dish (optional) — e.g. Dynamite Shrimp'
                      }
                      className={INPUT_CLS}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={resetCampaignForm}
                      className="h-9 rounded-full bg-neutral-100 px-4 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/10 dark:text-slate-200"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const saved = upsertCampaignFromForm()
                        submitCampaignApproval(saved)
                        resetCampaignForm()
                      }}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-amber-50 px-4 text-xs font-semibold text-amber-900 transition-all duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>{isAr ? 'طلب موافقة المدير 🔔' : 'Request Manager Approval 🔔'}</span>
                    </button>
                    <button
                      type="submit"
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>
                        {editingId
                          ? isAr
                            ? 'حفظ تعديل الإعلان'
                            : 'Save Changes'
                          : isAr
                            ? 'احسب أثر الإعلان وأضفه للسجل'
                            : 'Calculate Odoo Halo & Save'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {/* Evaluated Campaigns List (Real Venture Foods records by default; Demo gated behind toggle) */}
            {displayedEvaluations.length === 0 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F7F8] px-4 py-3 text-xs dark:bg-white/[0.03]">
                <span className="font-medium text-neutral-500 dark:text-slate-300">
                  {isAr
                    ? 'لا توجد حملات مسجلة بعد — اضغط (+ فحص إعلان مشهور جديد) لقياس الأثر الفعلي من أودو.'
                    : 'No live influencer campaigns logged yet — click (+ Check New Influencer Ad) to measure real 3-day Odoo lift.'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDemoCampaigns(true)}
                  className="cursor-pointer font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                >
                  {isAr ? 'عرض أمثلة توضيحية 🧪' : 'Show Demo Examples 🧪'}
                </button>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3.5 rounded-2xl bg-[#F7F7F8] p-3.5 lg:grid-cols-2 dark:bg-white/[0.02]">
                {displayedEvaluations.map((ev) => {
                  const isDemo = isDemoSocialCampaign(ev.campaign.id)
                  const approvalRec = getApprovalByRef(`campaign:${ev.campaign.id}`)
                  const isWatchdogBreach =
                    !isDemo && (ev.verdict === 'loser' || ev.campaign.spendKwd > 450)
                  const badgeCls =
                    ev.verdict === 'winner'
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : ev.verdict === 'breakeven'
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'

                  return (
                    <article
                      key={ev.campaign.id}
                      className="flex flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 dark:bg-[#111A22]"
                    >
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Soft High-Contrast Brand Pill (Zero Dark-on-Dark) */}
                            <span className={SOFT_SCOPE_PILL_CLS}>
                              {isAr ? ev.brandAr : ev.brandEn}
                            </span>
                            <span className="bg-neutral-100 text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200 font-medium text-xs px-2.5 py-1 rounded-full">
                              {isAr ? ev.adTypeAr : ev.adTypeEn}
                            </span>
                            {isDemo ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                                {isAr ? 'مثال توضيحي' : 'Demo'}
                              </span>
                            ) : null}
                            {approvalRec?.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <ShieldCheck className="h-3 w-3" />
                                <span>{isAr ? 'معتمد بختم المدير ✅' : 'Manager Sealed ✅'}</span>
                              </span>
                            ) : approvalRec?.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                                <Bell className="h-3 w-3" />
                                <span>{isAr ? 'بانتظار الموافقة 🔔' : 'Pending Approval 🔔'}</span>
                              </span>
                            ) : null}
                            {isWatchdogBreach ? (
                              <button
                                type="button"
                                onClick={() => openDrawer('breaches')}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                <span>{isAr ? 'تصعيد ↗' : 'Escalate ↗'}</span>
                              </button>
                            ) : null}
                            <span dir="ltr" className="text-xs tabular-nums text-neutral-400">
                              {ev.startDate} → {ev.endDate}
                            </span>
                          </div>

                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeCls}`}>
                            {isAr ? ev.verdictAr : ev.verdictEn}
                          </span>
                        </div>

                        <h3 className="mt-2.5 text-[15px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                          {ev.campaign.campaignName}
                        </h3>
                        {ev.campaign.promotedItem ? (
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {isAr ? 'الصنف المعلن عنه: ' : 'Promoted Dish: '}
                            <span className="font-medium text-neutral-700 dark:text-slate-200">
                              {ev.campaign.promotedItem}
                            </span>
                          </p>
                        ) : null}

                        {/* 3-Box Metrics Row */}
                        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-[#0C141B]">
                            <div className="text-xs text-neutral-400">
                              {isAr
                                ? `${ev.windowDays} أيام قبل ← ${ev.windowDays} أيام الحملة`
                                : `Prior ${ev.windowDays}d -> Campaign ${ev.windowDays}d`}
                            </div>
                            <div
                              dir="ltr"
                              className="mt-1 text-[13.5px] font-semibold tabular-nums text-neutral-900 dark:text-white"
                            >
                              {f0(ev.before3dSalesKwd)} → {f0(ev.after3dSalesKwd)} {kwdSuffix}
                            </div>
                            <div dir="ltr" className="mt-0.5 text-xs tabular-nums text-neutral-400">
                              {isAr
                                ? `المدفوع: ${f0(ev.campaign.spendKwd)} د.ك`
                                : `Spend: ${f0(ev.campaign.spendKwd)} KWD`}
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-[#0C141B]">
                            <div className="text-xs text-neutral-400">
                              {isAr ? 'زيادة المبيعات الفعلية' : 'Real Sales Lift'}
                            </div>
                            <div
                              dir="ltr"
                              className={`mt-1 text-[15px] font-semibold tabular-nums ${
                                ev.liftSalesKwd >= 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {ev.liftSalesKwd >= 0 ? '+' : ''}
                              {f1(ev.liftSalesKwd)} {kwdSuffix}
                            </div>
                            <div dir="ltr" className="mt-0.5 text-xs tabular-nums text-neutral-400">
                              {ev.liftOrders >= 0 ? '+' : ''}
                              {f0(ev.liftOrders)} {isAr ? 'طلب' : 'orders'} ({ev.liftPct >= 0 ? '+' : ''}
                              {ev.liftPct}%)
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-[#0C141B]">
                            <div className="text-xs text-neutral-400">
                              {isAr ? 'الربح الصافي بعد الإعلان' : 'Net Profit After Ad'}
                            </div>
                            <div
                              dir="ltr"
                              className={`mt-1 text-[15px] font-semibold tabular-nums ${
                                ev.netProfitAfterAdKwd >= 0
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {ev.netProfitAfterAdKwd >= 0 ? '+' : ''}
                              {f1(ev.netProfitAfterAdKwd)} {kwdSuffix}
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-400">
                              {isAr
                                ? `بعد الأكل (${f0(ev.foodAndPackCostKwd)}) والعمولة (${f0(ev.platformFeeKwd)})`
                                : `After food (${f0(ev.foodAndPackCostKwd)}) & fee (${f0(ev.platformFeeKwd)})`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyText(ev.campaign.id, formatCampaignWhatsapp(ev))}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-900 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
                          >
                            {copiedId === ev.campaign.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                                <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                              </>
                            ) : (
                              <span>{isAr ? 'نسخ للواتساب 📋' : 'Copy WhatsApp 📋'}</span>
                            )}
                          </button>

                          {!approvalRec ? (
                            <button
                              type="button"
                              onClick={() => submitCampaignApproval(ev.campaign, ev)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition-colors duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                            >
                              <span>{isAr ? 'طلب موافقة المدير 🔔' : 'Request Approval 🔔'}</span>
                            </button>
                          ) : null}

                          {!isDemo ? (
                            <button
                              type="button"
                              onClick={() => handleEditCampaign(ev.campaign)}
                              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-200/80 hover:text-neutral-950 dark:bg-white/10 dark:text-slate-300"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>{isAr ? 'تعديل' : 'Edit'}</span>
                            </button>
                          ) : null}
                        </div>

                        {!isDemo ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(ev.campaign.id)}
                            aria-label={isAr ? 'حذف الحملة' : 'Delete campaign'}
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-medium text-neutral-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* 4. 6 Streamlined Ready-to-Run Kuwait Growth Plays (Cut Text Wall by 60%) */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr
                    ? '٦ خطط جاهزة لزيادة المبيعات بالكويت'
                    : '6 Ready-to-Run Kuwait Growth Plays'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? `عائد صافي (متحفظ – واقعي) محسوب لنطاق: ${workspace.subtitleAr}`
                    : `Conservative–Realistic net KWD scaled to: ${workspace.subtitleEn}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Dish of the Week Spotlight Pill */}
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#111A22]">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-neutral-400">
                    {isAr ? 'طبق الأسبوع:' : 'Dish of Week:'}
                  </span>
                  <span className="font-semibold text-neutral-950 dark:text-white">
                    {snap.marketing.dishOfTheWeek.dishName}
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {snap.marketing.dishOfTheWeek.marginPct}%
                  </span>
                </div>

                {/* Single Primary Emerald CTA for the Growth Plays Section */}
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      'all-6-plays',
                      snap.marketing.growthPlays
                        .map((p) => (isAr ? p.whatsappTextAr : p.whatsappTextEn))
                        .join('\n\n'),
                    )
                  }
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
                >
                  {copiedId === 'all-6-plays' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{isAr ? 'تم نسخ الـ ٦ خطط' : 'All 6 Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{isAr ? 'نسخ الـ ٦ خطط كاملة' : 'Copy All 6 Plays'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {snap.marketing.growthPlays.map((play) => {
                const isExpanded = Boolean(expandedPlays[play.id])
                const playApproval = getApprovalByRef(`growth-play:${play.id}`)
                const feryalPrompt = isAr
                  ? `فصّلي لي خطة التنفيذ العملية لـ (${play.titleAr}) لنطاق (${play.scopeAr}) مع جدول خطوات واضح وعائد (${play.upsideBadgeAr}).`
                  : `Give me the step-by-step execution plan for (${play.titleEn}) scoped to (${play.scopeEn}) targeting (${play.upsideBadgeEn}).`

                return (
                  <article
                    key={play.id}
                    className={`${CARD_CLS} flex flex-col justify-between space-y-3`}
                  >
                    <div className="space-y-2.5">
                      {/* Soft Scope Pill + Dynamic Filter-Scaled KWD Upside Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={SOFT_SCOPE_PILL_CLS}>
                            {isAr ? play.scopeAr : play.scopeEn}
                          </span>
                          {playApproval?.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              <span>{isAr ? 'معتمد ✅' : 'Approved ✅'}</span>
                            </span>
                          ) : playApproval?.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                              <Bell className="h-3 w-3" />
                              <span>{isAr ? 'بانتظار الموافقة' : 'Pending'}</span>
                            </span>
                          ) : null}
                        </div>
                        <span
                          dir="ltr"
                          title={isAr ? 'نطاق العائد الصافي (متحفظ – واقعي)' : 'Conservative – Realistic Net Upside'}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                        >
                          {isAr ? play.upsideBadgeAr : play.upsideBadgeEn}
                        </span>
                      </div>

                      {/* Concise Title */}
                      <h3 className="text-[15px] font-semibold tracking-tight leading-snug text-neutral-950 dark:text-white">
                        {isAr ? play.titleAr : play.titleEn}
                      </h3>

                      {/* Maximum 2 Short Single-Line Action Bullets (<= 8 words each) */}
                      <ul className="space-y-1.5 text-[12.5px] leading-snug text-neutral-600 dark:text-slate-300">
                        {(isAr ? play.shortBulletsAr : play.shortBulletsEn).slice(0, 2).map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Optional Expandable Details Drawer */}
                      {isExpanded ? (
                        <div className="rounded-xl bg-[#F7F7F8] p-3 text-xs leading-relaxed text-neutral-600 dark:bg-white/[0.04] dark:text-slate-300">
                          {isAr ? play.detailsAr : play.detailsEn}
                        </div>
                      ) : null}
                    </div>

                    {/* Side-by-Side Ask Feryal ✨ + Copy 📋 + Request Approval 🔔 + Details ▾ */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/erp/feryal-ai?prompt=${encodeURIComponent(feryalPrompt)}`}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
                        >
                          <span>{isAr ? 'اسأل فريال ✨' : 'Ask Feryal ✨'}</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            copyText(play.id, isAr ? play.whatsappTextAr : play.whatsappTextEn)
                          }
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-neutral-100 px-3 text-xs font-medium text-neutral-900 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.08] dark:text-slate-200"
                        >
                          {copiedId === play.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                              <span>{isAr ? 'تم النسخ ✓' : 'Copied ✓'}</span>
                            </>
                          ) : (
                            <span>{isAr ? 'نسخ 📋' : 'Copy 📋'}</span>
                          )}
                        </button>

                        {!playApproval ? (
                          <button
                            type="button"
                            onClick={() =>
                              requestApproval({
                                refKey: `growth-play:${play.id}`,
                                domain: 'growth-play',
                                titleAr: `تفعيل خطة نمو: ${play.titleAr}`,
                                titleEn: `Activate Growth Play: ${play.titleEn}`,
                                summaryAr: `${play.scopeAr} • العائد المتوقع: ${play.upsideBadgeAr} • ${play.shortBulletsAr.slice(0, 2).join(' — ')}`,
                                summaryEn: `${play.scopeEn} • Target Upside: ${play.upsideBadgeEn} • ${play.shortBulletsEn.slice(0, 2).join(' — ')}`,
                                departmentAr: 'التسويق وتشغيل الفروع',
                                departmentEn: 'Marketing & Branch Ops',
                                budgetOrCostKwd: 0,
                                expectedMonthlyReturnKwd: Math.max(150, Math.round(play.upsideMaxKwd)),
                                href: '/erp/cores?tab=marketing',
                              })
                            }
                            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 transition-colors duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                          >
                            <span>{isAr ? 'طلب موافقة 🔔' : 'Approve 🔔'}</span>
                          </button>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => togglePlayDrawer(play.id)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-medium text-neutral-400 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                      >
                        <span>{isAr ? 'التفاصيل' : 'Details'}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-150 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 2: المبيعات والقنوات (Sales Core — Exact 0.000 KWD Reconciliation & Zero Duplication)
         ===================================================================== */}
      {activeTab === 'sales' ? (
        <div className="space-y-4">
          {/* 4 Non-Redundant Executive Sales KPIs */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* KPI 1: Total Net Sales + Orders + Avg Bill in One Anchor Card */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'صافي المبيعات والطلبات' : 'Total Net Sales'}
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200">
                  {getPeriodLabel(filters.period, isAr)}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-neutral-950 sm:text-[32px] dark:text-white"
              >
                {f0(workspace.salesKwd)} {kwdSuffix}
              </div>
              <p dir="ltr" className="mt-1 text-[13.5px] tabular-nums text-neutral-500 dark:text-slate-400">
                {f0(workspace.orders)} {isAr ? 'طلب' : 'orders'} • {isAr ? 'متوسط' : 'Avg'}{' '}
                {f2(workspace.aovKwd)} {kwdSuffix}
              </p>
            </article>

            {/* KPI 2: Zero-Commission Sales (Dine-In + Direct Takeaway) */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'مبيعات بدون عمولة (صالة ومباشر)' : 'Zero-Commission Sales'}
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {f1(snap.sales.zeroCommSharePct)}%
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 sm:text-[32px] dark:text-emerald-400"
              >
                {f0(snap.sales.zeroCommDisplayKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[13.5px] tabular-nums text-neutral-500 dark:text-slate-400">
                {isAr
                  ? `صالة وسفري مباشر • ${f0(snap.sales.zeroCommOrders)} طلب`
                  : `Dine-In + Takeaway • ${f0(snap.sales.zeroCommOrders)} orders`}
              </p>
            </article>

            {/* KPI 3: Peak Sales Hour + Strongest Day Badge */}
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'ذروة المبيعات اليومية' : 'Peak Sales Hour'}
                </span>
                <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                  {isAr
                    ? `الأقوى: ${snap.sales.strongestDayLabelAr}`
                    : `Top: ${snap.sales.strongestDayLabelEn}`}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-neutral-950 sm:text-[28px] dark:text-white"
              >
                {isAr ? snap.sales.peakHourShortAr : snap.sales.peakHourShortEn} •{' '}
                {f0(snap.sales.peakHourDisplayKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[13.5px] tabular-nums text-neutral-500 dark:text-slate-400">
                {isAr
                  ? `${f0(snap.sales.peakHourOrders)} طلب (${f1(snap.sales.peakHourSharePct)}% من اليوم)`
                  : `${f0(snap.sales.peakHourOrders)} orders (${f1(snap.sales.peakHourSharePct)}% of day)`}
              </p>
            </article>

            {/* KPI 4: Quiet Window (3–6 PM) + Recoverable Upside Badge */}
            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'مبيعات الساعات الهادئة (٣–٦ م)' : 'Quiet Window (3–6 PM)'}
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  +{f0(snap.sales.quietWindowUpsideKwd)} {kwdSuffix}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-neutral-950 sm:text-[32px] dark:text-white"
              >
                {f0(snap.sales.quietWindowDisplayKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[13.5px] tabular-nums text-neutral-500 dark:text-slate-400">
                {isAr
                  ? `${f1(snap.sales.quietWindowSharePct)}% من المبيعات • جاهزة لعروض العصر`
                  : `${f1(snap.sales.quietWindowSharePct)}% of sales • recoverable combo upside`}
              </p>
            </article>
          </section>

          {/* Finance V2 Bento Split: 8-Col Sales Capsule Timeline + 4-Col 0%-Fee Direct vs Aggregator Mix */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4">
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr ? 'حركة المبيعات والطلبات حسب الفترة' : 'Sales & Orders Timeline'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? 'مرّر الماوس على أي عمود لعرض المبيعات بالدينار وعدد الطلبات ومتوسط الفاتورة'
                    : 'Hover any capsule for exact Sales KWD, Orders, and Average Bill'}
                </p>
              </div>
              <InteractiveHoverBarChart
                data={salesTimelineData}
                isAr={isAr}
                primaryLegend={isAr ? 'المبيعات (د.ك)' : 'Sales (KWD)'}
                primaryColor="#10B981"
                heightClass="h-64"
              />
            </div>

            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-4`}>
              <div className="mb-3">
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr ? 'الصالة والاستلام مقابل التوصيل' : '0%-Fee Direct vs Aggregator Mix'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? 'نسبة المباشر بدون عمولة ومقارنة صافي الهامش'
                    : 'Zero-fee direct share vs delivery apps net margin'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={salesDirectVsAggregatorSlices}
                centerValue={`${f1(snap.sales.zeroCommSharePct)}%`}
                centerLabel={isAr ? 'بدون عمولة' : '0%-Fee Share'}
                summaryPill={{
                  label: isAr ? 'صافي الهامش (مباشر مقابل تطبيقات)' : 'Direct vs Apps Net Margin',
                  value: `${f1(snap.sales.directNetMarginPct)}% vs ${f1(snap.sales.aggregatorNetMarginPct)}%`,
                  tone: 'emerald',
                }}
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* Peak Hours Interactive Hover Chart */}
          <section className={CARD_CLS}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr ? 'ساعات الذروة والساعات الهادئة (٢٤ ساعة)' : 'Peak & Quiet Hours (24h POS Profile)'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? 'الأخضر = ساعات الذروة | البرتقالي = ساعات هادئة (٣–٦ عصراً) جاهزة لعروض التنشيط'
                    : 'Emerald = Peak rush | Amber = Quiet afternoon window (3–6 PM) ideal for combos'}
                </p>
              </div>
            </div>
            <InteractiveHoverBarChart
              data={salesHourlyData}
              isAr={isAr}
              primaryLegend={isAr ? 'مبيعات الساعة (د.ك)' : 'Hourly Sales (KWD)'}
              primaryColor="#10B981"
              heightClass="h-56"
            />
          </section>

          {/* 3 Reconciled Interactive Ranking Cards (100.0% Exact Total & Click-to-Filter) */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* 1. 6 Venture Foods Brands */}
            <article className={CARD_CLS}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr ? 'حصة المطاعم الستة' : '6 Venture Foods Brands'}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr ? 'اضغط أي مطعم للفلترة • مطابق ١٠٠٪' : 'Click brand to filter • 100.0% reconciled'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {filters.brand !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setBrand('all')}
                      className="cursor-pointer rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                    >
                      {isAr ? 'الكل ✕' : 'All ✕'}
                    </button>
                  ) : null}
                  <span
                    dir="ltr"
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200"
                  >
                    100.0% · {f0(workspace.salesKwd)} {kwdSuffix}
                  </span>
                </div>
              </div>
              <InteractiveHorizontalRankList
                items={toRankItems(snap.sales.brandShare, 'brand', filters.brand)}
                isAr={isAr}
                onSelect={(id) =>
                  setBrand(filters.brand === id ? 'all' : (id as GlobalBrand))
                }
              />
            </article>

            {/* 2. 7 Active Branches Ranking */}
            <article className={CARD_CLS}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr ? 'ترتيب الفروع السبعة' : '7 Active Branches Ranking'}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr ? 'اضغط أي فرع للفلترة • مطابق ١٠٠٪' : 'Click branch to filter • 100.0% reconciled'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {filters.branch !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setBranch('all')}
                      className="cursor-pointer rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                    >
                      {isAr ? 'الكل ✕' : 'All ✕'}
                    </button>
                  ) : null}
                  <span
                    dir="ltr"
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200"
                  >
                    100.0% · {f0(workspace.salesKwd)} {kwdSuffix}
                  </span>
                </div>
              </div>
              <InteractiveHorizontalRankList
                items={toRankItems(snap.sales.branchRanking, 'branch', filters.branch)}
                isAr={isAr}
                onSelect={(id) =>
                  setBranch(filters.branch === id ? 'all' : (id as GlobalBranch))
                }
              />
            </article>

            {/* 3. Sales Channels & Apps */}
            <article className={CARD_CLS}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr ? 'القنوات وتطبيقات التوصيل' : 'Sales Channels & Apps'}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr ? 'اضغط أي قناة للفلترة • مطابق ١٠٠٪' : 'Click channel to filter • 100.0% reconciled'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {filters.channel !== 'all' ? (
                    <button
                      type="button"
                      onClick={() => setChannel('all')}
                      className="cursor-pointer rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200"
                    >
                      {isAr ? 'الكل ✕' : 'All ✕'}
                    </button>
                  ) : null}
                  <span
                    dir="ltr"
                    className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200"
                  >
                    100.0% · {f0(workspace.salesKwd)} {kwdSuffix}
                  </span>
                </div>
              </div>
              <InteractiveHorizontalRankList
                items={toRankItems(snap.sales.channelRanking, 'channel', filters.channel)}
                isAr={isAr}
                onSelect={(id) =>
                  setChannel(filters.channel === id ? 'all' : (id as GlobalChannel))
                }
              />
            </article>
          </section>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 3: هندسة المينيو (Products & Menu Engineering Matrix)
         ===================================================================== */}
      {activeTab === 'menu' ? (
        <div className="space-y-4">
          {/* 4 Crisp Non-Redundant Menu KPIs ("One Metric, One Place" — Gross Margin % lives in the Donut) */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الأصناف النشطة' : 'Active Menu Items'}
                </span>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200">
                  {isAr
                    ? `⭐ ${snap.menu.quadrantCounts.golden} · 💎 ${snap.menu.quadrantCounts['box-gem']}`
                    : `⭐ ${snap.menu.quadrantCounts.golden} · 💎 ${snap.menu.quadrantCounts['box-gem']}`}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-neutral-950 sm:text-[32px] dark:text-white"
              >
                {f0(snap.menu.totalActiveSkus)} {isAr ? 'صنف' : 'items'}
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr ? 'مربوطة بوصفات العارضية ونقاط البيع' : 'Linked to Ardiya BOM & POS sales'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الأطباق المباعة' : 'Total Units Sold'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200"
                >
                  {f0(snap.menu.totalSalesKwd)} {kwdSuffix}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-neutral-950 sm:text-[32px] dark:text-white"
              >
                {f0(snap.menu.totalUnitsSold)} {isAr ? 'طبق' : 'units'}
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr ? 'مطابق ١٠٠٪ لصافي مبيعات أودو' : '100% reconciled to Odoo net sales'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'فرصة تحسين التسعير والكومبو' : 'Menu Optimization Upside'}
                </span>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {isAr ? 'ثبات 95%' : '95% Retention'}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[28px] font-black tracking-tight tabular-nums text-emerald-700 sm:text-[32px] dark:text-emerald-400"
              >
                +{f0(snap.menu.optimizationUpsideKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-slate-400">
                {isAr
                  ? 'صافي متحفظ بعد خصم عمولة التطبيقات'
                  : 'Conservative net gain after app fees'}
              </p>
            </article>

            <article
              onClick={() => snap.menu.topProfitDish && openDishSimulator(snap.menu.topProfitDish)}
              className={`${KPI_CARD_CLS} ae-glow-amber cursor-pointer transition-transform duration-150 hover:scale-[1.005]`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-500 dark:text-slate-400">
                  {isAr ? 'أعلى صنف ربحاً' : 'Top Profit Dish'}
                </span>
                {snap.menu.topProfitDish ? (
                  <span className={SOFT_SCOPE_PILL_CLS}>
                    {isAr ? snap.menu.topProfitDish.brandAr : snap.menu.topProfitDish.brandEn}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 truncate text-[17.5px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                {snap.menu.topProfitDish?.name ?? '—'}
              </div>
              <p
                dir="ltr"
                className="mt-1 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {snap.menu.topProfitDish
                  ? `+${f0(snap.menu.topProfitDish.netProfitKwd)} ${kwdSuffix} · ${f0(snap.menu.topProfitDish.unitsSold)} ${isAr ? 'طبق' : 'units'}`
                  : '—'}
              </p>
            </article>
          </section>

          {/* Bento Split: 8-Col Horizontal Executive Ranking (Heroes vs Margin Bleeders) + 4-Col Green Gross Margin Donut */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left 8-Col: Horizontal Executive Dish Ranking (Zero Truncated Vertical X-Axis Labels!) */}
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr
                      ? 'ترتيب الأطباق التنفيذي: أبطال الربح مقابل ضعيفة الهامش'
                      : 'Executive Dish Ranking: Profit Heroes vs Margin Bleeders'}
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr
                      ? 'اضغط على أي طبق لفتح حاسبة التسعير وتكلفة العارضية (ثبات ٩٥٪ من الكمية)'
                      : 'Click any dish to launch the Conservative 95%-Retention Price & Cost Simulator'}
                  </p>
                </div>

                {/* Instant View Mode Switcher */}
                <div className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] p-1 dark:bg-white/[0.05]">
                  {(
                    [
                      { id: 'split', ar: 'جنباً إلى جنب', en: 'Side-by-Side' },
                      { id: 'heroes', ar: 'أبطال الربح 🟢', en: 'Top 8 Heroes 🟢' },
                      { id: 'bleeders', ar: 'ضعيفة الهامش 🔴', en: 'Top 8 Bleeders 🔴' },
                    ] as const
                  ).map((v) => {
                    const active = menuRankView === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setMenuRankView(v.id)}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
                          active
                            ? 'bg-white font-semibold text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-emerald-950/80 dark:text-emerald-200'
                            : 'text-neutral-500 hover:text-neutral-900 dark:text-slate-400 dark:hover:text-white'
                        }`}
                      >
                        {isAr ? v.ar : v.en}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div
                className={`grid grid-cols-1 gap-4 ${
                  menuRankView === 'split' ? 'xl:grid-cols-2' : ''
                }`}
              >
                {/* List 1: Top 8 Profit Heroes */}
                {menuRankView === 'split' || menuRankView === 'heroes' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-white">
                        {isAr
                          ? 'أعلى ٨ أطباق تدرّ صافياً بالجيب 🟢'
                          : 'Top 8 Profit Heroes 🟢'}
                      </h3>
                      <span className="text-[11px] font-medium text-neutral-400">
                        {isAr ? 'الربح الصافي بعد الأكل' : 'Net Dish Profit'}
                      </span>
                    </div>

                    {(() => {
                      const maxHeroProfit = Math.max(
                        1,
                        ...snap.menu.topProfitHeroes.map((x) => x.netProfitKwd),
                      )
                      return snap.menu.topProfitHeroes.map((d, idx) => {
                        const widthPct = Math.max(
                          6,
                          Math.min(100, (d.netProfitKwd / maxHeroProfit) * 100),
                        )
                        return (
                          <button
                            key={`hero-${d.id}`}
                            type="button"
                            onClick={() => openDishSimulator(d)}
                            className="ae-bento-subcard group block w-full cursor-pointer rounded-xl bg-[#F7F7F8] p-3 text-start transition-all duration-150 hover:bg-neutral-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <span
                                  dir="ltr"
                                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                                >
                                  {idx + 1}
                                </span>
                                <span className="break-words text-[13px] font-semibold leading-snug text-neutral-950 dark:text-white">
                                  {d.name}
                                </span>
                              </div>
                              <span
                                dir="ltr"
                                className="shrink-0 text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                              >
                                +{f0(d.netProfitKwd)} {kwdSuffix}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-emerald-950/60 dark:text-emerald-200">
                                  {isAr ? d.brandAr : d.brandEn}
                                </span>
                                <span dir="ltr" className="tabular-nums text-neutral-500 dark:text-slate-400">
                                  {f0(d.unitsSold)} {isAr ? 'طبق' : 'units'}
                                </span>
                              </div>
                              <span
                                dir="ltr"
                                className="tabular-nums font-medium text-neutral-500 dark:text-slate-400"
                              >
                                {isAr ? 'تكلفة الأكل' : 'Food Cost'} {f1(d.foodCostPct)}%
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/70 dark:bg-white/[0.08]">
                              <div
                                style={{ width: `${widthPct}%` }}
                                className="h-full rounded-full bg-emerald-500/85 transition-all duration-150"
                              />
                            </div>
                          </button>
                        )
                      })
                    })()}
                  </div>
                ) : null}

                {/* List 2: Top 8 Margin Bleeders / Ardiya Cost Creep */}
                {menuRankView === 'split' || menuRankView === 'bleeders' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <h3 className="text-[14px] font-semibold tracking-tight text-neutral-900 dark:text-white">
                        {isAr
                          ? 'أخطر ٨ أطباق عالية التكلفة أو ضعيفة الهامش 🔴'
                          : 'Top 8 Margin Bleeders / Price Gaps 🔴'}
                      </h3>
                      <span className="text-[11px] font-medium text-neutral-400">
                        {isAr ? 'تضخم وصفة العارضية' : 'Ardiya BOM Creep'}
                      </span>
                    </div>

                    {(() => {
                      const maxFoodPct = Math.max(
                        45,
                        ...snap.menu.topMarginBleeders.map((x) => x.foodCostPct),
                      )
                      return snap.menu.topMarginBleeders.map((d, idx) => {
                        const widthPct = Math.max(
                          12,
                          Math.min(100, (d.foodCostPct / maxFoodPct) * 100),
                        )
                        return (
                          <button
                            key={`bleed-${d.id}`}
                            type="button"
                            onClick={() => openDishSimulator(d)}
                            className="ae-bento-subcard group block w-full cursor-pointer rounded-xl bg-[#F7F7F8] p-3 text-start transition-all duration-150 hover:bg-neutral-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <span
                                  dir="ltr"
                                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-[11px] font-semibold tabular-nums text-rose-700 dark:text-rose-300"
                                >
                                  {idx + 1}
                                </span>
                                <span className="break-words text-[13px] font-semibold leading-snug text-neutral-950 dark:text-white">
                                  {d.name}
                                </span>
                              </div>
                              <span
                                dir="ltr"
                                className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              >
                                {isAr ? 'تكلفة' : 'Cost'} {f1(d.foodCostPct)}%
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[11.5px]">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:bg-emerald-950/60 dark:text-emerald-200">
                                  {isAr ? d.brandAr : d.brandEn}
                                </span>
                                <span dir="ltr" className="tabular-nums text-neutral-500 dark:text-slate-400">
                                  {f0(d.unitsSold)} {isAr ? 'طبق' : 'units'}
                                </span>
                                {d.costGapPct > 0 ? (
                                  <span
                                    dir="ltr"
                                    className="font-medium tabular-nums text-amber-700 dark:text-amber-300"
                                  >
                                    +{f1(d.costGapPct)}% {isAr ? 'فوق الهدف' : 'over target'}
                                  </span>
                                ) : null}
                              </div>
                              <span
                                dir="ltr"
                                className="tabular-nums font-semibold text-neutral-800 dark:text-slate-200"
                              >
                                +{f0(d.netProfitKwd)} {kwdSuffix}
                              </span>
                            </div>

                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/70 dark:bg-white/[0.08]">
                              <div
                                style={{ width: `${widthPct}%` }}
                                className="h-full rounded-full bg-rose-500/80 transition-all duration-150"
                              />
                            </div>
                          </button>
                        )
                      })
                    })()}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Right 4-Col: Green Gross Margin Donut (Single % Inside Ring + Exact KWD Summary Rows Below) */}
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-4`}>
              <div className="mb-3">
                <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {isAr ? 'هامش الأطباق وتوزيعة الربح' : 'Gross Margin & Profit Mix'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? 'النسبة الصافية بالوسط وتفاصيل الدينار بالأسفل'
                    : 'Single % centered in ring · exact KWD rows below'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={menuTagDonutSlices}
                centerValue={`${f1(snap.menu.avgMarginPct)}%`}
                centerLabel={isAr ? 'هامش الأطباق' : 'Gross Margin'}
                summaryRows={[
                  {
                    label: isAr ? 'مبيعات المينيو المطابقة' : 'Reconciled Menu Sales',
                    value: `${f0(snap.menu.totalSalesKwd)} ${kwdSuffix}`,
                    tone: 'neutral',
                  },
                  {
                    label: isAr ? 'تكلفة المواد والتغليف' : 'Food & Packaging Cost',
                    value: `${f0(snap.menu.totalCostKwd)} ${kwdSuffix} (${f1(snap.menu.avgFoodCostPct)}%)`,
                    tone: 'amber',
                  },
                  {
                    label: isAr ? 'صافي ربح الأطباق' : 'Net Dish Gross Profit',
                    value: `+${f0(snap.menu.totalNetProfitKwd)} ${kwdSuffix}`,
                    tone: 'emerald',
                  },
                ]}
                activeSliceId={dishTagFilter === 'all' ? undefined : dishTagFilter}
                onSelectSlice={(id) =>
                  setDishTagFilter((cur) => (cur === id ? 'all' : (id as DishSimpleTag)))
                }
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* Paginated Menu Engineering Matrix Table (12 Rows Default + Search + 4 Quadrant Pills + Simulator Trigger) */}
          <section className={`${CARD_CLS} overflow-hidden p-0`}>
            {/* Table Header: Title + Search + Sort + 4 Menu Engineering Matrix Pills */}
            <div className="space-y-3.5 px-5 pt-5 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr
                      ? 'مصفوفة هندسة المينيو وحاسبة تسعير الأطباق'
                      : 'Menu Engineering Matrix & Dish Pricing Studio'}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr
                      ? 'اضغط على أي صنف لمحاكاة رفع السعر أو الكومبو بنسبة ثبات ٩٥٪ بعد خصم عمولة المنصة'
                      : 'Click any dish row to simulate +100/+150 fils or recipe fixes at 95% volume retention'}
                  </p>
                </div>

                {/* Instant Dish & Brand Search + Sort Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-64 sm:w-72">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      placeholder={
                        isAr ? 'ابحث عن طبق أو مطعم... 🔍' : 'Search dish or brand... 🔍'
                      }
                      className="h-9 w-full rounded-full bg-[#F7F7F8] ps-9 pe-8 text-xs font-medium text-neutral-900 transition-all duration-150 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-white/[0.06] dark:text-white"
                    />
                    {dishSearch ? (
                      <button
                        type="button"
                        onClick={() => setDishSearch('')}
                        aria-label={isAr ? 'مسح البحث' : 'Clear search'}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <select
                    value={dishSort}
                    onChange={(e) => setDishSort(e.target.value as MenuSortKey)}
                    className="h-9 cursor-pointer rounded-full bg-[#F7F7F8] px-3.5 text-xs font-medium text-neutral-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-white/[0.06] dark:text-slate-200"
                  >
                    <option value="profit">{isAr ? 'الأعلى ربحاً' : 'Highest Profit'}</option>
                    <option value="units">{isAr ? 'الأكثر طلباً' : 'Most Units Sold'}</option>
                    <option value="costPct">{isAr ? 'الأعلى تكلفة %' : 'Highest Food Cost %'}</option>
                    <option value="sales">{isAr ? 'الأعلى مبيعات' : 'Highest Sales KWD'}</option>
                  </select>
                </div>
              </div>

              {/* 4 Menu Engineering Matrix Filter Pills + All */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                  {TAG_FILTERS.map((tf) => {
                    const isSelected = dishTagFilter === tf.id
                    const count =
                      tf.id === 'all'
                        ? snap.menu.totalActiveSkus
                        : snap.menu.quadrantCounts[tf.id]
                    return (
                      <button
                        key={tf.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        title={isAr ? tf.subAr : tf.subEn}
                        onClick={() => setDishTagFilter(tf.id)}
                        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs transition-all duration-150 ${
                          isSelected
                            ? 'bg-emerald-600 font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-emerald-500 dark:text-neutral-950'
                            : 'bg-[#F7F7F8] font-medium text-neutral-700 hover:bg-neutral-200/70 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.09]'
                        }`}
                      >
                        <span>{isAr ? tf.ar : tf.en}</span>
                        <span
                          dir="ltr"
                          className={`rounded-full px-1.5 py-0.5 text-[10.5px] tabular-nums ${
                            isSelected
                              ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-neutral-950'
                              : 'bg-white text-neutral-500 dark:bg-white/10 dark:text-slate-300'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <span
                  dir="ltr"
                  className="rounded-full bg-[#F7F7F8] px-3 py-1 text-[13px] font-medium tabular-nums text-neutral-600 dark:bg-white/[0.06] dark:text-slate-300"
                >
                  {isAr ? 'إجمالي المينيو المطابق:' : 'Reconciled Menu Sales:'}{' '}
                  {f0(snap.menu.totalSalesKwd)} {kwdSuffix}
                </span>
              </div>
            </div>

            {/* Crisp Executive Table (Default 12 rows — Zero 50-Row Wall!) */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-start text-[14px]">
                <thead>
                  <tr className="bg-[#F7F7F8] text-[13px] font-semibold text-neutral-500 dark:bg-white/[0.04] dark:text-slate-400">
                    <th className="px-5 py-3 text-start">{isAr ? 'الطبق' : 'Dish'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'المطعم' : 'Brand'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الكمية' : 'Qty Sold'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'سعر البيع' : 'Price'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'تكلفة الطبق %' : 'Unit Cost (%)'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'المبيعات' : 'Sales KWD'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الربح الصافي' : 'Net Profit'}</th>
                    <th className="px-5 py-3 text-end">
                      {isAr ? 'التوصية والمحاكاة' : 'Matrix Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100/80 dark:divide-white/[0.05]">
                  {paginatedDishes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-10 text-center text-xs font-medium text-neutral-400"
                      >
                        {isAr
                          ? 'لا توجد أطباق مطابقة للبحث أو التصنيف المختار.'
                          : 'No dishes match the selected search or matrix lens.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedDishes.map((d) => {
                      const actionBadgeCls =
                        d.tag === 'golden'
                          ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : d.tag === 'reprice'
                            ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200'
                            : d.tag === 'box-gem'
                              ? 'bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200'
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/80 dark:bg-white/10 dark:text-slate-200'

                      const costHigh = d.costGapPct > 0 || d.foodCostPct >= 33

                      return (
                        <tr
                          key={d.id}
                          onClick={() => openDishSimulator(d)}
                          className="cursor-pointer transition-colors duration-150 hover:bg-[#F7F7F8]/90 dark:hover:bg-white/[0.04]"
                        >
                          <td className="px-5 py-3">
                            <div className="font-semibold text-neutral-950 dark:text-white">
                              {d.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-neutral-400">
                              {isAr ? d.tagAr : d.tagEn}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={SOFT_SCOPE_PILL_CLS}>
                              {isAr ? d.brandAr : d.brandEn}
                            </span>
                          </td>
                          <td
                            dir="ltr"
                            className="px-3 py-3 text-end font-semibold tabular-nums text-neutral-800 dark:text-slate-200"
                          >
                            {f0(d.unitsSold)}
                          </td>
                          <td
                            dir="ltr"
                            className="px-3 py-3 text-end tabular-nums text-neutral-700 dark:text-slate-300"
                          >
                            {f2(d.unitPriceKwd)}
                          </td>
                          <td dir="ltr" className="px-3 py-3 text-end tabular-nums">
                            <span className="text-neutral-600 dark:text-slate-300">
                              {f2(d.unitCostKwd)}
                            </span>{' '}
                            <span
                              className={`inline-block rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                                costHigh
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-neutral-100 text-neutral-600 dark:bg-white/[0.06] dark:text-slate-300'
                              }`}
                            >
                              {f1(d.foodCostPct)}%
                            </span>
                          </td>
                          <td
                            dir="ltr"
                            className="px-3 py-3 text-end font-semibold tabular-nums text-neutral-900 dark:text-white"
                          >
                            {f1(d.salesKwd)}
                          </td>
                          <td
                            dir="ltr"
                            className="px-3 py-3 text-end font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                          >
                            +{f1(d.netProfitKwd)}{' '}
                            <span className="text-[11.5px] font-medium text-neutral-400">
                              ({f1(d.marginPct)}%)
                            </span>
                          </td>
                          <td className="px-5 py-3 text-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDishSimulator(d)
                              }}
                              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${actionBadgeCls}`}
                            >
                              <span>{isAr ? d.actionBadgeAr : d.actionBadgeEn}</span>
                              <Calculator className="h-3 w-3 opacity-75" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Clean Executive Pagination Bar (12 / 25 / عرض الكل + السابق / التالي) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F7F8]/80 px-5 py-3.5 text-xs dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-neutral-600 dark:text-slate-300">
                  {isAr
                    ? `عرض ${fArInt(menuStartRow)}–${fArInt(menuEndRow)} من ${fArInt(filteredDishes.length)} صنفاً`
                    : `Showing ${menuStartRow}–${menuEndRow} of ${filteredDishes.length} items`}
                </span>

                {/* Page Size Pills: 12 / 25 / عرض الكل */}
                <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#111A22]">
                  {([12, 25, 'all'] as const).map((sz) => {
                    const active = menuPageSize === sz
                    return (
                      <button
                        key={String(sz)}
                        type="button"
                        onClick={() => setMenuPageSize(sz)}
                        className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ${
                          active
                            ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-neutral-950'
                            : 'text-neutral-600 hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        {sz === 'all' ? (isAr ? 'عرض الكل' : 'Show All') : sz}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Previous / Next Controls */}
              {menuPageSize !== 'all' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safeMenuPage <= 1}
                    onClick={() => setMenuPage((p) => Math.max(1, p - 1))}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#111A22] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                  >
                    {isAr ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    )}
                    <span>{isAr ? 'السابق' : 'Previous'}</span>
                  </button>

                  <span
                    dir="ltr"
                    className="px-1.5 font-semibold tabular-nums text-neutral-600 dark:text-slate-300"
                  >
                    {safeMenuPage} / {menuTotalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safeMenuPage >= menuTotalPages}
                    onClick={() => setMenuPage((p) => Math.min(menuTotalPages, p + 1))}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#111A22] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                  >
                    <span>{isAr ? 'التالي' : 'Next'}</span>
                    {isAr ? (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {/* =====================================================================
          INTERACTIVE PRICE & COST SIMULATOR DRAWER (95% Volume Retention Net of App Fee)
         ===================================================================== */}
      {selectedDish && simResult ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            isAr
              ? `حاسبة تسعير وتكلفة ${selectedDish.name}`
              : `Price & Cost Simulator — ${selectedDish.name}`
          }
          onClick={() => setSelectedDish(null)}
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-150"
        >
          <div
            dir={isAr ? 'rtl' : 'ltr'}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-lg flex-col justify-between overflow-y-auto bg-white p-6 shadow-2xl dark:bg-[#0E161E]"
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={SOFT_SCOPE_PILL_CLS}>
                      {isAr ? selectedDish.brandAr : selectedDish.brandEn}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      {isAr ? selectedDish.tagAr : selectedDish.tagEn}
                    </span>
                  </div>
                  <h2 className="text-[19px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {selectedDish.name}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-slate-400">
                    {isAr ? selectedDish.costCreepNoteAr : selectedDish.costCreepNoteEn}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDish(null)}
                  aria-label={isAr ? 'إغلاق الحاسبة' : 'Close simulator'}
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#F7F7F8] text-neutral-600 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.08] dark:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 4 Current Baseline Tiles */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-white/[0.04]">
                  <div className="text-[11px] font-medium text-neutral-400">
                    {isAr ? 'سعر البيع الحالي' : 'Current Price'}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-1 text-[16px] font-semibold tabular-nums text-neutral-950 dark:text-white"
                  >
                    {f2(selectedDish.unitPriceKwd)} {kwdSuffix}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-white/[0.04]">
                  <div className="text-[11px] font-medium text-neutral-400">
                    {isAr ? 'تكلفة العارضية والتغليف' : 'Ardiya BOM + Pack'}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-1 text-[16px] font-semibold tabular-nums text-neutral-950 dark:text-white"
                  >
                    {f2(selectedDish.unitCostKwd)} {kwdSuffix}{' '}
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      ({f1(selectedDish.foodCostPct)}%)
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-white/[0.04]">
                  <div className="text-[11px] font-medium text-neutral-400">
                    {isAr ? 'الكمية الشهرية (٣٠ يوم)' : 'Monthly Volume (30d)'}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-1 text-[16px] font-semibold tabular-nums text-neutral-950 dark:text-white"
                  >
                    {f0(selectedDish.monthlyUnitsSold)} {isAr ? 'طبق' : 'units'}
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-white/[0.04]">
                  <div className="text-[11px] font-medium text-neutral-400">
                    {isAr ? 'عمولة القناة المعتمدة' : 'Effective Channel Fee'}
                  </div>
                  <div
                    dir="ltr"
                    className="mt-1 text-[16px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
                  >
                    {f1(snap.menu.effectiveChannelFeePct)}%
                  </div>
                </div>
              </div>

              {/* Control 1: Price / Combo Tweak Presets */}
              <div className="space-y-2 rounded-2xl bg-[#F7F7F8] p-4 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-slate-200">
                    {isAr ? '١) تعديل سعر البيع أو كومبو' : '1) Price or Combo Tweak'}
                  </label>
                  <span
                    dir="ltr"
                    className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {f2(selectedDish.unitPriceKwd)} → {f2(simResult.newPriceKwd)} {kwdSuffix}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { val: 0, ar: 'بدون رفع', en: '0 fils' },
                    { val: 0.05, ar: '+٥٠ فلس', en: '+50 fils' },
                    { val: 0.1, ar: '+١٠٠ فلس', en: '+100 fils' },
                    { val: 0.15, ar: '+١٥٠ فلس', en: '+150 fils' },
                    { val: 0.2, ar: '+٢٠٠ فلس', en: '+200 fils' },
                    { val: 0.25, ar: '+٢٥٠ فلس', en: '+250 fils' },
                  ].map((p) => {
                    const active = Math.abs(simDeltaPrice - p.val) < 0.005
                    return (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setSimDeltaPrice(p.val)}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
                          active
                            ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-neutral-950'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-[#111A22] dark:text-slate-200'
                        }`}
                      >
                        {isAr ? p.ar : p.en}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Control 2: Ardiya Recipe / Portion Trim Saving */}
              <div className="space-y-2 rounded-2xl bg-[#F7F7F8] p-4 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-neutral-800 dark:text-slate-200">
                    {isAr
                      ? '٢) ضبط هدر ومقادير مطبخ العارضية'
                      : '2) Ardiya Recipe & Portion Calibration'}
                  </label>
                  <span
                    dir="ltr"
                    className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-slate-300"
                  >
                    -{simCostSavePct}% ({f2(simResult.newUnitCostKwd)} {kwdSuffix})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 3, 5, 8].map((pct) => {
                    const active = simCostSavePct === pct
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSimCostSavePct(pct)}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
                          active
                            ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-neutral-950'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-[#111A22] dark:text-slate-200'
                        }`}
                      >
                        {pct === 0 ? (isAr ? 'الحالي (0%)' : 'Current (0%)') : `-${pct}%`}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Control 3: Conservative Volume Retention (Default 95%) & App Pinning Lift */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-2 rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-white/[0.03]">
                  <div className="text-xs font-semibold text-neutral-800 dark:text-slate-200">
                    {isAr ? 'ثبات الكمية المحافظ' : 'Volume Retention'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[94, 95, 96, 97].map((ret) => {
                      const active = simRetentionPct === ret
                      return (
                        <button
                          key={ret}
                          type="button"
                          onClick={() => setSimRetentionPct(ret)}
                          className={`cursor-pointer rounded-full px-2.5 py-1 text-xs tabular-nums transition-all duration-150 ${
                            active
                              ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-neutral-950'
                              : 'bg-white text-neutral-700 dark:bg-[#111A22] dark:text-slate-200'
                          }`}
                        >
                          {ret}%
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-white/[0.03]">
                  <div className="text-xs font-semibold text-neutral-800 dark:text-slate-200">
                    {isAr ? 'دفعة تثبيت بالتطبيقات' : 'App Top-Slot Lift'}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 6, 12].map((lift) => {
                      const active = simPromoLiftPct === lift
                      return (
                        <button
                          key={lift}
                          type="button"
                          onClick={() => setSimPromoLiftPct(lift)}
                          className={`cursor-pointer rounded-full px-2.5 py-1 text-xs tabular-nums transition-all duration-150 ${
                            active
                              ? 'bg-sky-600 font-semibold text-white dark:bg-sky-500 dark:text-neutral-950'
                              : 'bg-white text-neutral-700 dark:bg-[#111A22] dark:text-slate-200'
                          }`}
                        >
                          {lift === 0 ? '0%' : `+${lift}%`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Live Conservative CFO Gain Result Box */}
              <div className="rounded-2xl bg-emerald-50/90 p-4 dark:bg-emerald-950/45">
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-900 dark:text-emerald-200">
                  <span>
                    {isAr
                      ? `الربح الإضافي الصافي بالجيب (ثبات ${simRetentionPct}% بعد العمولة)`
                      : `Conservative Monthly Net Gain (${simRetentionPct}% retention, net of fee)`}
                  </span>
                </div>
                <div
                  dir="ltr"
                  className={`mt-1.5 text-[26px] font-semibold tracking-tight tabular-nums ${
                    simResult.monthlyNetGainKwd >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {simResult.monthlyNetGainKwd >= 0 ? '+' : ''}
                  {f0(simResult.monthlyNetGainKwd)} {kwdSuffix}{' '}
                  <span className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/80">
                    {isAr ? '/ شهرياً' : '/ month'}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-emerald-900/85 dark:text-emerald-200/85">
                  <div className="flex items-center justify-between">
                    <span>{isAr ? 'الصافي الشهري قبل ← بعد:' : 'Monthly Net Before -> After:'}</span>
                    <span dir="ltr" className="font-semibold tabular-nums">
                      {f0(simResult.currentMonthlyNetKwd)} → {f0(simResult.simulatedMonthlyNetKwd)}{' '}
                      {kwdSuffix}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{isAr ? 'صافي الطبق الواحد بالجيب:' : 'Net Pocket per Unit:'}</span>
                    <span dir="ltr" className="font-semibold tabular-nums">
                      {f3(simResult.unitNetBeforeKwd)} → {f3(simResult.unitNetAfterKwd)} {kwdSuffix}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{isAr ? 'الكمية الشهرية المتوقعة:' : 'Simulated Monthly Units:'}</span>
                    <span dir="ltr" className="font-semibold tabular-nums">
                      {f0(simResult.baseUnitsMo)} → {f0(simResult.simUnitsMo)}{' '}
                      {isAr ? 'طبق' : 'units'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="mt-6 flex items-center justify-between gap-2 pt-3">
              <button
                type="button"
                onClick={() =>
                  copyText(`sim-${selectedDish.id}`, formatDishSimWhatsapp(selectedDish))
                }
                className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700"
              >
                {copiedId === `sim-${selectedDish.id}` ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{isAr ? 'تم نسخ القرار للواتساب ✓' : 'Copied to WhatsApp ✓'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{isAr ? 'نسخ قرار التسعير للواتساب 📋' : 'Copy Action to WhatsApp 📋'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedDish(null)}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-neutral-100 px-4 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/10 dark:text-slate-200"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
