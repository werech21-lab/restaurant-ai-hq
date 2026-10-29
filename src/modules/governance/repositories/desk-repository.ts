import type { Queryable } from '@/lib/db'
import { showsNeglect } from '@/modules/governance/domain/desk'
import type { ConnectedDevice, DeskLog, ExecutiveTask, GovViolation, InquiryStatement, Investigation, MonitorEvent } from '@/modules/governance/domain/types'
import type { LogMonitorInput, OpenInquiryInput, RaiseAlertInput, RegisterViolationInput } from '@/modules/governance/schemas/desk'

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

function logs(value: unknown): DeskLog[] {
  return asList(value).map((item) => ({ at: textField(item, 'at'), action: textField(item, 'action'), noteAr: textField(item, 'noteAr') }))
}

function statements(value: unknown): InquiryStatement[] {
  return asList(value).map((item) => ({ questionAr: textField(item, 'questionAr'), answerAr: textField(item, 'answerAr') }))
}

type ViolationRow = Omit<GovViolation, 'actionLog' | 'neglected'> & { actionLog: unknown }
type InquiryRow = Omit<Investigation, 'statements' | 'evidenceFiles'> & { statements: unknown; evidenceFiles: unknown }

function violation(row: ViolationRow, nowMs: number): GovViolation {
  return {
    ...row,
    fineAmountMinor: Number(row.fineAmountMinor),
    version: Number(row.version),
    actionLog: logs(row.actionLog),
    neglected: showsNeglect(row.workflowStage, row.isNeglectedFlag, row.slaDeadline, nowMs),
  }
}

const VIOLATION = `id, violation_number as "violationNumber", issuing_authority as "issuingAuthority", branch_id as "branchId",
  violation_type_ar as "violationTypeAr", fine_amount_minor::bigint as "fineAmountMinor", assigned_employee_name as "assignedEmployeeName",
  sla_deadline::text as "slaDeadline", workflow_stage as "workflowStage", employee_statement_ar as "employeeStatementAr",
  action_log_json as "actionLog", closure_proof_doc_url as "closureProofDocUrl", is_neglected_flag as "isNeglectedFlag",
  version, created_at::text as "createdAt"`

export async function listViolations(tx: Queryable, tenantId: string, nowMs: number): Promise<GovViolation[]> {
  const result = await tx.query<ViolationRow>(`select ${VIOLATION} from gov_violations_tracker where tenant_id = $1 order by sla_deadline, violation_number limit 100`, [tenantId])
  return result.rows.map((row) => violation(row, nowMs))
}

export async function findViolation(tx: Queryable, tenantId: string, id: string, nowMs: number): Promise<GovViolation | null> {
  const result = await tx.query<ViolationRow>(`select ${VIOLATION} from gov_violations_tracker where tenant_id = $1 and id = $2 for update`, [tenantId, id])
  return result.rows[0] ? violation(result.rows[0], nowMs) : null
}

export async function insertViolation(tx: Queryable, tenantId: string, actorId: string, input: RegisterViolationInput, nowMs: number): Promise<GovViolation> {
  const result = await tx.query<ViolationRow>(
    `insert into gov_violations_tracker (
      tenant_id, violation_number, issuing_authority, branch_id, violation_type_ar, fine_amount_minor,
      assigned_employee_name, sla_deadline, created_by
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${VIOLATION}`,
    [tenantId, input.violationNumber, input.issuingAuthority, input.branchId, input.violationTypeAr, input.fineAmountMinor, input.assignedEmployeeName, input.slaDeadline, actorId],
  )
  return violation(result.rows[0], nowMs)
}

export async function saveViolation(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  patch: { stage: string; statement: string | null; proof: string | null; neglected: boolean; entry: DeskLog },
  nowMs: number,
): Promise<GovViolation | null> {
  const result = await tx.query<ViolationRow>(
    `update gov_violations_tracker set workflow_stage = $3, employee_statement_ar = $4, closure_proof_doc_url = $5,
      is_neglected_flag = $6, action_log_json = action_log_json || $7::jsonb, version = version + 1
     where tenant_id = $1 and id = $2 and version = $8
     returning ${VIOLATION}`,
    [tenantId, id, patch.stage, patch.statement, patch.proof, patch.neglected, JSON.stringify([patch.entry]), version],
  )
  return result.rows[0] ? violation(result.rows[0], nowMs) : null
}

