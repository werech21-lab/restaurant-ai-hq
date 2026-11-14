/**
 * Shared Social Media, Influencer & In-App Ad Campaign Registry + Real Odoo 3-Day Halo Calculator.
 * Used across `/erp/cores` (Tab 1: التسويق ونمو المبيعات) and `/erp/before-after` (مقارنة قبل وبعد).
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  getBranchLabel,
  getBrandLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'

export type SocialAdType = 'snapchat' | 'tiktok' | 'instagram' | 'influencer' | 'in-app'

export interface SocialCampaign {
  id: string
  brand: Exclude<GlobalBrand, 'all'>
  branch?: GlobalBranch
  adType: SocialAdType
  campaignName: string
  campaignNameEn?: string
  spendKwd: number
  date: string // YYYY-MM-DD (campaign start date)
  startDate?: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  /** Optional custom baseline comparison window (overrides automatic prior N days when set) */
  compareStartDate?: string // YYYY-MM-DD
  compareEndDate?: string // YYYY-MM-DD
  promotedItem?: string
}

export type AdVerdict = 'winner' | 'breakeven' | 'loser'

export interface CampaignHaloEvaluation {
  campaign: SocialCampaign
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  adTypeAr: string
  adTypeEn: string
  startDate: string
  endDate: string
  compareStartDate: string
  compareEndDate: string
  windowDays: number
  beforeRangeLabel: string
  afterRangeLabel: string
  before3dSalesKwd: number
  after3dSalesKwd: number
  before3dOrders: number
  after3dOrders: number
  liftSalesKwd: number
  liftOrders: number
  liftPct: number
  foodAndPackCostKwd: number
  platformFeeKwd: number
  incrementalGrossProfitKwd: number
  netProfitAfterAdKwd: number
  roasMultiple: number
  verdict: AdVerdict
  verdictAr: string
  verdictEn: string
}

export const SOCIAL_CAMPAIGNS_STORAGE_KEY = 'vf-social-campaigns-v1'
export const REAL_SOCIAL_CAMPAIGNS_STORAGE_KEY = 'vf-real-social-campaigns-v2'

export const SOCIAL_AD_TYPE_OPTIONS: readonly {
  id: SocialAdType
  ar: string
  en: string
}[] = [
  { id: 'snapchat', ar: 'سناب شات', en: 'Snapchat' },
  { id: 'tiktok', ar: 'تيك توك', en: 'TikTok' },
  { id: 'instagram', ar: 'إنستغرام', en: 'Instagram' },
  { id: 'influencer', ar: 'مشهور - بلوقر', en: 'Influencer / Blogger' },
  { id: 'in-app', ar: 'إعلان داخل طلبات وكيتا', en: 'Talabat & Keeta Ads' },
] as const

export const SEEDED_SOCIAL_CAMPAIGNS: SocialCampaign[] = [
  {
    id: 'camp-cg-blogger-oct29',
    brand: 'china-garden',
    adType: 'influencer',
    campaignName: 'تغطية بلوقر مطاعم الكويت — داينمايت شرمب ونودلز',
    campaignNameEn: 'Kuwait Food Blogger — Dynamite Shrimp & Noodles',
    spendKwd: 350,
    date: '2026-10-29',
    startDate: '2026-10-29',
    endDate: '2026-10-31',
    promotedItem: 'Dynamite Shrimp & Chicken Noodles',
  },
  {
    id: 'camp-franks-tiktok-oct22',
    brand: 'franks',
    adType: 'tiktok',
    campaignName: 'فيديو تيك توك وريلز — فيلي ستيك على الصاج',
    campaignNameEn: 'TikTok & Reels Promo — Orig. Philly CheeseSteak',
    spendKwd: 95,
    date: '2026-10-22',
    startDate: '2026-10-22',
    endDate: '2026-10-24',
    promotedItem: 'Orig. Philly CheeseSteak',
  },
  {
    id: 'camp-fb-snap-nov04',
    brand: 'farm-brown',
    adType: 'snapchat',
    campaignName: 'إعلان سناب شات — وجبات كرسبي وساندويتشات',
    campaignNameEn: 'Snapchat Promo — Crispy Chicken Combo',
    spendKwd: 75,
    date: '2026-11-04',
    startDate: '2026-11-04',
    endDate: '2026-11-06',
    promotedItem: 'Crispy Chicken Combo',
  },
  {
    id: 'camp-inapp-clicks-nov01',
    brand: 'noodle-bar',
    adType: 'in-app',
    campaignName: 'إعلان نقرات ممول بدون حد أدنى للطلب',
    campaignNameEn: 'Sponsored App Clicks — Wok Noodles Promo',
    spendKwd: 190,
    date: '2026-11-01',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    promotedItem: 'Wok Noodles',
  },
]

