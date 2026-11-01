import type { LogisticsMode } from '@/modules/governance/domain/aggregator'

/** Compare aggregator-fleet vs Venture Foods own-fleet net order margin (fils). */
export type CommissionAuditInput = {
  orderGrossMinor: number
  aggregatorCommissionMinor: number
  aggregatorDeliveryFeeMinor: number
  fleetOperatingCostMinor: number
  fleetDeliveryFeeChargedMinor: number
  pageVisits: number
  ordersFromVisits: number
  currentRank: number
  targetRank: number
  logisticsMode: LogisticsMode
}

export type CommissionAuditResult = {
  platformNetMarginMinor: number
  fleetNetMarginMinor: number
  deltaMinor: number
  better: 'platform' | 'fleet' | 'tie'
  conversionBps: number
  rankTrackLabel: string
  logisticsMode: LogisticsMode
}

export function auditAggregatorSettlement(input: CommissionAuditInput): CommissionAuditResult {
  const platformNetMarginMinor = input.orderGrossMinor - input.aggregatorCommissionMinor - input.aggregatorDeliveryFeeMinor
  const fleetNetMarginMinor = input.orderGrossMinor - input.fleetOperatingCostMinor + input.fleetDeliveryFeeChargedMinor
  const deltaMinor = fleetNetMarginMinor - platformNetMarginMinor
  const better = deltaMinor > 0 ? 'fleet' : deltaMinor < 0 ? 'platform' : 'tie'
  const conversionBps =
    input.pageVisits <= 0 ? 0 : Math.round((input.ordersFromVisits * 10_000) / input.pageVisits)
  const rankTrackLabel = `#${input.currentRank} → Top ${Math.min(5, Math.max(1, input.targetRank))}`
  return {
    platformNetMarginMinor,
    fleetNetMarginMinor,
    deltaMinor,
    better,
    conversionBps,
    rankTrackLabel,
    logisticsMode: input.logisticsMode,
  }
}

/** Build auditor inputs from live snapshot averages when order rows are sparse. */
export function settlementFromSnapshot(row: {
  deliveryFeeMinor: number
  logisticsMode: LogisticsMode
  currentRank: number
  pageViews: number
  ordersCount: number
  avgTicketMinor: number
  commissionBps: number
}): CommissionAuditInput {
  const orderGrossMinor = Math.max(0, row.avgTicketMinor)
  const aggregatorCommissionMinor = Math.round((orderGrossMinor * row.commissionBps) / 10_000)
  const fleetOperatingCostMinor = Math.round(row.deliveryFeeMinor * 0.65)
  return {
    orderGrossMinor,
    aggregatorCommissionMinor,
    aggregatorDeliveryFeeMinor: row.deliveryFeeMinor,
    fleetOperatingCostMinor,
    fleetDeliveryFeeChargedMinor: Math.round(row.deliveryFeeMinor * 0.85),
    pageVisits: row.pageViews,
    ordersFromVisits: row.ordersCount,
    currentRank: row.currentRank,
    targetRank: 5,
    logisticsMode: row.logisticsMode,
  }
}
