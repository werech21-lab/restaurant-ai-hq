import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { versionConflict } from '@/lib/auth/require'
import { withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { recordMovementWithin } from '@/modules/admin'
import {
  aggregatorPlatforms,
  escalationStatuses,
  escalationTransition,
  fiveMinuteBucket,
  logisticsModes,
  buriedRankRescue,
  recommendEscalation,
  type AggregatorPlatform,
  type EscalationStatus,
  type LogisticsMode,
} from '@/modules/governance/domain/aggregator'
import type { CompetitorBench, EscalationCard, GeoRankSnapshot, VentureBrandRow } from '@/modules/governance/domain/types'
import { publishGovernanceEvents, type GovernanceEvent } from '@/modules/governance/events'
import * as repository from '@/modules/governance/repositories/aggregator-repository'
import type { AggregatorQuery, EscalationDecisionInput, ScanInput } from '@/modules/governance/schemas/aggregator'

function stamp(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

function asPlatform(value: string): AggregatorPlatform {
  const found = aggregatorPlatforms.find((item) => item === value)
  if (!found) throw new DomainError('invalid_transition', 'منصة التوصيل غير معروفة.')
  return found
}

function asLogistics(value: string): LogisticsMode {
  const found = logisticsModes.find((item) => item === value)
  if (!found) throw new DomainError('invalid_transition', 'وضع التوصيل غير معروف.')
  return found
}

function asStatus(value: string): EscalationStatus {
  const found = escalationStatuses.find((item) => item === value)
  if (!found) throw new DomainError('invalid_transition', 'حالة التصعيد غير معروفة.')
  return found
}

export type AggregatorBoard = {
  brands: VentureBrandRow[]
  snapshots: GeoRankSnapshot[]
  competitors: CompetitorBench[]
  actions: EscalationCard[]
}

export async function aggregatorBoard(auth: AuthContext, query: AggregatorQuery): Promise<AggregatorBoard> {
  return withTransaction(async (tx) => {
    const brands = await repository.listBrands(tx, auth.tenantId)
    const snapshots = await repository.listSnapshots(tx, auth.tenantId, query)
    const competitors = await repository.listCompetitors(tx, auth.tenantId, snapshots.map((row) => row.id))
    const actions = await repository.listActions(tx, auth.tenantId, query)
    return { brands, snapshots, competitors, actions }
  })
}

export async function scanAggregator(auth: AuthContext, key: string, input: ScanInput): Promise<IdempotentResult<{ data: { recorded: number; bucket: string } }>> {
  const events: GovernanceEvent[] = []
  const bucket = fiveMinuteBucket(Date.now())
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.aggregator.scan', key, requestHash: hashRequest({ ...input, bucket }) }, async () => {
      const existing = await repository.countBucket(tx, auth.tenantId, bucket)
      if (existing > 0) return { status: 200 as const, body: { data: { recorded: 0, bucket } } }
      const earlier = await repository.countEarlier(tx, auth.tenantId, bucket)
      if (earlier === 0) throw new AppError(422, 'nothing_to_scan', 'لا توجد أرصاد سابقة لنسخها إلى فترة الدقائق الخمس الحالية.')
      const recorded = await repository.rollForward(tx, auth.tenantId, auth.userId, bucket)
      const fresh = await repository.listBucket(tx, auth.tenantId, bucket)
      const competitors = await repository.listCompetitors(tx, auth.tenantId, fresh.map((row) => row.id))
      for (const row of fresh) {
        if (row.currentRank <= 3) continue
        if (await repository.hasOpenAction(tx, auth.tenantId, row.platformName, row.geoZoneAr, row.ourBranchName)) continue
        const leader = competitors.find((item) => item.snapshotId === row.id && item.competitorRank === 1)
        if (!leader) continue
        const observation = {
          platformName: asPlatform(row.platformName),
          geoZoneAr: row.geoZoneAr,
          ourBranchName: row.ourBranchName,
          currentRank: row.currentRank,
          etaMinutes: row.deliveryEtaMinutes,
          deliveryFeeMinor: row.deliveryFeeMinor,
          logisticsMode: asLogistics(row.logisticsMode),
          ratingBps: row.overallRatingBps,
          sponsored: row.isSponsoredAdActive,
        }
        const rescue = buriedRankRescue({
          platformName: observation.platformName,
          geoZoneAr: observation.geoZoneAr,
          currentRank: observation.currentRank,
          etaMinutes: observation.etaMinutes,
          acceptanceSeconds: row.avgOrderAcceptanceSeconds,
          prepMinutes: row.prepTimeMinutes,
          cancellationBps: row.cancellationRateBps,
          logisticsMode: observation.logisticsMode,
        })
        const advice = rescue ?? recommendEscalation(observation, {
          rank: leader.competitorRank,
          etaMinutes: leader.competitorEtaMinutes,
          deliveryFeeMinor: leader.competitorDeliveryFeeMinor,
          logisticsMode: asLogistics(leader.competitorLogisticsMode),
          ratingBps: leader.competitorRatingBps,
        })
        if (advice.estimatedRankJump < 1 || advice.targetRank > row.currentRank) continue
        await repository.insertAction(tx, auth.tenantId, auth.userId, {
          platformName: observation.platformName,
          geoZoneAr: observation.geoZoneAr,
          ourBrandName: row.ourBrandName,
          ourBranchName: observation.ourBranchName,
          currentRank: observation.currentRank,
          targetRank: advice.targetRank,
          rootCauseAr: advice.rootCauseAr,
          recommendationAr: advice.recommendationAr,
          actionType: advice.actionType,
          estimatedRankJump: advice.estimatedRankJump,
          estimatedRevenueUpliftMinor: rescue?.estimatedMonthlyRevenueUpliftMinor ?? advice.estimatedRevenueUpliftMinor,
          penaltyDiagnosedAr: rescue?.penaltyDiagnosedAr ?? '',
          stepByStepPlanAr: rescue?.stepByStepPlanAr ?? '',
          logisticsSwitchAr: rescue?.logisticsSwitchAr ?? '',
          ratingBoostTacticAr: rescue?.ratingBoostTacticAr ?? '',
          estimatedDailyOrdersGain: rescue?.estimatedDailyOrdersGain ?? 0,
          estimatedMonthlyRevenueUpliftMinor: rescue?.estimatedMonthlyRevenueUpliftMinor ?? 0,
        })
      }
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'aggregator_scan', entityId: auth.tenantId, action: 'create', before: null, after: { recorded, bucket } })
      await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'create', entityType: 'aggregator_scan', entityId: auth.tenantId, descriptionAr: `مسح ترتيب المنصات للفترة ${bucket}` })
      events.push({ ...stamp(auth), name: 'governance.aggregator.scanned', payload: { recorded, scannedBy: auth.userId } })
      return { status: 201 as const, body: { data: { recorded, bucket } } }
    }),
  )
  if (!outcome.replayed) await publishGovernanceEvents(events)
  return outcome
}

