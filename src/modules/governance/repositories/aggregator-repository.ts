import type { Queryable } from '@/lib/db'
import type { AggregatorPlatform, EscalationActionType, RankGap } from '@/modules/governance/domain/aggregator'
import type { CompetitorBench, EscalationCard, GeoRankSnapshot, VentureBrandRow } from '@/modules/governance/domain/types'
import type { AggregatorQuery } from '@/modules/governance/schemas/aggregator'

function whole(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asGap(value: unknown): RankGap {
  const source: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return { rankGap: 0, etaGapMinutes: 0, feeGapMinor: 0, ratingGapBps: 0 }
  }
  const row = source as Record<string, unknown>
  return {
    rankGap: whole(row.rankGap),
    etaGapMinutes: whole(row.etaGapMinutes),
    feeGapMinor: whole(row.feeGapMinor),
    ratingGapBps: whole(row.ratingGapBps),
  }
}

const SNAPSHOT = `id, to_char(snapshot_interval_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "snapshotIntervalTime",
  platform_name as "platformName", geo_zone_ar as "geoZoneAr", our_brand_name as "ourBrandName", our_branch_name as "ourBranchName",
  current_rank as "currentRank", previous_rank_5m_ago as "previousRank5mAgo", rank_delta as "rankDelta",
  overall_rating_bps as "overallRatingBps", reviews_count as "reviewsCount",
  estimated_visits_impressions as "estimatedVisitsImpressions", conversion_rate_bps as "conversionRateBps",
  avg_order_acceptance_seconds as "avgOrderAcceptanceSeconds", prep_time_minutes as "prepTimeMinutes",
  cancellation_rate_bps as "cancellationRateBps", algorithm_penalty_reason_ar as "algorithmPenaltyReasonAr",
  delivery_eta_minutes as "deliveryEtaMinutes", delivery_fee_minor as "deliveryFeeMinor", min_order_minor as "minOrderMinor",
  logistics_mode as "logisticsMode", is_sponsored_ad_active as "isSponsoredAdActive",
  to_char(recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "recordedAt", version`

function snapshot(row: GeoRankSnapshot): GeoRankSnapshot {
  return {
    ...row,
    currentRank: whole(row.currentRank),
    previousRank5mAgo: whole(row.previousRank5mAgo),
    rankDelta: whole(row.rankDelta),
    overallRatingBps: whole(row.overallRatingBps),
    reviewsCount: whole(row.reviewsCount),
    estimatedVisitsImpressions: whole(row.estimatedVisitsImpressions),
    conversionRateBps: whole(row.conversionRateBps),
    avgOrderAcceptanceSeconds: whole(row.avgOrderAcceptanceSeconds),
    prepTimeMinutes: whole(row.prepTimeMinutes),
    cancellationRateBps: whole(row.cancellationRateBps),
    deliveryEtaMinutes: whole(row.deliveryEtaMinutes),
    deliveryFeeMinor: whole(row.deliveryFeeMinor),
    minOrderMinor: whole(row.minOrderMinor),
    version: whole(row.version),
  }
}

const BENCH = `id, snapshot_id as "snapshotId", platform_name as "platformName", geo_zone_ar as "geoZoneAr",
  competitor_rank as "competitorRank", competitor_brand_name as "competitorBrandName",
  competitor_rating_bps as "competitorRatingBps", competitor_reviews_count as "competitorReviewsCount",
  competitor_visits_estimate as "competitorVisitsEstimate", competitor_eta_minutes as "competitorEtaMinutes",
  competitor_delivery_fee_minor as "competitorDeliveryFeeMinor", competitor_logistics_mode as "competitorLogisticsMode",
  competitor_conversion_bps as "competitorConversionBps",
  active_promo_badge_ar as "activePromoBadgeAr", detected_rating_boost_policy_ar as "detectedRatingBoostPolicyAr",
  exact_gap_analysis_ar as "exactGapAnalysisAr",
  gap_vs_our_brand_json as gap`

type BenchRow = Omit<CompetitorBench, 'gap' | 'competitorRank' | 'competitorRatingBps' | 'competitorReviewsCount' | 'competitorVisitsEstimate' | 'competitorEtaMinutes' | 'competitorDeliveryFeeMinor'> & {
  competitorRank: number
  competitorRatingBps: number
  competitorReviewsCount: number
  competitorVisitsEstimate: number
  competitorEtaMinutes: number
  competitorDeliveryFeeMinor: number
  gap: unknown
}