const BROKEN_CAMPAIGN_NAME_RE = /^(?:[-—–\s]|in\s*[-—–]\s*in|in)+$/i

/**
 * Resolves a complete, meaningful bilingual campaign title (NEVER `—`, empty, or `in — in`).
 */
export function resolveCampaignDisplayName(
  campaign: Partial<SocialCampaign> | null | undefined,
  isAr: boolean,
): string {
  const brandId = campaign?.brand ?? 'china-garden'
  const brandLabel = getBrandLabel(brandId, isAr)
  const adOpt =
    SOCIAL_AD_TYPE_OPTIONS.find((t) => t.id === campaign?.adType) ?? SOCIAL_AD_TYPE_OPTIONS[2]
  const adLabel = isAr ? adOpt.ar : adOpt.en
  const dish = (campaign?.promotedItem ?? '').trim()
  const rawAr = (campaign?.campaignName ?? '').trim()
  const rawEn = (campaign?.campaignNameEn ?? '').trim()

  if (isAr) {
    if (rawAr && !BROKEN_CAMPAIGN_NAME_RE.test(rawAr)) return rawAr
    return dish ? `حملة ${adLabel} — ${dish}` : `حملة ${adLabel} — ${brandLabel}`
  }

  if (rawEn && !BROKEN_CAMPAIGN_NAME_RE.test(rawEn)) return rawEn
  if (rawAr && !/[\u0600-\u06FF]/.test(rawAr) && !BROKEN_CAMPAIGN_NAME_RE.test(rawAr)) {
    return rawAr
  }
  const seededHit = SEEDED_SOCIAL_CAMPAIGNS.find((s) => s.id === campaign?.id)
  if (seededHit?.campaignNameEn) return seededHit.campaignNameEn
  return dish ? `${adLabel} Promo — ${dish}` : `${adLabel} Campaign — ${brandLabel}`
}

const BRAND_FOOD_PCT: Record<Exclude<GlobalBrand, 'all'>, number> = {
  'china-garden': 0.264,
  franks: 0.295,
  tahina: 0.252,
  'farm-brown': 0.282,
  'noodle-bar': 0.258,
  'karak-cafeteria': 0.225,
}

const BRAND_PLATFORM_CUT_PCT: Record<Exclude<GlobalBrand, 'all'>, number> = {
  'china-garden': 0.135,
  franks: 0.148,
  tahina: 0.142,
  'farm-brown': 0.132,
  'noodle-bar': 0.152,
  'karak-cafeteria': 0.085,
}

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

