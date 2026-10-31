import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import {
  assertLogistics,
  escalationTransition,
  fiveMinuteBucket,
  gapVsOurs,
  logisticsLabel,
  rankDelta,
  buriedRankRescue,
  recommendEscalation,
} from '@/modules/governance/domain/aggregator'

const keeta = {
  platformName: 'Keeta' as const,
  geoZoneAr: 'السالمية',
  ourBranchName: 'أثير السالمية',
  currentRank: 8,
  etaMinutes: 28,
  deliveryFeeMinor: 750,
  logisticsMode: 'vendor_own_fleet' as const,
  ratingBps: 420,
  sponsored: false,
}

const leader = {
  rank: 1,
  etaMinutes: 22,
  deliveryFeeMinor: 0,
  logisticsMode: 'platform_fleet' as const,
  ratingBps: 470,
}

describe('aggregator rank engine', () => {
  it('floors a timestamp to a five-minute bucket and signs the rank change', () => {
    expect(fiveMinuteBucket(1_700_000_061_000)).toBe(new Date(Math.floor(1_700_000_061_000 / 300_000) * 300_000).toISOString())
    expect(rankDelta(9, 8)).toBe(1)
    expect(rankDelta(5, 8)).toBe(-3)
  })

  it('classifies platform fleet and our fleet', () => {
    expect(assertLogistics('platform_fleet')).toBe('platform_fleet')
    expect(assertLogistics('vendor_own_fleet')).toBe('vendor_own_fleet')
    expect(logisticsLabel('platform_fleet').ar).toBe('توصيل التطبيق')
    expect(logisticsLabel('vendor_own_fleet').ar).toBe('توصيل شركتنا Venture Foods')
    expect(() => assertLogistics('courier')).toThrow(DomainError)
  })

  it('measures the top-rank gap and recommends the Keeta climb', () => {
    expect(gapVsOurs(keeta, { competitorRank: 1, etaMinutes: 22, deliveryFeeMinor: 0, ratingBps: 470 })).toEqual({
      rankGap: 7,
      etaGapMinutes: 6,
      feeGapMinor: 750,
      ratingGapBps: 50,
    })
    const advice = recommendEscalation(keeta, leader)
    expect(advice.actionType).toBe('switch_fleet_mode')
    expect(advice.targetRank).toBe(2)
    expect(advice.estimatedRankJump).toBe(6)
    expect(advice.estimatedRevenueUpliftMinor).toBe(450_000)
    expect(advice.recommendationAr).toContain('السالمية')
    expect(advice.recommendationAr).toContain('450.000')
    expect(advice.recommendationAr).toContain('#8')
    expect(advice.recommendationAr).toContain('#2')
  })

  it('diagnoses a buried rank and plans the climb to the top five', () => {
    const plan = buriedRankRescue({
      platformName: 'Talabat',
      geoZoneAr: 'السالمية',
      currentRank: 46,
      etaMinutes: 47,
      acceptanceSeconds: 95,
      prepMinutes: 28,
      cancellationBps: 900,
      logisticsMode: 'vendor_own_fleet',
    })
    expect(plan?.targetRank).toBe(5)
    expect(plan?.estimatedRankJump).toBe(41)
    expect(plan?.estimatedDailyOrdersGain).toBe(82)
    expect(plan?.estimatedMonthlyRevenueUpliftMinor).toBe(19_680_000)
    expect(plan?.actionType).toBe('switch_fleet_mode')
    expect(plan?.penaltyAr).toContain('47')
    expect(plan?.penaltyAr).toContain('95')
    expect(plan?.penaltyAr).toContain('أسطول الشركة')
    expect(plan?.recommendationAr).toContain('19680.000')
    expect(plan?.stepByStepPlanAr).toContain('توصيل التطبيق')
    const buried = buriedRankRescue({
      platformName: 'Snoonu',
      geoZoneAr: 'العارضية',
      currentRank: 52,
      etaMinutes: 50,
      acceptanceSeconds: 100,
      prepMinutes: 30,
      cancellationBps: 1000,
      logisticsMode: 'vendor_own_fleet',
    })
    expect(buried?.targetRank).toBe(5)
    expect(buried?.estimatedRankJump).toBe(47)
    expect(buried?.estimatedDailyOrdersGain).toBe(94)
    expect(buried?.estimatedMonthlyRevenueUpliftMinor).toBe(22_560_000)
    expect(buriedRankRescue({
      platformName: 'Keeta',
      geoZoneAr: 'السالمية',
      currentRank: 8,
      etaMinutes: 28,
      acceptanceSeconds: 20,
      prepMinutes: 12,
      cancellationBps: 100,
      logisticsMode: 'vendor_own_fleet',
    })).toBeNull()
  })

  it('approves a pending escalation and refuses a completed one', () => {
    expect(escalationTransition('pending', 'execute')).toBe('approved_executing')
    expect(escalationTransition('approved_executing', 'complete')).toBe('completed')
    expect(() => escalationTransition('completed', 'execute')).toThrow(DomainError)
    expect(() => escalationTransition('pending', 'complete')).toThrow(DomainError)
  })
})
