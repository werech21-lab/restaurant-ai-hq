'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  Copy,
  Edit3,
  Megaphone,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import { DualBrainPagePanel } from '@/components/aether/DualBrainPagePanel'
import {
  GLOBAL_BRAND_OPTIONS,
  getPeriodLabel,
  type GlobalBrand,
} from '@/lib/aether/global-filter-engine'
import {
  SEEDED_SOCIAL_CAMPAIGNS,
  SOCIAL_AD_TYPE_OPTIONS,
  SOCIAL_CAMPAIGNS_STORAGE_KEY,
  sanitizeCampaigns,
  type CampaignHaloEvaluation,
  type SocialAdType,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'
import {
  computeCoresHubSnapshot,
  type DishSimpleTag,
} from '@/lib/aether/cores-hub-engine'
import {
  InteractiveDonutChart,
  InteractiveHorizontalRankList,
  InteractiveHoverBarChart,
  type DonutSliceDatum,
  type HorizontalRankDatum,
  type MultiSeriesBarDatum,
} from '@/components/aether/InteractiveHoverCharts'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'

type CoreTabId = 'marketing' | 'sales' | 'menu' | 'quality'
type MenuSortKey = 'profit' | 'units' | 'sales'

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

const CARD_CLS = 'ae-bento-card p-5 sm:p-6'
const KPI_CARD_CLS = 'ae-kpi-card p-5'

const INPUT_CLS =
  'h-10 w-full rounded-xl bg-[#F4F6F9] px-3 text-[13px] font-semibold text-slate-900 ring-1 ring-slate-950/[0.05] transition-all duration-150 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600/70 dark:bg-white/[0.06] dark:text-white dark:ring-white/[0.08]'

const BRAND_CHOICES = GLOBAL_BRAND_OPTIONS.filter(
  (b): b is { id: Exclude<GlobalBrand, 'all'>; ar: string; en: string } => b.id !== 'all',
)

const CORE_TABS: readonly {
  id: CoreTabId
  ar: string
  en: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'marketing', ar: 'التسويق ونمو المبيعات', en: 'Marketing & Growth', icon: Megaphone },
  { id: 'sales', ar: 'المبيعات', en: 'Sales', icon: TrendingUp },
  { id: 'menu', ar: 'المنتجات والأصناف', en: 'Products & Menu', icon: UtensilsCrossed },
  { id: 'quality', ar: 'التقييم والجودة', en: 'Ratings & Quality', icon: Star },
] as const

const TAG_FILTERS: readonly { id: 'all' | DishSimpleTag; ar: string; en: string }[] = [
  { id: 'all', ar: 'الكل', en: 'All Dishes' },
  { id: 'golden', ar: 'صنف ذهبي ⭐', en: 'Golden Star ⭐' },
  { id: 'reprice', ar: 'يحتاج تعديل سعر 💡', en: 'Needs Price Tweak 💡' },
  { id: 'box-gem', ar: 'ممتاز للبوكسات 🍱', en: 'Great for Boxes 🍱' },
  { id: 'slow', ar: 'ضعيف الحركة ⚠️', en: 'Slow Mover ⚠️' },
] as const

