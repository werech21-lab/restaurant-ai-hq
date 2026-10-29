import { describe, expect, it } from 'vitest'
import { DomainError } from '@/lib/domain-error'
import {
  assertLogistics,
  escalationTransition,
  fiveMinuteBucket,
  gapVsOurs,
  logisticsLabel,
  rankDelta,
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
    expect(logisticsLabel('vendor_own_fleet').ar).toBe('توصيل شركتنا')
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

  it('approves a pending escalation and refuses a completed one', () => {
    expect(escalationTransition('pending', 'execute')).toBe('approved_executing')
    expect(escalationTransition('approved_executing', 'complete')).toBe('completed')
    expect(() => escalationTransition('completed', 'execute')).toThrow(DomainError)
    expect(() => escalationTransition('pending', 'complete')).toThrow(DomainError)
  })
})
