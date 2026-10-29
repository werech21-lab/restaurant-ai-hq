import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { versionConflict } from '@/lib/auth/require'
import { withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { recordMovementWithin } from '@/modules/admin'
import { listContracts } from '@/modules/operations'
import { analyzeContract } from '@/modules/governance/domain/analyze'
import { blockMessage, gateDecision, ruleTypeFor, type GateAction, type GateFacts } from '@/modules/governance/domain/gate'
import { nextMemory } from '@/modules/governance/domain/learning'
import { extractArchive } from '@/modules/governance/domain/ocr'
import { radarAdvice } from '@/modules/governance/domain/radar'
import type { ArchiveDocument, BlockedAttempt, Circular, ContractAnalysis, EnforcementRule, LearningMemory, RadarRow, TelemetryRow } from '@/modules/governance/domain/types'
import { publishGovernanceEvents, type GovernanceEvent } from '@/modules/governance/events'
import * as repository from '@/modules/governance/repositories/governance-repository'
import type { AnalyzeInput, ArchiveInput, EnforceInput, RadarInput, SimulateInput, TelemetryInput } from '@/modules/governance/schemas/governance'

const attemptText: Record<GateAction, { module: 'hr' | 'delivery'; text: string }> = {
  'delivery.assign_driver': { module: 'delivery', text: 'تعيين طلب توصيل لسائق برخصة منتهية' },
  'hr.attendance.hours': { module: 'hr', text: 'تسجيل ساعات وردية تتجاوز الحد القانوني' },
  'hr.expense.cash': { module: 'hr', text: 'تسجيل مصروف نقدي أعلى من السقف المعتمد' },
}

function stamp(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

async function learn(
  tx: Parameters<typeof repository.findMemory>[0],
  auth: AuthContext,
  decision: 'approved' | 'blocked',
  pattern: string,
  issue: string,
): Promise<void> {
  const current = await repository.findMemory(tx, auth.tenantId, 'compliance')
  const next = nextMemory(
    { weight: current?.learnedWeightAdjustment ?? 0, confidence: current?.confidenceScore ?? 40 },
    decision,
  )
  await repository.saveMemory(tx, auth, { domain: 'compliance', pattern, issue, weight: next.weight, confidence: next.confidence })
}

export async function enforceCompliance(auth: AuthContext, action: GateAction, facts: GateFacts): Promise<void> {
  const asOf = new Date().toISOString().slice(0, 10)
  const rules = await withTransaction((tx) => repository.activeRules(tx, auth.tenantId, ruleTypeFor(action)))
  const decision = gateDecision(rules, action, facts, asOf)
  if (!decision.blocked) return
  const message = blockMessage(decision.ruleCode)
  const attempt = attemptText[action]
  const events: GovernanceEvent[] = []
  await withTransaction(async (tx) => {
    const id = await repository.insertBlock(tx, auth, { ruleCode: decision.ruleCode, module: attempt.module, attemptedActionAr: attempt.text, message })
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'compliance_block', entityId: id, action: 'create', before: null, after: { ruleCode: decision.ruleCode, message } })
    await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'blocked', entityType: 'compliance_block', entityId: id, descriptionAr: message, amountMinor: facts.cashMinor })
    await learn(tx, auth, 'blocked', 'إيقاف تلقائي عند تجاوز القاعدة', decision.ruleCode)
    events.push({ ...stamp(auth), name: 'governance.compliance.blocked', payload: { blockId: id, ruleCode: decision.ruleCode, module: attempt.module, blockedBy: auth.userId } })
  })
  await publishGovernanceEvents(events)
  throw new DomainError('compliance_blocked', message)
}

export async function simulateCompliance(auth: AuthContext, input: SimulateInput): Promise<{ blocked: false }> {
  await enforceCompliance(auth, input.actionType, {
    licenseExpiry: input.licenseExpiry,
    workedMinutes: input.workedMinutes,
    cashMinor: input.cashMinor,
  })
  return { blocked: false }
}

export function listAnalyses(auth: AuthContext): Promise<ContractAnalysis[]> {
  return withTransaction((tx) => repository.listAnalyses(tx, auth.tenantId))
}

export async function analyzeContractFor(auth: AuthContext, key: string, input: AnalyzeInput): Promise<IdempotentResult<{ data: ContractAnalysis }>> {
  const contracts = await listContracts(auth)
  const contract = contracts.find((item) => item.id === input.contractId)
  if (!contract) throw new AppError(404, 'not_found', 'The contract was not found.')
  const draft = analyzeContract(contract, new Date().toISOString().slice(0, 10))
  const events: GovernanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.contract.analyze', key, requestHash: hashRequest(input) }, async () => {
      const row = await repository.insertAnalysis(tx, auth.tenantId, auth.userId, contract.id, contract.title, draft)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'contract_ai_analysis', entityId: row.id, action: 'create', before: null, after: row })
      events.push({ ...stamp(auth), name: 'governance.contract.analyzed', payload: { analysisId: row.id, contractId: contract.id, riskScore: row.riskScore, analyzedBy: auth.userId } })
      return { status: 201 as const, body: { data: row } }
    }),
  )
  if (!outcome.replayed) await publishGovernanceEvents(events)
  return outcome
}