export function CoresHubStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { filters, workspace, liveSummary } = useGlobalFilter()

  const [activeTab, setActiveTab] = useState<CoreTabId>('marketing')
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>(SEEDED_SOCIAL_CAMPAIGNS)
  const [hydrated, setHydrated] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Campaign inline form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formBrand, setFormBrand] = useState<Exclude<GlobalBrand, 'all'>>('china-garden')
  const [formAdType, setFormAdType] = useState<SocialAdType>('influencer')
  const [formName, setFormName] = useState('')
  const [formSpend, setFormSpend] = useState('150')
  const [formDate, setFormDate] = useState('2026-10-29')
  const [formItem, setFormItem] = useState('')

  // Menu tab local filters
  const [dishTagFilter, setDishTagFilter] = useState<'all' | DishSimpleTag>('all')
  const [dishSearch, setDishSearch] = useState('')
  const [dishSort, setDishSort] = useState<MenuSortKey>('profit')

  // Hydrate campaigns + optional URL ?tab=
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const qTab = params.get('tab') as CoreTabId | null
      if (qTab && ['marketing', 'sales', 'menu', 'quality'].includes(qTab)) {
        setActiveTab(qTab)
      }
    } catch {}

    try {
      const raw = window.localStorage.getItem(SOCIAL_CAMPAIGNS_STORAGE_KEY)
      if (raw) {
        setCampaigns(sanitizeCampaigns(JSON.parse(raw)))
      } else {
        window.localStorage.setItem(
          SOCIAL_CAMPAIGNS_STORAGE_KEY,
          JSON.stringify(SEEDED_SOCIAL_CAMPAIGNS),
        )
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
    setCampaigns(next)
    try {
      window.localStorage.setItem(SOCIAL_CAMPAIGNS_STORAGE_KEY, JSON.stringify(next))
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
    setFormDate('2026-10-29')
    setFormItem('')
  }, [filters.brand])

  const handleSaveCampaign = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const cleanName =
        formName.trim() ||
        (isAr ? 'حملة سوشيال ومشاهير' : 'Social Media Campaign')
      const spend = Math.max(0, Number(formSpend) || 0)
      const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(formDate) ? formDate : '2026-10-29'

      if (editingId) {
        const next = campaigns.map((c) =>
          c.id === editingId
            ? {
                ...c,
                brand: formBrand,
                adType: formAdType,
                campaignName: cleanName,
                spendKwd: spend,
                date: dateIso,
                promotedItem: formItem.trim(),
              }
            : c,
        )
        persistCampaigns(next)
      } else {
        const created: SocialCampaign = {
          id: `camp-${Date.now()}`,
          brand: formBrand,
          adType: formAdType,
          campaignName: cleanName,
          spendKwd: spend,
          date: dateIso,
          promotedItem: formItem.trim(),
        }
        persistCampaigns([created, ...campaigns])
      }
      resetCampaignForm()
    },
    [
      campaigns,
      editingId,
      formAdType,
      formBrand,
      formDate,
      formItem,
      formName,
      formSpend,
      isAr,
      persistCampaigns,
      resetCampaignForm,
    ],
  )

  const handleEditCampaign = useCallback((c: SocialCampaign) => {
    setEditingId(c.id)
    setFormBrand(c.brand)
    setFormAdType(c.adType)
    setFormName(c.campaignName)
    setFormSpend(String(c.spendKwd))
    setFormDate(c.date)
    setFormItem(c.promotedItem ?? '')
  }, [])

  const handleDeleteCampaign = useCallback(
    (id: string) => {
      const remaining = campaigns.filter((c) => c.id !== id)
      persistCampaigns(remaining)
      if (editingId === id) resetCampaignForm()
    },
    [campaigns, editingId, persistCampaigns, resetCampaignForm],
  )

  const handleResetSeededCampaigns = useCallback(() => {
    persistCampaigns(SEEDED_SOCIAL_CAMPAIGNS)
    resetCampaignForm()
  }, [persistCampaigns, resetCampaignForm])

  const snap = useMemo(
    () => computeCoresHubSnapshot(filters, hydrated ? campaigns : SEEDED_SOCIAL_CAMPAIGNS, liveSummary),
    [filters, campaigns, hydrated, liveSummary],
  )

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
      primaryColor: pt.color ?? '#0F172A',
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
      primaryColor: pt.color ?? '#0F172A',
      badgeText: `${pt.sharePct}%`,
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
          value: `${pt.sharePct}%`,
        },
      ],
    }))
  }, [snap.sales.hourly, isAr, kwdSuffix])

  const toRankItems = useCallback(
    (rows: typeof snap.sales.brandShare): HorizontalRankDatum[] =>
      rows.map((r) => ({
        id: r.id,
        label: isAr ? r.labelAr : r.labelEn,
        value: r.salesKwd,
        valueFormatted: `${f0(r.salesKwd)} ${kwdSuffix}`,
        color: r.color ?? '#0F172A',
        badgeText: `${r.sharePct}%`,
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
            value: `${r.sharePct}%`,
            tone: 'emerald',
          },
        ],
      })),
    [isAr, kwdSuffix],
  )

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
        return b.netProfitKwd - a.netProfitKwd
      })
  }, [snap.menu.dishes, dishTagFilter, dishSearch, dishSort])

  const menuChartData = useMemo<MultiSeriesBarDatum[]>(() => {
    return filteredDishes.slice(0, 12).map((d) => ({
      id: d.id,
      label: d.name.length > 13 ? `${d.name.slice(0, 12)}…` : d.name,
      tooltipTitle: `${d.name} · ${isAr ? d.brandAr : d.brandEn}`,
      primaryValue: d.netProfitKwd,
      secondaryValue: d.costKwd,
      primaryColor: '#10B981',
      secondaryColor: '#CBD5E1',
      badgeText: isAr ? d.tagAr : d.tagEn,
      badgeTone:
        d.tag === 'golden'
          ? 'emerald'
          : d.tag === 'reprice'
            ? 'amber'
            : d.tag === 'slow'
              ? 'rose'
              : 'neutral',
      lines: [
        {
          label: isAr ? 'الكمية المباعة:' : 'Units Sold:',
          value: `${f0(d.unitsSold)} ${isAr ? 'طبق' : 'units'}`,
          bold: true,
        },
        {
          label: isAr ? 'المبيعات:' : 'Sales:',
          value: `${f1(d.salesKwd)} ${kwdSuffix}`,
        },
        {
          label: isAr ? 'التكلفة:' : 'Food Cost:',
          value: `${f1(d.costKwd)} ${kwdSuffix}`,
          tone: 'amber',
        },
        {
          label: isAr ? 'الربح الصافي:' : 'Net Profit:',
          value: `${f1(d.netProfitKwd)} ${kwdSuffix}`,
          tone: 'emerald',
          bold: true,
        },
        {
          label: isAr ? 'سعر البيع / التكلفة:' : 'Unit Price / Cost:',
          value: `${f2(d.unitPriceKwd)} / ${f2(d.unitCostKwd)} ${kwdSuffix}`,
        },
      ],
    }))
  }, [filteredDishes, isAr, kwdSuffix])

  const qualityChartData = useMemo<MultiSeriesBarDatum[]>(() => {
    return snap.quality.branchQuality.map((b) => ({
      id: b.branchId,
      label: isAr ? b.branchAr : b.branchEn,
      tooltipTitle: isAr ? b.branchAr : b.branchEn,
      primaryValue: b.qualityScore,
      primaryColor:
        b.qualityScore >= 90 ? '#10B981' : b.qualityScore >= 84 ? '#0F172A' : '#F59E0B',
      badgeText: `${b.rating.toFixed(1)} ★`,
      badgeTone: b.rating >= 4.6 ? 'emerald' : 'amber',
      lines: [
        {
          label: isAr ? 'تقييم المنصات:' : 'App Rating:',
          value: `${b.rating.toFixed(1)} / 5.0 ★`,
          tone: b.rating >= 4.6 ? 'emerald' : 'amber',
          bold: true,
        },
        {
          label: isAr ? 'درجة الجودة والالتزام:' : 'Quality Score:',
          value: `${b.qualityScore}%`,
          bold: true,
        },
        {
          label: isAr ? 'الطلبات الملغية والمرتجعة:' : 'Cancelled / Refunded:',
          value: `${f0(b.cancelledOrders)} (${f1(b.cancelledKwd)} ${kwdSuffix})`,
          tone: b.cancelledOrders > 15 ? 'rose' : 'neutral',
        },
        {
          label: isAr ? 'نسبة الإلغاء:' : 'Cancel Rate:',
          value: `${b.cancelRatePct}%`,
          tone: b.cancelRatePct >= 0.8 ? 'rose' : 'emerald',
        },
        {
          label: isAr ? 'ضيافة وتعويض:' : 'Complimentary:',
          value: `${f1(b.compKwd)} ${kwdSuffix}`,
        },
      ],
    }))
  }, [snap.quality.branchQuality, isAr, kwdSuffix])

  const marketingDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const org = Math.max(0, snap.marketing.kpis.organicSalesKwd)
    const promo = Math.max(0, snap.marketing.kpis.promoAdSalesKwd)
    const cost = Math.max(0, snap.marketing.kpis.totalMarketingCostKwd)
    const tot = Math.max(1, org + promo)
    return [
      {
        id: 'organic',
        label: isAr ? 'المبيعات الطبيعية' : 'Organic Sales',
        value: org,
        valueFormatted: `${f0(org)} ${kwdSuffix}`,
        pctFormatted: `${f1((org / tot) * 100)}%`,
        color: '#334155',
      },
      {
        id: 'promo',
        label: isAr ? 'العروض والإعلانات' : 'Promo & Ad Sales',
        value: promo,
        valueFormatted: `${f0(promo)} ${kwdSuffix}`,
        pctFormatted: `${f1((promo / tot) * 100)}%`,
        color: '#10B981',
      },
      {
        id: 'cost',
        label: isAr ? 'تكلفة الخصم والإعلان' : 'Promo & Ad Cost',
        value: cost,
        valueFormatted: `${f0(cost)} ${kwdSuffix}`,
        pctFormatted: `${f1((cost / tot) * 100)}%`,
        color: '#F59E0B',
      },
    ]
  }, [isAr, kwdSuffix, snap.marketing.kpis])

  const salesBrandDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const palette = ['#10B981', '#0EA5E9', '#F59E0B', '#64748B', '#14B8A6', '#475569']
    return snap.sales.brandShare.slice(0, 4).map((b, i) => ({
      id: b.id,
      label: isAr ? b.labelAr : b.labelEn,
      value: Math.max(0, b.salesKwd),
      valueFormatted: `${f0(b.salesKwd)} ${kwdSuffix}`,
      pctFormatted: `${b.sharePct}%`,
      color: palette[i % palette.length],
    }))
  }, [isAr, kwdSuffix, snap.sales.brandShare])

  const menuTagDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const groups: { id: DishSimpleTag; ar: string; en: string; color: string }[] = [
      { id: 'golden', ar: 'أصناف ذهبية ⭐', en: 'Golden Stars ⭐', color: '#10B981' },
      { id: 'box-gem', ar: 'ممتازة للبوكسات 🍱', en: 'Box Gems 🍱', color: '#0EA5E9' },
      { id: 'reprice', ar: 'تحتاج تعديل سعر 💡', en: 'Price Tweaks 💡', color: '#F59E0B' },
      { id: 'slow', ar: 'ضعيفة الحركة ⚠️', en: 'Slow Movers ⚠️', color: '#64748B' },
    ]
    const totalProfit = Math.max(
      1,
      snap.menu.dishes.reduce((acc, d) => acc + Math.max(0, d.netProfitKwd), 0),
    )
    return groups.map((g) => {
      const val = snap.menu.dishes
        .filter((d) => d.tag === g.id)
        .reduce((acc, d) => acc + Math.max(0, d.netProfitKwd), 0)
      return {
        id: g.id,
        label: isAr ? g.ar : g.en,
        value: val,
        valueFormatted: `${f0(val)} ${kwdSuffix}`,
        pctFormatted: `${f1((val / totalProfit) * 100)}%`,
        color: g.color,
      }
    })
  }, [isAr, kwdSuffix, snap.menu.dishes])

  const qualityPlatformDonutSlices = useMemo<DonutSliceDatum[]>(() => {
    const palette = ['#10B981', '#0EA5E9', '#F59E0B', '#64748B']
    const totalOrd = Math.max(
      1,
      snap.quality.platformRatings.reduce((acc, p) => acc + Math.max(0, p.orders), 0),
    )
    return snap.quality.platformRatings.slice(0, 4).map((p, i) => ({
      id: p.id,
      label: isAr ? p.platformAr : p.platformEn,
      subLabel: `${p.rating.toFixed(1)} ★`,
      value: Math.max(0, p.orders),
      valueFormatted: `${f0(p.orders)} ${isAr ? 'طلب' : 'ord'}`,
      pctFormatted: `${f1((Math.max(0, p.orders) / totalOrd) * 100)}%`,
      color: palette[i % palette.length],
    }))
  }, [isAr, snap.quality.platformRatings])

  const formatCampaignWhatsapp = (ev: CampaignHaloEvaluation) => {
    if (!isAr) {
      return `*Ad ROI Check — ${ev.brandEn}*\n• Campaign: ${ev.campaign.campaignName} (${ev.adTypeEn})\n• Date: ${ev.campaign.date} | Spend: ${f0(ev.campaign.spendKwd)} KWD\n• 3d Before: ${f1(ev.before3dSalesKwd)} KWD -> 3d After: ${f1(ev.after3dSalesKwd)} KWD\n• Real Sales Lift: ${ev.liftSalesKwd >= 0 ? '+' : ''}${f1(ev.liftSalesKwd)} KWD (${ev.liftOrders >= 0 ? '+' : ''}${ev.liftOrders} orders)\n• Net Profit After Ad: ${ev.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(ev.netProfitAfterAdKwd)} KWD\n• Verdict: ${ev.verdictEn}`
    }
    return `*نتيجة إعلان — ${ev.brandAr}*\n• الحملة: ${ev.campaign.campaignName} (${ev.adTypeAr})\n• التاريخ: ${ev.campaign.date} | المدفوع: ${f0(ev.campaign.spendKwd)} د.ك\n• المبيعات ٣ أيام قبل: ${f1(ev.before3dSalesKwd)} د.ك ← ٣ أيام بعد: ${f1(ev.after3dSalesKwd)} د.ك\n• زيادة المبيعات الفعلية: ${ev.liftSalesKwd >= 0 ? '+' : ''}${f1(ev.liftSalesKwd)} د.ك (${ev.liftOrders >= 0 ? '+' : ''}${ev.liftOrders} طلب)\n• الربح الصافي بعد خصم الإعلان: ${ev.netProfitAfterAdKwd >= 0 ? '+' : ''}${f1(ev.netProfitAfterAdKwd)} د.ك\n• القرار: ${ev.verdictAr}`
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="w-full space-y-5 pb-12">
      {/* ───────────── Page Header & Verdelo 4 Core SlidingPillTabs ───────────── */}
      <header className="ae-bento-card flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-slate-950 sm:text-[26px] dark:text-white">
            {isAr ? 'المبيعات والتسويق والمنتجات' : 'Sales, Marketing & Menu'}
          </h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500 dark:text-slate-400">
            {isAr ? workspace.subtitleAr : workspace.subtitleEn}
          </p>
        </div>

        <SlidingPillTabs<CoreTabId>
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
      </header>

      {/* 1-Click Dual-Brain Analysis synced with Active Core Tab */}
      <DualBrainPagePanel
        pageTitleAr={`المبيعات والتسويق والمنتجات — ${CORE_TABS.find((t) => t.id === activeTab)?.ar ?? ''}`}
        pageTitleEn={`Sales, Marketing & Menu — ${CORE_TABS.find((t) => t.id === activeTab)?.en ?? ''}`}
        promptAr={`حلّل قسم (${CORE_TABS.find((t) => t.id === activeTab)?.ar ?? ''}) وعطني أهم ٣ قرارات عملية لزيادة الطلبات والصافي بالجيب فوراً.`}
        promptEn={`Analyze the (${CORE_TABS.find((t) => t.id === activeTab)?.en ?? ''}) tab and give me the top 3 immediate actions to grow orders and net cash.`}
        pageContext={`القسم النشط: ${activeTab}. عائد كل 1 د.ك تسويق: ${f1(snap.marketing.kpis.roasPer1Kwd)} د.ك | نسبة مبيعات العروض والإعلانات: ${snap.marketing.kpis.promoSharePct}% | إجمالي الأصناف النشطة: ${snap.menu.dishes.length} صنف (أعلى صنف ربحاً: ${snap.menu.dishes[0]?.name ?? '-'}) | درجة الجودة العامة: ${snap.quality.qualityScore}%.`}
      />

      {/* =====================================================================
          TAB 1: التسويق ونمو المبيعات (Marketing, Social/Influencer ROI & 6 Growth Plays)
         ===================================================================== */}
      {activeTab === 'marketing' ? (
        <div className="space-y-6">
          {/* 1. 4 Crisp Finance V2 Marketing KPIs */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'عائد كل ١ د.ك تسويق' : 'Return per 1 KWD Ad'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {f1(snap.marketing.kpis.roasPer1Kwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr
                  ? 'مبيعات مقابل كل دينار خصومات وإعلانات'
                  : 'Sales generated per 1 KWD spent on ads & promos'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                  {isAr ? 'العروض مقابل الطبيعي' : 'Promo vs Organic'}
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {snap.marketing.kpis.promoSharePct}%
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[22px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(snap.marketing.kpis.promoAdSalesKwd)}{' '}
                <span className="text-[14px] font-semibold text-slate-400">
                  / {f0(snap.marketing.kpis.organicSalesKwd)} {kwdSuffix}
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'عروض وإعلانات مقابل مبيعات بدون خصم' : 'Promo/ad-driven sales vs organic'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'تكلفة الخصومات والإعلانات' : 'Discounts & Ad Spend'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(snap.marketing.kpis.totalMarketingCostKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'مجموع خصومات الكاشير والتطبيقات والحملات' : 'POS discounts + app promos + social ads'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'الطلبات الإضافية' : 'Extra Orders'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                +{f0(snap.marketing.kpis.incrementalOrders)} {isAr ? 'طلب' : 'orders'}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'طلبات جاءت بسبب الإعلانات والعروض' : 'Incremental orders driven by campaigns'}
              </p>
            </article>
          </section>

          {/* 2. Finance V2 Bento Split: 8-Col Stacked Capsule Chart + 4-Col Promo Mix Donut */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                    {isAr
                      ? 'المبيعات الطبيعية مقابل العروض والإعلانات'
                      : 'Organic vs Promo/Ad Sales & Net Profit'}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                    {isAr
                      ? 'مرّر الماوس على أي يوم لمعرفة المبيعات، الطلبات، تكلفة الإعلان، والصافي'
                      : 'Hover any capsule to inspect exact KWD, orders, ad cost, and net profit'}
                  </p>
                </div>
                <Link
                  href="/erp/before-after"
                  className="ae-bento-subcard inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-bold text-slate-800 transition-colors hover:text-slate-950 dark:text-slate-200"
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
                primaryColor="#334155"
                secondaryColor="#10B981"
                stacked
                heightClass="h-64"
              />
            </div>

            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-4`}>
              <div className="mb-3">
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? 'حصة العروض والطبيعي' : 'Promo vs Organic Mix'}
                </h2>
                <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? 'توزيعة مبيعات الفترة وتكلفة التسويق' : 'Sales split & marketing cost share'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={marketingDonutSlices}
                centerValue={`${snap.marketing.kpis.promoSharePct}%`}
                centerSubValue={`${f1(snap.marketing.kpis.roasPer1Kwd)}x ${kwdSuffix}`}
                centerLabel={isAr ? 'حصة العروض' : 'Promo Share'}
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* 3. Social Media & Influencer Ad ROI Calculator + Log */}
          <section className={CARD_CLS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-extrabold text-neutral-950 dark:text-white">
                  {isAr
                    ? 'حاسبة أثر إعلانات السوشيال والمشاهير'
                    : 'Social Media & Influencer Ad ROI Calculator'}
                </h2>
                <p className="mt-0.5 text-[13px] font-medium text-neutral-500 dark:text-slate-400">
                  {isAr
                    ? 'تقارن تلقائياً مبيعات أودو الفعلية ٣ أيام قبل الإعلان مقابل ٣ أيام أثناءه وبعده، وتخصم تكلفة الأكل والعمولة وسعر الإعلان'
                    : 'Automatically compares real Odoo sales 3 days before vs 3 days during/after the ad date, deducting food cost, platform fee & ad spend'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetSeededCampaigns}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#F7F7F8] px-3.5 text-[12px] font-bold text-neutral-600 transition-colors hover:bg-neutral-200/70 hover:text-neutral-950 dark:bg-white/[0.06] dark:text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isAr ? 'استعادة الأمثلة' : 'Reset Examples'}</span>
              </button>
            </div>

            {/* Inline Add / Edit Form */}
            <form
              onSubmit={handleSaveCampaign}
              className="mt-4 rounded-2xl bg-[#F7F7F8] p-4 dark:bg-white/[0.03]"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-neutral-600 dark:text-slate-300">
                    {isAr ? 'المطعم' : 'Brand'}
                  </label>
                  <select
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value as Exclude<GlobalBrand, 'all'>)}
                    className={`${INPUT_CLS} bg-white dark:bg-[#0F1626]`}
                  >
                    {BRAND_CHOICES.map((b) => (
                      <option key={b.id} value={b.id}>
                        {isAr ? b.ar : b.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-neutral-600 dark:text-slate-300">
                    {isAr ? 'نوع الإعلان' : 'Ad Type'}
                  </label>
                  <select
                    value={formAdType}
                    onChange={(e) => setFormAdType(e.target.value as SocialAdType)}
                    className={`${INPUT_CLS} bg-white dark:bg-[#0F1626]`}
                  >
                    {SOCIAL_AD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {isAr ? opt.ar : opt.en}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <label className="mb-1 block text-[11.5px] font-bold text-neutral-600 dark:text-slate-300">
                    {isAr ? 'اسم الحملة أو المشهور' : 'Campaign or Influencer Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: تغطية بلوقر أو إعلان تيك توك...'
                        : 'e.g. Food blogger coverage or TikTok reel...'
                    }
                    className={`${INPUT_CLS} bg-white dark:bg-[#0F1626]`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-neutral-600 dark:text-slate-300">
                    {isAr ? 'المبلغ المدفوع (د.ك)' : 'Ad Spend (KWD)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    required
                    value={formSpend}
                    onChange={(e) => setFormSpend(e.target.value)}
                    className={`${INPUT_CLS} bg-white tabular-nums dark:bg-[#0F1626]`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11.5px] font-bold text-neutral-600 dark:text-slate-300">
                    {isAr ? 'تاريخ الإعلان' : 'Campaign Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className={`${INPUT_CLS} bg-white tabular-nums dark:bg-[#0F1626]`}
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
                    className={`${INPUT_CLS} bg-white dark:bg-[#0F1626]`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {editingId ? (
                    <button
                      type="button"
                      onClick={resetCampaignForm}
                      className="h-10 rounded-full bg-white px-4 text-[12.5px] font-bold text-neutral-600 ring-1 ring-neutral-950/[0.06] hover:text-neutral-950 dark:bg-white/10 dark:text-slate-200"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-neutral-950 px-5 text-[13px] font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-150 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                  >
                    <Plus className="h-4 w-4" />
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

            {/* Evaluated Campaigns Cards */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {snap.marketing.evaluations.map((ev) => {
                const badgeCls =
                  ev.verdict === 'winner'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : ev.verdict === 'breakeven'
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300'
                      : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20 dark:bg-rose-950/50 dark:text-rose-300'

                return (
                  <article
                    key={ev.campaign.id}
                    className="flex flex-col justify-between rounded-2xl bg-[#F7F7F8] p-4 ring-1 ring-neutral-950/[0.04] transition-all duration-150 hover:ring-neutral-950/10 dark:bg-white/[0.04] dark:ring-white/[0.08]"
                  >
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-neutral-950 px-2.5 py-0.5 text-[11.5px] font-bold text-white dark:bg-white dark:text-neutral-950">
                            {isAr ? ev.brandAr : ev.brandEn}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11.5px] font-bold text-neutral-700 ring-1 ring-neutral-950/[0.05] dark:bg-white/10 dark:text-slate-200">
                            {isAr ? ev.adTypeAr : ev.adTypeEn}
                          </span>
                          <span
                            dir="ltr"
                            className="text-[11.5px] font-semibold tabular-nums text-neutral-400"
                          >
                            {ev.campaign.date}
                          </span>
                        </div>

                        <span className={`rounded-full px-3 py-1 text-[12px] font-extrabold ${badgeCls}`}>
                          {isAr ? ev.verdictAr : ev.verdictEn}
                        </span>
                      </div>

                      <h3 className="mt-2.5 text-[15px] font-extrabold text-neutral-950 dark:text-white">
                        {ev.campaign.campaignName}
                      </h3>
                      {ev.campaign.promotedItem ? (
                        <p className="mt-0.5 text-[12px] font-semibold text-neutral-500 dark:text-slate-400">
                          {isAr ? 'الصنف المعلن عنه: ' : 'Promoted Dish: '}
                          <span className="text-neutral-800 dark:text-slate-200">
                            {ev.campaign.promotedItem}
                          </span>
                        </p>
                      ) : null}

                      {/* 3-Box Metrics Row */}
                      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.06]">
                          <div className="text-[11px] font-bold text-neutral-400">
                            {isAr ? '٣ أيام قبل ← ٣ أيام بعد' : '3d Before -> 3d After'}
                          </div>
                          <div
                            dir="ltr"
                            className="mt-1 text-[13.5px] font-extrabold tabular-nums text-neutral-900 dark:text-white"
                          >
                            {f0(ev.before3dSalesKwd)} → {f0(ev.after3dSalesKwd)} {kwdSuffix}
                          </div>
                          <div dir="ltr" className="mt-0.5 text-[11px] font-semibold tabular-nums text-neutral-400">
                            {isAr
                              ? `المدفوع للإعلان: ${f0(ev.campaign.spendKwd)} د.ك`
                              : `Ad Spend: ${f0(ev.campaign.spendKwd)} KWD`}
                          </div>
                        </div>

                        <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.06]">
                          <div className="text-[11px] font-bold text-neutral-400">
                            {isAr ? 'زيادة المبيعات الفعلية' : 'Real Sales Lift'}
                          </div>
                          <div
                            dir="ltr"
                            className={`mt-1 text-[15px] font-extrabold tabular-nums ${
                              ev.liftSalesKwd >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {ev.liftSalesKwd >= 0 ? '+' : ''}
                            {f1(ev.liftSalesKwd)} {kwdSuffix}
                          </div>
                          <div dir="ltr" className="mt-0.5 text-[11px] font-bold tabular-nums text-neutral-500">
                            {ev.liftOrders >= 0 ? '+' : ''}
                            {f0(ev.liftOrders)} {isAr ? 'طلب' : 'orders'} ({ev.liftPct >= 0 ? '+' : ''}
                            {ev.liftPct}%)
                          </div>
                        </div>

                        <div className="rounded-xl bg-white p-3 ring-1 ring-neutral-950/[0.04] dark:bg-[#0F1626] dark:ring-white/[0.06]">
                          <div className="text-[11px] font-bold text-neutral-400">
                            {isAr ? 'الربح الصافي بعد الإعلان' : 'Net Profit After Ad'}
                          </div>
                          <div
                            dir="ltr"
                            className={`mt-1 text-[15px] font-extrabold tabular-nums ${
                              ev.netProfitAfterAdKwd >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {ev.netProfitAfterAdKwd >= 0 ? '+' : ''}
                            {f1(ev.netProfitAfterAdKwd)} {kwdSuffix}
                          </div>
                          <div className="mt-0.5 text-[10.5px] font-medium text-neutral-400">
                            {isAr
                              ? `بعد الأكل (${f0(ev.foodAndPackCostKwd)}) والعمولة (${f0(ev.platformFeeKwd)})`
                              : `After food (${f0(ev.foodAndPackCostKwd)}) & fee (${f0(ev.platformFeeKwd)})`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyText(ev.campaign.id, formatCampaignWhatsapp(ev))}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-bold text-neutral-800 ring-1 ring-neutral-950/[0.06] transition-colors hover:bg-neutral-100 dark:bg-white/10 dark:text-slate-200"
                        >
                          {copiedId === ev.campaign.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>{isAr ? 'نسخ للواتساب' : 'Copy WhatsApp'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditCampaign(ev.campaign)}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12px] font-bold text-neutral-600 ring-1 ring-neutral-950/[0.06] hover:text-neutral-950 dark:bg-white/10 dark:text-slate-300"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>{isAr ? 'تعديل' : 'Edit'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(ev.campaign.id)}
                        aria-label={isAr ? 'حذف الحملة' : 'Delete campaign'}
                        className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          {/* 4. 6 Practical Kuwait Growth Engines */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[19px] font-extrabold text-neutral-950 dark:text-white">
                  {isAr
                    ? 'حلول جاهزة لزيادة مبيعات المطاعم (٦ خطط عملية للكويت)'
                    : '6 Ready-to-Run Kuwait Restaurant Growth Plays'}
                </h2>
                <p className="mt-0.5 text-[13px] font-medium text-neutral-500 dark:text-slate-400">
                  {isAr
                    ? 'مبنية مباشرة من أرقام فروعنا الستة وساعات البيع وأصناف أودو الأعلى ربحاً'
                    : 'Built directly from our 6 Venture Foods brands, POS quiet hours, and high-margin Odoo dishes'}
                </p>
              </div>

              {/* Dish of the Week Spotlight Pill */}
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-[12.5px] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-950/[0.05] dark:bg-[#0F1626] dark:ring-white/[0.08]">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-neutral-500 dark:text-slate-400">
                  {isAr ? 'طبق الأسبوع للتصوير:' : 'Dish of the Week:'}
                </span>
                <span className="font-extrabold text-neutral-950 dark:text-white">
                  {snap.marketing.dishOfTheWeek.dishName} (
                  {isAr ? snap.marketing.dishOfTheWeek.brandAr : snap.marketing.dishOfTheWeek.brandEn})
                </span>
                <span
                  dir="ltr"
                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {snap.marketing.dishOfTheWeek.marginPct}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {snap.marketing.growthPlays.map((play) => (
                <article
                  key={play.id}
                  className={`${CARD_CLS} flex flex-col justify-between space-y-4`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-[13px] font-extrabold text-white dark:bg-white dark:text-neutral-950">
                        {play.num}
                      </span>
                      <span className="rounded-full bg-[#F7F7F8] px-2.5 py-1 text-[11.5px] font-bold text-neutral-700 dark:bg-white/10 dark:text-slate-200">
                        {isAr ? play.badgeAr : play.badgeEn}
                      </span>
                    </div>

                    <h3 className="text-[16px] font-extrabold leading-snug text-neutral-950 dark:text-white">
                      {isAr ? play.titleAr : play.titleEn}
                    </h3>

                    <p className="text-[13px] leading-relaxed text-neutral-600 dark:text-slate-300">
                      {isAr ? play.summaryAr : play.summaryEn}
                    </p>

                    <ul className="space-y-1.5 rounded-xl bg-[#F7F7F8] p-3 text-[12.5px] leading-relaxed text-neutral-800 dark:bg-white/[0.04] dark:text-slate-200">
                      {(isAr ? play.bulletsAr : play.bulletsEn).map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 dark:border-white/10">
                    <div>
                      <div className="text-[11px] font-bold text-neutral-400">
                        {isAr ? 'الفايدة المتوقعة:' : 'Expected Gain:'}
                      </div>
                      <div className="text-[13.5px] font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {isAr ? play.expectedAr : play.expectedEn}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        copyText(play.id, isAr ? play.whatsappTextAr : play.whatsappTextEn)
                      }
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-[12px] font-bold text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                    >
                      {copiedId === play.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
                          <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{isAr ? 'نسخ للواتساب' : 'Copy WhatsApp'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 2: المبيعات (Sales Core)
         ===================================================================== */}
      {activeTab === 'sales' ? (
        <div className="space-y-5">
          {/* 4 Crisp Sales KPIs */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'إجمالي المبيعات' : 'Total Sales'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(workspace.salesKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {getPeriodLabel(filters.period, isAr)}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'عدد الطلبات' : 'Total Orders'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(workspace.orders)} {isAr ? 'طلب' : 'orders'}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'فواتير نقاط البيع والتوصيل المعتمدة' : 'Verified POS & delivery orders'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'متوسط الفاتورة' : 'Average Bill'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {f2(workspace.aovKwd)} {kwdSuffix}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'متوسط قيمة الطلب الواحد' : 'Average basket value per order'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'أقوى ساعة بيع' : 'Peak Sales Hour'}
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-slate-950 dark:text-white">
                {isAr ? snap.sales.peakHourLabelAr : snap.sales.peakHourLabelEn}
              </div>
              <p className="mt-1 text-[12px] font-medium text-amber-700 dark:text-amber-400">
                {isAr
                  ? `الساعات الهادئة للتنشيط: ${snap.sales.quietWindowAr}`
                  : `Quiet combo window: ${snap.sales.quietWindowEn}`}
              </p>
            </article>
          </section>

          {/* Finance V2 Bento Split: 8-Col Sales Capsule Timeline + 4-Col Brand Share Donut */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4">
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? 'حركة المبيعات والطلبات حسب الفترة' : 'Sales & Orders Timeline'}
                </h2>
                <p className="mt-0.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
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
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? 'حصة المطاعم' : 'Brand Sales Share'}
                </h2>
                <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? 'توزيعة مبيعات مطاعم فنتشر فودز' : 'Venture Foods active brands split'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={salesBrandDonutSlices}
                centerValue={`${snap.sales.brandShare[0]?.sharePct ?? 0}%`}
                centerSubValue={`${f0(workspace.salesKwd)} ${kwdSuffix}`}
                centerLabel={
                  isAr
                    ? (snap.sales.brandShare[0]?.labelAr ?? 'المبيعات')
                    : (snap.sales.brandShare[0]?.labelEn ?? 'Sales')
                }
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* Peak Hours Interactive Hover Chart */}
          <section className={CARD_CLS}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-extrabold text-neutral-950 dark:text-white">
                  {isAr ? 'ساعات الذروة والساعات الهادئة (٢٤ ساعة)' : 'Peak & Quiet Hours (24h POS Profile)'}
                </h2>
                <p className="mt-0.5 text-[12.5px] font-medium text-neutral-500 dark:text-slate-400">
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

          {/* 3 Interactive Ranking Cards: Brands, Branches, Channels */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <article className={CARD_CLS}>
              <h3 className="mb-3 text-[16px] font-extrabold text-neutral-950 dark:text-white">
                {isAr ? 'حصة المطاعم الستة' : '6 Venture Foods Brands'}
              </h3>
              <InteractiveHorizontalRankList
                items={toRankItems(snap.sales.brandShare)}
                isAr={isAr}
              />
            </article>

            <article className={CARD_CLS}>
              <h3 className="mb-3 text-[16px] font-extrabold text-neutral-950 dark:text-white">
                {isAr ? 'ترتيب الفروع السبعة' : '7 Active Branches Ranking'}
              </h3>
              <InteractiveHorizontalRankList
                items={toRankItems(snap.sales.branchRanking)}
                isAr={isAr}
              />
            </article>

            <article className={CARD_CLS}>
              <h3 className="mb-3 text-[16px] font-extrabold text-neutral-950 dark:text-white">
                {isAr ? 'القنوات وتطبيقات التوصيل' : 'Sales Channels & Apps'}
              </h3>
              <InteractiveHorizontalRankList
                items={toRankItems(snap.sales.channelRanking)}
                isAr={isAr}
              />
            </article>
          </section>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 3: المنتجات والأصناف (Products & Menu Core)
         ===================================================================== */}
      {activeTab === 'menu' ? (
        <div className="space-y-5">
          {/* 4 Crisp Menu KPIs */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'الأصناف النشطة' : 'Active Menu Items'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(snap.menu.totalActiveSkus)} {isAr ? 'صنف' : 'items'}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'مربوطة بوصفات وتكاليف أودو' : 'Linked to Odoo POS & BOM recipes'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'الأطباق المباعة' : 'Total Units Sold'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(snap.menu.totalUnitsSold)} {isAr ? 'طبق' : 'units'}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'خلال الفترة والفلاتر المختارة' : 'Across selected period & filters'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'هامش ربح الأكل' : 'Avg Dish Margin'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {snap.menu.avgMarginPct}%
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'بعد خصم تكلفة المواد والتغليف' : 'After BOM food & packaging cost'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-amber`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'أعلى صنف ربحاً' : 'Top Profit Dish'}
              </div>
              <div className="mt-2 truncate text-[18px] font-black text-slate-950 dark:text-white">
                {snap.menu.topProfitDish?.name ?? '—'}
              </div>
              <p dir="ltr" className="mt-1 text-[12.5px] font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {snap.menu.topProfitDish
                  ? `+${f0(snap.menu.topProfitDish.netProfitKwd)} ${kwdSuffix}`
                  : '—'}
              </p>
            </article>
          </section>

          {/* Verdelo Sliding Tag Filter Pills + Search */}
          <section className="flex flex-wrap items-center justify-between gap-3">
            <SlidingPillTabs<'all' | DishSimpleTag>
              ariaLabel={isAr ? 'تصنيف الأصناف' : 'Dish Tags'}
              surface="white"
              size="sm"
              value={dishTagFilter}
              onChange={setDishTagFilter}
              options={TAG_FILTERS.map((tf) => ({
                id: tf.id,
                label: isAr ? tf.ar : tf.en,
              }))}
            />

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56 sm:w-64">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث باسم الصنف...' : 'Search dish...'}
                  className="ae-input ae-input-icon h-9 w-full font-semibold"
                />
              </div>

              <select
                value={dishSort}
                onChange={(e) => setDishSort(e.target.value as MenuSortKey)}
                className="ae-select h-9"
              >
                <option value="profit">{isAr ? 'الأعلى ربحاً' : 'Highest Profit'}</option>
                <option value="units">{isAr ? 'الأكثر طلباً' : 'Most Units Sold'}</option>
                <option value="sales">{isAr ? 'الأعلى مبيعات' : 'Highest Sales KWD'}</option>
              </select>
            </div>
          </section>

          {/* Finance V2 Bento Split: 8-Col Dish Profit Capsule Chart + 4-Col Tag Profit Donut */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4">
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr
                    ? 'الربح الصافي مقابل التكلفة لأهم الأصناف'
                    : 'Dish Net Profit vs Food Cost'}
                </h2>
                <p className="mt-0.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'مرّر الماوس على أي صنف لرؤية الكمية المباعة، المبيعات، التكلفة، والربح الصافي'
                    : 'Hover any dish capsule to view Units Sold, Sales KWD, Cost KWD & Net Profit'}
                </p>
              </div>

              {menuChartData.length > 0 ? (
                <InteractiveHoverBarChart
                  data={menuChartData}
                  isAr={isAr}
                  primaryLegend={isAr ? 'الربح الصافي (د.ك)' : 'Net Profit (KWD)'}
                  secondaryLegend={isAr ? 'تكلفة الصنف (د.ك)' : 'Food Cost (KWD)'}
                  primaryColor="#10B981"
                  secondaryColor="#CBD5E1"
                  stacked
                  heightClass="h-64"
                />
              ) : (
                <p className="py-8 text-center text-[13px] font-semibold text-slate-400">
                  {isAr ? 'لا توجد أصناف مطابقة للبحث الحالي.' : 'No dishes match the current filter.'}
                </p>
              )}
            </div>

            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-4`}>
              <div className="mb-3">
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? 'توزيعة ربح المينيو' : 'Menu Profit Split'}
                </h2>
                <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? 'حصة الربح حسب تصنيف الأصناف' : 'Net profit share across dish tags'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={menuTagDonutSlices}
                centerValue={`${snap.menu.avgMarginPct}%`}
                centerSubValue={`${f0(snap.menu.totalActiveSkus)} ${isAr ? 'صنف' : 'SKUs'}`}
                centerLabel={isAr ? 'متوسط الهامش' : 'Avg Margin'}
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* Clean Menu Table */}
          <section className={`${CARD_CLS} overflow-hidden p-0`}>
            <div className="border-b border-neutral-100 px-5 py-4 dark:border-white/10">
              <h3 className="text-[16px] font-extrabold text-neutral-950 dark:text-white">
                {isAr ? 'جدول الأصناف وتكلفة وربح كل طبق' : 'Menu Dishes Breakdown'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-start text-[13px]">
                <thead>
                  <tr className="bg-[#F7F7F8] text-[12px] font-bold text-neutral-500 dark:bg-white/[0.04] dark:text-slate-400">
                    <th className="px-5 py-3 text-start">{isAr ? 'الصنف' : 'Dish'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'المطعم' : 'Brand'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الكمية المباعة' : 'Units Sold'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'سعر البيع' : 'Price'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'تكلفة الطبق' : 'Unit Cost'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'المبيعات' : 'Sales KWD'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'التكلفة' : 'Cost KWD'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الربح الصافي' : 'Net Profit'}</th>
                    <th className="px-5 py-3 text-end">{isAr ? 'التصنيف' : 'Tag'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
                  {filteredDishes.slice(0, 45).map((d) => {
                    const tagCls =
                      d.tag === 'golden'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : d.tag === 'reprice'
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                          : d.tag === 'box-gem'
                            ? 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300'
                            : 'bg-neutral-100 text-neutral-700 dark:bg-white/10 dark:text-slate-300'

                    return (
                      <tr
                        key={d.id}
                        className="transition-colors hover:bg-[#F7F7F8]/80 dark:hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-3 font-bold text-neutral-950 dark:text-white">
                          {d.name}
                        </td>
                        <td className="px-3 py-3 font-semibold text-neutral-600 dark:text-slate-300">
                          {isAr ? d.brandAr : d.brandEn}
                        </td>
                        <td dir="ltr" className="px-3 py-3 text-end font-bold tabular-nums text-neutral-800 dark:text-slate-200">
                          {f0(d.unitsSold)}
                        </td>
                        <td dir="ltr" className="px-3 py-3 text-end tabular-nums text-neutral-600 dark:text-slate-300">
                          {f2(d.unitPriceKwd)}
                        </td>
                        <td dir="ltr" className="px-3 py-3 text-end tabular-nums text-neutral-500 dark:text-slate-400">
                          {f2(d.unitCostKwd)}
                        </td>
                        <td dir="ltr" className="px-3 py-3 text-end font-bold tabular-nums text-neutral-900 dark:text-white">
                          {f1(d.salesKwd)}
                        </td>
                        <td dir="ltr" className="px-3 py-3 text-end tabular-nums text-neutral-500 dark:text-slate-400">
                          {f1(d.costKwd)}
                        </td>
                        <td dir="ltr" className="px-3 py-3 text-end font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {f1(d.netProfitKwd)} ({d.marginPct}%)
                        </td>
                        <td className="px-5 py-3 text-end">
                          <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${tagCls}`}>
                            {isAr ? d.tagAr : d.tagEn}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {/* =====================================================================
          TAB 4: التقييم والجودة (Ratings & Quality Core)
         ===================================================================== */}
      {activeTab === 'quality' ? (
        <div className="space-y-5">
          {/* 4 Crisp Quality KPIs */}
          <section className="ae-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'تقييم المنصات' : 'Avg App Rating'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400"
              >
                {snap.quality.avgPlatformRating.toFixed(1)} ★
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'الهدف التشغيلي: 4.8 ★ بكل التطبيقات' : 'Target benchmark: 4.8 ★ across apps'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-rose`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'الطلبات الملغية' : 'Cancelled Orders'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-rose-600 dark:text-rose-400"
              >
                {f0(snap.quality.cancelledOrders)}{' '}
                <span className="text-[15px] font-bold text-slate-500">
                  ({f1(snap.quality.cancelledKwd)} {kwdSuffix})
                </span>
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'من سجلات نقاط البيع الفعلية في أودو' : 'Directly from Odoo POS void/refund logs'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-sky`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'درجة الالتزام والجودة' : 'Quality Score'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {snap.quality.qualityScore}%
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr ? 'انضباط التحضير والتغليف وعدم الإلغاء' : 'Prep speed, packing accuracy & low voids'}
              </p>
            </article>

            <article className={`${KPI_CARD_CLS} ae-glow-emerald`}>
              <div className="text-[13px] font-bold text-slate-500 dark:text-slate-400">
                {isAr ? 'العملاء المتكررون' : 'Repeat Guests'}
              </div>
              <div
                dir="ltr"
                className="mt-2 text-[26px] font-black tracking-tight tabular-nums text-slate-950 dark:text-white"
              >
                {f0(snap.quality.repeatGuests)}
              </div>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                {isAr
                  ? `من أصل ${f0(snap.quality.identifiedGuests)} عميل مسجل بأودو`
                  : `Out of ${f0(snap.quality.identifiedGuests)} identified Odoo customers`}
              </p>
            </article>
          </section>

          {/* Finance V2 Bento Split: 8-Col Branch Quality Capsule Chart + 4-Col Platform Orders/Rating Donut */}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-8`}>
              <div className="mb-4">
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr
                    ? 'مؤشر الجودة والتقييم لكل فرع'
                    : 'Branch Quality Score & App Rating'}
                </h2>
                <p className="mt-0.5 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'مرّر الماوس على أي فرع لمعرفة التقييم ★، عدد وقيمة الطلبات الملغية، ونسبة الإلغاء'
                    : 'Hover any branch capsule to inspect exact ★ rating, cancelled orders/KWD & cancel rate'}
                </p>
              </div>
              <InteractiveHoverBarChart
                data={qualityChartData}
                isAr={isAr}
                primaryLegend={isAr ? 'درجة الجودة والالتزام (%)' : 'Quality Score (%)'}
                primaryColor="#10B981"
                formatAxisValue={(v) => `${Math.round(v)}%`}
                heightClass="h-60"
              />
            </div>

            <div className={`${CARD_CLS} flex flex-col justify-between lg:col-span-4`}>
              <div className="mb-3">
                <h2 className="text-[17px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? 'تقييم وطلبات التطبيقات' : 'App Ratings & Share'}
                </h2>
                <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
                  {isAr ? 'توزيع الطلبات ومتوسط التقييم' : 'Delivery volume split & star rating'}
                </p>
              </div>

              <InteractiveDonutChart
                slices={qualityPlatformDonutSlices}
                centerValue={`${snap.quality.avgPlatformRating.toFixed(1)} ★`}
                centerSubValue={`${snap.quality.qualityScore}%`}
                centerLabel={isAr ? 'متوسط التقييم' : 'Avg Rating'}
                isAr={isAr}
                legendColumns={1}
              />
            </div>
          </section>

          {/* Platform Action Cards: Talabat, Keeta, Deliveroo, Jahez & Snoonu */}
          <section className="space-y-3">
            <h2 className="text-[18px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'خطوات عملية لرفع التقييم في طلبات وكيتا وديليفرو'
                : 'Simple Steps to Raise Ratings on Talabat, Keeta & Deliveroo'}
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {snap.quality.platformRatings.map((p) => (
                <article key={p.id} className={`${CARD_CLS} flex flex-col justify-between space-y-3`}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[16px] font-extrabold text-neutral-950 dark:text-white">
                        {isAr ? p.platformAr : p.platformEn}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span
                          dir="ltr"
                          className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        >
                          {p.rating.toFixed(1)} ★ → {p.targetRating.toFixed(1)} ★
                        </span>
                      </div>
                    </div>

                    <div className="text-[12.5px] leading-relaxed">
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {isAr ? 'المشكلة المتكررة: ' : 'Main Issue: '}
                      </span>
                      <span className="text-neutral-700 dark:text-slate-300">
                        {isAr ? p.issueAr : p.issueEn}
                      </span>
                    </div>

                    <div className="rounded-xl bg-[#F7F7F8] p-3 text-[12.5px] leading-relaxed dark:bg-white/[0.04]">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {isAr ? 'الحل العملي: ' : 'Action Step: '}
                      </span>
                      <span className="font-medium text-neutral-800 dark:text-slate-200">
                        {isAr ? p.stepAr : p.stepEn}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[12px] font-semibold tabular-nums text-neutral-400">
                      {f0(p.orders)} {isAr ? 'طلب بالفترة' : 'orders in period'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          p.id,
                          isAr
                            ? `*تحسين تقييم ${p.platformAr} (${p.rating} ★ ← ${p.targetRating} ★)*\n• المشكلة: ${p.issueAr}\n• المطلوب من الفرع اليوم: ${p.stepAr}`
                            : `*Raise ${p.platformEn} Rating (${p.rating} ★ -> ${p.targetRating} ★)*\n• Issue: ${p.issueEn}\n• Action: ${p.stepEn}`,
                        )
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-neutral-950 px-3 text-[12px] font-bold text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-950"
                    >
                      {copiedId === p.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
                          <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>{isAr ? 'نسخ للواتساب' : 'Copy WhatsApp'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Branch Alerts & POS Refunds Table */}
          <section className={`${CARD_CLS} overflow-hidden p-0`}>
            <div className="border-b border-neutral-100 px-5 py-4 dark:border-white/10">
              <h3 className="text-[16px] font-extrabold text-neutral-950 dark:text-white">
                {isAr ? 'تنبيهات الفروع والطلبات الملغية من أودو' : 'Branch Alerts & Odoo POS Cancellations'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-start text-[13px]">
                <thead>
                  <tr className="bg-[#F7F7F8] text-[12px] font-bold text-neutral-500 dark:bg-white/[0.04] dark:text-slate-400">
                    <th className="px-5 py-3 text-start">{isAr ? 'الفرع' : 'Branch'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'التقييم' : 'Rating'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'الطلبات الملغية' : 'Cancelled'}</th>
                    <th className="px-3 py-3 text-end">{isAr ? 'قيمة الملغي' : 'Cancelled KWD'}</th>
                    <th className="px-3 py-3 text-start">{isAr ? 'التنبيه' : 'Alert'}</th>
                    <th className="px-5 py-3 text-start">{isAr ? 'الخطوة المطلوبة' : 'Action Step'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
                  {snap.quality.branchQuality.map((b) => (
                    <tr
                      key={b.branchId}
                      className="transition-colors hover:bg-[#F7F7F8]/80 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3 font-extrabold text-neutral-950 dark:text-white">
                        {isAr ? b.branchAr : b.branchEn}
                      </td>
                      <td dir="ltr" className="px-3 py-3 text-end font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {b.rating.toFixed(1)} ★
                      </td>
                      <td dir="ltr" className="px-3 py-3 text-end font-bold tabular-nums text-neutral-800 dark:text-slate-200">
                        {f0(b.cancelledOrders)} ({b.cancelRatePct}%)
                      </td>
                      <td dir="ltr" className="px-3 py-3 text-end font-bold tabular-nums text-rose-600 dark:text-rose-400">
                        {f1(b.cancelledKwd)} {kwdSuffix}
                      </td>
                      <td className="px-3 py-3 font-medium text-neutral-700 dark:text-slate-300">
                        {isAr ? b.alertAr : b.alertEn}
                      </td>
                      <td className="px-5 py-3 font-semibold text-neutral-900 dark:text-slate-100">
                        {isAr ? b.fixAr : b.fixEn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
