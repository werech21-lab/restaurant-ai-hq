import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { isUniqueViolation, versionConflict } from '@/lib/auth/require'
import { withTransaction } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { recordMovementWithin } from '@/modules/admin'
import {
  alertRecommendation,
  inquiryFromMonitor,
  inquiryTransition,
  taskTransition,
  violationStages,
  violationTransition,
  type MonitorCategory,
  type ViolationStage,
} from '@/modules/governance/domain/desk'
import type { ConnectedDevice, ExecutiveTask, GovViolation, Investigation, MonitorEvent } from '@/modules/governance/domain/types'
import { publishGovernanceEvents, type GovernanceEvent } from '@/modules/governance/events'
import * as repository from '@/modules/governance/repositories/desk-repository'
import type {
  ConvertMonitorInput,
  InquiryActionInput,
  LogMonitorInput,
  OpenInquiryInput,
  RaiseAlertInput,
  RegisterViolationInput,
  TaskActionInput,
  ViolationActionInput,
} from '@/modules/governance/schemas/desk'

function stamp(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

function asStage(stage: string): ViolationStage {
  const found = violationStages.find((item) => item === stage)
  if (!found) throw new DomainError('invalid_transition', 'هذا الانتقال غير مسموح في محضر المخالفة.')
  return found
}

function asCategory(category: string): MonitorCategory {
  const allowed: readonly MonitorCategory[] = ['uniform_violation', 'hygiene_gloves_mask', 'unauthorized_phone_use', 'workstation_abandonment', 'biometric_mismatch']
  const found = allowed.find((item) => item === category)
  if (!found) throw new DomainError('invalid_transition', 'تصنيف الملاحظة غير معروف.')
  return found
}

export function listViolations(auth: AuthContext): Promise<GovViolation[]> {
  return withTransaction((tx) => repository.listViolations(tx, auth.tenantId, Date.now()))
}

export async function registerViolation(auth: AuthContext, key: string, input: RegisterViolationInput): Promise<IdempotentResult<{ data: GovViolation }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.violation.register', key, requestHash: hashRequest(input) }, async () => {
      let row: GovViolation
      try {
        row = await repository.insertViolation(tx, auth.tenantId, auth.userId, input, Date.now())
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError(409, 'violation_exists', 'That violation number is already used.')
        throw error
      }
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'gov_violation', entityId: row.id, action: 'create', before: null, after: row })
      await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'create', entityType: 'gov_violation', entityId: row.id, descriptionAr: `تسجيل مخالفة ${row.violationNumber}`, amountMinor: row.fineAmountMinor })
      return { status: 201 as const, body: { data: row } }
    }),
  )
}

export async function actOnViolation(auth: AuthContext, id: string, input: ViolationActionInput): Promise<{ data: GovViolation }> {
  const events: GovernanceEvent[] = []
  const now = new Date().toISOString()
  const data = await withTransaction(async (tx) => {
    const before = await repository.findViolation(tx, auth.tenantId, id, Date.now())
    if (!before) throw new AppError(404, 'not_found', 'The violation was not found.')
    if (before.version !== input.version) throw versionConflict('violation')
    const statement = input.action === 'statement' ? input.statementAr : before.employeeStatementAr
    const proof = input.action === 'proof' ? input.proofRef : before.closureProofDocUrl
    const stage = violationTransition(asStage(before.workflowStage), input.action, statement, proof)
    const noteAr = input.action === 'statement' ? input.statementAr : input.action === 'proof' ? input.proofRef : input.action === 'close' ? 'أُغلق المحضر بعد الإفادة والإثبات' : 'بدأت المعالجة'
    const saved = await repository.saveViolation(tx, auth.tenantId, id, input.version, {
      stage,
      statement,
      proof,
      neglected: stage === 'closed_verified' ? before.isNeglectedFlag : before.neglected,
      entry: { at: now, action: input.action, noteAr },
    }, Date.now())
    if (!saved) throw versionConflict('violation')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'gov_violation', entityId: id, action: 'update', before, after: saved })
    await recordMovementWithin(tx, auth, { module: 'governance', actionType: input.action, entityType: 'gov_violation', entityId: id, descriptionAr: `${input.action} ${saved.violationNumber}`, amountMinor: saved.fineAmountMinor })
    if (input.action === 'close') {
      events.push({ ...stamp(auth), name: 'governance.violation.closed', payload: { violationId: id, violationNumber: saved.violationNumber, closedBy: auth.userId } })
    }
    return saved
  })
  await publishGovernanceEvents(events)
  return { data }
}