export function listCirculars(auth: AuthContext): Promise<Circular[]> {
  return withTransaction((tx) => repository.listCirculars(tx, auth.tenantId))
}

export async function enforceCircular(auth: AuthContext, id: string, input: EnforceInput): Promise<{ data: Circular }> {
  const events: GovernanceEvent[] = []
  const data = await withTransaction(async (tx) => {
    const before = await repository.findCircular(tx, auth.tenantId, id)
    if (!before) throw new AppError(404, 'not_found', 'The circular was not found.')
    const circular = await repository.enforceCircular(tx, auth.tenantId, id, input.version)
    if (!circular) {
      if (before.version !== input.version) throw versionConflict('circular')
      throw new DomainError('invalid_transition', 'This circular is already enforced.')
    }
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'regulatory_circular', entityId: id, action: 'update', before, after: circular })
    await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'approved', entityType: 'regulatory_circular', entityId: id, descriptionAr: `اعتماد التعميم ${circular.regulationCode}` })
    await learn(tx, auth, 'approved', 'اعتماد التعميم وتعميمه على الإدارة', circular.regulationCode)
    events.push({ ...stamp(auth), name: 'governance.circular.enforced', payload: { circularId: id, regulationCode: circular.regulationCode, enforcedBy: auth.userId } })
    return circular
  })
  await publishGovernanceEvents(events)
  return { data }
}

export function listRules(auth: AuthContext): Promise<EnforcementRule[]> {
  return withTransaction((tx) => repository.listRules(tx, auth.tenantId))
}

export function listBlocks(auth: AuthContext): Promise<BlockedAttempt[]> {
  return withTransaction((tx) => repository.listBlocks(tx, auth.tenantId))
}

export function listMemory(auth: AuthContext): Promise<LearningMemory[]> {
  return withTransaction((tx) => repository.listMemory(tx, auth.tenantId))
}

export function listArchive(auth: AuthContext): Promise<ArchiveDocument[]> {
  return withTransaction((tx) => repository.listArchive(tx, auth.tenantId))
}

export async function stageArchive(auth: AuthContext, key: string, input: ArchiveInput): Promise<IdempotentResult<{ data: ArchiveDocument }>> {
  const extracted = extractArchive(input.fileName, input.text, input.documentCategory)
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.archive.stage', key, requestHash: hashRequest(input) }, async () => {
      const row = await repository.insertArchive(tx, auth, input, extracted)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'smart_archive_document', entityId: row.id, action: 'create', before: null, after: row })
      return { status: 201 as const, body: { data: row } }
    }),
  )
}

export async function markArchive(auth: AuthContext, id: string, status: ArchiveDocument['status'], routedRecordId: string | null): Promise<ArchiveDocument> {
  const events: GovernanceEvent[] = []
  const row = await withTransaction(async (tx) => {
    const updated = await repository.markArchive(tx, auth.tenantId, id, status, routedRecordId)
    if (!updated) throw new AppError(404, 'not_found', 'The archive document was not found.')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'smart_archive_document', entityId: id, action: 'update', before: null, after: updated })
    if (status === 'routed' || status === 'archived') {
      events.push({ ...stamp(auth), name: 'governance.archive.routed', payload: { documentId: id, routedToModule: updated.routedToModule, routedRecordId, routedBy: auth.userId } })
    }
    return updated
  })
  await publishGovernanceEvents(events)
  return row
}

export function listTelemetry(auth: AuthContext): Promise<TelemetryRow[]> {
  return withTransaction((tx) => repository.listTelemetry(tx, auth.tenantId))
}

export async function recordTelemetry(auth: AuthContext, key: string, input: TelemetryInput): Promise<IdempotentResult<{ data: TelemetryRow }>> {
  const events: GovernanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.telemetry.record', key, requestHash: hashRequest(input) }, async () => {
      const actor = await repository.actorLabel(tx, auth)
      const row = await repository.insertTelemetry(tx, auth, input, actor)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'employee_telemetry', entityId: row.id, action: 'create', before: null, after: row })
      events.push({ ...stamp(auth), name: 'governance.telemetry.recorded', payload: { telemetryId: row.id, activePath: row.activePath, anomalyFlag: row.anomalyFlag, recordedBy: auth.userId } })
      return { status: 201 as const, body: { data: row } }
    }),
  )
  if (!outcome.replayed) await publishGovernanceEvents(events)
  return outcome
}

export function listRadar(auth: AuthContext): Promise<RadarRow[]> {
  return withTransaction((tx) => repository.listRadar(tx, auth.tenantId))
}

export async function recordRadar(auth: AuthContext, key: string, input: RadarInput): Promise<IdempotentResult<{ data: RadarRow }>> {
  const advice = radarAdvice(input.competitorName, input.itemOrService, input.ourPriceMinor, input.competitorPriceMinor)
  const events: GovernanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.radar.record', key, requestHash: hashRequest(input) }, async () => {
      const row = await repository.insertRadar(tx, auth, input, advice)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'competitive_radar', entityId: row.id, action: 'create', before: null, after: row })
      events.push({ ...stamp(auth), name: 'governance.radar.recorded', payload: { radarId: row.id, competitorName: row.competitorName, recordedBy: auth.userId } })
      return { status: 201 as const, body: { data: row } }
    }),
  )
  if (!outcome.replayed) await publishGovernanceEvents(events)
  return outcome
}