function bench(row: BenchRow): CompetitorBench {
  return {
    ...row,
    competitorRank: whole(row.competitorRank),
    competitorRatingBps: whole(row.competitorRatingBps),
    competitorReviewsCount: whole(row.competitorReviewsCount),
    competitorVisitsEstimate: whole(row.competitorVisitsEstimate),
    competitorEtaMinutes: whole(row.competitorEtaMinutes),
    competitorDeliveryFeeMinor: whole(row.competitorDeliveryFeeMinor),
    competitorConversionBps: whole(row.competitorConversionBps),
    gap: asGap(row.gap),
  }
}

const ACTION = `id, platform_name as "platformName", geo_zone_ar as "geoZoneAr", our_brand_name as "ourBrandName", our_branch_name as "ourBranchName",
  current_rank as "currentRank", target_rank as "targetRank", root_cause_of_lower_rank_ar as "rootCauseAr",
  algorithmic_recommendation_ar as "recommendationAr", recommended_action_type as "actionType",
  estimated_rank_jump as "estimatedRankJump", estimated_revenue_uplift_minor as "estimatedRevenueUpliftMinor",
  penalty_diagnosed_ar as "penaltyDiagnosedAr", step_by_step_escalation_plan_ar as "stepByStepPlanAr",
  logistics_switch_recommendation_ar as "logisticsSwitchAr", rating_boost_tactic_ar as "ratingBoostTacticAr",
  estimated_daily_orders_gain as "estimatedDailyOrdersGain",
  estimated_monthly_revenue_uplift_minor as "estimatedMonthlyRevenueUpliftMinor",
  status, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt", version`

function action(row: EscalationCard): EscalationCard {
  return {
    ...row,
    currentRank: whole(row.currentRank),
    targetRank: whole(row.targetRank),
    estimatedRankJump: whole(row.estimatedRankJump),
    estimatedRevenueUpliftMinor: whole(row.estimatedRevenueUpliftMinor),
    estimatedDailyOrdersGain: whole(row.estimatedDailyOrdersGain),
    estimatedMonthlyRevenueUpliftMinor: whole(row.estimatedMonthlyRevenueUpliftMinor),
    version: whole(row.version),
  }
}

export async function listBrands(tx: Queryable, tenantId: string): Promise<VentureBrandRow[]> {
  const result = await tx.query<VentureBrandRow>(
    `select code, name_en as "nameEn", name_ar as "nameAr", cuisine_category_ar as "cuisineCategoryAr",
            active_branches_count as "activeBranchesCount"
     from venture_brands
     where tenant_id = $1
     order by sort_order, code`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, activeBranchesCount: whole(row.activeBranchesCount) }))
}

export async function listSnapshots(tx: Queryable, tenantId: string, query: AggregatorQuery): Promise<GeoRankSnapshot[]> {
  const result = await tx.query<GeoRankSnapshot>(
    `select ${SNAPSHOT} from aggregator_geo_rank_snapshots
     where tenant_id = $1
       and snapshot_interval_time = (select max(latest.snapshot_interval_time) from aggregator_geo_rank_snapshots latest where latest.tenant_id = $1)
       and ($2::text is null or platform_name = $2)
       and ($3::text is null or geo_zone_ar = $3)
       and ($4::text is null or our_branch_name = $4 or our_brand_name = $4)
     order by current_rank desc, platform_name, geo_zone_ar
     limit 240`,
    [tenantId, query.platform ?? null, query.zone ?? null, query.branch ?? null],
  )
  return result.rows.map(snapshot)
}

export async function listCompetitors(tx: Queryable, tenantId: string, snapshotIds: readonly string[]): Promise<CompetitorBench[]> {
  if (snapshotIds.length === 0) return []
  const result = await tx.query<BenchRow>(
    `select ${BENCH} from aggregator_top_competitors_bench
     where tenant_id = $1 and snapshot_id = any($2::uuid[])
     order by competitor_rank`,
    [tenantId, snapshotIds],
  )
  return result.rows.map(bench)
}