export async function monitoringBoard(auth: AuthContext): Promise<{ devices: ConnectedDevice[]; events: MonitorEvent[] }> {
  return withTransaction(async (tx) => ({
    devices: await repository.listDevices(tx, auth.tenantId),
    events: await repository.listEvents(tx, auth.tenantId),
  }))
}

export async function logMonitoring(auth: AuthContext, key: string, input: LogMonitorInput): Promise<IdempotentResult<{ data: { id: string } }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.monitor.log', key, requestHash: hashRequest(input) }, async () => {
      const device = await repository.findDevice(tx, auth.tenantId, input.deviceId)
      if (!device) throw new AppError(404, 'not_found', 'The device was not found.')
      const id = await repository.insertEvent(tx, auth.tenantId, auth.userId, device.branchId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'monitor_event', entityId: id, action: 'create', before: null, after: input })
      await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'create', entityType: 'monitor_event', entityId: id, descriptionAr: `ملاحظة انضباط: ${input.employeeName}` })
      return { status: 201 as const, body: { data: { id } } }
    }),
  )
}

export async function convertMonitoring(auth: AuthContext, key: string, id: string, input: ConvertMonitorInput): Promise<IdempotentResult<{ data: Investigation }>> {
  const events: GovernanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.monitor.convert', key, requestHash: hashRequest({ id, ...input }) }, async () => {
      const event = await repository.findEvent(tx, auth.tenantId, id)
      if (!event) throw new AppError(404, 'not_found', 'The monitoring note was not found.')
      if (event.version !== input.version || event.status !== 'detected') {
        throw new DomainError('invalid_transition', 'هذه الملاحظة ليست بانتظار التحويل.')
      }
      const inquiry = await repository.insertInquiry(tx, auth.tenantId, auth.userId, {
        caseNumber: `INV-${event.id.slice(0, 8)}`,
        sourceType: 'ai_camera_violation',
        sourceReferenceId: event.id,
        subjectEmployeeName: event.employeeName,
        investigatorName: input.investigatorName,
        incidentSummaryAr: inquiryFromMonitor(asCategory(event.violationCategory), event.employeeName),
        evidenceRef: event.snapshotEvidenceRef,
      })
      const marked = await repository.markEventConverted(tx, auth.tenantId, id, input.version)
      if (!marked) throw versionConflict('monitoring event')
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'legal_investigation', entityId: inquiry.id, action: 'create', before: null, after: inquiry })
      await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'create', entityType: 'legal_investigation', entityId: inquiry.id, descriptionAr: `تحويل ملاحظة إلى تحقيق ${inquiry.caseNumber}` })
      events.push({ ...stamp(auth), name: 'governance.monitoring.converted', payload: { eventId: id, investigationId: inquiry.id, convertedBy: auth.userId } })
      events.push({ ...stamp(auth), name: 'governance.investigation.opened', payload: { investigationId: inquiry.id, caseNumber: inquiry.caseNumber, openedBy: auth.userId } })
      return { status: 201 as const, body: { data: inquiry } }
    }),
  )
  if (!outcome.replayed) await publishGovernanceEvents(events)
  return outcome
}

export function listInquiries(auth: AuthContext): Promise<Investigation[]> {
  return withTransaction((tx) => repository.listInquiries(tx, auth.tenantId))
}

export async function openInquiry(auth: AuthContext, key: string, input: OpenInquiryInput): Promise<IdempotentResult<{ data: Investigation }>> {
  const events: GovernanceEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.inquiry.open', key, requestHash: hashRequest(input) }, async () => {
      let inquiry: Investigation
      try {
        inquiry = await repository.insertInquiry(tx, auth.tenantId, auth.userId, input)
      } catch (error) {
        if (isUniqueViolation(error)) throw new AppError(409, 'case_exists', 'That case number is already used.')
        throw error
      }
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'legal_investigation', entityId: inquiry.id, action: 'create', before: null, after: inquiry })
      await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'create', entityType: 'legal_investigation', entityId: inquiry.id, descriptionAr: `فتح تحقيق ${inquiry.caseNumber}` })
      events.push({ ...stamp(auth), name: 'governance.investigation.opened', payload: { investigationId: inquiry.id, caseNumber: inquiry.caseNumber, openedBy: auth.userId } })
      return { status: 201 as const, body: { data: inquiry } }
    }),
  )
  if (!outcome.replayed) await publishGovernanceEvents(events)
  return outcome
}

