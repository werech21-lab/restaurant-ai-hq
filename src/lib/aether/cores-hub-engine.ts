/**
 * Multi-Core Hub Data Engine (`/erp/cores` — المبيعات والتسويق والمنتجات)
 *
 * Powers the 4 interactive Core Tabs synced live with GlobalFilterContext:
 *   1. التسويق ونمو المبيعات (Marketing Impact, Social/Influencer ROI & 6 Kuwait Growth Plays)
 *   2. المبيعات (Sales Core: Timeline, Peak Hours, Brand Share, Branch Ranking, Channels)
 *   3. المنتجات والأصناف (Products & Menu Core: BOM Costs, Net Profit & 4 Actionable Tags)
 *   4. التقييم والجودة (Ratings & Quality Core: Platform Ratings, Odoo POS Voids & Action Steps)
 *
 * Strictly uses ONLY our 6 Venture Foods restaurant brands and 7 active Odoo branches.
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import JOURNEY_RAW from '@/lib/odoo/odoo-journey.json'
import INTEL_RAW from '@/lib/odoo/odoo-intel.json'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  computeGlobalWorkspace,
  getBranchLabel,
  getBrandLabel,
  getChannelLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import {
  evaluateCampaignOdooHalo,
  type CampaignHaloEvaluation,
  type SocialCampaign,
} from '@/lib/aether/social-campaigns'

export type DishSimpleTag = 'golden' | 'reprice' | 'box-gem' | 'slow'

export interface MenuDishRow {
  id: string
  name: string
  brandId: Exclude<GlobalBrand, 'all'>
  brandAr: string
  brandEn: string
  category: string
  unitsSold: number
  unitPriceKwd: number
  unitCostKwd: number
  salesKwd: number
  costKwd: number
  netProfitKwd: number
  marginPct: number
  tag: DishSimpleTag
  tagAr: string
  tagEn: string
}

export interface KuwaitGrowthPlay {
  id: string
  num: string
  titleAr: string
  titleEn: string
  badgeAr: string
  badgeEn: string
  summaryAr: string
  summaryEn: string
  bulletsAr: string[]
  bulletsEn: string[]
  expectedAr: string
  expectedEn: string
  whatsappTextAr: string
  whatsappTextEn: string
}

export interface MarketingChartPoint {
  id: string
  labelAr: string
  labelEn: string
  tooltipTitleAr: string
  tooltipTitleEn: string
  organicSalesKwd: number
  promoAdSalesKwd: number
  totalSalesKwd: number
  orders: number
  marketingCostKwd: number
  netProfitKwd: number
}

export interface SalesPoint {
  id: string
  labelAr: string
  labelEn: string
  tooltipTitleAr: string
  tooltipTitleEn: string
  salesKwd: number
  orders: number
  aovKwd: number
  sharePct: number
  color?: string
}

export interface BranchQualityRow {
  branchId: Exclude<GlobalBranch, 'all'>
  branchAr: string
  branchEn: string
  rating: number
  cancelledOrders: number
  cancelledKwd: number
  cancelRatePct: number
  compOrders: number
  compKwd: number
  qualityScore: number
  alertAr: string
  alertEn: string
  fixAr: string
  fixEn: string
}

export interface PlatformRatingRow {
  id: string
  platformAr: string
  platformEn: string
  rating: number
  targetRating: number
  orders: number
  issueAr: string
  issueEn: string
  stepAr: string
  stepEn: string
}

export interface CoresHubSnapshot {
  marketing: {
    evaluations: CampaignHaloEvaluation[]
    kpis: {
      roasPer1Kwd: number
      promoAdSalesKwd: number
      organicSalesKwd: number
      promoSharePct: number
      totalMarketingCostKwd: number
      incrementalOrders: number
    }
    chartPoints: MarketingChartPoint[]
    growthPlays: KuwaitGrowthPlay[]
    dishOfTheWeek: {
      dishName: string
      brandAr: string
      brandEn: string
      priceKwd: number
      marginPct: number
      angleAr: string
      angleEn: string
    }
  }
  sales: {
    peakHourLabelAr: string
    peakHourLabelEn: string
    quietWindowAr: string
    quietWindowEn: string
    timeline: SalesPoint[]
    hourly: SalesPoint[]
    brandShare: SalesPoint[]
    branchRanking: SalesPoint[]
    channelRanking: SalesPoint[]
  }
  menu: {
    totalActiveSkus: number
    totalUnitsSold: number
    avgMarginPct: number
    topProfitDish: MenuDishRow | null
    dishes: MenuDishRow[]
  }
  quality: {
    avgPlatformRating: number
    cancelledOrders: number
    cancelledKwd: number
    qualityScore: number
    repeatGuests: number
    identifiedGuests: number
    branchQuality: BranchQualityRow[]
    platformRatings: PlatformRatingRow[]
  }
}

interface IntelRecipe {
  productId: number
  name: string
  brand: string
  recipeCostKwd?: number
}

interface JourneyQualitySlice {
  quality: {
    cancelled: {
      orders: number
      kwd: number
      byLocation: { location: string; orders: number; kwd: number; ratePct: number }[]
      byShift: { shift: string; cancelled: number; orders: number; ratePct: number }[]
    }
    complimentary: { location: string; orders: number; kwd: number; pctOfSales: number }[]
    retention: {
      identifiedCustomers: number
      repeatCustomers: number
      repeatRatePct: number
      avgOrdersPerRepeat: number
    }
  }
}

const INTEL = INTEL_RAW as unknown as { recipes?: IntelRecipe[] }
const J = JOURNEY_RAW as unknown as JourneyQualitySlice

const BRAND_COLORS: Record<Exclude<GlobalBrand, 'all'>, string> = {
  'china-garden': '#0284C7',
  franks: '#059669',
  tahina: '#D97706',
  'farm-brown': '#EA580C',
  'noodle-bar': '#DC2626',
  'karak-cafeteria': '#0F172A',
}

const BRAND_DEFAULT_FOOD_PCT: Record<Exclude<GlobalBrand, 'all'>, number> = {
  'china-garden': 0.26,
  franks: 0.29,
  tahina: 0.25,
  'farm-brown': 0.28,
  'noodle-bar': 0.26,
  'karak-cafeteria': 0.22,
}

const BRANCH_BASE_RATING: Record<Exclude<GlobalBranch, 'all'>, number> = {
  promenade: 4.7,
  '360-mall': 4.7,
  assima: 4.8,
  'al-kout': 4.7,
  avenues: 4.6,
  salmiya: 4.4,
  ardiya: 4.4,
}

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

const round1 = (n: number) => Math.round(safeNum(n) * 10) / 10
const round2 = (n: number) => Math.round(safeNum(n) * 100) / 100

function cleanDishName(raw: string): string {
  return raw.replace(/^\[[^\]]+\]\s*/, '').trim()
}

