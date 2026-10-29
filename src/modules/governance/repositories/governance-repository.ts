import type { Queryable } from '@/lib/db'
import type { AuthContext } from '@/lib/auth/context'
import type { RuleType } from '@/modules/governance/domain/gate'
import type { MemoryDomain } from '@/modules/governance/domain/learning'
import type { ArchiveExtraction } from '@/modules/governance/domain/ocr'
import type { ArchiveDocument, BlockedAttempt, Circular, ContractAnalysis, EnforcementRule, LearningMemory, RadarRow, TelemetryRow } from '@/modules/governance/domain/types'
import type { ArchiveInput, RadarInput, TelemetryInput } from '@/modules/governance/schemas/governance'

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asList(value: unknown): Record<string, unknown>[] {
  const source: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(source)) return []
  return source.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
}

function asStrings(value: unknown): string[] {
  const source: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (!Array.isArray(source)) return []
  return source.filter((item): item is string => typeof item === 'string')
}

function textField(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : ''
}

function analysis(row: ContractAnalysis & { risks: unknown; obligations: unknown }): ContractAnalysis {
  return {
    ...row,
    riskScore: Number(row.riskScore),
    risks: asList(row.risks).map((item) => ({ code: textField(item, 'code'), detailAr: textField(item, 'detailAr') })),
    obligations: asList(row.obligations).map((item) => ({ party: textField(item, 'party'), textAr: textField(item, 'textAr') })),
  }
}

function extraction(value: unknown): ArchiveDocument['extracted'] {
  const row = asRecord(value)
  const route = textField(row, 'route')
  const fileType = textField(row, 'fileType')
  return {
    amountMinor: Number(row.amountMinor ?? 0),
    counterparty: textField(row, 'counterparty'),
    fileType,
    route: route === '/erp/hr' || route === '/erp/contracts' || route === '/erp/delivery' || route === '/erp/finance' ? route : '/erp/finance',
  }
}

const ANALYSIS = `id, contract_id as "contractId", document_name as "documentName", clauses_summary_ar as "clausesSummaryAr",
  legal_financial_risks_json as risks, party_obligations_json as obligations, penalty_clauses_ar as "penaltyClausesAr",
  negotiation_recommendations_ar as "negotiationRecommendationsAr", risk_score as "riskScore", analyzed_at::text as "analyzedAt"`

export async function listAnalyses(tx: Queryable, tenantId: string): Promise<ContractAnalysis[]> {
  const result = await tx.query<ContractAnalysis & { risks: unknown; obligations: unknown }>(
    `select ${ANALYSIS} from contract_ai_analyses where tenant_id = $1 order by analyzed_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map(analysis)
}

export async function insertAnalysis(
  tx: Queryable,
  tenantId: string,
  actorId: string,
  contractId: string,
  documentName: string,
  draft: {
    clausesSummaryAr: string
    risks: { code: string; detailAr: string }[]
    obligations: { party: string; textAr: string }[]
    penaltyClausesAr: string
    negotiationRecommendationsAr: string
    riskScore: number
  },
): Promise<ContractAnalysis> {
  const result = await tx.query<ContractAnalysis & { risks: unknown; obligations: unknown }>(
    `insert into contract_ai_analyses (
       tenant_id, contract_id, document_name, clauses_summary_ar, legal_financial_risks_json, party_obligations_json,
       penalty_clauses_ar, negotiation_recommendations_ar, risk_score, created_by
     ) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)
     returning ${ANALYSIS}`,
    [
      tenantId, contractId, documentName, draft.clausesSummaryAr, JSON.stringify(draft.risks), JSON.stringify(draft.obligations),
      draft.penaltyClausesAr, draft.negotiationRecommendationsAr, draft.riskScore, actorId,
    ],
  )
  return analysis(result.rows[0])
}

export async function listCirculars(tx: Queryable, tenantId: string): Promise<Circular[]> {
  const result = await tx.query<Circular>(
    `select id, authority_name as "authorityName", regulation_code as "regulationCode", title_ar as "titleAr",
            target_department as "targetDepartment", ai_recommendation_ar as "aiRecommendationAr", status, version
     from regulatory_circulars where tenant_id = $1 order by regulation_code limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, version: Number(row.version) }))
}

