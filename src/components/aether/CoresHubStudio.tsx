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
  formatArDays,
  GLOBAL_BRANCH_OPTIONS,
  GLOBAL_BRAND_OPTIONS,
  getPeriodLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'
import { shiftIsoDate } from '@/lib/erp-comparison-engine'
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
  formatCompactAxisLabel,
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
  trailing,
}: {
  options: readonly { id: K; label: string; icon?: React.ReactNode }[]
  value: K
  onChange: (next: K) => void
  ariaLabel?: string
  trailing?: React.ReactNode
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 ring-1 ring-slate-900/[0.04] select-none dark:bg-white/[0.06] dark:ring-emerald-500/10"
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
      {trailing ? (
        <>
          <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-neutral-300/70 dark:bg-white/10" />
          {trailing}
        </>
      ) : null}
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
/** Audit taxonomy anchors: مبيعات الساعات الهادئة (٣–٦ م) | أعلى ٨ أطباق تدرّ صافياً بالجيب 🟢 | أخطر ٨ أطباق عالية التكلفة أو ضعيفة الهامش 🔴 — rendered in Western 0-9 numerals */
const fArInt = (n: number) =>
  Math.max(0, Math.round(Number.isFinite(n) ? n : 0)).toLocaleString('en-US')

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CARD_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SOFT_SCOPE_PILL_CLS =
  'bg-neutral-100 text-neutral-800 dark:bg-emerald-950/70 dark:text-emerald-200 font-medium text-[12.5px] px-2.5 py-1 rounded-lg'

const INPUT_CLS =
  'h-10 w-full rounded-xl bg-white px-3 text-[14px] font-medium text-neutral-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.06] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-[#09110E] dark:text-white dark:ring-emerald-500/15'

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
  const [formBranch, setFormBranch] = useState<GlobalBranch>('all')
  const [formAdType, setFormAdType] = useState<SocialAdType>('influencer')
  const [formName, setFormName] = useState('')
  const [formSpend, setFormSpend] = useState('150')
  const [formStartDate, setFormStartDate] = useState('2026-10-29')
  const [formEndDate, setFormEndDate] = useState('2026-10-31')
  const [formCompareStartDate, setFormCompareStartDate] = useState('2026-10-26')
  const [formCompareEndDate, setFormCompareEndDate] = useState('2026-10-28')
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

  // Sync default form brand & branch when user picks a specific scope in TopFilterBar
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
    setFormBranch(filters.branch)
    setFormAdType('influencer')
    setFormName('')
    setFormSpend('150')
    setFormStartDate('2026-10-29')
    setFormEndDate('2026-10-31')
    setFormCompareStartDate('2026-10-26')
    setFormCompareEndDate('2026-10-28')
    setFormItem('')
    setIsAdFormOpen(false)
  }, [filters.brand, filters.branch])

  const upsertCampaignFromForm = useCallback((): SocialCampaign => {
    const cleanName =
      formName.trim() || (isAr ? 'حملة سوشيال ومشاهير' : 'Social Media Campaign')
    const spend = Math.max(0, Number(formSpend) || 0)
    const rawStart = /^\d{4}-\d{2}-\d{2}$/.test(formStartDate) ? formStartDate : '2026-10-29'
    const rawEnd = /^\d{4}-\d{2}-\d{2}$/.test(formEndDate) ? formEndDate : rawStart
    const startIso = rawStart <= rawEnd ? rawStart : rawEnd
    const endIso = rawStart <= rawEnd ? rawEnd : rawStart
    const cStart = /^\d{4}-\d{2}-\d{2}$/.test(formCompareStartDate)
      ? formCompareStartDate
      : shiftIsoDate(startIso, -3)
    const cEnd = /^\d{4}-\d{2}-\d{2}$/.test(formCompareEndDate)
      ? formCompareEndDate
      : shiftIsoDate(startIso, -1)

    if (editingId) {
      const updated: SocialCampaign = {
        id: editingId,
        brand: formBrand,
        branch: formBranch,
        adType: formAdType,
        campaignName: cleanName,
        spendKwd: spend,
        date: startIso,
        startDate: startIso,
        endDate: endIso,
        compareStartDate: cStart <= cEnd ? cStart : cEnd,
        compareEndDate: cStart <= cEnd ? cEnd : cStart,
        promotedItem: formItem.trim(),
      }
      persistCampaigns(campaigns.map((c) => (c.id === editingId ? updated : c)))
      return updated
    }

    const created: SocialCampaign = {
      id: `camp-${Date.now()}`,
      brand: formBrand,
      branch: formBranch,
      adType: formAdType,
      campaignName: cleanName,
      spendKwd: spend,
      date: startIso,
      startDate: startIso,
      endDate: endIso,
      compareStartDate: cStart <= cEnd ? cStart : cEnd,
      compareEndDate: cStart <= cEnd ? cEnd : cStart,
      promotedItem: formItem.trim(),
    }
    persistCampaigns([created, ...campaigns])
    return created
  }, [
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
        summaryAr: `الفترة ${evalRow.startDate} ← ${evalRow.endDate} (${formatArDays(evalRow.windowDays)}) • الميزانية ${f0(c.spendKwd)} د.ك • الصافي المتوقع ${evalRow.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(evalRow.netProfitAfterAdKwd)} د.ك.`,
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
    const sIso = c.startDate ?? c.date
    setEditingId(c.id)
    setFormBrand(c.brand)
    setFormBranch(c.branch ?? 'all')
    setFormAdType(c.adType)
    setFormName(c.campaignName)
    setFormSpend(String(c.spendKwd))
    setFormStartDate(sIso)
    setFormEndDate(c.endDate ?? sIso)
    setFormCompareStartDate(c.compareStartDate ?? shiftIsoDate(sIso, -3))
    setFormCompareEndDate(c.compareEndDate ?? shiftIsoDate(sIso, -1))
    setFormItem(c.promotedItem ?? '')
    setIsAdFormOpen(true)
  }, [])

  // Live instant preview for the custom Campaign & Promo Ad ROI Calculator
  const liveFormPreview = useMemo<CampaignHaloEvaluation>(() => {
    const rawStart = /^\d{4}-\d{2}-\d{2}$/.test(formStartDate) ? formStartDate : '2026-10-29'
    const rawEnd = /^\d{4}-\d{2}-\d{2}$/.test(formEndDate) ? formEndDate : rawStart
    const startIso = rawStart <= rawEnd ? rawStart : rawEnd
    const endIso = rawStart <= rawEnd ? rawEnd : rawStart
    return evaluateCampaignOdooHalo(
      {
        id: 'preview-campaign',
        brand: formBrand,
        branch: formBranch,
        adType: formAdType,
        campaignName: formName || 'Preview',
        spendKwd: Math.max(0, Number(formSpend) || 0),
        date: startIso,
        startDate: startIso,
        endDate: endIso,
        compareStartDate: /^\d{4}-\d{2}-\d{2}$/.test(formCompareStartDate)
          ? formCompareStartDate
          : shiftIsoDate(startIso, -3),
        compareEndDate: /^\d{4}-\d{2}-\d{2}$/.test(formCompareEndDate)
          ? formCompareEndDate
          : shiftIsoDate(startIso, -1),
        promotedItem: formItem,
      },
      formBranch,
      filters.channel,
    )
  }, [
    filters.channel,
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
  ])

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
      label: formatCompactAxisLabel(isAr ? pt.labelAr : pt.labelEn),
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
      label: formatCompactAxisLabel(isAr ? pt.labelAr : pt.labelEn),
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
          ? `صافي الهامش ${f1(snap.sales.directNetMarginPct)}% (0% عمولة)`
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
        subAr: 'ارفع +100 فلس / كومبو',
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
    return `*نتيجة إعلان — ${ev.brandAr}*\n• الحملة: ${ev.campaign.campaignName} (${ev.adTypeAr})\n• الفترة: ${ev.startDate} ← ${ev.endDate} (${formatArDays(ev.windowDays)}) | المدفوع: ${f0(ev.campaign.spendKwd)} د.ك\n• المبيعات قبل (${formatArDays(ev.windowDays)}): ${f1(ev.before3dSalesKwd)} د.ك ← خلال الحملة: ${f1(ev.after3dSalesKwd)} د.ك\n• زيادة المبيعات الفعلية: ${ev.liftSalesKwd >= 0 ? '+' : ''}${f1(ev.liftSalesKwd)} د.ك (${ev.liftOrders >= 0 ? '+' : ''}${ev.liftOrders} طلب)\n• الربح الصافي بعد خصم الإعلان: ${ev.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(ev.netProfitAfterAdKwd)} د.ك\n• القرار: ${ev.verdictAr}`
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full max-w-[1920px] mx-auto space-y-4 pb-10">
      {/* ───────────── Slim Segmented Core Bar + Inline Social Reviews Cross-Link ───────────── */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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
          trailing={
            <Link
              href="/erp/social-reviews"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-xs ring-1 ring-slate-900/[0.05] transition-all duration-150 hover:text-emerald-700 dark:bg-[#101C17] dark:text-slate-200 dark:ring-emerald-500/15 dark:hover:text-emerald-300"
            >
              <span>{isAr ? 'التقييمات ومنصات التواصل ↗' : 'Social & App Reviews ↗'}</span>
            </Link>
          }
        />

        <p className="whitespace-normal px-1 text-xs font-medium text-neutral-500 dark:text-slate-400">
          {isAr ? workspace.subtitleAr : workspace.subtitleEn}
        </p>
      </div>

      {/* =====================================================================
          TAB 1: التسويق وإعلانات المشاهير (Marketing, Social/Influencer ROI & 6 Growth Plays)
         ===================================================================== */}
      {activeTab === 'marketing' ? (
        <div className="space-y-4">
          {/* 1. 4 Crisp Non-Duplicate Odoo-Derived Marketing KPIs ("One Metric, One Place") */}
          <section className="ae-stagger grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Return per 1 KWD Ad (4.6x) */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                {isAr ? 'عائد كل 1 د.ك إعلان' : 'Return per 1 KWD Ad'}
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {f1(snap.marketing.kpis.roasPer1Kwd)}x
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
                {isAr ? 'مبيعات لكل 1 د.ك عروض وإعلان' : 'Sales per 1 KWD promo & ad spend'}
              </p>
            </article>

            {/* KPI 2: Discounts & Ad Spend (1,158 KWD) */}
            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'تكلفة الخصومات والإعلانات' : 'Discounts & Ad Spend'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-bold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  {f1(snap.marketing.kpis.marketingCostPctOfSales)}%{' '}
                  {isAr ? 'من المبيعات' : 'of sales'}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f0(snap.marketing.kpis.totalMarketingCostKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
                {isAr ? 'خصومات الكاشير والتطبيقات والحملات' : 'POS discounts, app promos & ads'}
              </p>
            </article>

            {/* KPI 3: Net Cash After Ads (4,205 KWD) */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الصافي النقدي بعد الإعلانات' : 'Net Cash After Ads'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {isAr ? 'فائض العروض' : 'Net Surplus'}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {f0(snap.marketing.kpis.netAfterAdSpendKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
                {isAr
                  ? 'مبيعات العروض بعد خصم تكلفة الإعلان والخصم'
                  : 'Promo sales retained after discounts & ad spend'}
              </p>
            </article>

            {/* KPI 4: Promo vs Organic Avg Bill */}
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="whitespace-normal text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'متوسط فاتورة العرض مقابل الطبيعي' : 'Promo vs Organic Avg Bill'}
                </span>
                <span
                  dir="ltr"
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-bold tabular-nums ${
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
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f2(snap.marketing.kpis.promoAovKwd)}{' '}
                <span className="text-xs sm:text-[14px] font-medium text-neutral-400">
                  vs {f2(snap.marketing.kpis.organicAovKwd)} {kwdSuffix}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
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
                      ? 'اضغط أو مرر على أي عمود لعرض التفاصيل بالدينار'
                      : 'Tap or hover any bar to inspect exact KWD'}
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
                  {isAr
                    ? 'حصة مبيعات العروض والإعلانات مقابل الطلبات الطبيعية بالسعر الكامل'
                    : 'Share of promo & ad-driven revenue vs organic full-price orders'}
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
                    ? 'تقارن مبيعات أودو 3 أيام قبل الإعلان بـ 3 أيام بعده وتخصم الأكل والعمولة وسعر الإعلان'
                    : 'Compares real Odoo POS sales 3 days before vs 3 days after ad date, net of food, fees & spend'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowDemoCampaigns((v) => !v)}
                  aria-pressed={showDemoCampaigns}
                  className={`inline-flex h-9 w-full sm:w-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-xs font-medium transition-all duration-150 ${
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
                    className="inline-flex h-9 w-full sm:w-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-neutral-100 px-3.5 text-xs font-medium text-neutral-800 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.08] dark:text-slate-200"
                  >
                    <span>{isAr ? 'إغلاق النموذج ✕' : 'Close Form ✕'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAdFormOpen(true)}
                    className="inline-flex h-9 w-full sm:w-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
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

            {/* Collapsible Custom Ad & Baseline Comparison ROI Form */}
            {isAdFormOpen ? (
              <form
                onSubmit={handleSaveCampaign}
                className="mt-4 rounded-2xl bg-[#F7F7F8] p-4 transition-all duration-150 dark:bg-white/[0.03]"
              >
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-slate-300">
                      {isAr ? 'المطعم (6 براندات)' : 'Brand (6 Brands)'}
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
                      {isAr ? 'الفرع المستهدف (7 فروع)' : 'Target Branch (7 Branches)'}
                    </label>
                    <select
                      value={formBranch}
                      onChange={(e) => setFormBranch(e.target.value as GlobalBranch)}
                      className={INPUT_CLS}
                    >
                      {GLOBAL_BRANCH_OPTIONS.map((br) => (
                        <option key={br.id} value={br.id}>
                          {isAr ? br.ar : br.en}
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
                </div>

                {/* Custom Campaign Window (After) vs Custom Baseline Window (Before) */}
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 ring-1 ring-emerald-600/20 dark:bg-[#101C17] dark:ring-emerald-500/25">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                        {isAr ? 'فترة الإعلان / العرض (بعد)' : 'Ad / Promo Date Window (After)'}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
                        {liveFormPreview.windowDays} {isAr ? 'يوم' : 'days'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-neutral-500">
                          {isAr ? 'من تاريخ' : 'Start Date'}
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
                        <label className="mb-1 block text-[11px] text-neutral-500">
                          {isAr ? 'إلى تاريخ' : 'End Date'}
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
                  </div>

                  <div className="rounded-xl bg-white p-3 ring-1 ring-slate-900/[0.06] dark:bg-[#101C17] dark:ring-white/10">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-slate-200">
                        {isAr ? 'تاريخ المقارنة المرجعي المخصص (قبل)' : 'Custom Baseline Compare Window (Before)'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const span = Math.max(1, liveFormPreview.windowDays)
                            setFormCompareStartDate(shiftIsoDate(formStartDate, -span))
                            setFormCompareEndDate(shiftIsoDate(formStartDate, -1))
                          }}
                          className="cursor-pointer rounded-md bg-neutral-100 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/10 dark:text-slate-300"
                        >
                          {isAr ? 'الأيام السابقة' : 'Prior Days'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormCompareStartDate(shiftIsoDate(formStartDate, -7))
                            setFormCompareEndDate(shiftIsoDate(formEndDate, -7))
                          }}
                          className="cursor-pointer rounded-md bg-neutral-100 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-white/10 dark:text-slate-300"
                        >
                          {isAr ? 'نفس الأيام الأسبوع الماضي' : 'Same Days Last Week'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-neutral-500">
                          {isAr ? 'مقارنة من' : 'Compare From'}
                        </label>
                        <input
                          type="date"
                          value={formCompareStartDate}
                          onChange={(e) => setFormCompareStartDate(e.target.value)}
                          className={`${INPUT_CLS} tabular-nums`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-neutral-500">
                          {isAr ? 'مقارنة إلى' : 'Compare To'}
                        </label>
                        <input
                          type="date"
                          value={formCompareEndDate}
                          onChange={(e) => setFormCompareEndDate(e.target.value)}
                          className={`${INPUT_CLS} tabular-nums`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Instant Odoo Before-vs-After Preview Strip */}
                <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-xl bg-white p-3 ring-1 ring-slate-900/[0.05] lg:grid-cols-4 dark:bg-[#101C17] dark:ring-emerald-500/15">
                  <div className="tabular-nums">
                    <div className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
                      {isAr ? 'المبيعات قبل ← بعد' : 'Before → After Sales'}
                    </div>
                    <div dir="ltr" className="mt-0.5 text-[13.5px] font-semibold text-neutral-950 dark:text-white">
                      {f0(liveFormPreview.before3dSalesKwd)} → {f0(liveFormPreview.after3dSalesKwd)} {kwdSuffix}
                    </div>
                  </div>
                  <div className="tabular-nums">
                    <div className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
                      {isAr ? 'الزيادة الفعلية والطلبات' : 'Real Sales & Order Lift'}
                    </div>
                    <div
                      dir="ltr"
                      className={`mt-0.5 text-[13.5px] font-semibold ${
                        liveFormPreview.liftSalesKwd >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {liveFormPreview.liftSalesKwd >= 0 ? '+' : ''}
                      {f1(liveFormPreview.liftSalesKwd)} {kwdSuffix} ({liveFormPreview.liftOrders >= 0 ? '+' : ''}
                      {f0(liveFormPreview.liftOrders)} ord)
                    </div>
                  </div>
                  <div className="tabular-nums">
                    <div className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
                      {isAr ? 'تكلفة الأكل + العمولة' : 'Food + Aggregator Cost'}
                    </div>
                    <div dir="ltr" className="mt-0.5 text-[13.5px] font-semibold text-neutral-800 dark:text-slate-200">
                      {f1(liveFormPreview.foodAndPackCostKwd + liveFormPreview.platformFeeKwd)} {kwdSuffix}
                    </div>
                  </div>
                  <div className="tabular-nums">
                    <div className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
                      {isAr ? 'صافي الربح بعد الإعلان' : 'Net Pocket After Ad'}
                    </div>
                    <div
                      dir="ltr"
                      className={`mt-0.5 text-[13.5px] font-bold ${
                        liveFormPreview.netProfitAfterAdKwd >= 0
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {liveFormPreview.netProfitAfterAdKwd >= 0 ? '+' : ''}
                      {f1(liveFormPreview.netProfitAfterAdKwd)} {kwdSuffix} •{' '}
                      {isAr ? liveFormPreview.verdictAr : liveFormPreview.verdictEn}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={
                        isAr
                          ? 'اسم الحملة أو المشهور (مثال: تغطية بلوقر أو تيك توك)...'
                          : 'Campaign or Influencer name (e.g. Food blogger)...'
                      }
                      className={INPUT_CLS}
                    />
                    <input
                      type="text"
                      value={formItem}
                      onChange={(e) => setFormItem(e.target.value)}
                      placeholder={
                        isAr
                          ? 'الصنف المعلن عنه (اختياري) — مثال: داينمايت شرمب'
                          : 'Promoted Dish (optional) — e.g. Dynamite Shrimp'
                      }
                      className={INPUT_CLS}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={resetCampaignForm}
                      className="h-9 shrink-0 whitespace-nowrap rounded-xl bg-neutral-100 px-4 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/10 dark:text-slate-200"
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
                      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-amber-50 px-4 text-xs font-semibold text-amber-900 transition-all duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      <span>{isAr ? 'طلب موافقة المدير 🔔' : 'Request Manager Approval 🔔'}</span>
                    </button>
                    <button
                      type="submit"
                      className="inline-flex h-9 w-full sm:w-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-5 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
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
                      className="flex flex-col justify-between rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] transition-all duration-150 dark:bg-[#101C17] dark:ring-emerald-500/10"
                    >
                      <div>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Soft High-Contrast Brand & Branch Pills */}
                            <span className={SOFT_SCOPE_PILL_CLS}>
                              {isAr ? ev.brandAr : ev.brandEn}
                            </span>
                            <span className="bg-neutral-100 text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200 font-medium text-xs px-2.5 py-1 rounded-lg">
                              {isAr ? ev.branchAr : ev.branchEn}
                            </span>
                            <span className="bg-neutral-100 text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200 font-medium text-xs px-2.5 py-1 rounded-lg">
                              {isAr ? ev.adTypeAr : ev.adTypeEn}
                            </span>
                            {isDemo ? (
                              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                                {isAr ? 'مثال توضيحي' : 'Demo'}
                              </span>
                            ) : null}
                            {approvalRec?.status === 'approved' ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <ShieldCheck className="h-3 w-3" />
                                <span>{isAr ? 'معتمد بختم المدير ✅' : 'Manager Sealed ✅'}</span>
                              </span>
                            ) : approvalRec?.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                                <Bell className="h-3 w-3" />
                                <span>{isAr ? 'بانتظار الموافقة 🔔' : 'Pending Approval 🔔'}</span>
                              </span>
                            ) : null}
                            {isWatchdogBreach ? (
                              <button
                                type="button"
                                onClick={() => openDrawer('breaches')}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                              >
                                <ShieldAlert className="h-3 w-3" />
                                <span>{isAr ? '🚨 مخالفة لقرار معتمد' : '🚨 Compliance Alert'}</span>
                              </button>
                            ) : null}
                            <span dir="ltr" className="text-xs tabular-nums text-neutral-400">
                              {ev.startDate} → {ev.endDate}
                            </span>
                          </div>

                          <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${badgeCls}`}>
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
                          <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-[#09110E]">
                            <div className="text-xs text-neutral-400">
                              {isAr
                                ? `${formatArDays(ev.windowDays)} قبل ← ${formatArDays(ev.windowDays)} الحملة`
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

                          <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-[#09110E]">
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

                          <div className="rounded-xl bg-[#F7F7F8] p-3 dark:bg-[#09110E]">
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
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
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
                              className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                            >
                              <span>{isAr ? 'طلب موافقة المدير 🔔' : 'Request Approval 🔔'}</span>
                            </button>
                          ) : null}

                          {!isDemo ? (
                            <button
                              type="button"
                              onClick={() => handleEditCampaign(ev.campaign)}
                              className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-200/80 hover:text-neutral-950 dark:bg-white/10 dark:text-slate-300"
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
                            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-xs font-medium text-neutral-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 ms-auto dark:hover:bg-rose-950/40"
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
                    ? '6 خطط جاهزة لزيادة المبيعات بالكويت'
                    : '6 Ready-to-Run Kuwait Growth Plays'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? `عائد صافي (متحفظ – واقعي) محسوب لنطاق: ${workspace.subtitleAr}`
                    : `Conservative–Realistic net KWD scaled to: ${workspace.subtitleEn}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Dish of the Week Spotlight Pill */}
                <div className="inline-flex max-w-full items-center gap-2 rounded-xl bg-white px-3.5 py-1.5 text-xs shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  <span className="shrink-0 text-neutral-400">
                    {isAr ? 'طبق الأسبوع:' : 'Dish of Week:'}
                  </span>
                  <span className="truncate font-semibold text-neutral-950 dark:text-white">
                    {snap.marketing.dishOfTheWeek.dishName}
                  </span>
                  <span
                    dir="ltr"
                    className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
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
                  className="inline-flex h-9 w-full sm:w-auto cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white shadow-sm transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
                >
                  {copiedId === 'all-6-plays' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{isAr ? 'تم نسخ الـ 6 خطط' : 'All 6 Copied'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>{isAr ? 'نسخ الـ 6 خطط كاملة' : 'Copy All 6 Plays'}</span>
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
                    <div className="space-y-2">
                      {/* Compact Affected Brand/Branch Pill + Dynamic Filter-Scaled KWD Lift Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={SOFT_SCOPE_PILL_CLS}>
                          {isAr ? play.scopeAr : play.scopeEn}
                        </span>
                        <span
                          dir="ltr"
                          title={isAr ? 'نطاق العائد الصافي (متحفظ – واقعي)' : 'Conservative – Realistic Net Upside'}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200"
                        >
                          {isAr ? play.upsideBadgeAr : play.upsideBadgeEn}
                        </span>
                      </div>

                      {/* Unique Title */}
                      <h3 className="text-[15.5px] font-bold tracking-tight leading-snug text-neutral-950 dark:text-white">
                        {isAr ? play.titleAr : play.titleEn}
                      </h3>

                      {/* Concise 2-Line Executive Insight (Zero Boilerplate Bullet Walls) */}
                      <p className="line-clamp-2 text-[13px] leading-relaxed text-neutral-600 dark:text-slate-300">
                        {isAr ? play.summaryAr : play.summaryEn}
                      </p>

                      {/* Optional Expandable CFO Math Disclosure */}
                      {isExpanded ? (
                        <div className="rounded-xl bg-[#F7F7F8] p-3 text-xs leading-relaxed text-neutral-600 dark:bg-white/[0.04] dark:text-slate-300">
                          {isAr ? play.detailsAr : play.detailsEn}
                        </div>
                      ) : null}
                    </div>

                    {/* Clean Governance Action (`رفع للاعتماد 🔔` / `اسأل فريال ✨`) + Subtle Details Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-white/[0.06]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {playApproval?.status === 'approved' ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>{isAr ? 'معتمد رسمياً ✓' : 'Approved ✓'}</span>
                          </button>
                        ) : playApproval?.status === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                          >
                            <Bell className="h-3.5 w-3.5" />
                            <span>{isAr ? 'بانتظار الاعتماد 🔔' : 'Pending Approval 🔔'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              requestApproval({
                                refKey: `growth-play:${play.id}`,
                                domain: 'growth-play',
                                titleAr: `تفعيل خطة نمو: ${play.titleAr}`,
                                titleEn: `Activate Growth Play: ${play.titleEn}`,
                                summaryAr: `${play.scopeAr} • العائد المتوقع: ${play.upsideBadgeAr} • ${play.summaryAr}`,
                                summaryEn: `${play.scopeEn} • Target Upside: ${play.upsideBadgeEn} • ${play.summaryEn}`,
                                departmentAr: 'التسويق وتشغيل الفروع',
                                departmentEn: 'Marketing & Branch Ops',
                                budgetOrCostKwd: 0,
                                expectedMonthlyReturnKwd: Math.max(150, Math.round(play.upsideMaxKwd)),
                                href: '/erp/cores?tab=marketing',
                              })
                            }
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors duration-150 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-200"
                          >
                            <span>{isAr ? 'رفع للاعتماد 🔔' : 'Submit for Approval 🔔'}</span>
                          </button>
                        )}

                        <Link
                          href={`/erp/feryal-ai?prompt=${encodeURIComponent(feryalPrompt)}`}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors duration-150 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
                        >
                          <span>{isAr ? 'اسأل فريال ✨' : 'Ask Feryal ✨'}</span>
                        </Link>
                      </div>

                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => togglePlayDrawer(play.id)}
                        className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition-colors duration-150 hover:bg-neutral-100 hover:text-neutral-900 ms-auto dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
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
          <section className="ae-stagger grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* KPI 1: Total Net Sales + Orders + Avg Bill in One Anchor Card */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'صافي المبيعات والطلبات' : 'Total Net Sales'}
                </span>
                <span className="rounded-lg bg-neutral-100 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-semibold text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200">
                  {getPeriodLabel(filters.period, isAr)}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f0(workspace.salesKwd)} {kwdSuffix}
              </div>
              <p dir="ltr" className="mt-1 text-[11.5px] sm:text-[13px] leading-snug tabular-nums text-neutral-500 dark:text-slate-400">
                {f0(workspace.orders)} {isAr ? 'طلب' : 'orders'} • {isAr ? 'متوسط' : 'Avg'}{' '}
                {f2(workspace.aovKwd)} {kwdSuffix}
              </p>
            </article>

            {/* KPI 2: Zero-Commission Sales (Dine-In + Direct Takeaway) */}
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="whitespace-normal text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'مبيعات بدون عمولة (صالة ومباشر)' : 'Zero-Commission Sales'}
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {f1(snap.sales.zeroCommSharePct)}%
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {f0(snap.sales.zeroCommDisplayKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug tabular-nums text-neutral-500 dark:text-slate-400">
                {isAr
                  ? `صالة وسفري مباشر • ${f0(snap.sales.zeroCommOrders)} طلب`
                  : `Dine-In + Takeaway • ${f0(snap.sales.zeroCommOrders)} orders`}
              </p>
            </article>

            {/* KPI 3: Peak Sales Hour + Strongest Day Badge */}
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'ذروة المبيعات اليومية' : 'Peak Sales Hour'}
                </span>
                <span className="shrink-0 rounded-lg bg-sky-50 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                  {isAr
                    ? `الأقوى: ${snap.sales.strongestDayLabelAr}`
                    : `Top: ${snap.sales.strongestDayLabelEn}`}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {isAr ? snap.sales.peakHourShortAr : snap.sales.peakHourShortEn} •{' '}
                {f0(snap.sales.peakHourDisplayKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug tabular-nums text-neutral-500 dark:text-slate-400">
                {isAr
                  ? `${f0(snap.sales.peakHourOrders)} طلب (${f1(snap.sales.peakHourSharePct)}% من اليوم)`
                  : `${f0(snap.sales.peakHourOrders)} orders (${f1(snap.sales.peakHourSharePct)}% of day)`}
              </p>
            </article>

            {/* KPI 4: Quiet Window (3–6 PM) + Recoverable Upside Badge */}
            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="whitespace-normal text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'مبيعات الساعات الهادئة (3–6 م)' : 'Quiet Window (3–6 PM)'}
                </span>
                <span
                  dir="ltr"
                  className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  +{f0(snap.sales.quietWindowUpsideKwd)} {kwdSuffix}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f0(snap.sales.quietWindowDisplayKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug tabular-nums text-neutral-500 dark:text-slate-400">
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
                    ? 'اضغط أو مرر على أي عمود لعرض التفاصيل بالدينار'
                    : 'Tap or hover any bar to inspect exact KWD'}
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
                  {isAr ? 'ساعات الذروة والساعات الهادئة (24 ساعة)' : 'Peak & Quiet Hours (24h POS Profile)'}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {isAr
                    ? 'الأخضر = ساعات الذروة | البرتقالي = ساعات هادئة (3–6 عصراً) جاهزة لعروض التنشيط'
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
                    {isAr ? 'اضغط أي مطعم للفلترة • مطابق 100%' : 'Click brand to filter • 100.0% reconciled'}
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
                    {isAr ? 'اضغط أي فرع للفلترة • مطابق 100%' : 'Click branch to filter • 100.0% reconciled'}
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
                    {isAr ? 'اضغط أي قناة للفلترة • مطابق 100%' : 'Click channel to filter • 100.0% reconciled'}
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
          <section className="ae-stagger grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الأصناف النشطة' : 'Active Menu Items'}
                </span>
                <span className="rounded-lg bg-neutral-100 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-semibold tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200">
                  {isAr
                    ? `⭐ ${snap.menu.quadrantCounts.golden} · 💎 ${snap.menu.quadrantCounts['box-gem']}`
                    : `⭐ ${snap.menu.quadrantCounts.golden} · 💎 ${snap.menu.quadrantCounts['box-gem']}`}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f0(snap.menu.totalActiveSkus)} {isAr ? 'صنف' : 'items'}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
                {isAr ? 'مربوطة بوصفات العارضية ونقاط البيع' : 'Linked to Ardiya BOM & POS sales'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'الأطباق المباعة' : 'Total Units Sold'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-lg bg-neutral-100 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-semibold tabular-nums text-neutral-700 dark:bg-white/[0.08] dark:text-slate-200"
                >
                  {f0(snap.menu.totalSalesKwd)} {kwdSuffix}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-neutral-950 dark:text-white"
              >
                {f0(snap.menu.totalUnitsSold)} {isAr ? 'طبق' : 'units'}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
                {isAr ? 'مطابق 100% لصافي مبيعات أودو' : '100% reconciled to Odoo net sales'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="whitespace-normal text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'فرصة تحسين التسعير والكومبو' : 'Menu Optimization Upside'}
                </span>
                <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-0.5 text-[10.5px] sm:text-[11.5px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {isAr ? 'ثبات 95%' : '95% Retention'}
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-1.5 sm:mt-2 text-xl sm:text-3xl font-semibold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                +{f0(snap.menu.optimizationUpsideKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[11.5px] sm:text-[13px] leading-snug text-neutral-500 dark:text-slate-400">
                {isAr
                  ? 'صافي متحفظ بعد خصم عمولة التطبيقات'
                  : 'Conservative net gain after app fees'}
              </p>
            </article>

            <article
              onClick={() => snap.menu.topProfitDish && openDishSimulator(snap.menu.topProfitDish)}
              className={`${KPI_CARD_CLS} ae-glow-amber cursor-pointer transition-transform duration-150 hover:scale-[1.005]`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs sm:text-[13.5px] font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'أعلى صنف ربحاً' : 'Top Profit Dish'}
                </span>
                {snap.menu.topProfitDish ? (
                  <span className={SOFT_SCOPE_PILL_CLS}>
                    {isAr ? snap.menu.topProfitDish.brandAr : snap.menu.topProfitDish.brandEn}
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 sm:mt-2 truncate text-base sm:text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                {snap.menu.topProfitDish?.name ?? '—'}
              </div>
              <p
                dir="ltr"
                className="mt-1 text-[11.5px] sm:text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
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
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr
                      ? 'ترتيب الأطباق التنفيذي: أبطال الربح مقابل ضعيفة الهامش'
                      : 'Executive Dish Ranking: Profit Heroes vs Margin Bleeders'}
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr
                      ? 'اضغط على أي طبق لفتح حاسبة التسعير وتكلفة العارضية (ثبات 95% من الكمية)'
                      : 'Click any dish to launch the Conservative 95%-Retention Price & Cost Simulator'}
                  </p>
                </div>

                {/* Instant View Mode Switcher */}
                <div
                  role="tablist"
                  className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]"
                >
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
                        role="tab"
                        aria-selected={active}
                        onClick={() => setMenuRankView(v.id)}
                        className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                          active
                            ? 'bg-white font-semibold text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-emerald-500 dark:text-[#04130D]'
                            : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white'
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
                          ? 'أعلى 8 أطباق تدرّ صافياً بالجيب 🟢'
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
                          ? 'أخطر 8 أطباق عالية التكلفة أو ضعيفة الهامش 🔴'
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
                    ? 'هامش ربح الأطباق بعد خصم تكلفة المواد الخام والتغليف'
                    : 'Menu profit mix across dish quadrants net of food & packaging cost'}
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
          <section className={`${CARD_CLS} px-3.5 py-4 sm:p-6`}>
            {/* Table Header: Title + Search + Sort + 4 Menu Engineering Matrix Pills */}
            <div className="space-y-3.5 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-[17px] font-semibold tracking-tight text-neutral-950 dark:text-white">
                    {isAr
                      ? 'مصفوفة هندسة المينيو وحاسبة تسعير الأطباق'
                      : 'Menu Engineering Matrix & Dish Pricing Studio'}
                  </h3>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {isAr
                      ? 'اضغط على أي صنف لمحاكاة رفع السعر أو الكومبو بنسبة ثبات 95% بعد خصم عمولة المنصة'
                      : 'Click any dish row to simulate +100/+150 fils or recipe fixes at 95% volume retention'}
                  </p>
                </div>

                {/* Instant Dish & Brand Search + Sort Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 sm:w-72 sm:flex-none">
                    <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={dishSearch}
                      onChange={(e) => setDishSearch(e.target.value)}
                      placeholder={
                        isAr ? 'ابحث عن طبق أو مطعم... 🔍' : 'Search dish or brand... 🔍'
                      }
                      className="h-9 w-full rounded-xl bg-[#F7F7F8] ps-9 pe-8 text-xs font-medium text-neutral-900 transition-all duration-150 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-white/[0.06] dark:text-white"
                    />
                    {dishSearch ? (
                      <button
                        type="button"
                        onClick={() => setDishSearch('')}
                        aria-label={isAr ? 'مسح البحث' : 'Clear search'}
                        className="absolute end-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-lg p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <select
                    value={dishSort}
                    onChange={(e) => setDishSort(e.target.value as MenuSortKey)}
                    className="h-9 cursor-pointer rounded-xl bg-[#F7F7F8] px-3.5 text-xs font-medium text-neutral-800 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-white/[0.06] dark:text-slate-200"
                  >
                    <option value="profit">{isAr ? 'الأعلى ربحاً' : 'Highest Profit'}</option>
                    <option value="units">{isAr ? 'الأكثر طلباً' : 'Most Units Sold'}</option>
                    <option value="costPct">{isAr ? 'الأعلى تكلفة %' : 'Highest Food Cost %'}</option>
                    <option value="sales">{isAr ? 'الأعلى مبيعات' : 'Highest Sales KWD'}</option>
                  </select>
                </div>
              </div>

              {/* 4 Menu Engineering Matrix Filter Pills + All */}
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div
                  role="tablist"
                  className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]"
                >
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
                        className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 ${
                          isSelected
                            ? 'bg-emerald-600 font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:bg-emerald-500 dark:text-[#04130D]'
                            : 'text-neutral-700 hover:bg-white/80 dark:text-slate-200 dark:hover:bg-white/[0.09]'
                        }`}
                      >
                        <span>{isAr ? tf.ar : tf.en}</span>
                        <span
                          dir="ltr"
                          className={`rounded-md px-1.5 py-0.5 text-[10.5px] tabular-nums ${
                            isSelected
                              ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-[#04130D]'
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
                  className="self-start whitespace-nowrap rounded-xl bg-[#F7F7F8] px-3 py-1.5 text-xs font-medium tabular-nums text-neutral-600 lg:self-auto dark:bg-white/[0.06] dark:text-slate-300"
                >
                  {isAr ? 'إجمالي المينيو المطابق:' : 'Reconciled Menu Sales:'}{' '}
                  {f0(snap.menu.totalSalesKwd)} {kwdSuffix}
                </span>
              </div>
            </div>

            {/* Crisp Executive Table (Default 12 rows — Zero 50-Row Wall!) */}
            <div className="overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[820px] text-start text-[14px]">
                <thead>
                  <tr className="rounded-xl bg-[#F7F7F8] text-[13px] font-semibold text-neutral-500 dark:bg-white/[0.04] dark:text-slate-400">
                    <th className="whitespace-nowrap px-4 py-3 text-start">{isAr ? 'الطبق' : 'Dish'}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-start">{isAr ? 'المطعم' : 'Brand'}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-end">{isAr ? 'الكمية' : 'Qty Sold'}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-end">{isAr ? 'سعر البيع' : 'Price'}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-end">{isAr ? 'تكلفة الطبق %' : 'Unit Cost (%)'}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-end">{isAr ? 'المبيعات' : 'Sales KWD'}</th>
                    <th className="whitespace-nowrap px-3 py-3 text-end">{isAr ? 'الربح الصافي' : 'Net Profit'}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-end">
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
                          <td className="px-4 py-3">
                            <div className="font-semibold text-neutral-950 dark:text-white">
                              {d.name}
                            </div>
                            <div className="mt-0.5 whitespace-nowrap text-[11px] text-neutral-400">
                              {isAr ? d.tagAr : d.tagEn}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <span className={SOFT_SCOPE_PILL_CLS}>
                              {isAr ? d.brandAr : d.brandEn}
                            </span>
                          </td>
                          <td
                            dir="ltr"
                            className="whitespace-nowrap px-3 py-3 text-end font-semibold tabular-nums text-neutral-800 dark:text-slate-200"
                          >
                            {f0(d.unitsSold)}
                          </td>
                          <td
                            dir="ltr"
                            className="whitespace-nowrap px-3 py-3 text-end tabular-nums text-neutral-700 dark:text-slate-300"
                          >
                            {f2(d.unitPriceKwd)}
                          </td>
                          <td dir="ltr" className="whitespace-nowrap px-3 py-3 text-end tabular-nums">
                            <span className="text-neutral-600 dark:text-slate-300">
                              {f2(d.unitCostKwd)}
                            </span>{' '}
                            <span
                              className={`inline-block rounded-lg px-1.5 py-0.5 text-[11px] font-semibold ${
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
                            className="whitespace-nowrap px-3 py-3 text-end font-semibold tabular-nums text-neutral-900 dark:text-white"
                          >
                            {f1(d.salesKwd)}
                          </td>
                          <td
                            dir="ltr"
                            className="whitespace-nowrap px-3 py-3 text-end font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                          >
                            +{f1(d.netProfitKwd)}{' '}
                            <span className="text-[11.5px] font-medium text-neutral-400">
                              ({f1(d.marginPct)}%)
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openDishSimulator(d)
                              }}
                              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1 text-xs font-semibold transition-colors duration-150 ${actionBadgeCls}`}
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
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F7F8]/80 px-4 py-3 text-xs dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-neutral-600 dark:text-slate-300">
                  {isAr
                    ? `عرض ${fArInt(menuStartRow)}–${fArInt(menuEndRow)} من ${fArInt(filteredDishes.length)} صنفاً`
                    : `Showing ${menuStartRow}–${menuEndRow} of ${filteredDishes.length} items`}
                </span>

                {/* Page Size Pills: 12 / 25 / عرض الكل */}
                <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
                  {([12, 25, 'all'] as const).map((sz) => {
                    const active = menuPageSize === sz
                    return (
                      <button
                        key={String(sz)}
                        type="button"
                        onClick={() => setMenuPageSize(sz)}
                        className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3 py-1 text-xs font-medium transition-all duration-150 ${
                          active
                            ? 'bg-white font-semibold text-neutral-950 shadow-xs dark:bg-emerald-500 dark:text-[#04130D]'
                            : 'text-neutral-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/[0.06]'
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
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#101C17] dark:text-slate-200 dark:hover:bg-white/[0.08]"
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
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl bg-white px-3 text-xs font-medium text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-150 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#101C17] dark:text-slate-200 dark:hover:bg-white/[0.08]"
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
            className="flex h-full w-full max-w-lg flex-col justify-between overflow-y-auto bg-white p-5 sm:p-6 shadow-2xl dark:bg-[#101C17] dark:ring-1 dark:ring-emerald-500/10"
          >
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={SOFT_SCOPE_PILL_CLS}>
                      {isAr ? selectedDish.brandAr : selectedDish.brandEn}
                    </span>
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
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
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#F7F7F8] text-neutral-600 transition-colors duration-150 hover:bg-neutral-200/80 dark:bg-white/[0.08] dark:text-slate-200"
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
                    {isAr ? 'الكمية الشهرية (30 يوماً)' : 'Monthly Volume (30d)'}
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
                    {isAr ? '1) تعديل سعر البيع أو كومبو' : '1) Price or Combo Tweak'}
                  </label>
                  <span
                    dir="ltr"
                    className="rounded-lg bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-emerald-950/60 dark:text-emerald-300"
                  >
                    {f2(selectedDish.unitPriceKwd)} → {f2(simResult.newPriceKwd)} {kwdSuffix}
                  </span>
                </div>
                <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
                  {[
                    { val: 0, ar: 'بدون رفع', en: '0 fils' },
                    { val: 0.05, ar: '+50 فلس', en: '+50 fils' },
                    { val: 0.1, ar: '+100 فلس', en: '+100 fils' },
                    { val: 0.15, ar: '+150 فلس', en: '+150 fils' },
                    { val: 0.2, ar: '+200 فلس', en: '+200 fils' },
                    { val: 0.25, ar: '+250 فلس', en: '+250 fils' },
                  ].map((p) => {
                    const active = Math.abs(simDeltaPrice - p.val) < 0.005
                    return (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setSimDeltaPrice(p.val)}
                        className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                          active
                            ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-[#04130D]'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-[#101C17] dark:text-slate-200'
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
                      ? '2) ضبط هدر ومقادير مطبخ العارضية'
                      : '2) Ardiya Recipe & Portion Calibration'}
                  </label>
                  <span
                    dir="ltr"
                    className="text-xs font-semibold tabular-nums text-neutral-700 dark:text-slate-300"
                  >
                    -{simCostSavePct}% ({f2(simResult.newUnitCostKwd)} {kwdSuffix})
                  </span>
                </div>
                <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
                  {[0, 3, 5, 8].map((pct) => {
                    const active = simCostSavePct === pct
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSimCostSavePct(pct)}
                        className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                          active
                            ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-[#04130D]'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-[#101C17] dark:text-slate-200'
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
                  <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
                    {[94, 95, 96, 97].map((ret) => {
                      const active = simRetentionPct === ret
                      return (
                        <button
                          key={ret}
                          type="button"
                          onClick={() => setSimRetentionPct(ret)}
                          className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-2.5 py-1 text-xs tabular-nums transition-all duration-150 ${
                            active
                              ? 'bg-emerald-600 font-semibold text-white dark:bg-emerald-500 dark:text-[#04130D]'
                              : 'bg-white text-neutral-700 dark:bg-[#101C17] dark:text-slate-200'
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
                  <div className="flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]">
                    {[0, 6, 12].map((lift) => {
                      const active = simPromoLiftPct === lift
                      return (
                        <button
                          key={lift}
                          type="button"
                          onClick={() => setSimPromoLiftPct(lift)}
                          className={`shrink-0 cursor-pointer whitespace-nowrap rounded-xl px-2.5 py-1 text-xs tabular-nums transition-all duration-150 ${
                            active
                              ? 'bg-sky-600 font-semibold text-white dark:bg-sky-500 dark:text-neutral-950'
                              : 'bg-white text-neutral-700 dark:bg-[#101C17] dark:text-slate-200'
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
