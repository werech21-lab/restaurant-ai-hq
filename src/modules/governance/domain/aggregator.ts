import { DomainError } from '@/lib/domain-error'
import { minorToInput } from '@/lib/money'

/** Entered aggregator observations. The same inputs always produce the same rank advice. */

export const aggregatorPlatforms = ['Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo'] as const
export type AggregatorPlatform = (typeof aggregatorPlatforms)[number]

export const aggregatorZones = ['السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء'] as const
export type AggregatorZone = (typeof aggregatorZones)[number]

export const logisticsModes = ['platform_fleet', 'vendor_own_fleet'] as const
export type LogisticsMode = (typeof logisticsModes)[number]

export const escalationActions = ['switch_fleet_mode', 'subsidize_delivery_fee', 'reduce_prep_eta', 'activate_rating_booster', 'bid_sponsored_slot'] as const
export type EscalationActionType = (typeof escalationActions)[number]

export const escalationStatuses = ['pending', 'approved_executing', 'completed'] as const
export type EscalationStatus = (typeof escalationStatuses)[number]

const platformAr: Record<AggregatorPlatform, string> = {
  Talabat: 'طلبات',
  Keeta: 'كيتا',
  Jahez: 'جاهز',
  Snoonu: 'سنونو',
  Deliveroo: 'ديليفرو',
}

export type RankObservation = {
  platformName: AggregatorPlatform
  geoZoneAr: string
  ourBranchName: string
  currentRank: number
  etaMinutes: number
  deliveryFeeMinor: number
  logisticsMode: LogisticsMode
  ratingBps: number
  sponsored: boolean
}

export type RankLeader = {
  rank: number
  etaMinutes: number
  deliveryFeeMinor: number
  logisticsMode: LogisticsMode
  ratingBps: number
}

export type RankGap = {
  rankGap: number
  etaGapMinutes: number
  feeGapMinor: number
  ratingGapBps: number
}

export type RankRecommendation = {
  actionType: EscalationActionType
  targetRank: number
  estimatedRankJump: number
  estimatedRevenueUpliftMinor: number
  rootCauseAr: string
  recommendationAr: string
}

const UPLIFT_PER_ETA_MINUTE_MINOR = 75_000

export function fiveMinuteBucket(epochMs: number): string {
  const bucket = Math.floor(epochMs / 300_000) * 300_000
  return new Date(bucket).toISOString()
}

/** Positive means the rank number fell, which is a climb. */
export function rankDelta(previousRank: number, currentRank: number): number {
  return previousRank - currentRank
}

export function assertLogistics(value: string): LogisticsMode {
  if (value === 'platform_fleet' || value === 'vendor_own_fleet') return value
  throw new DomainError('invalid_transition', 'وضع التوصيل غير معروف.')
}

export function logisticsLabel(mode: LogisticsMode): { ar: string; en: string } {
  if (mode === 'platform_fleet') return { ar: 'توصيل التطبيق', en: 'Platform fleet' }
  return { ar: 'توصيل شركتنا', en: 'Our fleet' }
}

export function gapVsOurs(
  ours: { currentRank: number; etaMinutes: number; deliveryFeeMinor: number; ratingBps: number },
  competitor: { competitorRank: number; etaMinutes: number; deliveryFeeMinor: number; ratingBps: number },
): RankGap {
  return {
    rankGap: ours.currentRank - competitor.competitorRank,
    etaGapMinutes: ours.etaMinutes - competitor.etaMinutes,
    feeGapMinor: ours.deliveryFeeMinor - competitor.deliveryFeeMinor,
    ratingGapBps: competitor.ratingBps - ours.ratingBps,
  }
}

function climb(currentRank: number, steps: number): { targetRank: number; jump: number } {
  const jump = Math.max(0, Math.min(steps, currentRank - 1))
  return { targetRank: currentRank - jump, jump }
}

