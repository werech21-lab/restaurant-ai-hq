/**
 * Shared Social Media, Influencer & In-App Ad Campaign Registry + Real Odoo 3-Day Halo Calculator.
 * Used across `/erp/cores` (Tab 1: التسويق ونمو المبيعات) and `/erp/before-after` (مقارنة قبل وبعد).
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  APPROVED_BRAND_IDS,
  getBrandLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
} from '@/lib/aether/global-filter-engine'

export type SocialAdType = 'snapchat' | 'tiktok' | 'instagram' | 'influencer' | 'in-app'

export interface SocialCampaign {
  id: string
  brand: Exclude<GlobalBrand, 'all'>
  adType: SocialAdType
  campaignName: string
  spendKwd: number
  date: string // YYYY-MM-DD
  promotedItem?: string
}

export type AdVerdict = 'winner' | 'breakeven' | 'loser'

export interface CampaignHaloEvaluation {
  campaign: SocialCampaign
  brandAr: string
  brandEn: string
  adTypeAr: string
  adTypeEn: string
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
    spendKwd: 350,
    date: '2026-10-29',
    promotedItem: 'Dynamite Shrimp & Chicken Noodles',
  },
  {
    id: 'camp-franks-tiktok-oct22',
    brand: 'franks',
    adType: 'tiktok',
    campaignName: 'فيديو تيك توك وريلز — فيلي ستيك على الصاج',
    spendKwd: 95,
    date: '2026-10-22',
    promotedItem: 'Orig. Philly CheeseSteak',
  },
  {
    id: 'camp-fb-snap-nov04',
    brand: 'farm-brown',
    adType: 'snapchat',
    campaignName: 'إعلان سناب شات — وجبات كرسبي وساندويتشات',
    spendKwd: 75,
    date: '2026-11-04',
    promotedItem: 'Crispy Chicken Combo',
  },
  {
    id: 'camp-inapp-clicks-nov01',
    brand: 'noodle-bar',
    adType: 'in-app',
    campaignName: 'إعلان نقرات ممول بدون حد أدنى للطلب',
    spendKwd: 190,
    date: '2026-11-01',
    promotedItem: 'Wok Noodles',
  },
]

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
    const spend = Math.max(0, safeNum(Number(rec.spendKwd), 0))
    const date =
      typeof rec.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rec.date)
        ? rec.date
        : '2026-11-05'
    out.push({
      id,
      brand: rec.brand as Exclude<GlobalBrand, 'all'>,
      adType,
      campaignName:
        typeof rec.campaignName === 'string' && rec.campaignName.trim()
          ? rec.campaignName.trim()
          : 'حملة سوشيال',
      spendKwd: spend,
      date,
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
 * Compares 3 days BEFORE [D-3..D-1] vs 3 days DURING/AFTER [D..D+2] for that brand
 * (sliced proportionally if a specific Branch or Channel filter is active).
 */
export function evaluateCampaignOdooHalo(
  campaign: SocialCampaign,
  activeBranch: GlobalBranch = 'all',
  activeChannel: GlobalChannel = 'all',
): CampaignHaloEvaluation {
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
  if (activeBranch !== 'all') {
    const locRow = ODOO.restaurants.find((r) => r.id === activeBranch)
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

  const beforeDates = [shiftIsoDate(campaign.date, -3), shiftIsoDate(campaign.date, -2), shiftIsoDate(campaign.date, -1)]
  const afterDates = [campaign.date, shiftIsoDate(campaign.date, 1), shiftIsoDate(campaign.date, 2)]

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
    adTypeAr: adOpt.ar,
    adTypeEn: adOpt.en,
    beforeRangeLabel: `${beforeDates[0].slice(5)} → ${beforeDates[2].slice(5)}`,
    afterRangeLabel: `${afterDates[0].slice(5)} → ${afterDates[2].slice(5)}`,
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