export async function listActions(tx: Queryable, tenantId: string, query: AggregatorQuery): Promise<EscalationCard[]> {
  const result = await tx.query<EscalationCard>(
    `select ${ACTION} from aggregator_rank_escalation_actions
     where tenant_id = $1
       and ($2::text is null or platform_name = $2)
       and ($3::text is null or geo_zone_ar = $3)
       and ($4::text is null or our_branch_name = $4 or our_brand_name = $4)
     order by current_rank desc, created_at desc
     limit 240`,
    [tenantId, query.platform ?? null, query.zone ?? null, query.branch ?? null],
  )
  return result.rows.map(action)
}

export async function listBucket(tx: Queryable, tenantId: string, bucketIso: string): Promise<GeoRankSnapshot[]> {
  const result = await tx.query<GeoRankSnapshot>(
    `select ${SNAPSHOT} from aggregator_geo_rank_snapshots
     where tenant_id = $1 and snapshot_interval_time = $2::timestamptz
     order by platform_name, geo_zone_ar`,
    [tenantId, bucketIso],
  )
  return result.rows.map(snapshot)
}

export async function countBucket(tx: Queryable, tenantId: string, bucketIso: string): Promise<number> {
  const result = await tx.query<{ count: number }>(
    `select count(*)::int as count from aggregator_geo_rank_snapshots where tenant_id = $1 and snapshot_interval_time = $2::timestamptz`,
    [tenantId, bucketIso],
  )
  return whole(result.rows[0]?.count)
}

export async function countEarlier(tx: Queryable, tenantId: string, bucketIso: string): Promise<number> {
  const result = await tx.query<{ count: number }>(
    `select count(*)::int as count from aggregator_geo_rank_snapshots where tenant_id = $1 and snapshot_interval_time < $2::timestamptz`,
    [tenantId, bucketIso],
  )
  return whole(result.rows[0]?.count)
}

export async function rollForward(tx: Queryable, tenantId: string, actorId: string, bucketIso: string): Promise<number> {
  const inserted = await tx.query<{ id: string }>(
    `insert into aggregator_geo_rank_snapshots (
      tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
      current_rank, previous_rank_5m_ago, rank_delta, overall_rating_bps, reviews_count,
      estimated_visits_impressions, conversion_rate_bps, avg_order_acceptance_seconds, prep_time_minutes,
      cancellation_rate_bps, algorithm_penalty_reason_ar, delivery_eta_minutes, delivery_fee_minor,
      min_order_minor, logistics_mode, is_sponsored_ad_active, recorded_at, created_by
    )
    select tenant_id, $2::timestamptz, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
      current_rank, current_rank, 0, overall_rating_bps, reviews_count, estimated_visits_impressions,
      conversion_rate_bps, avg_order_acceptance_seconds, prep_time_minutes, cancellation_rate_bps,
      algorithm_penalty_reason_ar, delivery_eta_minutes, delivery_fee_minor, min_order_minor, logistics_mode,
      is_sponsored_ad_active, now(), $3
    from (
      select distinct on (platform_name, geo_zone_ar, our_branch_name) *
      from aggregator_geo_rank_snapshots
      where tenant_id = $1 and snapshot_interval_time < $2::timestamptz
      order by platform_name, geo_zone_ar, our_branch_name, snapshot_interval_time desc
    ) latest
    returning id`,
    [tenantId, bucketIso, actorId],
  )
  await tx.query(
    `insert into aggregator_top_competitors_bench (
      tenant_id, snapshot_id, platform_name, geo_zone_ar, competitor_rank, competitor_brand_name,
      competitor_rating_bps, competitor_reviews_count, competitor_visits_estimate, competitor_eta_minutes,
      competitor_delivery_fee_minor, competitor_logistics_mode, competitor_conversion_bps, active_promo_badge_ar,
      detected_rating_boost_policy_ar, exact_gap_analysis_ar, gap_vs_our_brand_json, created_by
    )
    select n.tenant_id, n.id, n.platform_name, n.geo_zone_ar, c.competitor_rank, c.competitor_brand_name,
      c.competitor_rating_bps, c.competitor_reviews_count, c.competitor_visits_estimate, c.competitor_eta_minutes,
      c.competitor_delivery_fee_minor, c.competitor_logistics_mode, c.competitor_conversion_bps, c.active_promo_badge_ar,
      c.detected_rating_boost_policy_ar, c.exact_gap_analysis_ar, c.gap_vs_our_brand_json, $3
    from aggregator_geo_rank_snapshots n
    join aggregator_geo_rank_snapshots o
      on o.tenant_id = n.tenant_id and o.platform_name = n.platform_name
      and o.geo_zone_ar = n.geo_zone_ar and o.our_branch_name = n.our_branch_name
      and o.snapshot_interval_time < n.snapshot_interval_time
    join aggregator_top_competitors_bench c on c.tenant_id = o.tenant_id and c.snapshot_id = o.id
    where n.tenant_id = $1 and n.snapshot_interval_time = $2::timestamptz
      and o.snapshot_interval_time = (
        select max(p.snapshot_interval_time) from aggregator_geo_rank_snapshots p
        where p.tenant_id = o.tenant_id and p.platform_name = o.platform_name
          and p.geo_zone_ar = o.geo_zone_ar and p.our_branch_name = o.our_branch_name
          and p.snapshot_interval_time < $2::timestamptz
      )`,
    [tenantId, bucketIso, actorId],
  )
  return inserted.rows.length
}

