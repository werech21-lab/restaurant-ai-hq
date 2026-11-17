/**
 * Social Media, Influencer & In-App Ad Campaign Registry + Live Odoo POS Halo Calculator.
 * Zero hardcoded campaigns; evaluates user-entered campaigns strictly against live Odoo `dailySeries`
 * when Odoo is connected.
 */

import { formatDate } from '@/lib/format'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'
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
  odooConnected: boolean
  noData: boolean
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

const BROKEN_CAMPAIGN_NAME_RE = /^(?:[-—–\s]|in\s*[-—–]\s*in|in)+$/i

const LEGACY_REMOVED_IDS = new Set<string>([
  'camp-cg-blogger-oct29',
  'camp-franks-tiktok-oct22',
  'camp-fb-snap-nov04',
  'camp-inapp-clicks-nov01',
])

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
  return dish ? `${adLabel} Promo — ${dish}` : `${adLabel} Campaign — ${brandLabel}`
}

const safeNum = (v: unknown, fb = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb

function shiftIsoDate(iso: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return formatDate(new Date(), 'en')
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

function parseValidCampaignList(raw: unknown): SocialCampaign[] {
  if (!Array.isArray(raw)) return []
  const validBrands = new Set<string>(APPROVED_BRAND_IDS)
  const validBranches = new Set<string>([...APPROVED_BRANCH_IDS, 'school-canteens'])
  const validTypes = new Set<string>(SOCIAL_AD_TYPE_OPTIONS.map((t) => t.id))
  const todayIso = formatDate(new Date(), 'en')
  const out: SocialCampaign[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Partial<SocialCampaign>
    if (!rec.brand || !validBrands.has(rec.brand)) continue
    const id =
      typeof rec.id === 'string' && rec.id ? rec.id : `camp-${Date.now()}-${out.length}`
    if (LEGACY_REMOVED_IDS.has(id)) continue
    const textFields = [rec.campaignName, rec.campaignNameEn, rec.promotedItem].filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0,
    )
    if (
      textFields.some(
        (txt) => isExcludedOdooEntity(txt) || isNonCompanyCatalogItem(null, txt),
      )
    ) {
      continue
    }
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
          : todayIso
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
        !BROKEN_CAMPAIGN_NAME_RE.test(rec.campaignName.trim()) &&
        !/^(?:campaign|ad|حملة|إعلان)\s*:\s*(?:[—–\-]+|in\s*[—–\-]+\s*in)?\s*$/i.test(
          rec.campaignName.trim(),
        ) &&
        !/\bin\s*[—–\-]+\s*in\b/i.test(rec.campaignName.trim())
          ? rec.campaignName.trim()
          : 'بدون حملة',
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

/** Sanitizes user-saved Venture Foods campaigns; preserves `[]` when empty. */
export function sanitizeRealCampaigns(raw: unknown): SocialCampaign[] {
  return parseValidCampaignList(raw)
}

export function sanitizeCampaigns(raw: unknown): SocialCampaign[] {
  return parseValidCampaignList(raw)
}

/**
 * Evaluates a user-recorded campaign against live Odoo POS daily sales (`liveSummary.dailySeries`).
 * Never invents fallback sales when Odoo is disconnected or when dates have no POS records.
 */
export function evaluateCampaignOdooHalo(
  campaign: SocialCampaign,
  activeBranch: GlobalBranch = 'all',
  activeChannel: GlobalChannel = 'all',
  liveSummary?: OdooLiveSummary | null,
): CampaignHaloEvaluation {
  const effectiveBranch: GlobalBranch =
    campaign.branch && campaign.branch !== 'all' ? campaign.branch : activeBranch

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

  const adOpt =
    SOCIAL_AD_TYPE_OPTIONS.find((t) => t.id === campaign.adType) ?? SOCIAL_AD_TYPE_OPTIONS[0]

  const isConnected = Boolean(liveSummary?.connected && liveSummary?.source === 'live' && !liveSummary?.noData)
  const dayMap = new Map<string, { netKwd: number; orders: number }>()

  if (isConnected && liveSummary) {
    if (effectiveBranch !== 'all' && liveSummary.dailyByBranch) {
      for (const [day, locMap] of Object.entries(liveSummary.dailyByBranch)) {
        const hit = locMap?.[effectiveBranch]
        if (hit) {
          dayMap.set(day, { netKwd: safeNum(hit.netKwd), orders: safeNum(hit.orders) })
        }
      }
    } else {
      for (const d of liveSummary.dailySeries ?? []) {
        dayMap.set(d.day, { netKwd: safeNum(d.netKwd), orders: safeNum(d.orders) })
      }
    }
  }

  // Brand share from live Odoo brands only (never static fallback)
  let brandShare = 0
  if (isConnected && liveSummary) {
    const totalBrandSales = (liveSummary.brands ?? []).reduce((s, b) => s + safeNum(b.netKwd), 0)
    const hitBrand = (liveSummary.brands ?? []).find((b) => b.id === campaign.brand)
    if (totalBrandSales > 0 && hitBrand) {
      brandShare = safeNum(hitBrand.netKwd) / totalBrandSales
    }
  }

  // Channel share from live bucket if filtered
  let channelShare = 1
  if (isConnected && liveSummary && activeChannel !== 'all') {
    const monthBucket = liveSummary.buckets?.month
    const totalCh = Object.values(monthBucket?.uiChannels ?? {}).reduce(
      (s, c) => s + safeNum(c?.netKwd),
      0,
    )
    const chHit = safeNum(monthBucket?.uiChannels?.[activeChannel]?.netKwd)
    channelShare = totalCh > 0 ? chHit / totalCh : 0
  }

  const sliceShare = isConnected ? brandShare * channelShare : 0

  let before3dSalesKwd = 0
  let after3dSalesKwd = 0
  let before3dOrders = 0
  let after3dOrders = 0
  let matchedDays = 0

  for (const dt of beforeDates) {
    const hit = dayMap.get(dt)
    if (hit) {
      matchedDays += 1
      before3dSalesKwd += hit.netKwd * sliceShare
      before3dOrders += hit.orders * sliceShare
    }
  }
  for (const dt of afterDates) {
    const hit = dayMap.get(dt)
    if (hit) {
      matchedDays += 1
      after3dSalesKwd += hit.netKwd * sliceShare
      after3dOrders += hit.orders * sliceShare
    }
  }

  const noData = !isConnected || matchedDays === 0

  before3dSalesKwd = Math.round(before3dSalesKwd * 10) / 10
  after3dSalesKwd = Math.round(after3dSalesKwd * 10) / 10
  before3dOrders = Math.max(0, Math.round(before3dOrders))
  after3dOrders = Math.max(0, Math.round(after3dOrders))

  const liftSalesKwd = noData ? 0 : Math.round((after3dSalesKwd - before3dSalesKwd) * 10) / 10
  const liftOrders = noData ? 0 : after3dOrders - before3dOrders
  const liftPct =
    !noData && before3dSalesKwd > 0
      ? Math.round(((after3dSalesKwd - before3dSalesKwd) / before3dSalesKwd) * 1000) / 10
      : 0

  // Use live GL COGS & posted commission ratios only if available; otherwise 0
  const monthAcc = isConnected ? liveSummary?.buckets?.month?.accounting : undefined
  const glIncome = safeNum(monthAcc?.income)
  const liveCogsRatio =
    glIncome > 0 && safeNum(monthAcc?.cogs) > 0 ? safeNum(monthAcc?.cogs) / glIncome : 0
  const liveCommRatio =
    !monthAcc?.aggregatorCommissionUnposted &&
    glIncome > 0 &&
    safeNum(monthAcc?.deliveryCommissions) > 0
      ? safeNum(monthAcc?.deliveryCommissions) / glIncome
      : 0

  const positiveLiftSales = Math.max(0, liftSalesKwd)
  const foodAndPackCostKwd = noData ? 0 : Math.round(positiveLiftSales * liveCogsRatio * 10) / 10
  const platformFeeKwd = noData ? 0 : Math.round(positiveLiftSales * liveCommRatio * 10) / 10
  const incrementalGrossProfitKwd = noData
    ? 0
    : Math.round((liftSalesKwd - foodAndPackCostKwd - platformFeeKwd) * 10) / 10
  const netProfitAfterAdKwd = noData
    ? 0
    : Math.round((incrementalGrossProfitKwd - campaign.spendKwd) * 10) / 10
  const roasMultiple =
    !noData && campaign.spendKwd > 0
      ? Math.max(0, Math.round((positiveLiftSales / campaign.spendKwd) * 10) / 10)
      : 0

  let verdict: AdVerdict = 'breakeven'
  let verdictAr = noData ? 'لا توجد بيانات من Odoo لهذه الفترة' : 'متعادل'
  let verdictEn = noData ? 'No Odoo data for this period' : 'Breakeven'

  if (!noData) {
    if (netProfitAfterAdKwd > 0) {
      verdict = 'winner'
      verdictAr = 'صافي موجب (تقدير)'
      verdictEn = 'Positive Net (Estimate)'
    } else if (netProfitAfterAdKwd < 0) {
      verdict = 'loser'
      verdictAr = 'صافي سالب (تقدير)'
      verdictEn = 'Negative Net (Estimate)'
    }
  }

  return {
    campaign,
    odooConnected: isConnected,
    noData,
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