export async function findCircular(tx: Queryable, tenantId: string, id: string): Promise<Circular | null> {
  const result = await tx.query<Circular>(
    `select id, authority_name as "authorityName", regulation_code as "regulationCode", title_ar as "titleAr",
            target_department as "targetDepartment", ai_recommendation_ar as "aiRecommendationAr", status, version
     from regulatory_circulars where tenant_id = $1 and id = $2`,
    [tenantId, id],
  )
  return result.rows[0] ? { ...result.rows[0], version: Number(result.rows[0].version) } : null
}

export async function enforceCircular(tx: Queryable, tenantId: string, id: string, version: number): Promise<Circular | null> {
  const result = await tx.query<Circular>(
    `update regulatory_circulars set status = 'enforced', version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'pending'
     returning id, authority_name as "authorityName", regulation_code as "regulationCode", title_ar as "titleAr",
               target_department as "targetDepartment", ai_recommendation_ar as "aiRecommendationAr", status, version`,
    [tenantId, id, version],
  )
  if (!result.rows[0]) return null
  await tx.query(
    `update compliance_enforcement_rules set is_active = true where tenant_id = $1 and circular_id = $2`,
    [tenantId, id],
  )
  return { ...result.rows[0], version: Number(result.rows[0].version) }
}

export async function listRules(tx: Queryable, tenantId: string): Promise<EnforcementRule[]> {
  const result = await tx.query<EnforcementRule>(
    `select id, circular_id as "circularId", rule_code as "ruleCode", rule_type as "ruleType",
            threshold_value as "thresholdValue", is_active as "isActive"
     from compliance_enforcement_rules where tenant_id = $1 order by rule_code limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, thresholdValue: Number(row.thresholdValue) }))
}

export async function activeRules(tx: Queryable, tenantId: string, ruleType: RuleType): Promise<{ ruleCode: string; ruleType: RuleType; thresholdValue: number }[]> {
  const result = await tx.query<{ ruleCode: string; ruleType: RuleType; thresholdValue: number }>(
    `select rule_code as "ruleCode", rule_type as "ruleType", threshold_value as "thresholdValue"
     from compliance_enforcement_rules
     where tenant_id = $1 and is_active and rule_type = $2
     order by rule_code limit 5`,
    [tenantId, ruleType],
  )
  return result.rows.map((row) => ({ ...row, thresholdValue: Number(row.thresholdValue) }))
}

export async function listBlocks(tx: Queryable, tenantId: string): Promise<BlockedAttempt[]> {
  const result = await tx.query<BlockedAttempt>(
    `select id, rule_code as "ruleCode", actor_name as "actorName", module, attempted_action_ar as "attemptedActionAr",
            block_message_ar as "blockMessageAr", created_at::text as "createdAt"
     from compliance_blocked_attempts where tenant_id = $1 order by created_at desc limit 100`,
    [tenantId],
  )
  return result.rows
}

export async function insertBlock(
  tx: Queryable,
  auth: AuthContext,
  input: { ruleCode: string; module: string; attemptedActionAr: string; message: string },
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into compliance_blocked_attempts (
       tenant_id, rule_code, actor_name, module, attempted_action_ar, block_message_ar, created_by
     ) values (
       $1, $2, coalesce((select nullif(display_name, '') from profiles where id = $3), 'مستخدم'), $4, $5, $6, $3
     ) returning id`,
    [auth.tenantId, input.ruleCode, auth.userId, input.module, input.attemptedActionAr, input.message],
  )
  return result.rows[0].id
}

export async function listMemory(tx: Queryable, tenantId: string): Promise<LearningMemory[]> {
  const result = await tx.query<LearningMemory>(
    `select id, context_domain as "contextDomain", manager_decision_pattern as "managerDecisionPattern",
            recurring_issue_detected as "recurringIssueDetected", learned_weight_adjustment as "learnedWeightAdjustment",
            confidence_score as "confidenceScore", updated_at::text as "updatedAt"
     from ai_learning_memory where tenant_id = $1 order by context_domain`,
    [tenantId],
  )
  return result.rows.map((row) => ({
    ...row,
    learnedWeightAdjustment: Number(row.learnedWeightAdjustment),
    confidenceScore: Number(row.confidenceScore),
  }))
}

