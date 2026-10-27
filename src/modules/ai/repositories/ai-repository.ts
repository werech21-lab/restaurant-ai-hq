import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage, type SortColumn } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type {
  ActionType,
  Approval,
  AutomationRule,
  ExecutionResult,
  Insight,
  InsightDraft,
  InsightSeverity,
  InsightStatus,
  ProposalDraft,
  RuleKey,
} from '@/modules/ai/domain/types'
import type {
  ApprovalSortKey,
  InsightSortKey,
  ListApprovalsQuery,
  ListInsightsQuery,
} from '@/modules/ai/schemas/ai'

type InsightRow = Omit<Insight, 'detectedAt' | 'resolvedAt' | 'createdAt' | 'updatedAt'> & {
  detectedAt: Date
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
type ApprovalRow = Omit<Approval, 'requestedByAiAt' | 'decidedAt' | 'createdAt' | 'updatedAt'> & {
  requestedByAiAt: Date
  decidedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
type RuleRow = Omit<AutomationRule, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }

const INSIGHT_COLUMNS = `id, rule_key as "ruleKey", fingerprint, severity, category, title_ar as "titleAr",
  description_ar as "descriptionAr", metric_value as "metricValue", metric_unit as "metricUnit", status,
  source_entity_type as "sourceEntityType", source_entity_id as "sourceEntityId", detected_at as "detectedAt",
  resolved_at as "resolvedAt", version, created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

const APPROVAL_COLUMNS = `id, insight_id as "insightId", rule_key as "ruleKey", fingerprint, action_type as "actionType",
  title_ar as "titleAr", summary_ar as "summaryAr", payload_json as "payloadJson",
  estimated_impact_fils as "estimatedImpactFils", status, requested_by_ai_at as "requestedByAiAt",
  decided_by as "decidedBy", decided_at as "decidedAt", decision_note as "decisionNote", result_json as "resultJson",
  version, created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy"`

const RULE_COLUMNS = `id, rule_key as "ruleKey", name, description_ar as "descriptionAr", trigger_event as "triggerEvent",
  condition_json as "conditionJson", action_type as "actionType", is_active as "isActive", version,
  created_at as "createdAt", updated_at as "updatedAt"`

const insightSortColumns: Record<InsightSortKey, SortColumn> = {
  detectedAt: { sql: 'detected_at', cast: 'timestamptz' },
  metricValue: { sql: 'metric_value', cast: 'bigint' },
}

const approvalSortColumns: Record<ApprovalSortKey, SortColumn> = {
  requestedAt: { sql: 'requested_by_ai_at', cast: 'timestamptz' },
  impact: { sql: 'estimated_impact_fils', cast: 'bigint' },
}

function toInsight(row: InsightRow): Insight {
  return {
    ...row,
    detectedAt: row.detectedAt.toISOString(),
    resolvedAt: row.resolvedAt === null ? null : row.resolvedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toApproval(row: ApprovalRow): Approval {
  return {
    ...row,
    requestedByAiAt: row.requestedByAiAt.toISOString(),
    decidedAt: row.decidedAt === null ? null : row.decidedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toRule(row: RuleRow): AutomationRule {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }
}

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

// ---- insights ----

export async function listInsights(tx: Queryable, tenantId: string, query: ListInsightsQuery): Promise<Page<Insight>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status === 'live') filters += ` and status in ('open', 'acknowledged')`
  else if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and status = $${params.length}`
  }
  if (query.severity) {
    params.push(query.severity)
    filters += ` and severity = $${params.length}`
  }
  if (query.category) {
    params.push(query.category)
    filters += ` and category = $${params.length}`
  }
  if (query.q) {
    params.push(likePattern(query.q))
    filters += ` and (title_ar ilike $${params.length} or description_ar ilike $${params.length})`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: insightSortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<InsightRow & { sortValue: string }>(
    `select ${INSIGHT_COLUMNS}, ${keyset.selectValue}
     from ai_insights_alerts
     where tenant_id = $1${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toInsight), nextCursor: page.nextCursor }
}

export async function findInsight(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<Insight | null> {
  const result = await tx.query<InsightRow>(
    `select ${INSIGHT_COLUMNS} from ai_insights_alerts where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toInsight(result.rows[0]) : null
}

/** The live (open or acknowledged) insights with these fingerprints, locked so two scans cannot both update them. */
export async function lockLiveInsights(tx: Queryable, tenantId: string, fingerprints: readonly string[]): Promise<Map<string, Insight>> {
  if (fingerprints.length === 0) return new Map()
  const result = await tx.query<InsightRow>(
    `select ${INSIGHT_COLUMNS} from ai_insights_alerts
     where tenant_id = $1 and fingerprint = any($2::text[]) and status in ('open', 'acknowledged')
     order by id for update`,
    [tenantId, [...fingerprints]]
  )
  return new Map(result.rows.map((row) => [row.fingerprint, toInsight(row)]))
}

export async function insertInsight(
  tx: Queryable,
  tenantId: string,
  userId: string,
  ruleKey: RuleKey,
  fingerprint: string,
  draft: InsightDraft
): Promise<Insight> {
  const result = await tx.query<InsightRow>(
    `insert into ai_insights_alerts
       (tenant_id, rule_key, fingerprint, severity, category, title_ar, description_ar, metric_value, metric_unit,
        source_entity_type, source_entity_id, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     returning ${INSIGHT_COLUMNS}`,
    [
      tenantId,
      ruleKey,
      fingerprint,
      draft.severity,
      draft.category,
      draft.titleAr,
      draft.descriptionAr,
      draft.metricValue,
      draft.metricUnit,
      draft.sourceEntityType,
      draft.sourceEntityId,
      userId,
    ]
  )
  return toInsight(result.rows[0])
}

/** Refreshes what a live insight says. Status stays as it is, so an acknowledged finding is not reopened by a rescan. */
export async function refreshInsight(tx: Queryable, tenantId: string, id: string, draft: InsightDraft): Promise<Insight> {
  const result = await tx.query<InsightRow>(
    `update ai_insights_alerts
     set severity = $3, category = $4, title_ar = $5, description_ar = $6, metric_value = $7, metric_unit = $8,
         source_entity_type = $9, source_entity_id = $10, version = version + 1
     where tenant_id = $1 and id = $2
     returning ${INSIGHT_COLUMNS}`,
    [
      tenantId,
      id,
      draft.severity,
      draft.category,
      draft.titleAr,
      draft.descriptionAr,
      draft.metricValue,
      draft.metricUnit,
      draft.sourceEntityType,
      draft.sourceEntityId,
    ]
  )
  return toInsight(result.rows[0])
}

/** Moves an insight to a new status when its version still matches. Null when the version moved on. */
export async function setInsightStatus(
  tx: Queryable,
  tenantId: string,
  id: string,
  expectedVersion: number,
  status: InsightStatus
): Promise<Insight | null> {
  const result = await tx.query<InsightRow>(
    `update ai_insights_alerts
     set status = $4, resolved_at = case when $4 = 'resolved' then now() else null end, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3
     returning ${INSIGHT_COLUMNS}`,
    [tenantId, id, expectedVersion, status]
  )
  return result.rows[0] ? toInsight(result.rows[0]) : null
}

/** Live insights of the given rules, so a scan can resolve the ones whose cause is gone. */
export async function listLiveInsightsOfRules(tx: Queryable, tenantId: string, ruleKeys: readonly RuleKey[]): Promise<Insight[]> {
  if (ruleKeys.length === 0) return []
  const result = await tx.query<InsightRow>(
    `select ${INSIGHT_COLUMNS} from ai_insights_alerts
     where tenant_id = $1 and rule_key = any($2::text[]) and status in ('open', 'acknowledged')
     order by id for update`,
    [tenantId, [...ruleKeys]]
  )
  return result.rows.map(toInsight)
}

export async function resolveInsights(tx: Queryable, tenantId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await tx.query(
    `update ai_insights_alerts set status = 'resolved', resolved_at = now(), version = version + 1
     where tenant_id = $1 and id = any($2::uuid[]) and status in ('open', 'acknowledged')`,
    [tenantId, [...ids]]
  )
}

export async function countOpenInsights(tx: Queryable, tenantId: string): Promise<Record<InsightSeverity, number>> {
  const result = await tx.query<{ severity: InsightSeverity; count: number }>(
    `select severity, count(*)::bigint as count from ai_insights_alerts
     where tenant_id = $1 and status = 'open' group by severity`,
    [tenantId]
  )
  const counts: Record<InsightSeverity, number> = { critical: 0, warning: 0, opportunity: 0 }
  result.rows.forEach((row) => {
    counts[row.severity] = Number(row.count)
  })
  return counts
}

// ---- approvals ----

export async function listApprovals(tx: Queryable, tenantId: string, query: ListApprovalsQuery): Promise<Page<Approval>> {
  const params: unknown[] = [tenantId]
  let filters = ''
  if (query.status !== 'all') {
    params.push(query.status)
    filters += ` and status = $${params.length}`
  }
  if (query.actionType) {
    params.push(query.actionType)
    filters += ` and action_type = $${params.length}`
  }
  const keyset = keysetClauses({
    sortKey: query.sort,
    column: approvalSortColumns[query.sort],
    direction: query.direction,
    cursor: query.cursor,
    params,
  })
  params.push(query.limit + 1)
  const result = await tx.query<ApprovalRow & { sortValue: string }>(
    `select ${APPROVAL_COLUMNS}, ${keyset.selectValue}
     from ai_action_approvals
     where tenant_id = $1${filters}${keyset.where}
     order by ${keyset.orderBy}
     limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, query.sort, query.direction)
  return { data: page.data.map(toApproval), nextCursor: page.nextCursor }
}

export async function findApproval(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<Approval | null> {
  const result = await tx.query<ApprovalRow>(
    `select ${APPROVAL_COLUMNS} from ai_action_approvals where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toApproval(result.rows[0]) : null
}

export async function countPendingApprovals(tx: Queryable, tenantId: string): Promise<number> {
  const result = await tx.query<{ count: number }>(
    `select count(*)::bigint as count from ai_action_approvals where tenant_id = $1 and status = 'pending'`,
    [tenantId]
  )
  return Number(result.rows[0].count)
}

/** The pending requests with these fingerprints, locked so two scans cannot both update them. */
export async function lockPendingApprovals(
  tx: Queryable,
  tenantId: string,
  fingerprints: readonly string[]
): Promise<Map<string, Approval>> {
  if (fingerprints.length === 0) return new Map()
  const result = await tx.query<ApprovalRow>(
    `select ${APPROVAL_COLUMNS} from ai_action_approvals
     where tenant_id = $1 and fingerprint = any($2::text[]) and status = 'pending'
     order by id for update`,
    [tenantId, [...fingerprints]]
  )
  return new Map(result.rows.map((row) => [row.fingerprint, toApproval(row)]))
}

/** When a person last decided each fingerprint (rejected or executed). The engine's own withdrawals do not count. */
export async function lastHumanDecisions(
  tx: Queryable,
  tenantId: string,
  fingerprints: readonly string[]
): Promise<Map<string, Date>> {
  if (fingerprints.length === 0) return new Map()
  const result = await tx.query<{ fingerprint: string; decidedAt: Date }>(
    `select fingerprint, max(decided_at) as "decidedAt" from ai_action_approvals
     where tenant_id = $1 and fingerprint = any($2::text[]) and status in ('rejected', 'executed') and decided_by is not null
     group by fingerprint`,
    [tenantId, [...fingerprints]]
  )
  return new Map(result.rows.map((row) => [row.fingerprint, row.decidedAt]))
}

export async function insertApproval(
  tx: Queryable,
  tenantId: string,
  userId: string,
  args: { insightId: string | null; ruleKey: RuleKey; fingerprint: string; proposal: ProposalDraft }
): Promise<Approval> {
  const result = await tx.query<ApprovalRow>(
    `insert into ai_action_approvals
       (tenant_id, insight_id, rule_key, fingerprint, action_type, title_ar, summary_ar, payload_json,
        estimated_impact_fils, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
     returning ${APPROVAL_COLUMNS}`,
    [
      tenantId,
      args.insightId,
      args.ruleKey,
      args.fingerprint,
      args.proposal.actionType,
      args.proposal.titleAr,
      args.proposal.summaryAr,
      JSON.stringify(args.proposal.payload),
      args.proposal.estimatedImpactFils,
      userId,
    ]
  )
  return toApproval(result.rows[0])
}

/** Refreshes a pending request to what the latest scan found. */
export async function refreshApproval(
  tx: Queryable,
  tenantId: string,
  id: string,
  insightId: string | null,
  proposal: ProposalDraft
): Promise<Approval> {
  const result = await tx.query<ApprovalRow>(
    `update ai_action_approvals
     set insight_id = $3, action_type = $4, title_ar = $5, summary_ar = $6, payload_json = $7::jsonb,
         estimated_impact_fils = $8, version = version + 1
     where tenant_id = $1 and id = $2 and status = 'pending'
     returning ${APPROVAL_COLUMNS}`,
    [
      tenantId,
      id,
      insightId,
      proposal.actionType,
      proposal.titleAr,
      proposal.summaryAr,
      JSON.stringify(proposal.payload),
      proposal.estimatedImpactFils,
    ]
  )
  return toApproval(result.rows[0])
}

/** Pending requests of the given rules, so a scan can withdraw the ones whose cause is gone. */
export async function listPendingApprovalsOfRules(tx: Queryable, tenantId: string, ruleKeys: readonly RuleKey[]): Promise<Approval[]> {
  if (ruleKeys.length === 0) return []
  const result = await tx.query<ApprovalRow>(
    `select ${APPROVAL_COLUMNS} from ai_action_approvals
     where tenant_id = $1 and rule_key = any($2::text[]) and status = 'pending'
     order by id for update`,
    [tenantId, [...ruleKeys]]
  )
  return result.rows.map(toApproval)
}

/** The engine withdraws its own request: rejected, with no person as the decider. */
export async function withdrawApprovals(tx: Queryable, tenantId: string, ids: readonly string[], note: string): Promise<void> {
  if (ids.length === 0) return
  await tx.query(
    `update ai_action_approvals
     set status = 'rejected', decided_at = now(), decision_note = $3, version = version + 1
     where tenant_id = $1 and id = any($2::uuid[]) and status = 'pending'`,
    [tenantId, [...ids], note]
  )
}

export async function markRejected(
  tx: Queryable,
  tenantId: string,
  id: string,
  expectedVersion: number,
  userId: string,
  note: string | null
): Promise<Approval | null> {
  const result = await tx.query<ApprovalRow>(
    `update ai_action_approvals
     set status = 'rejected', decided_by = $4, decided_at = now(), decision_note = $5, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'pending'
     returning ${APPROVAL_COLUMNS}`,
    [tenantId, id, expectedVersion, userId, note]
  )
  return result.rows[0] ? toApproval(result.rows[0]) : null
}

export async function markExecuted(
  tx: Queryable,
  tenantId: string,
  id: string,
  expectedVersion: number,
  userId: string,
  note: string | null,
  result: ExecutionResult
): Promise<Approval | null> {
  const updated = await tx.query<ApprovalRow>(
    `update ai_action_approvals
     set status = 'executed', decided_by = $4, decided_at = now(), decision_note = $5, result_json = $6::jsonb,
         version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'pending'
     returning ${APPROVAL_COLUMNS}`,
    [tenantId, id, expectedVersion, userId, note, JSON.stringify(result)]
  )
  return updated.rows[0] ? toApproval(updated.rows[0]) : null
}

export async function countApprovalsByType(
  tx: Queryable,
  tenantId: string
): Promise<Array<{ actionType: ActionType; count: number }>> {
  const result = await tx.query<{ actionType: ActionType; count: number }>(
    `select action_type as "actionType", count(*)::bigint as count from ai_action_approvals
     where tenant_id = $1 and status = 'pending' group by action_type order by action_type`,
    [tenantId]
  )
  return result.rows.map((row) => ({ actionType: row.actionType, count: Number(row.count) }))
}

// ---- rules ----

export async function listRules(tx: Queryable, tenantId: string): Promise<AutomationRule[]> {
  const result = await tx.query<RuleRow>(
    `select ${RULE_COLUMNS} from erp_automation_rules where tenant_id = $1 order by rule_key`,
    [tenantId]
  )
  return result.rows.map(toRule)
}

/** Active rules, and with `trigger` only those bound to that event. */
export async function listActiveRules(tx: Queryable, tenantId: string, trigger: string | null): Promise<AutomationRule[]> {
  const result = await tx.query<RuleRow>(
    `select ${RULE_COLUMNS} from erp_automation_rules
     where tenant_id = $1 and is_active and ($2::text is null or trigger_event = $2)
     order by rule_key`,
    [tenantId, trigger]
  )
  return result.rows.map(toRule)
}

export async function findRule(
  tx: Queryable,
  tenantId: string,
  id: string,
  options: { lock: boolean } = { lock: false }
): Promise<AutomationRule | null> {
  const result = await tx.query<RuleRow>(
    `select ${RULE_COLUMNS} from erp_automation_rules where tenant_id = $1 and id = $2${options.lock ? ' for update' : ''}`,
    [tenantId, id]
  )
  return result.rows[0] ? toRule(result.rows[0]) : null
}

export async function updateRule(
  tx: Queryable,
  tenantId: string,
  id: string,
  expectedVersion: number,
  input: { name: string; isActive: boolean; conditionJson: Record<string, unknown> }
): Promise<AutomationRule | null> {
  const result = await tx.query<RuleRow>(
    `update erp_automation_rules
     set name = $4, is_active = $5, condition_json = $6::jsonb, version = version + 1
     where tenant_id = $1 and id = $2 and version = $3
     returning ${RULE_COLUMNS}`,
    [tenantId, id, expectedVersion, input.name, input.isActive, JSON.stringify(input.conditionJson)]
  )
  return result.rows[0] ? toRule(result.rows[0]) : null
}

/** The tenant's creator. The event processor acts as this user, because an event has no signed-in person behind it. */
export async function findTenantCreator(tx: Queryable, tenantId: string): Promise<string | null> {
  const result = await tx.query<{ createdBy: string }>(
    `select created_by as "createdBy" from tenants where id = $1 and status = 'active'`,
    [tenantId]
  )
  return result.rows[0]?.createdBy ?? null
}

/** The open insights that need attention first: critical, then warning, then opportunity, newest first within each. */
export async function topInsights(tx: Queryable, tenantId: string, limit: number): Promise<Insight[]> {
  const result = await tx.query<InsightRow>(
    `select ${INSIGHT_COLUMNS} from ai_insights_alerts
     where tenant_id = $1 and status = 'open'
     order by case severity when 'critical' then 0 when 'warning' then 1 else 2 end, detected_at desc, id
     limit $2`,
    [tenantId, limit]
  )
  return result.rows.map(toInsight)
}