export function recommendEscalation(ours: RankObservation, leader: RankLeader): RankRecommendation {
  const etaGap = ours.etaMinutes - leader.etaMinutes
  const feeGap = ours.deliveryFeeMinor - leader.deliveryFeeMinor
  const ratingGap = leader.ratingBps - ours.ratingBps
  const platform = platformAr[ours.platformName]
  const place = `${ours.geoZoneAr} على ${platform}`

  if (ours.logisticsMode === 'vendor_own_fleet' && leader.logisticsMode === 'platform_fleet' && etaGap >= 6) {
    const moved = climb(ours.currentRank, etaGap)
    const uplift = etaGap * UPLIFT_PER_ETA_MINUTE_MINOR
    return {
      actionType: 'switch_fleet_mode',
      targetRank: moved.targetRank,
      estimatedRankJump: moved.jump,
      estimatedRevenueUpliftMinor: uplift,
      rootCauseAr: `الترتيب متأخر لأن التوصيل على أسطول الشركة ووقت التحضير أطول من المتصدر بـ ${etaGap} دقائق.`,
      recommendationAr: `تحويل التوصيل في منطقة ${place} من أسطول الشركة إلى أسطول التطبيق وتخفيض وقت التحضير ${etaGap} دقائق سيرفع ترتيبك من #${ours.currentRank} إلى #${moved.targetRank} ويزيد المبيعات بـ ${minorToInput(uplift)} د.ك`,
    }
  }

  if (feeGap > 0) {
    const moved = climb(ours.currentRank, 2)
    return {
      actionType: 'subsidize_delivery_fee',
      targetRank: moved.targetRank,
      estimatedRankJump: moved.jump,
      estimatedRevenueUpliftMinor: feeGap * 20,
      rootCauseAr: `رسوم التوصيل أعلى من المتصدر بمقدار ${minorToInput(feeGap)} د.ك.`,
      recommendationAr: `تخفيض رسوم التوصيل في ${place} بمقدار ${minorToInput(feeGap)} د.ك يقرب الترتيب من #${ours.currentRank} إلى #${moved.targetRank}.`,
    }
  }

  if (ratingGap >= 20) {
    const moved = climb(ours.currentRank, 1)
    return {
      actionType: 'activate_rating_booster',
      targetRank: moved.targetRank,
      estimatedRankJump: moved.jump,
      estimatedRevenueUpliftMinor: ratingGap * 1_000,
      rootCauseAr: `التقييم أقل من المتصدر بـ ${Math.floor(ratingGap / 100)}.${String(ratingGap % 100).padStart(2, '0')} نقطة.`,
      recommendationAr: `تفعيل سياسة رفع التقييم في ${place} (بطاقة داخل الطلب وطلب تقييم بعد التسليم) يستهدف الترتيب #${moved.targetRank}.`,
    }
  }

  if (!ours.sponsored && ours.currentRank > 3) {
    const moved = climb(ours.currentRank, 2)
    return {
      actionType: 'bid_sponsored_slot',
      targetRank: moved.targetRank,
      estimatedRankJump: moved.jump,
      estimatedRevenueUpliftMinor: 150_000,
      rootCauseAr: 'لا يوجد إعلان مدعوم بينما الترتيب خارج المراكز الثلاثة.',
      recommendationAr: `شراء خانة مدعومة في ${place} يستهدف نقل الترتيب من #${ours.currentRank} إلى #${moved.targetRank}.`,
    }
  }

  const moved = climb(ours.currentRank, Math.max(1, etaGap))
  return {
    actionType: 'reduce_prep_eta',
    targetRank: moved.targetRank,
    estimatedRankJump: moved.jump,
    estimatedRevenueUpliftMinor: Math.max(0, etaGap) * 25_000,
    rootCauseAr: `وقت التحضير أطول من المتصدر بـ ${Math.max(0, etaGap)} دقائق.`,
    recommendationAr: `تخفيض وقت التحضير في ${place} يستهدف الترتيب #${moved.targetRank}.`,
  }
}

export function escalationTransition(status: EscalationStatus, action: 'execute' | 'complete'): EscalationStatus {
  if (action === 'execute' && status === 'pending') return 'approved_executing'
  if (action === 'complete' && status === 'approved_executing') return 'completed'
  throw new DomainError('invalid_transition', 'لا يمكن تنفيذ التصعيد من هذه الحالة.')
}