function shiftIsoDate(iso: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return '2026-11-05'
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

export const DEMO_SOCIAL_CAMPAIGN_IDS = new Set<string>(
  SEEDED_SOCIAL_CAMPAIGNS.map((c) => c.id),
)

export function isDemoSocialCampaign(id: string): boolean {
  return DEMO_SOCIAL_CAMPAIGN_IDS.has(id)
}

function parseValidCampaignList(raw: unknown, excludeDemoIds: boolean): SocialCampaign[] {
  if (!Array.isArray(raw)) return []
  const validBrands = new Set<string>(APPROVED_BRAND_IDS)
  const validBranches = new Set<string>(APPROVED_BRANCH_IDS)
  const validTypes = new Set<string>(SOCIAL_AD_TYPE_OPTIONS.map((t) => t.id))
  const out: SocialCampaign[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Partial<SocialCampaign>
    if (!rec.brand || !validBrands.has(rec.brand)) continue
    const id =
      typeof rec.id === 'string' && rec.id ? rec.id : `camp-${Date.now()}-${out.length}`
    if (excludeDemoIds && DEMO_SOCIAL_CAMPAIGN_IDS.has(id)) continue
    const adType: SocialAdType =
      rec.adType && validTypes.has(rec.adType) ? (rec.adType as SocialAdType) : 'instagram'
    const branch: GlobalBranch =
      rec.branch && validBranches.has(rec.branch) ? (rec.branch as GlobalBranch) : 'all'
    const spend = Math.max(0, safeNum(Number(rec.spendKwd), 0))
    const rawStart =
      typeof rec.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.startDate)
        ? rec.startDate
        : typeof rec.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.date)
          ? rec.date
          : '2026-11-05'
    const rawEnd =
      typeof rec.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.endDate)
        ? rec.endDate
        : shiftIsoDate(rawStart, 2)
    const startDate = rawStart <= rawEnd ? rawStart : rawEnd
    const endDate = rawStart <= rawEnd ? rawEnd : rawStart
    const compareStartDate =
      typeof rec.compareStartDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.compareStartDate)
        ? rec.compareStartDate
        : undefined
    const compareEndDate =
      typeof rec.compareEndDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.compareEndDate)
        ? rec.compareEndDate
        : undefined
    out.push({
      id,
      brand: rec.brand as Exclude<GlobalBrand, 'all'>,
      branch,
      adType,
      campaignName:
        typeof rec.campaignName === 'string' &&
        rec.campaignName.trim() &&
        !BROKEN_CAMPAIGN_NAME_RE.test(rec.campaignName.trim())
          ? rec.campaignName.trim()
          : 'حملة عروض وتوصيل',
      ...(typeof rec.campaignNameEn === 'string' &&
      rec.campaignNameEn.trim() &&
      !BROKEN_CAMPAIGN_NAME_RE.test(rec.campaignNameEn.trim())
        ? { campaignNameEn: rec.campaignNameEn.trim() }
        : {}),
      spendKwd: spend,
      date: startDate,
      startDate,
      endDate,
      compareStartDate,
      compareEndDate,
      promotedItem: typeof rec.promotedItem === 'string' ? rec.promotedItem.trim() : '',
    })
  }
  return out
}

/** Sanitizes user-saved real Venture Foods campaigns; preserves `[]` when empty and strips demo IDs. */
export function sanitizeRealCampaigns(raw: unknown): SocialCampaign[] {
  return parseValidCampaignList(raw, true)
}

export function sanitizeCampaigns(raw: unknown): SocialCampaign[] {
  const out = parseValidCampaignList(raw, false)
  return out.length > 0 ? out : SEEDED_SOCIAL_CAMPAIGNS
}

/**
 * Evaluates a social/influencer/in-app campaign against actual Odoo POS daily sales:
 * Compares custom baseline date range (or prior N days) BEFORE vs N days DURING/AFTER
 * for the selected Brand, Branch (All 7 or specific branch), and Channel.
 */