export async function actOnInquiry(auth: AuthContext, id: string, input: InquiryActionInput): Promise<{ data: Investigation }> {
  const events: GovernanceEvent[] = []
  const data = await withTransaction(async (tx) => {
    const before = await repository.findInquiry(tx, auth.tenantId, id)
    if (!before) throw new AppError(404, 'not_found', 'The investigation was not found.')
    if (before.version !== input.version) throw versionConflict('investigation')
    const statements = input.action === 'statement' ? [...before.statements, { questionAr: input.questionAr, answerAr: input.answerAr }] : before.statements
    const stage = inquiryTransition(before.status, input.action, statements.length)
    const finding = input.action === 'finding' ? input.legalFindingAr : before.legalFindingAr
    const actionAr = input.action === 'finding' ? input.recommendedDisciplinaryActionAr : before.recommendedDisciplinaryActionAr
    const decision = input.action === 'ruling' ? input.managerFinalDecision : before.managerFinalDecision
    const saved = await repository.saveInquiry(tx, auth.tenantId, id, input.version, { stage, statements, finding, actionAr, decision })
    if (!saved) throw versionConflict('investigation')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'legal_investigation', entityId: id, action: 'update', before, after: saved })
    await recordMovementWithin(tx, auth, { module: 'governance', actionType: input.action, entityType: 'legal_investigation', entityId: id, descriptionAr: `${input.action} ${saved.caseNumber}` })
    if (input.action === 'ruling') {
      events.push({ ...stamp(auth), name: 'governance.investigation.ruled', payload: { investigationId: id, caseNumber: saved.caseNumber, ruledBy: auth.userId } })
    }
    return saved
  })
  await publishGovernanceEvents(events)
  return { data }
}

export function listTasks(auth: AuthContext): Promise<ExecutiveTask[]> {
  return withTransaction((tx) => repository.listTasks(tx, auth.tenantId))
}

export async function raiseAlert(auth: AuthContext, key: string, input: RaiseAlertInput): Promise<IdempotentResult<{ data: ExecutiveTask }>> {
  const recommendation = alertRecommendation(input.alertCategory)
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: 'governance.task.raise', key, requestHash: hashRequest(input) }, async () => {
      const row = await repository.insertTask(tx, auth.tenantId, auth.userId, input, recommendation)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'executive_task', entityId: row.id, action: 'create', before: null, after: row })
      await recordMovementWithin(tx, auth, { module: 'governance', actionType: 'create', entityType: 'executive_task', entityId: row.id, descriptionAr: row.titleAr })
      return { status: 201 as const, body: { data: row } }
    }),
  )
}

export async function actOnTask(auth: AuthContext, id: string, input: TaskActionInput): Promise<{ data: ExecutiveTask }> {
  const events: GovernanceEvent[] = []
  const data = await withTransaction(async (tx) => {
    const before = await repository.findTask(tx, auth.tenantId, id)
    if (!before) throw new AppError(404, 'not_found', 'The task was not found.')
    if (before.version !== input.version) throw versionConflict('task')
    const stage = taskTransition(before.status, input.action)
    const assignee = input.action === 'dispatch' ? input.assignedToEmployee : before.assignedToEmployee
    const instruction = input.action === 'dispatch' ? input.taskInstructionAr : before.taskInstructionAr
    const dueDate = input.action === 'dispatch' ? input.dueDate : before.dueDate
    const report = input.action === 'complete' ? input.employeeCompletionReportAr : before.employeeCompletionReportAr
    const saved = await repository.saveTask(tx, auth.tenantId, id, input.version, { stage, assignee, instruction, dueDate, report })
    if (!saved) throw versionConflict('task')
    await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'executive_task', entityId: id, action: 'update', before, after: saved })
    await recordMovementWithin(tx, auth, { module: 'governance', actionType: input.action, entityType: 'executive_task', entityId: id, descriptionAr: `${input.action} ${saved.titleAr}` })
    if (input.action === 'dispatch') {
      events.push({ ...stamp(auth), name: 'governance.task.dispatched', payload: { taskId: id, dispatchedBy: auth.userId } })
    }
    if (input.action === 'complete') {
      events.push({ ...stamp(auth), name: 'governance.task.completed', payload: { taskId: id, completedBy: auth.userId } })
    }
    return saved
  })
  await publishGovernanceEvents(events)
  return { data }
}