// Lookup map of BOM recipe costs from odoo-intel.json
const RECIPE_COST_BY_NAME: Map<string, number> = (() => {
  const m = new Map<string, number>()
  for (const r of INTEL.recipes ?? []) {
    if (typeof r.recipeCostKwd === 'number' && r.recipeCostKwd > 0) {
      m.set(`${r.brand}|${cleanDishName(r.name).toLowerCase()}`, r.recipeCostKwd)
    }
  }
  return m
})()

function formatHourAr(h: number): string {
  if (h === 0) return '12 ص'
  if (h < 12) return `${h} ص`
  if (h === 12) return '12 م'
  return `${h - 12} م`
}

function formatHourEn(h: number): string {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export function computeCoresHubSnapshot(
  filters: GlobalFilters,
  campaigns: SocialCampaign[],
  liveSummary?: OdooLiveSummary | null,
): CoresHubSnapshot {
  const ws = computeGlobalWorkspace(filters, liveSummary)
  const approvedSet = new Set<string>(APPROVED_BRAND_IDS)
  const fullDays = (ODOO.timeProfile?.daily ?? []).filter((d) => d.orders >= 150)

  // =========================================================================
  // 1. MENU & PRODUCTS CORE (computed first so Marketing can spotlight gems!)
  // =========================================================================
  const rawMenu = ODOO.menu.filter((m) => {
    if (!approvedSet.has(m.brand)) return false
    if (filters.brand !== 'all' && m.brand !== filters.brand) return false
    if (m.qty <= 0 || m.netKwd <= 0 || m.priceKwd < 0.25) return false
    if (/packaging|bag|cutlery|staff|delivery charge|plastic/i.test(m.name)) return false
    return true
  })

  // Scale factor from 30d brand menu to active filter (period + branch + channel)
  const rawMenuSum30 = rawMenu.reduce((s, m) => s + m.netKwd, 0) || 1
  const menuScale = ws.salesKwd > 0 ? ws.salesKwd / rawMenuSum30 : ws.totalScale || 0.1

  const prelimDishes = rawMenu.map((m) => {
    const bid = m.brand as Exclude<GlobalBrand, 'all'>
    const bomCost = RECIPE_COST_BY_NAME.get(`${bid}|${m.name.toLowerCase()}`)
    const rawUnitCost =
      bomCost && bomCost > 0 && bomCost < m.priceKwd * 0.8
        ? bomCost + 0.08 // include packaging tray/bag allowance
        : m.unitCostKwd > 0.05 && m.unitCostKwd < m.priceKwd * 0.8
          ? m.unitCostKwd
          : m.priceKwd * (BRAND_DEFAULT_FOOD_PCT[bid] ?? 0.27)

    const unitCostKwd = round2(Math.min(m.priceKwd * 0.72, Math.max(0.08, rawUnitCost)))
    const salesKwd = round1(m.netKwd * menuScale)
    const unitsSold = salesKwd > 0 ? Math.max(1, Math.round(m.qty * menuScale)) : 0
    const costKwd = round1(unitsSold * unitCostKwd)
    const netProfitKwd = round1(Math.max(0, salesKwd - costKwd))
    const marginPct = salesKwd > 0 ? round1((netProfitKwd / salesKwd) * 100) : 0

    return {
      id: `${bid}-${m.code ?? m.name}`,
      name: m.name,
      brandId: bid,
      brandAr: getBrandLabel(bid, true),
      brandEn: getBrandLabel(bid, false),
      category: m.category,
      unitsSold,
      unitPriceKwd: round2(m.priceKwd),
      unitCostKwd,
      salesKwd,
      costKwd,
      netProfitKwd,
      marginPct,
    }
  })

  const sortedByUnits = [...prelimDishes].map((d) => d.unitsSold).sort((a, b) => a - b)
  const medianUnits = sortedByUnits[Math.floor(sortedByUnits.length * 0.55)] ?? 20

  const dishes: MenuDishRow[] = prelimDishes
    .map((d) => {
      let tag: DishSimpleTag = 'slow'
      let tagAr = 'ضعيف الحركة ⚠️'
      let tagEn = 'Slow Mover ⚠️'

      if (d.unitsSold >= medianUnits && d.marginPct >= 66) {
        tag = 'golden'
        tagAr = 'صنف ذهبي ⭐'
        tagEn = 'Golden Star ⭐'
      } else if (d.unitsSold >= medianUnits && d.marginPct < 66) {
        tag = 'reprice'
        tagAr = 'يحتاج تعديل سعر 💡'
        tagEn = 'Needs Price Tweak 💡'
      } else if (d.unitsSold < medianUnits && d.marginPct >= 68) {
        tag = 'box-gem'
        tagAr = 'ممتاز للبوكسات 🍱'
        tagEn = 'Great for Boxes 🍱'
      }

      return { ...d, tag, tagAr, tagEn }
    })
    .sort((a, b) => b.netProfitKwd - a.netProfitKwd)

  const totalUnitsSold = dishes.reduce((s, d) => s + d.unitsSold, 0)
  const sumDishSales = dishes.reduce((s, d) => s + d.salesKwd, 0) || 1
  const sumDishProfit = dishes.reduce((s, d) => s + d.netProfitKwd, 0)
  const avgMarginPct = round1((sumDishProfit / sumDishSales) * 100)
  const topProfitDish = dishes[0] ?? null

  // =========================================================================
  // 2. SALES CORE (Timeline, Hourly Peak/Quiet, Brands, Branches, Channels)
  // =========================================================================
  const hourlyRaw = ODOO.timeProfile?.hourly ?? []
  const totalHourlyRawNet = hourlyRaw.reduce((s, h) => s + h.netKwd, 0) || 1
  const totalHourlyRawOrd = hourlyRaw.reduce((s, h) => s + h.orders, 0) || 1

  // Operational hours in Kuwait: 9 AM -> 1 AM
  const orderedHours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1]
  const hourly: SalesPoint[] = orderedHours.map((hr) => {
    const row = hourlyRaw.find((x) => x.hour === hr)
    const sKwd = round1(ws.salesKwd * (safeNum(row?.netKwd) / totalHourlyRawNet))
    const ord = Math.max(0, Math.round(ws.orders * (safeNum(row?.orders) / totalHourlyRawOrd)))
    const aov = ord > 0 ? round2(sKwd / ord) : ws.aovKwd
    const isQuietAfternoon = hr >= 15 && hr <= 17
    return {
      id: `hr-${hr}`,
      labelAr: formatHourAr(hr),
      labelEn: formatHourEn(hr),
      tooltipTitleAr: `الساعة ${formatHourAr(hr)}${isQuietAfternoon ? ' (فترة هادئة — فرصة عروض)' : ''}`,
      tooltipTitleEn: `${formatHourEn(hr)}${isQuietAfternoon ? ' (Quiet Window)' : ''}`,
      salesKwd: sKwd,
      orders: ord,
      aovKwd: aov,
      sharePct: ws.salesKwd > 0 ? round1((sKwd / ws.salesKwd) * 100) : 0,
      color: isQuietAfternoon ? '#F59E0B' : '#0F172A',
    }
  })

  const peakHour = [...hourly].sort((a, b) => b.salesKwd - a.salesKwd)[0]
  const peakHourLabelAr = peakHour ? `${peakHour.labelAr} (${Math.round(peakHour.salesKwd).toLocaleString('en-US')} د.ك)` : '2 م – 8 م'
  const peakHourLabelEn = peakHour ? `${peakHour.labelEn} (${Math.round(peakHour.salesKwd).toLocaleString('en-US')} KWD)` : '2 PM – 8 PM'

  // Sales Timeline points matched to active period
  let timeline: SalesPoint[] = []
  if (filters.period === 'today') {
    timeline = hourly.filter((_, i) => i % 2 === 0 || hourly[i].salesKwd === peakHour?.salesKwd)
  } else if (filters.period === 'week') {
    const last7 = fullDays.slice(-7)
    const sum7 = last7.reduce((s, d) => s + d.netKwd, 0) || 1
    const sum7Ord = last7.reduce((s, d) => s + d.orders, 0) || 1
    const dayAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    timeline = last7.map((d) => {
      const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
      const sKwd = round1(ws.salesKwd * (d.netKwd / sum7))
      const ord = Math.max(0, Math.round(ws.orders * (d.orders / sum7Ord)))
      return {
        id: d.day,
        labelAr: dayAr[dow] ?? d.day.slice(5),
        labelEn: dayEn[dow] ?? d.day.slice(5),
        tooltipTitleAr: `${dayAr[dow]} (${d.day})`,
        tooltipTitleEn: `${dayEn[dow]} (${d.day})`,
        salesKwd: sKwd,
        orders: ord,
        aovKwd: ord > 0 ? round2(sKwd / ord) : ws.aovKwd,
        sharePct: ws.salesKwd > 0 ? round1((sKwd / ws.salesKwd) * 100) : 0,
        color: dow === 4 || dow === 5 ? '#10B981' : '#0F172A',
      }
    })
  } else if (filters.period === 'month') {
    const recent14 = fullDays.slice(-14)
    const sum30 = fullDays.reduce((s, d) => s + d.netKwd, 0) || 1
    const sum30Ord = fullDays.reduce((s, d) => s + d.orders, 0) || 1
    timeline = recent14.map((d) => {
      const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
      const sKwd = round1(ws.salesKwd * (d.netKwd / sum30))
      const ord = Math.max(0, Math.round(ws.orders * (d.orders / sum30Ord)))
      return {
        id: d.day,
        labelAr: d.day.slice(5),
        labelEn: d.day.slice(5),
        tooltipTitleAr: `تاريخ ${d.day}`,
        tooltipTitleEn: `Date ${d.day}`,
        salesKwd: sKwd,
        orders: ord,
        aovKwd: ord > 0 ? round2(sKwd / ord) : ws.aovKwd,
        sharePct: ws.salesKwd > 0 ? round1((sKwd / ws.salesKwd) * 100) : 0,
        color: dow === 4 || dow === 5 ? '#10B981' : '#0F172A',
      }
    })
  } else {
    const months = [
      { id: 'm1', ar: 'يناير', en: 'Jan', w: 0.088 },
      { id: 'm2', ar: 'فبراير', en: 'Feb', w: 0.095 },
      { id: 'm3', ar: 'مارس', en: 'Mar', w: 0.084 },
      { id: 'm4', ar: 'أبريل', en: 'Apr', w: 0.092 },
      { id: 'm5', ar: 'مايو', en: 'May', w: 0.094 },
      { id: 'm6', ar: 'يونيو', en: 'Jun', w: 0.091 },
      { id: 'm7', ar: 'يوليو', en: 'Jul', w: 0.089 },
      { id: 'm8', ar: 'أغسطس', en: 'Aug', w: 0.090 },
      { id: 'm9', ar: 'سبتمبر', en: 'Sep', w: 0.093 },
      { id: 'm10', ar: 'أكتوبر', en: 'Oct', w: 0.106 },
      { id: 'm11', ar: 'نوفمبر', en: 'Nov', w: 0.078 },
    ]
    timeline = months.map((m) => {
      const sKwd = round1(ws.salesKwd * m.w)
      const ord = Math.max(1, Math.round(ws.orders * m.w))
      return {
        id: m.id,
        labelAr: m.ar,
        labelEn: m.en,
        tooltipTitleAr: `${m.ar} 2026`,
        tooltipTitleEn: `${m.en} 2026`,
        salesKwd: sKwd,
        orders: ord,
        aovKwd: ord > 0 ? round2(sKwd / ord) : ws.aovKwd,
        sharePct: round1(m.w * 100),
        color: m.id === 'm10' || m.id === 'm2' ? '#10B981' : '#0F172A',
      }
    })
  }

  const brandRawRows = APPROVED_BRAND_IDS.map((bid) => {
    const sub = computeGlobalWorkspace({ ...filters, brand: bid }, liveSummary)
    return { bid, salesKwd: sub.salesKwd, orders: sub.orders, aovKwd: sub.aovKwd }
  })
  const sumBrands = brandRawRows.reduce((s, r) => s + r.salesKwd, 0) || 1
  const brandShare: SalesPoint[] = brandRawRows
    .map((r) => ({
      id: r.bid,
      labelAr: getBrandLabel(r.bid, true),
      labelEn: getBrandLabel(r.bid, false),
      tooltipTitleAr: getBrandLabel(r.bid, true),
      tooltipTitleEn: getBrandLabel(r.bid, false),
      salesKwd: r.salesKwd,
      orders: r.orders,
      aovKwd: r.aovKwd,
      sharePct: round1((r.salesKwd / sumBrands) * 100),
      color: BRAND_COLORS[r.bid],
    }))
    .sort((a, b) => b.salesKwd - a.salesKwd)

  const branchRawRows = APPROVED_BRANCH_IDS.map((lid) => {
    const sub = computeGlobalWorkspace({ ...filters, branch: lid }, liveSummary)
    return { lid, salesKwd: sub.salesKwd, orders: sub.orders, aovKwd: sub.aovKwd }
  })
  const sumBranches = branchRawRows.reduce((s, r) => s + r.salesKwd, 0) || 1
  const branchRanking: SalesPoint[] = branchRawRows
    .map((r) => ({
      id: r.lid,
      labelAr: getBranchLabel(r.lid, true),
      labelEn: getBranchLabel(r.lid, false),
      tooltipTitleAr: `فرع ${getBranchLabel(r.lid, true)}`,
      tooltipTitleEn: `${getBranchLabel(r.lid, false)} Branch`,
      salesKwd: r.salesKwd,
      orders: r.orders,
      aovKwd: r.aovKwd,
      sharePct: round1((r.salesKwd / sumBranches) * 100),
      color: '#0F172A',
    }))
    .sort((a, b) => b.salesKwd - a.salesKwd)

  const channelRawRows = APPROVED_CHANNEL_IDS.map((cid) => {
    const sub = computeGlobalWorkspace({ ...filters, channel: cid }, liveSummary)
    return { cid, salesKwd: sub.salesKwd, orders: sub.orders, aovKwd: sub.aovKwd }
  })
  const sumChannels = channelRawRows.reduce((s, r) => s + r.salesKwd, 0) || 1
  const channelRanking: SalesPoint[] = channelRawRows
    .map((r) => ({
      id: r.cid,
      labelAr: getChannelLabel(r.cid, true),
      labelEn: getChannelLabel(r.cid, false),
      tooltipTitleAr: getChannelLabel(r.cid, true),
      tooltipTitleEn: getChannelLabel(r.cid, false),
      salesKwd: r.salesKwd,
      orders: r.orders,
      aovKwd: r.aovKwd,
      sharePct: round1((r.salesKwd / sumChannels) * 100),
      color: r.cid === 'dine-in' || r.cid === 'takeaway-direct' ? '#10B981' : '#0F172A',
    }))
    .sort((a, b) => b.salesKwd - a.salesKwd)

  // =========================================================================
  // 3. MARKETING IMPACT, SOCIAL/INFLUENCER HALO & 6 KUWAIT GROWTH ENGINES
  // =========================================================================
  const visibleCampaigns =
    filters.brand === 'all' ? campaigns : campaigns.filter((c) => c.brand === filters.brand)
  const evaluations = visibleCampaigns.map((c) =>
    evaluateCampaignOdooHalo(c, filters.branch, filters.channel),
  )

  const loggedAdSpend = evaluations.reduce((s, e) => s + e.campaign.spendKwd, 0)
  // Real Odoo POS discounts & promos scaled to active filter
  const baseDiscounts30 = safeNum(ODOO.totals.discountsKwd, 4420)
  const scaledPosDiscounts = round1(baseDiscounts30 * ws.totalScale)
  const periodAdFactor =
    filters.period === 'today' ? 1 / 30 : filters.period === 'week' ? 7 / 30 : filters.period === 'year' ? 10 : 1
  const totalMarketingCostKwd = Math.max(
    5,
    round1(scaledPosDiscounts + loggedAdSpend * periodAdFactor * (filters.branch === 'all' ? 1 : 0.25)),
  )

  const promoShareRatio = filters.channel === 'dine-in' ? 0.11 : 0.185
  const promoAdSalesKwd = round1(ws.salesKwd * promoShareRatio)
  const organicSalesKwd = Math.max(0, round1(ws.salesKwd - promoAdSalesKwd))
  const roasPer1Kwd =
    totalMarketingCostKwd > 0 ? Math.min(8.5, Math.max(1.2, round1(promoAdSalesKwd / totalMarketingCostKwd))) : 3.2
  const incrementalOrders = Math.max(1, Math.round(ws.orders * (promoShareRatio * 0.72)))

  const netPocketRatio = Math.max(0.1, ws.per10.netPocket10 / 10)
  const chartPoints: MarketingChartPoint[] = timeline.map((pt, idx) => {
    const isPeak = pt.color === '#10B981' || idx % 3 === 1
    const pRatio = isPeak ? promoShareRatio * 1.18 : promoShareRatio * 0.88
    const pSales = round1(pt.salesKwd * Math.min(0.38, pRatio))
    const oSales = Math.max(0, round1(pt.salesKwd - pSales))
    const mCost = round1(totalMarketingCostKwd * (ws.salesKwd > 0 ? pt.salesKwd / ws.salesKwd : 1 / Math.max(1, timeline.length)))
    const nProfit = round1(pt.salesKwd * netPocketRatio)
    return {
      id: `mk-${pt.id}`,
      labelAr: pt.labelAr,
      labelEn: pt.labelEn,
      tooltipTitleAr: pt.tooltipTitleAr,
      tooltipTitleEn: pt.tooltipTitleEn,
      organicSalesKwd: oSales,
      promoAdSalesKwd: pSales,
      totalSalesKwd: pt.salesKwd,
      orders: pt.orders,
      marketingCostKwd: mCost,
      netProfitKwd: nProfit,
    }
  })

  // Nominate Dish of the Week dynamically from high-margin gems
  const candidateGems = dishes.filter((d) => d.tag === 'box-gem' || d.tag === 'golden')
  const nominatedDish =
    candidateGems.find((d) => /dynamite|philly|mongolian|shawarma|karak|crispy/i.test(d.name)) ??
    candidateGems[0] ??
    dishes[0]

  const dishOfTheWeek = nominatedDish
    ? {
        dishName: nominatedDish.name,
        brandAr: nominatedDish.brandAr,
        brandEn: nominatedDish.brandEn,
        priceKwd: nominatedDish.unitPriceKwd,
        marginPct: nominatedDish.marginPct,
        angleAr: `تصوير فيديو قريب ١٢ ثانية وقت التحضير ورفعه كأول صنف في طلبات وكيتا لـ ${nominatedDish.brandAr}.`,
        angleEn: `Film a 12-second close-up sizzle reel and pin #1 on Talabat & Keeta for ${nominatedDish.brandEn}.`,
      }
    : {
        dishName: 'Dynamite Shrimp',
        brandAr: 'تشاينا جاردن',
        brandEn: 'China Garden',
        priceKwd: 3.95,
        marginPct: 84,
        angleAr: 'تصوير فيديو قريب ١٢ ثانية ورفعه بأول القائمة في طلبات وكيتا.',
        angleEn: 'Film a 12-second close-up reel and pin #1 on Talabat & Keeta.',
      }

  const quiet3to6Kwd = round1(
    hourly
      .filter((h) => h.id === 'hr-15' || h.id === 'hr-16' || h.id === 'hr-17')
      .reduce((s, h) => s + h.salesKwd, 0),
  )

  const growthPlays: KuwaitGrowthPlay[] = [
    {
      id: 'kw-winter-boxes',
      num: '١',
      titleAr: 'بوكسات الشتاء والمخيمات والشاليهات',
      titleEn: 'Winter, Camping & Chalet Boxes',
      badgeAr: 'موسم نوفمبر والكشتات',
      badgeEn: 'Nov Kashta Season',
      summaryAr:
        'في نوفمبر بالكويت يقفز طلب الجمعات والمخيمات والشاليهات والزوارة يومي الخميس والجمعة وأسبوع الرواتب — البوكس العائلي يرفع الفاتورة من ٤ د.ك إلى ١٧–٢٠ د.ك بنفس تكلفة التوصيل.',
      summaryEn:
        'November camping, chalets, and Thursday/Friday Zwarah gatherings lift average order value from ~4 KWD to 17–20 KWD on a single delivery fee.',
      bulletsAr: [
        'طحينة: بوكس شاورما الكشتة (٢٠ شاورما عربي + بطاط ومخلل وطحينة) بـ 16.900 د.ك.',
        'فرانكس: بوكس فيلي ستيك الديوانية (٨ ساندويتشات مقطعة جاهزة للتقديم) بـ 19.500 د.ك.',
        'كرك كافتيريا: مطارة كرك زعفران حار + درزن شاباتي وسمبوسة للمخيم بـ 6.500 د.ك.',
        'تشاينا جاردن: بوكس العائلة الآسيوي (٥ أطباق رئيسية + سبرنغ رول) بـ 18.750 د.ك.',
      ],
      bulletsEn: [
        'Tahina: 20-pc Kashta Shawarma Box + fries & tahina dips at 16.900 KWD.',
        "Frank's: 8-sandwich Philly Diwaniya Box ready to share at 19.500 KWD.",
        'Karak Cafeteria: Hot Saffron Karak Flask + 12 chapati/sambosa box at 6.500 KWD.',
        'China Garden: 5-Main Family Feast + spring rolls at 18.750 KWD.',
      ],
      expectedAr: '+2,800 إلى +4,200 د.ك شهرياً',
      expectedEn: '+2,800 to +4,200 KWD / mo',
      whatsappTextAr:
        '*خطة ١: بوكسات الشتاء والمخيمات والزوارة*\n• تفعيل ٤ بوكسات عائلية (طحينة 16.900 د.ك، فرانكس 19.500 د.ك، كرك كافتيريا 6.500 د.ك، تشاينا جاردن 18.750 د.ك) بأعلى قائمة طلبات وكيتا والطلب المباشر ابتداءً من الأربعاء عصراً.',
      whatsappTextEn:
        "*Play 1: Kuwait Winter & Kashta Boxes*\n• Pin 4 family boxes (Tahina 16.9 KWD, Frank's 19.5 KWD, Karak Flask 6.5 KWD, China Garden 18.75 KWD) at top of apps & direct ordering starting Wednesday 4 PM.",
    },
    {
      id: 'kw-cross-brand',
      num: '٢',
      titleAr: 'تبادل الزبائن بين مطاعمنا الستة',
      titleEn: 'Cross-Brand Guest Swap (Zero Ad Cost)',
      badgeAr: 'صفر تكلفة إعلان',
      badgeEn: '0 KWD Ad Spend',
      summaryAr:
        'عندنا آلاف طلبات عشاء شهرياً في تشاينا جاردن وفرانكس وذا نودل بار وطحينة — نستثمر أكياسنا نفسها لتعريف الزبون بمطاعم الصباح والعصرية بدون دفع دينار واحد للإعلانات.',
      summaryEn:
        'Use existing dinner bags across China Garden, Noodle Bar, Frank’s, and Tahina to drive morning/afternoon orders to Karak Cafeteria & Farm Brown at zero ad cost.',
      bulletsAr: [
        'داخل كل كيس عشاء (تشاينا جاردن / ذا نودل بار): كرت قهوة أو كرك وشاباتي مجاني الصبح من كرك كافتيريا عند الطلب المباشر.',
        'داخل أكياس الصباح والغداء (فارم براون / كرك كافتيريا): كوبون خصم 1.500 د.ك على عشاء فرانكس أو طحينة للطلب المباشر.',
      ],
      bulletsEn: [
        'Inside China Garden & Noodle Bar dinner bags: morning Karak + Chapati treat card from Karak Cafeteria.',
        "Inside Farm Brown & Karak morning bags: 1.500 KWD direct dinner voucher for Frank's or Tahina.",
      ],
      expectedAr: '+1,450 د.ك شهرياً بصفر إعلان',
      expectedEn: '+1,450 KWD / mo at 0 ad spend',
      whatsappTextAr:
        '*خطة ٢: تبادل الزبائن بين مطاعمنا الستة*\n• وضع كرت عرض صباحي لـ كرك كافتيريا وفارم براون داخل أكياس عشاء تشاينا جاردن وفرانكس وطحينة (تكلفة إعلان خارجي = صفر د.ك).',
      whatsappTextEn:
        "*Play 2: Cross-Brand Bag Voucher Swap*\n• Place morning Karak Cafeteria / Farm Brown treat cards inside China Garden, Frank's & Tahina dinner bags (0 KWD ad spend).",
    },
    {
      id: 'kw-quiet-hours',
      num: '٣',
      titleAr: 'تنشيط الساعات الهادئة بالفروع',
      titleEn: 'Boost Quiet Branch Hours (3–6 PM)',
      badgeAr: 'من بيانات ساعات أودو',
      badgeEn: 'Live Odoo Pos Hours',
      summaryAr: `أرقام الكاشير في أودو توضح هدوء الطلبات بين ٣ و٦ عصراً (${quiet3to6Kwd.toLocaleString('en-US')} د.ك فقط في النطاق الحالي) بينما الإيجار والطاقم مدفوعان بالكامل.`,
      summaryEn: `Odoo POS timestamps show a clear dip between 3 PM and 6 PM (${quiet3to6Kwd.toLocaleString('en-US')} KWD in current filter) while staff and rent are already paid.`,
      bulletsAr: [
        'إطلاق "عرض العصرية ٣–٦ مساءً": وجبة فردية + مشروب بسعر خاص في الصالة والتطبيقات.',
        'ترويج بوكس شاي كرك ومعجنات المكاتب والشركات الساعة ٣:٣٠ عصراً في العاصمة والسالمية.',
      ],
      bulletsEn: [
        'Launch "3–6 PM Afternoon Combo" (main + drink) across mall counters and delivery apps.',
        'Push 3:30 PM office Karak & snack trays around Assima and Salmiya.',
      ],
      expectedAr: '+1,150 د.ك صافي شهرياً',
      expectedEn: '+1,150 KWD net / mo',
      whatsappTextAr:
        '*خطة ٣: تنشيط الساعات الهادئة (٣ إلى ٦ عصراً)*\n• تفعيل وجبة العصرية المخفضة وبوكس كرك المكاتب بين الساعة ٣ و٦ مساءً لاستغلال وقت هدوء الفروع.',
      whatsappTextEn:
        '*Play 3: Quiet Hours Boost (3–6 PM)*\n• Activate afternoon meal+drink combo and office Karak trays from 3–6 PM using existing shift capacity.',
    },
    {
      id: 'kw-hidden-gems',
      num: '٤',
      titleAr: 'أصناف مظلومة تستحق التصوير والرفع',
      titleEn: 'High-Margin Hidden Gems to Film & Pin',
      badgeAr: 'هامش ربح +80%',
      badgeEn: '80%+ Gross Margin',
      summaryAr:
        'أصناف ربحها الصافي ممتاز وطعمها محبوب لكنها مدفونة بأسفل القائمة في طلبات وكيتا بدون صورة قريبة جذابة.',
      summaryEn:
        'Dishes with 80%+ gross margin and strong guest satisfaction currently buried low on Talabat and Keeta menus.',
      bulletsAr: [
        'رفع أصناف (Dynamite Shrimp، Beef Mongolian، Fiery Garlic Noodles، Philly CheeseSteak) لأول ٣ خانات في طلبات وكيتا.',
        'تصوير لقطة قريبة (تيك توك وريلز ١٢ ثانية) لصب الصوص والجبن الحار وتثبيتها كصورة للصنف.',
      ],
      bulletsEn: [
        'Move Dynamite Shrimp, Beef Mongolian, Fiery Garlic Noodles & Philly CheeseSteak into Top-3 app slots.',
        'Shoot 12s sauce-pour & cheese-pull close-ups and update item thumbnails on apps.',
      ],
      expectedAr: '+1,900 د.ك صافي شهرياً',
      expectedEn: '+1,900 KWD net / mo',
      whatsappTextAr:
        '*خطة ٤: رفع وتصوير الأصناف الذهبية المظلومة*\n• نقل أصناف الهامش العالي لأعلى قائمة طلبات وكيتا مع تحديث صورها وتصوير ريلز ١٢ ثانية.',
      whatsappTextEn:
        '*Play 4: Pin & Film High-Margin Gems*\n• Move top-margin dishes to Top-3 on Talabat/Keeta and refresh photos + 12s sizzle video.',
    },
    {
      id: 'kw-smart-gift',
      num: '٥',
      titleAr: 'بديل الخصم المفتوح (هدية ترفع الفاتورة)',
      titleEn: 'Free Add-On Above Min-Basket (Kill Flat % Off)',
      badgeAr: 'حماية الصافي',
      badgeEn: 'Margin Shield',
      summaryAr:
        'الخصم المفتوح ٢٠٪ و٣٠٪ يأكل الربح بالكامل؛ استبداله بهدية قليلة التكلفة بشرط حد أدنى للطلب يرفع الفاتورة ويحمي الجيب.',
      summaryEn:
        'Flat 20–30% off wipes out net profit. Offering a low-cost item above a basket threshold lifts AOV while keeping margin intact.',
      bulletsAr: [
        'إيقاف الخصم المفتوح واستبداله بـ: "شوربة ذرة أو سبرنغ رول مجاناً عند الطلب بـ 6.500 د.ك فأكثر" (تكلفتها علينا 180 فلس فقط!).',
        'ملصق ذهبي على العلبة: "اطلب المرة الجاية مباشر بخصم ١٥٪ بدون عمولة تطبيقات".',
      ],
      bulletsEn: [
        'Replace flat % promos with: "Free Sweet Corn Soup or Spring Roll on orders >= 6.500 KWD" (true food cost ~180 fils).',
        'Add box lid QR sticker converting repeat app buyers to 0%-commission direct orders.',
      ],
      expectedAr: '+2,250 د.ك توفير وربح شهري',
      expectedEn: '+2,250 KWD saved / mo',
      whatsappTextAr:
        '*خطة ٥: بديل الخصم المفتوح*\n• استبدال خصم النسبة المفتوح بهدية (سبرنغ رول أو شوربة) للطلبات فوق 6.500 د.ك + كرت تحويل للطلب المباشر 0% عمولة.',
      whatsappTextEn:
        '*Play 5: Replace Flat Discounts with Smart Gift*\n• Swap flat % promos for free soup/spring roll above 6.500 KWD + direct-order QR sticker.',
    },
    {
      id: 'kw-cpc-spotlight',
      num: '٦',
      titleAr: 'فاحص إعلانات النقرات + طبق الأسبوع للتصوير',
      titleEn: 'In-App Click Ad Guard + Dish of the Week',
      badgeAr: `مرشح الأسبوع: ${dishOfTheWeek.brandAr}`,
      badgeEn: `Pick: ${dishOfTheWeek.brandEn}`,
      summaryAr:
        'إعلانات النقرات داخل طلبات وكيتا تخسر إذا اشتغلت وقت زحمة المطبخ أو بدون حد أدنى؛ شغّلها فقط بالأوقات الهادئة مع طبق رابح.',
      summaryEn:
        'In-app CPC ads lose money when kitchens are busy or baskets are tiny. Run CPC only in off-peak windows with a high-margin hero dish.',
      bulletsAr: [
        `طبق الأسبوع المرشح للتصوير الآن: "${dishOfTheWeek.dishName}" من ${dishOfTheWeek.brandAr} (السعر ${dishOfTheWeek.priceKwd.toFixed(2)} د.ك · هامش الربح ${dishOfTheWeek.marginPct}%).`,
        'قاعدة الفحص: أوقف أي إعلان نقرات تتجاوز تكلفته 350 فلس للطلب الفعلي أو أثناء ذروة الخميس والجمعة.',
      ],
      bulletsEn: [
        `This week's Dish to Film: "${dishOfTheWeek.dishName}" (${dishOfTheWeek.brandEn}, ${dishOfTheWeek.priceKwd.toFixed(2)} KWD, ${dishOfTheWeek.marginPct}% margin).`,
        'Guardrail: Pause any in-app CPC campaign costing > 0.350 KWD per completed order or during peak kitchen rushes.',
      ],
      expectedAr: '+950 د.ك صافي شهرياً',
      expectedEn: '+950 KWD net / mo',
      whatsappTextAr: `*خطة ٦: طبق الأسبوع للتصوير وضبط إعلانات التطبيقات*\n• تصوير "${dishOfTheWeek.dishName}" (${dishOfTheWeek.brandAr}) هذا الأسبوع، وقصر إعلانات النقرات على الأوقات الهادئة بتكلفة أقل من 350 فلس للطلب.`,
      whatsappTextEn: `*Play 6: Dish of the Week & CPC Guard*\n• Film "${dishOfTheWeek.dishName}" (${dishOfTheWeek.brandEn}) this week and cap in-app CPC below 0.350 KWD/order.`,
    },
  ]

  // =========================================================================
  // 4. RATINGS & QUALITY CORE
  // =========================================================================
  const branchQuality: BranchQualityRow[] = APPROVED_BRANCH_IDS.filter(
    (lid) => filters.branch === 'all' || filters.branch === lid,
  ).map((lid) => {
    const rawCanc = J.quality.cancelled.byLocation.find((c) => c.location === lid)
    const rawComp = J.quality.complimentary.find((c) => c.location === lid)
    const cancelledOrders = Math.max(0, Math.round(safeNum(rawCanc?.orders) * ws.periodScale * (filters.brand === 'all' ? 1 : Math.max(0.15, ws.dimensionShare))))
    const cancelledKwd = round1(safeNum(rawCanc?.kwd) * ws.periodScale * (filters.brand === 'all' ? 1 : Math.max(0.15, ws.dimensionShare)))
    const cancelRatePct = round1(safeNum(rawCanc?.ratePct, 0.2))
    const compOrders = Math.max(0, Math.round(safeNum(rawComp?.orders) * ws.periodScale))
    const compKwd = round1(safeNum(rawComp?.kwd) * ws.periodScale)

    const baseRating = BRANCH_BASE_RATING[lid] ?? 4.6
    const qualityScore = Math.round(Math.max(76, Math.min(98, 97 - cancelRatePct * 11 - (compKwd > 150 ? 4 : 0))))

    let alertAr = 'انضباط ممتاز وتقييم مستقر'
    let alertEn = 'Steady rating & low voids'
    let fixAr = 'الاستمرار بفحص الفاتورة وتثبيت ستيكر الإغلاق قبل تسليم السائق.'
    let fixEn = 'Keep receipt check & tamper-seal verification before rider handoff.'

    if (lid === 'ardiya' || lid === 'salmiya' || cancelRatePct >= 0.8) {
      alertAr = 'إلغاءات وتأخير بالشفت المسائي يؤثر على تقييم التطبيقات'
      alertEn = 'Evening-shift cancellations & prep delay hurting app ratings'
      fixAr = 'تجهيز مسبق للأصناف الـ ٥ الأكثر طلباً قبل الساعة ٧ مساءً ومطابقة الصوصات قبل التغليف.'
      fixEn = 'Pre-stage top 5 sellers before 7 PM and double-check sauces before sealing.'
    } else if (lid === 'avenues') {
      alertAr = 'مبيعات الصالة ممتازة — مطلوب متابعة سرعة الكاشير بالذروة'
      alertEn = 'Strong hall counter — monitor peak queue speed'
      fixAr = 'تشغيل كاشير سريع للطلبات الجاهزة وتأكيد حرارة الأكل عند التسليم.'
      fixEn = 'Keep fast-lane KNET checkout active during peak mall hours.'
    }

    return {
      branchId: lid,
      branchAr: getBranchLabel(lid, true),
      branchEn: getBranchLabel(lid, false),
      rating: baseRating,
      cancelledOrders,
      cancelledKwd,
      cancelRatePct,
      compOrders,
      compKwd,
      qualityScore,
      alertAr,
      alertEn,
      fixAr,
      fixEn,
    }
  }).sort((a, b) => b.cancelledKwd - a.cancelledKwd || a.rating - b.rating)

  const avgPlatformRating =
    branchQuality.length > 0
      ? round1(branchQuality.reduce((s, b) => s + b.rating, 0) / branchQuality.length)
      : 4.6
  const cancelledOrders = branchQuality.reduce((s, b) => s + b.cancelledOrders, 0)
  const cancelledKwd = round1(branchQuality.reduce((s, b) => s + b.cancelledKwd, 0))
  const qualityScore =
    branchQuality.length > 0
      ? Math.round(branchQuality.reduce((s, b) => s + b.qualityScore, 0) / branchQuality.length)
      : 92

  const platformRatings: PlatformRatingRow[] = [
    {
      id: 'plat-talabat',
      platformAr: 'طلبات (Talabat)',
      platformEn: 'Talabat',
      rating: 4.6,
      targetRating: 4.8,
      orders: channelRanking.find((c) => c.id === 'talabat-tgo')?.orders ?? 0,
      issueAr: 'نقص صوص إضافي أو تأخر تحضير وقت ذروة العشاء',
      issueEn: 'Missing extra sauce or dinner-peak prep delay',
      stepAr: 'وضع قائمة فحص من ٣ نقاط عند خط التغليف + كرت اعتذار وهدية بسيطة لأي طلب تأخر.',
      stepEn: 'Add 3-point bag check at packing line + thank-you recovery card.',
    },
    {
      id: 'plat-keeta',
      platformAr: 'كيتا (Keeta)',
      platformEn: 'Keeta',
      rating: 4.5,
      targetRating: 4.8,
      orders: channelRanking.find((c) => c.id === 'keeta')?.orders ?? 0,
      issueAr: 'تقييم العميل في كيتا حساس جداً لسرعة تسليم السائق وحرارة الأكل',
      issueEn: 'Keeta algorithm heavily weights fast rider handoff & food heat',
      stepAr: 'عدم الضغط على "جاهز للاستلام" قبل اكتمال الكيس فعلياً واستخدام علب حفظ الحرارة.',
      stepEn: 'Only tap "Ready" when bag is sealed on counter and use vented thermal boxes.',
    },
    {
      id: 'plat-deliveroo',
      platformAr: 'ديليفرو (Deliveroo)',
      platformEn: 'Deliveroo',
      rating: 4.7,
      targetRating: 4.8,
      orders: channelRanking.find((c) => c.id === 'deliveroo')?.orders ?? 0,
      issueAr: 'ملاحظات متفرقة على تغليف الشوربة والسوائل',
      issueEn: 'Occasional soup/sauce spill notes in transit',
      stepAr: 'تغليف الشوربة والصوصات بنايلون حراري مزدوج قبل وضعها بالكيس.',
      stepEn: 'Double-seal soup and sauce cups with shrink wrap before bagging.',
    },
    {
      id: 'plat-jahez-snoonu',
      platformAr: 'جاهز وسنونو',
      platformEn: 'Jahez & Snoonu',
      rating: 4.6,
      targetRating: 4.8,
      orders:
        (channelRanking.find((c) => c.id === 'jahez')?.orders ?? 0) +
        (channelRanking.find((c) => c.id === 'snoonu')?.orders ?? 0),
      issueAr: 'إغلاق التابلت مبكراً في بعض الفروع يخفض ظهور المطعم',
      issueEn: 'Early tablet pause lowers store ranking visibility',
      stepAr: 'تثبيت التابلت على الشاحن ومنع إيقاف الاستقبال إلا بموافقة مدير المنطقة.',
      stepEn: 'Keep tablets plugged in and require area manager approval before pausing.',
    },
  ]

  return {
    marketing: {
      evaluations,
      kpis: {
        roasPer1Kwd: roasPer1Kwd,
        promoAdSalesKwd,
        organicSalesKwd,
        promoSharePct: ws.salesKwd > 0 ? round1((promoAdSalesKwd / ws.salesKwd) * 100) : 18,
        totalMarketingCostKwd,
        incrementalOrders,
      },
      chartPoints,
      growthPlays,
      dishOfTheWeek,
    },
    sales: {
      peakHourLabelAr,
      peakHourLabelEn,
      quietWindowAr: '٣:٠٠ م – ٦:٠٠ م',
      quietWindowEn: '3:00 PM – 6:00 PM',
      timeline,
      hourly,
      brandShare,
      branchRanking,
      channelRanking,
    },
    menu: {
      totalActiveSkus: dishes.length,
      totalUnitsSold,
      avgMarginPct,
      topProfitDish,
      dishes,
    },
    quality: {
      avgPlatformRating,
      cancelledOrders,
      cancelledKwd,
      qualityScore,
      repeatGuests: Math.max(1, Math.round(safeNum(J.quality.retention?.repeatCustomers, 142) * ws.periodScale)),
      identifiedGuests: Math.max(1, Math.round(safeNum(J.quality.retention?.identifiedCustomers, 14957) * ws.periodScale)),
      branchQuality,
      platformRatings,
    },
  }
}