export async function actOnEscalation(auth: AuthContext, id: string, input: EscalationDecisionInput): Promise<{ data: EscalationCard }> {
  const events: GovernanceEvent[] = []
  const data = await withTransaction(async (tx) => {
    const before = await repository.findAction(tx, auth.tenantId, id)
    if (!before) throw new AppError(404, 'not_found', 'The escalation was not found.')
    if (before.version !== input.version) throw versionConflict('escalation')
    const status = escalationTransition(asStatus(before.status), input.action)
    const saved = await repository.saveAction(tx, auth.tenantId, id, input.version, status)
    if (!saved) throw versionConflict('escalation')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'aggregator_escalation', entityId: id, action: 'update', before, after: saved })
    await recordMovementWithin(tx, auth, { module: 'governance', actionType: input.action, entityType: 'aggregator_escalation', entityId: id, descriptionAr: `تصعيد ترتيب ${saved.ourBranchName}`, amountMinor: saved.estimatedRevenueUpliftMinor })
    if (input.action === 'execute') {
      events.push({ ...stamp(auth), name: 'governance.aggregator.escalated', payload: { actionId: id, targetRank: saved.targetRank, decidedBy: auth.userId } })
    }
    return saved
  })
  await publishGovernanceEvents(events)
  return { data }
}