const DEVICE = `id, device_type as "deviceType", device_name as "deviceName", branch_id as "branchId",
  ip_or_stream_url as "ipOrStreamUrl", status, version`

export async function listDevices(tx: Queryable, tenantId: string): Promise<ConnectedDevice[]> {
  const result = await tx.query<ConnectedDevice>(`select ${DEVICE} from connected_devices where tenant_id = $1 order by device_name limit 100`, [tenantId])
  return result.rows.map((row) => ({ ...row, version: Number(row.version) }))
}

export async function findDevice(tx: Queryable, tenantId: string, id: string): Promise<ConnectedDevice | null> {
  const result = await tx.query<ConnectedDevice>(`select ${DEVICE} from connected_devices where tenant_id = $1 and id = $2`, [tenantId, id])
  return result.rows[0] ? { ...result.rows[0], version: Number(result.rows[0].version) } : null
}

const EVENT = `e.id, e.device_id as "deviceId", d.device_name as "deviceName", e.branch_id as "branchId", e.employee_name as "employeeName",
  e.violation_category as "violationCategory", e.ai_confidence_score as "aiConfidenceScore", e.snapshot_evidence_ref as "snapshotEvidenceRef",
  e.auto_action_taken_ar as "autoActionTakenAr", e.status, e.detected_at::text as "detectedAt", e.version`

export async function listEvents(tx: Queryable, tenantId: string): Promise<MonitorEvent[]> {
  const result = await tx.query<MonitorEvent>(
    `select ${EVENT} from iot_ai_monitoring_events e join connected_devices d on d.tenant_id = e.tenant_id and d.id = e.device_id
     where e.tenant_id = $1 order by e.detected_at desc limit 100`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, aiConfidenceScore: Number(row.aiConfidenceScore), version: Number(row.version) }))
}

export async function findEvent(tx: Queryable, tenantId: string, id: string): Promise<MonitorEvent | null> {
  const result = await tx.query<MonitorEvent>(
    `select ${EVENT} from iot_ai_monitoring_events e join connected_devices d on d.tenant_id = e.tenant_id and d.id = e.device_id
     where e.tenant_id = $1 and e.id = $2 for update of e`,
    [tenantId, id],
  )
  return result.rows[0] ? { ...result.rows[0], aiConfidenceScore: Number(result.rows[0].aiConfidenceScore), version: Number(result.rows[0].version) } : null
}

export async function insertEvent(tx: Queryable, tenantId: string, actorId: string, branchId: string | null, input: LogMonitorInput): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into iot_ai_monitoring_events (
      tenant_id, device_id, branch_id, employee_name, violation_category, ai_confidence_score,
      snapshot_evidence_ref, auto_action_taken_ar, created_by
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [tenantId, input.deviceId, branchId, input.employeeName, input.violationCategory, input.aiConfidenceScore, input.snapshotEvidenceRef, input.noteAr, actorId],
  )
  return result.rows[0].id
}

export async function markEventConverted(tx: Queryable, tenantId: string, id: string, version: number): Promise<boolean> {
  const result = await tx.query(
    `update iot_ai_monitoring_events set status = 'converted_to_investigation', version = version + 1
     where tenant_id = $1 and id = $2 and version = $3 and status = 'detected'`,
    [tenantId, id, version],
  )
  return (result.rowCount ?? 0) > 0
}

const INQUIRY = `id, case_number as "caseNumber", source_type as "sourceType", source_reference_id as "sourceReferenceId",
  subject_employee_name as "subjectEmployeeName", investigator_name as "investigatorName", incident_summary_ar as "incidentSummaryAr",
  questions_and_statements_json as statements, evidence_files_json as "evidenceFiles", legal_finding_ar as "legalFindingAr",
  recommended_disciplinary_action_ar as "recommendedDisciplinaryActionAr", manager_final_decision as "managerFinalDecision",
  status, version, created_at::text as "createdAt"`

function inquiry(row: InquiryRow): Investigation {
  return { ...row, version: Number(row.version), statements: statements(row.statements), evidenceFiles: asStrings(row.evidenceFiles) }
}

export async function listInquiries(tx: Queryable, tenantId: string): Promise<Investigation[]> {
  const result = await tx.query<InquiryRow>(`select ${INQUIRY} from legal_investigations where tenant_id = $1 order by created_at desc limit 100`, [tenantId])
  return result.rows.map(inquiry)
}