export function evaluateCampaignOdooHalo(
  campaign: SocialCampaign,
  activeBranch: GlobalBranch = 'all',
  activeChannel: GlobalChannel = 'all',
): CampaignHaloEvaluation {
  const effectiveBranch: GlobalBranch =
    campaign.branch && campaign.branch !== 'all' ? campaign.branch : activeBranch

  // Complete operational days from Odoo (exclude partial morning sync days < 150 orders)
  const fullDays = (ODOO.timeProfile?.daily ?? []).filter((d) => d.orders >= 150)
  const dayMap = new Map<string, (typeof fullDays)[number]>(fullDays.map((d) => [d.day, d]))

  // Weekday averages from real Odoo daily POS as fallback if date is outside the 30d window
  const weekdayBuckets: Record<number, { sumNet: number; sumOrd: number; count: number }> = {}
  let totalDailyNet = 0
  let totalDailyOrd = 0
  for (const d of fullDays) {
    const dow = new Date(`${d.day}T12:00:00Z`).getUTCDay()
    weekdayBuckets[dow] ??= { sumNet: 0, sumOrd: 0, count: 0 }
    weekdayBuckets[dow].sumNet += d.netKwd
    weekdayBuckets[dow].sumOrd += d.orders
    weekdayBuckets[dow].count += 1
    totalDailyNet += d.netKwd
    totalDailyOrd += d.orders
  }
  const fallbackAvgNet = fullDays.length > 0 ? totalDailyNet / fullDays.length : 4300
  const fallbackAvgOrd = fullDays.length > 0 ? totalDailyOrd / fullDays.length : 980

  const getGroupDay = (iso: string): { netKwd: number; orders: number } => {
    const hit = dayMap.get(iso)
    if (hit) return { netKwd: hit.netKwd, orders: hit.orders }
    const dow = new Date(`${iso}T12:00:00Z`).getUTCDay()
    const wb = weekdayBuckets[dow]
    if (wb && wb.count > 0) {
      return { netKwd: wb.sumNet / wb.count, orders: wb.sumOrd / wb.count }
    }
    return { netKwd: fallbackAvgNet, orders: fallbackAvgOrd }
  }

  // Brand share & AOV from real Odoo 30d brand totals
  const brandRow = ODOO.brands.find((b) => b.id === campaign.brand)
  const groupRestNet30 = ODOO.restaurants.reduce((s, r) => s + r.netKwd, 0) || ODOO.totals.restaurantNetKwd
  const brandNet30 = safeNum(brandRow?.netKwd, 1500)
  const brandAov = safeNum(brandRow?.aovKwd, 4.5) || 4.5
  let sliceShare = Math.max(0.008, Math.min(0.92, brandNet30 / Math.max(1, groupRestNet30)))

  // Apply branch share if filtered
  if (effectiveBranch !== 'all') {
    const locRow = ODOO.restaurants.find((r) => r.id === effectiveBranch)
    const locBrand = locRow?.brands.find((x) => x.brand === campaign.brand)
    const branchRatio =
      locBrand && brandNet30 > 0
        ? locBrand.netKwd / brandNet30
        : locRow
          ? locRow.netKwd / Math.max(1, groupRestNet30)
          : 0.14
    sliceShare *= Math.max(0.02, branchRatio)
  }

  // Apply channel share if filtered
  if (activeChannel !== 'all') {
    const rawChIds =
      activeChannel === 'dine-in' || activeChannel === 'takeaway-direct'
        ? ['shop', 'online-link', 'cod']
        : activeChannel === 'deliveroo'
          ? ['deliveroo-go', 'deliveroo-mp']
          : [activeChannel]
    const chSum = ODOO.brandChannel
      .filter((bc) => bc.brand === campaign.brand && rawChIds.includes(bc.channel))
      .reduce((s, bc) => s + bc.netKwd, 0)
    const chRatio = brandNet30 > 0 && chSum > 0 ? chSum / brandNet30 : 0.15
    sliceShare *= activeChannel === 'dine-in' ? chRatio * 0.85 : activeChannel === 'takeaway-direct' ? Math.max(0.05, chRatio * 0.15) : chRatio
  }

  const startIso =
    campaign.startDate && /^\d{4}-\d{2}-\d{2}$/.test(campaign.startDate)
      ? campaign.startDate
      : campaign.date
  const rawEndIso =
    campaign.endDate && /^\d{4}-\d{2}-\d{2}$/.test(campaign.endDate)
      ? campaign.endDate
      : shiftIsoDate(startIso, 2)
  const effectiveStart = startIso <= rawEndIso ? startIso : rawEndIso
  const effectiveEnd = startIso <= rawEndIso ? rawEndIso : startIso
  const rawSpanDays =
    Math.round(
      (new Date(`${effectiveEnd}T00:00:00Z`).getTime() -
        new Date(`${effectiveStart}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1
  const windowDays = Math.max(1, Math.min(60, Number.isFinite(rawSpanDays) ? rawSpanDays : 3))

  const beforeDates: string[] = []
  const afterDates: string[] = []
  for (let i = 0; i < windowDays; i++) {
    afterDates.push(shiftIsoDate(effectiveStart, i))
  }

  if (campaign.compareStartDate && /^\d{4}-\d{2}-\d{2}$/.test(campaign.compareStartDate)) {
    const cStartRaw = campaign.compareStartDate
    const cEndRaw =
      campaign.compareEndDate && /^\d{4}-\d{2}-\d{2}$/.test(campaign.compareEndDate)
        ? campaign.compareEndDate
        : shiftIsoDate(cStartRaw, windowDays - 1)
    const cStart = cStartRaw <= cEndRaw ? cStartRaw : cEndRaw
    const cEnd = cStartRaw <= cEndRaw ? cEndRaw : cStartRaw
    const cDays = Math.max(
      1,
      Math.min(
        60,
        Math.round(
          (new Date(`${cEnd}T00:00:00Z`).getTime() - new Date(`${cStart}T00:00:00Z`).getTime()) /
            86_400_000,
        ) + 1,
      ),
    )
    for (let i = 0; i < cDays; i++) {
      beforeDates.push(shiftIsoDate(cStart, i))
    }
  } else {
    for (let i = windowDays; i >= 1; i--) {
      beforeDates.push(shiftIsoDate(effectiveStart, -i))
    }
  }

  let before3dSalesKwd = 0
  let after3dSalesKwd = 0
  for (const dt of beforeDates) before3dSalesKwd += getGroupDay(dt).netKwd * sliceShare
  for (const dt of afterDates) after3dSalesKwd += getGroupDay(dt).netKwd * sliceShare

  before3dSalesKwd = Math.round(before3dSalesKwd * 10) / 10
  after3dSalesKwd = Math.round(after3dSalesKwd * 10) / 10

  const before3dOrders = Math.max(1, Math.round(before3dSalesKwd / brandAov))
  const after3dOrders = Math.max(1, Math.round(after3dSalesKwd / brandAov))

  const liftSalesKwd = Math.round((after3dSalesKwd - before3dSalesKwd) * 10) / 10
  const liftOrders = after3dOrders - before3dOrders
  const liftPct = before3dSalesKwd > 0 ? Math.round(((after3dSalesKwd - before3dSalesKwd) / before3dSalesKwd) * 1000) / 10 : 0

  const foodPct = BRAND_FOOD_PCT[campaign.brand] ?? 0.27
  const commPct =
    activeChannel === 'dine-in'
      ? 0
      : activeChannel === 'takeaway-direct'
        ? 0.02
        : BRAND_PLATFORM_CUT_PCT[campaign.brand] ?? 0.14

  const positiveLiftSales = Math.max(0, liftSalesKwd)
  const foodAndPackCostKwd = Math.round(positiveLiftSales * foodPct * 10) / 10
  const platformFeeKwd = Math.round(positiveLiftSales * commPct * 10) / 10
  const incrementalGrossProfitKwd =
    liftSalesKwd >= 0
      ? Math.round((liftSalesKwd - foodAndPackCostKwd - platformFeeKwd) * 10) / 10
      : Math.round(liftSalesKwd * (1 - foodPct - commPct) * 10) / 10

  const netProfitAfterAdKwd = Math.round((incrementalGrossProfitKwd - campaign.spendKwd) * 10) / 10
  const roasMultiple =
    campaign.spendKwd > 0 ? Math.max(0, Math.round((positiveLiftSales / campaign.spendKwd) * 10) / 10) : 0

  let verdict: AdVerdict = 'loser'
  let verdictAr = 'خاسر — لا تكرره 🔴'
  let verdictEn = 'Losing Ad — Skip 🔴'

  if (netProfitAfterAdKwd >= Math.max(25, campaign.spendKwd * 0.25)) {
    verdict = 'winner'
    verdictAr = 'إعلان رابح — كرره 🟢'
    verdictEn = 'Winning Ad — Repeat 🟢'
  } else if (netProfitAfterAdKwd >= -15) {
    verdict = 'breakeven'
    verdictAr = 'رجّع تكلفته فقط 🟡'
    verdictEn = 'Broke Even Only 🟡'
  }

  const adOpt = SOCIAL_AD_TYPE_OPTIONS.find((t) => t.id === campaign.adType) ?? SOCIAL_AD_TYPE_OPTIONS[0]

  return {
    campaign,
    brandAr: getBrandLabel(campaign.brand, true),
    brandEn: getBrandLabel(campaign.brand, false),
    branchAr: effectiveBranch === 'all' ? 'كل الفروع السبعة' : getBranchLabel(effectiveBranch, true),
    branchEn: effectiveBranch === 'all' ? 'All 7 Branches' : getBranchLabel(effectiveBranch, false),
    adTypeAr: adOpt.ar,
    adTypeEn: adOpt.en,
    startDate: effectiveStart,
    endDate: afterDates[afterDates.length - 1] ?? effectiveEnd,
    compareStartDate: beforeDates[0] ?? shiftIsoDate(effectiveStart, -windowDays),
    compareEndDate: beforeDates[beforeDates.length - 1] ?? shiftIsoDate(effectiveStart, -1),
    windowDays,
    beforeRangeLabel: `${beforeDates[0].slice(5)} → ${beforeDates[beforeDates.length - 1].slice(5)}`,
    afterRangeLabel: `${afterDates[0].slice(5)} → ${afterDates[afterDates.length - 1].slice(5)}`,
    before3dSalesKwd,
    after3dSalesKwd,
    before3dOrders,
    after3dOrders,
    liftSalesKwd,
    liftOrders,
    liftPct,
    foodAndPackCostKwd,
    platformFeeKwd,
    incrementalGrossProfitKwd,
    netProfitAfterAdKwd,
    roasMultiple,
    verdict,
    verdictAr,
    verdictEn,
  }
}