export async function hasOpenAction(tx: Queryable, tenantId: string, platform: string, zone: string, branch: string): Promise<boolean> {
  const result = await tx.query<{ id: string }>(
    `select id from aggregator_rank_escalation_actions
     where tenant_id = $1 and platform_name = $2 and geo_zone_ar = $3 and our_branch_name = $4
       and status in ('pending', 'approved_executing')
     limit 1`,
    [tenantId, platform, zone, branch],
  )
  return Boolean(result.rows[0])
}

export async function insertAction(
  tx: Queryable,
  tenantId: string,
  actorId: string,
  input: {
    platformName: AggregatorPlatform
    geoZoneAr: string
    ourBrandName: string
    ourBranchName: string
    currentRank: number
    targetRank: number
    rootCauseAr: string
    recommendationAr: string
    actionType: EscalationActionType
    estimatedRankJump: number
    estimatedRevenueUpliftMinor: number
    penaltyDiagnosedAr: string
    stepByStepPlanAr: string
    logisticsSwitchAr: string
    ratingBoostTacticAr: string
    estimatedDailyOrdersGain: number
    estimatedMonthlyRevenueUpliftMinor: number
  },
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into aggregator_rank_escalation_actions (
      tenant_id, platform_name, geo_zone_ar, our_brand_name, our_branch_name, current_rank, target_rank,
      root_cause_of_lower_rank_ar, algorithmic_recommendation_ar, recommended_action_type,
      estimated_rank_jump, estimated_revenue_uplift_minor, penalty_diagnosed_ar, step_by_step_escalation_plan_ar,
      logistics_switch_recommendation_ar, rating_boost_tactic_ar, estimated_daily_orders_gain,
      estimated_monthly_revenue_uplift_minor, created_by
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
    [
      tenantId, input.platformName, input.geoZoneAr, input.ourBrandName, input.ourBranchName, input.currentRank, input.targetRank,
      input.rootCauseAr, input.recommendationAr, input.actionType, input.estimatedRankJump, input.estimatedRevenueUpliftMinor,
      input.penaltyDiagnosedAr, input.stepByStepPlanAr, input.logisticsSwitchAr, input.ratingBoostTacticAr,
      input.estimatedDailyOrdersGain, input.estimatedMonthlyRevenueUpliftMinor, actorId,
    ],
  )
  return result.rows[0].id
}

export async function findAction(tx: Queryable, tenantId: string, id: string): Promise<EscalationCard | null> {
  const result = await tx.query<EscalationCard>(
    `select ${ACTION} from aggregator_rank_escalation_actions where tenant_id = $1 and id = $2 for update`,
    [tenantId, id],
  )
  return result.rows[0] ? action(result.rows[0]) : null
}

export async function saveAction(tx: Queryable, tenantId: string, id: string, version: number, status: string): Promise<EscalationCard | null> {
  const result = await tx.query<EscalationCard>(
    `update aggregator_rank_escalation_actions set status = $3, version = version + 1
     where tenant_id = $1 and id = $2 and version = $4
     returning ${ACTION}`,
    [tenantId, id, status, version],
  )
  return result.rows[0] ? action(result.rows[0]) : null
}