export async function findMemory(tx: Queryable, tenantId: string, domain: MemoryDomain): Promise<LearningMemory | null> {
  const result = await tx.query<LearningMemory>(
    `select id, context_domain as "contextDomain", manager_decision_pattern as "managerDecisionPattern",
            recurring_issue_detected as "recurringIssueDetected", learned_weight_adjustment as "learnedWeightAdjustment",
            confidence_score as "confidenceScore", updated_at::text as "updatedAt"
     from ai_learning_memory where tenant_id = $1 and context_domain = $2`,
    [tenantId, domain],
  )
  const row = result.rows[0]
  return row ? { ...row, learnedWeightAdjustment: Number(row.learnedWeightAdjustment), confidenceScore: Number(row.confidenceScore) } : null
}

export async function saveMemory(
  tx: Queryable,
  auth: AuthContext,
  input: { domain: MemoryDomain; pattern: string; issue: string; weight: number; confidence: number },
): Promise<void> {
  await tx.query(
    `insert into ai_learning_memory (
       tenant_id, context_domain, manager_decision_pattern, recurring_issue_detected, learned_weight_adjustment, confidence_score, created_by
     ) values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (tenant_id, context_domain) do update set
       manager_decision_pattern = excluded.manager_decision_pattern,
       recurring_issue_detected = excluded.recurring_issue_detected,
       learned_weight_adjustment = excluded.learned_weight_adjustment,
       confidence_score = excluded.confidence_score,
       updated_at = now()`,
    [auth.tenantId, input.domain, input.pattern, input.issue, input.weight, input.confidence, auth.userId],
  )
}

const ARCHIVE = `id, file_name as "fileName", file_type as "fileType", document_category as "documentCategory",
  extracted_ocr_json as extracted, amount_minor as "amountMinor", routed_to_module as "routedToModule",
  routed_record_id as "routedRecordId", status, created_at::text as "createdAt"`

function archive(row: ArchiveDocument & { extracted: unknown }): ArchiveDocument {
  return { ...row, amountMinor: Number(row.amountMinor), extracted: extraction(row.extracted) }
}

export async function listArchive(tx: Queryable, tenantId: string): Promise<ArchiveDocument[]> {
  const result = await tx.query<ArchiveDocument & { extracted: unknown }>(
    `select ${ARCHIVE} from smart_archive_documents where tenant_id = $1 order by created_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map(archive)
}

export async function insertArchive(
  tx: Queryable,
  auth: AuthContext,
  input: ArchiveInput,
  extracted: ArchiveExtraction,
): Promise<ArchiveDocument> {
  const result = await tx.query<ArchiveDocument & { extracted: unknown }>(
    `insert into smart_archive_documents (
       tenant_id, file_name, file_type, document_category, extracted_ocr_json, amount_minor, routed_to_module, status, created_by
     ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, 'pending', $8)
     returning ${ARCHIVE}`,
    [auth.tenantId, input.fileName, extracted.fileType, input.documentCategory, JSON.stringify(extracted), extracted.amountMinor, extracted.route, auth.userId],
  )
  return archive(result.rows[0])
}

export async function markArchive(
  tx: Queryable,
  tenantId: string,
  id: string,
  status: ArchiveDocument['status'],
  routedRecordId: string | null,
): Promise<ArchiveDocument | null> {
  const result = await tx.query<ArchiveDocument & { extracted: unknown }>(
    `update smart_archive_documents set status = $3, routed_record_id = $4
     where tenant_id = $1 and id = $2 returning ${ARCHIVE}`,
    [tenantId, id, status, routedRecordId],
  )
  return result.rows[0] ? archive(result.rows[0]) : null
}

export async function actorLabel(tx: Queryable, auth: AuthContext): Promise<{ name: string; role: string }> {
  const result = await tx.query<{ name: string; role: string }>(
    `select coalesce(nullif(p.display_name, ''), 'مستخدم') as name, coalesce(r.name, 'member') as role
     from tenant_members m
     left join profiles p on p.id = m.user_id
     left join roles r on r.id = m.role_id
     where m.tenant_id = $1 and m.user_id = $2`,
    [auth.tenantId, auth.userId],
  )
  return result.rows[0] ?? { name: 'مستخدم', role: 'member' }
}

export function riskLevel(dwellTimeSeconds: number, sequence: readonly string[]): { anomalyFlag: boolean; riskLevel: 'low' | 'medium' | 'high' } {
  const blocked = sequence.includes('blocked')
  if (blocked || dwellTimeSeconds > 600) return { anomalyFlag: true, riskLevel: 'high' }
  if (dwellTimeSeconds > 180) return { anomalyFlag: false, riskLevel: 'medium' }
  return { anomalyFlag: false, riskLevel: 'low' }
}

export async function listTelemetry(tx: Queryable, tenantId: string): Promise<TelemetryRow[]> {
  const result = await tx.query<TelemetryRow & { actionSequence: unknown }>(
    `select id, user_name as "userName", role, active_path as "activePath", action_sequence_json as "actionSequence",
            dwell_time_seconds as "dwellTimeSeconds", anomaly_flag as "anomalyFlag", risk_level as "riskLevel",
            recorded_at::text as "recordedAt"
     from employee_behavior_telemetry where tenant_id = $1 order by recorded_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({
    ...row,
    dwellTimeSeconds: Number(row.dwellTimeSeconds),
    actionSequence: asStrings(row.actionSequence),
  }))
}

