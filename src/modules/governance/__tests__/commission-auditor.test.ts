import { describe, expect, it } from 'vitest'
import { auditAggregatorSettlement, settlementFromSnapshot } from '@/modules/governance/domain/commission-auditor'

describe('aggregator settlement auditor', () => {
  it('prefers Venture Foods fleet when own-fleet margin is higher', () => {
    const result = auditAggregatorSettlement({
      orderGrossMinor: 5_000,
      aggregatorCommissionMinor: 1_250,
      aggregatorDeliveryFeeMinor: 750,
      fleetOperatingCostMinor: 600,
      fleetDeliveryFeeChargedMinor: 500,
      pageVisits: 1000,
      ordersFromVisits: 45,
      currentRank: 45,
      targetRank: 5,
      logisticsMode: 'vendor_own_fleet',
    })
    expect(result.platformNetMarginMinor).toBe(3_000)
    expect(result.fleetNetMarginMinor).toBe(4_900)
    expect(result.better).toBe('fleet')
    expect(result.conversionBps).toBe(450)
    expect(result.rankTrackLabel).toBe('#45 → Top 5')
  })

  it('builds deterministic inputs from a geo-rank snapshot', () => {
    const input = settlementFromSnapshot({
      deliveryFeeMinor: 1000,
      logisticsMode: 'platform_fleet',
      currentRank: 12,
      pageViews: 200,
      ordersCount: 10,
      avgTicketMinor: 8000,
      commissionBps: 2500,
    })
    expect(input.aggregatorCommissionMinor).toBe(2000)
    expect(auditAggregatorSettlement(input).better).toMatch(/platform|fleet|tie/)
  })
})
