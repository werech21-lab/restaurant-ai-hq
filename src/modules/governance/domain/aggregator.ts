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

const TICKET_MINOR = 8_000

function percentText(bps: number): string {
  return `${Math.floor(bps / 100)}.${String(bps % 100).padStart(2, '0')}`
}

export type BuriedObservation = {
  platformName: AggregatorPlatform
  geoZoneAr: string
  currentRank: number
  etaMinutes: number
  acceptanceSeconds: number
  prepMinutes: number
  cancellationBps: number
  logisticsMode: LogisticsMode
}

export type BuriedRescue = {
  penaltyAr: string
  targetRank: number
  estimatedRankJump: number
  estimatedDailyOrdersGain: number
  estimatedMonthlyRevenueUpliftMinor: number
  estimatedRevenueUpliftMinor: number
  penaltyDiagnosedAr: string
  stepByStepPlanAr: string
  logisticsSwitchAr: string
  ratingBoostTacticAr: string
  rootCauseAr: string
  recommendationAr: string
  actionType: EscalationActionType
}

/** Deterministic climb from a buried rank (39 and worse) to rank 5. The same inputs always return the same plan. */
export function buriedRankRescue(input: BuriedObservation): BuriedRescue | null {
  if (input.currentRank < 39 || input.currentRank > 50) return null
  const reasons: string[] = []
  if (input.etaMinutes > 40) reasons.push(`مدة التوصيل ${input.etaMinutes} دقيقة فوق حد 40 دقيقة`)
  if (input.acceptanceSeconds > 60) reasons.push(`قبول الطلب ${input.acceptanceSeconds} ثانية فوق حد 60 ثانية`)
  if (input.logisticsMode === 'vendor_own_fleet') reasons.push('التوصيل على أسطول الشركة بلا أولوية التطبيق')
  if (input.cancellationBps >= 800) reasons.push(`نسبة الإلغاء ${percentText(input.cancellationBps)} بالمئة`)
  if (reasons.length === 0) reasons.push('الترتيب خارج الصفحة الأولى')
  const penaltyAr = `الخوارزمية أبقت الفرع في المركز ${input.currentRank} لأن ${reasons.join('، و')}.`
  const targetRank = 5
  const jump = input.currentRank - targetRank
  const daily = Math.min(120, jump * 2)
  const monthly = daily * TICKET_MINOR * 30
  const platform = platformAr[input.platformName]
  const logisticsSwitchAr = input.logisticsMode === 'vendor_own_fleet'
    ? `حوّل ${input.geoZoneAr} على ${platform} من توصيل شركتنا إلى توصيل التطبيق، وثبّت مدة التوصيل عند 28 دقيقة ورسوم 0.500 د.ك.`
    : `أبقِ توصيل التطبيق في ${input.geoZoneAr} على ${platform}، واخفض مدة التوصيل إلى 28 دقيقة ورسوم 0.500 د.ك.`
  const stepByStepPlanAr = [
    `1. اخفض قبول الطلب من ${input.acceptanceSeconds} ثانية إلى 25 ثانية.`,
    `2. اخفض التحضير من ${input.prepMinutes} دقيقة إلى 12 دقيقة.`,
    `3. ${logisticsSwitchAr}`,
    `4. اخفض الإلغاء من ${percentText(input.cancellationBps)} بالمئة إلى أقل من 2.00 بالمئة.`,
    '5. فعّل بطاقة تقييم داخل الطلب حتى يرتفع التقييم وتزداد الزيارات.',
  ].join(' ')
  const ratingBoostTacticAr = `اطلب تقييماً بعد كل تسليم مكتمل في ${input.geoZoneAr}، وردّ على التقييمات المنخفضة خلال ساعة، حتى تقترب من سياسة المتصدرين.`
  const recommendationAr = `خطة التصعيد تنقل ${input.geoZoneAr} على ${platform} من المركز ${input.currentRank} إلى المركز ${targetRank}، بزيادة تقديرية ${daily} طلباً يومياً و${minorToInput(monthly)} د.ك شهرياً.`
  return {
    penaltyAr,
    targetRank,
    estimatedRankJump: jump,
    estimatedDailyOrdersGain: daily,
    estimatedMonthlyRevenueUpliftMinor: monthly,
    estimatedRevenueUpliftMinor: monthly,
    penaltyDiagnosedAr: penaltyAr,
    stepByStepPlanAr,
    logisticsSwitchAr,
    ratingBoostTacticAr,
    rootCauseAr: penaltyAr,
    recommendationAr,
    actionType: input.logisticsMode === 'vendor_own_fleet' ? 'switch_fleet_mode' : 'reduce_prep_eta',
  }
}

export function escalationTransition(status: EscalationStatus, action: 'execute' | 'complete'): EscalationStatus {
  if (action === 'execute' && status === 'pending') return 'approved_executing'
  if (action === 'complete' && status === 'approved_executing') return 'completed'
  throw new DomainError('invalid_transition', 'لا يمكن تنفيذ التصعيد من هذه الحالة.')
}