export async function insertTelemetry(tx: Queryable, auth: AuthContext, input: TelemetryInput, actor: { name: string; role: string }): Promise<TelemetryRow> {
  const risk = riskLevel(input.dwellTimeSeconds, input.actionSequence)
  const result = await tx.query<TelemetryRow & { actionSequence: unknown }>(
    `insert into employee_behavior_telemetry (
       tenant_id, user_name, role, active_path, action_sequence_json, dwell_time_seconds, anomaly_flag, risk_level, created_by
     ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     returning id, user_name as "userName", role, active_path as "activePath", action_sequence_json as "actionSequence",
               dwell_time_seconds as "dwellTimeSeconds", anomaly_flag as "anomalyFlag", risk_level as "riskLevel",
               recorded_at::text as "recordedAt"`,
    [auth.tenantId, actor.name, actor.role, input.activePath, JSON.stringify(input.actionSequence), input.dwellTimeSeconds, risk.anomalyFlag, risk.riskLevel, auth.userId],
  )
  const row = result.rows[0]
  return { ...row, dwellTimeSeconds: Number(row.dwellTimeSeconds), actionSequence: input.actionSequence }
}

export async function listRadar(tx: Queryable, tenantId: string): Promise<RadarRow[]> {
  const result = await tx.query<RadarRow>(
    `select id, competitor_name as "competitorName", market_segment as "marketSegment", item_or_service as "itemOrService",
            our_price_minor as "ourPriceMinor", competitor_price_minor as "competitorPriceMinor", promo_detected_ar as "promoDetectedAr",
            ai_executive_insight_ar as "aiExecutiveInsightAr", recommended_counter_action_ar as "recommendedCounterActionAr",
            scanned_at::text as "scannedAt"
     from competitive_intelligence_radar where tenant_id = $1 order by scanned_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, ourPriceMinor: Number(row.ourPriceMinor), competitorPriceMinor: Number(row.competitorPriceMinor) }))
}

export async function insertRadar(
  tx: Queryable,
  auth: AuthContext,
  input: RadarInput,
  advice: { insightAr: string; counterAr: string },
): Promise<RadarRow> {
  const result = await tx.query<RadarRow>(
    `insert into competitive_intelligence_radar (
       tenant_id, competitor_name, market_segment, item_or_service, our_price_minor, competitor_price_minor,
       promo_detected_ar, ai_executive_insight_ar, recommended_counter_action_ar, created_by
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, competitor_name as "competitorName", market_segment as "marketSegment", item_or_service as "itemOrService",
               our_price_minor as "ourPriceMinor", competitor_price_minor as "competitorPriceMinor", promo_detected_ar as "promoDetectedAr",
               ai_executive_insight_ar as "aiExecutiveInsightAr", recommended_counter_action_ar as "recommendedCounterActionAr",
               scanned_at::text as "scannedAt"`,
    [
      auth.tenantId, input.competitorName, input.marketSegment, input.itemOrService, input.ourPriceMinor, input.competitorPriceMinor,
      input.promoDetectedAr, advice.insightAr, advice.counterAr, auth.userId,
    ],
  )
  const row = result.rows[0]
  return { ...row, ourPriceMinor: Number(row.ourPriceMinor), competitorPriceMinor: Number(row.competitorPriceMinor) }
}