export async function findInquiry(tx: Queryable, tenantId: string, id: string): Promise<Investigation | null> {
  const result = await tx.query<InquiryRow>(`select ${INQUIRY} from legal_investigations where tenant_id = $1 and id = $2 for update`, [tenantId, id])
  return result.rows[0] ? inquiry(result.rows[0]) : null
}

export async function insertInquiry(tx: Queryable, tenantId: string, actorId: string, input: OpenInquiryInput): Promise<Investigation> {
  const evidence = input.evidenceRef ? [input.evidenceRef] : []
  const result = await tx.query<InquiryRow>(
    `insert into legal_investigations (
      tenant_id, case_number, source_type, source_reference_id, subject_employee_name, investigator_name,
      incident_summary_ar, evidence_files_json, created_by
    ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9) returning ${INQUIRY}`,
    [tenantId, input.caseNumber, input.sourceType, input.sourceReferenceId, input.subjectEmployeeName, input.investigatorName, input.incidentSummaryAr, JSON.stringify(evidence), actorId],
  )
  return inquiry(result.rows[0])
}

export async function saveInquiry(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  patch: { stage: string; statements: InquiryStatement[]; finding: string | null; actionAr: string | null; decision: string | null },
): Promise<Investigation | null> {
  const result = await tx.query<InquiryRow>(
    `update legal_investigations set status = $3, questions_and_statements_json = $4::jsonb, legal_finding_ar = $5,
      recommended_disciplinary_action_ar = $6, manager_final_decision = $7, version = version + 1
     where tenant_id = $1 and id = $2 and version = $8
     returning ${INQUIRY}`,
    [tenantId, id, patch.stage, JSON.stringify(patch.statements), patch.finding, patch.actionAr, patch.decision, version],
  )
  return result.rows[0] ? inquiry(result.rows[0]) : null
}

const TASK = `id, alert_category as "alertCategory", severity, title_ar as "titleAr", ai_recommendation_ar as "aiRecommendationAr",
  assigned_to_employee as "assignedToEmployee", task_instruction_ar as "taskInstructionAr", due_date::text as "dueDate",
  employee_completion_report_ar as "employeeCompletionReportAr", status, version, created_at::text as "createdAt"`

function task(row: ExecutiveTask): ExecutiveTask {
  return { ...row, version: Number(row.version) }
}

export async function listTasks(tx: Queryable, tenantId: string): Promise<ExecutiveTask[]> {
  const result = await tx.query<ExecutiveTask>(`select ${TASK} from executive_alerts_and_tasks where tenant_id = $1 order by created_at desc limit 100`, [tenantId])
  return result.rows.map(task)
}

export async function findTask(tx: Queryable, tenantId: string, id: string): Promise<ExecutiveTask | null> {
  const result = await tx.query<ExecutiveTask>(`select ${TASK} from executive_alerts_and_tasks where tenant_id = $1 and id = $2 for update`, [tenantId, id])
  return result.rows[0] ? task(result.rows[0]) : null
}

export async function insertTask(tx: Queryable, tenantId: string, actorId: string, input: RaiseAlertInput, recommendation: string): Promise<ExecutiveTask> {
  const result = await tx.query<ExecutiveTask>(
    `insert into executive_alerts_and_tasks (
      tenant_id, alert_category, severity, title_ar, ai_recommendation_ar, task_instruction_ar, created_by
    ) values ($1,$2,$3,$4,$5,$6,$7) returning ${TASK}`,
    [tenantId, input.alertCategory, input.severity, input.titleAr, recommendation, recommendation, actorId],
  )
  return task(result.rows[0])
}

export async function saveTask(
  tx: Queryable,
  tenantId: string,
  id: string,
  version: number,
  patch: { stage: string; assignee: string | null; instruction: string; dueDate: string | null; report: string | null },
): Promise<ExecutiveTask | null> {
  const result = await tx.query<ExecutiveTask>(
    `update executive_alerts_and_tasks set status = $3, assigned_to_employee = $4, task_instruction_ar = $5, due_date = $6,
      employee_completion_report_ar = $7, version = version + 1
     where tenant_id = $1 and id = $2 and version = $8
     returning ${TASK}`,
    [tenantId, id, patch.stage, patch.assignee, patch.instruction, patch.dueDate, patch.report, version],
  )
  return result.rows[0] ? task(result.rows[0]) : null
}
