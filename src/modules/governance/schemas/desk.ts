import { z } from 'zod'
import { alertCategories, authorities, disciplinaryActions, inquirySources, monitorCategories } from '@/modules/governance/domain/desk'

const version = z.number().int().min(1)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const money = z.number().int().min(0).max(1_000_000_000_000)

export const registerViolationSchema = z.object({
  violationNumber: z.string().trim().min(1).max(40),
  issuingAuthority: z.enum(authorities),
  branchId: z.string().uuid().nullable(),
  violationTypeAr: z.string().trim().min(1).max(200),
  fineAmountMinor: money,
  assignedEmployeeName: z.string().trim().min(1).max(200),
  slaDeadline: date,
})
export type RegisterViolationInput = z.output<typeof registerViolationSchema>

export const violationActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('statement'), version, statementAr: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('remediate'), version }),
  z.object({ action: z.literal('proof'), version, proofRef: z.string().trim().min(1).max(300) }),
  z.object({ action: z.literal('close'), version }),
])
export type ViolationActionInput = z.output<typeof violationActionSchema>

export const logMonitorSchema = z.object({
  deviceId: z.string().uuid(),
  employeeName: z.string().trim().min(1).max(200),
  violationCategory: z.enum(monitorCategories),
  aiConfidenceScore: z.number().int().min(0).max(100),
  snapshotEvidenceRef: z.string().trim().min(1).max(200),
  noteAr: z.string().trim().min(1).max(500),
})
export type LogMonitorInput = z.output<typeof logMonitorSchema>

export const convertMonitorSchema = z.object({
  version: version,
  investigatorName: z.string().trim().min(1).max(200),
})
export type ConvertMonitorInput = z.output<typeof convertMonitorSchema>

export const openInquirySchema = z.object({
  caseNumber: z.string().trim().min(1).max(40),
  sourceType: z.enum(inquirySources),
  sourceReferenceId: z.string().uuid().nullable(),
  subjectEmployeeName: z.string().trim().min(1).max(200),
  investigatorName: z.string().trim().min(1).max(200),
  incidentSummaryAr: z.string().trim().min(1).max(2000),
  evidenceRef: z.string().trim().min(1).max(200).nullable(),
})
export type OpenInquiryInput = z.output<typeof openInquirySchema>

export const inquiryActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('statement'),
    version,
    questionAr: z.string().trim().min(1).max(500),
    answerAr: z.string().trim().min(1).max(2000),
  }),
  z.object({
    action: z.literal('finding'),
    version,
    legalFindingAr: z.string().trim().min(1).max(2000),
    recommendedDisciplinaryActionAr: z.enum(disciplinaryActions),
  }),
  z.object({
    action: z.literal('ruling'),
    version,
    managerFinalDecision: z.string().trim().min(1).max(500),
  }),
])
export type InquiryActionInput = z.output<typeof inquiryActionSchema>

export const raiseAlertSchema = z.object({
  alertCategory: z.enum(alertCategories),
  severity: z.enum(['critical', 'high', 'medium']),
  titleAr: z.string().trim().min(1).max(200),
})
export type RaiseAlertInput = z.output<typeof raiseAlertSchema>

export const taskActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('dispatch'),
    version,
    assignedToEmployee: z.string().trim().min(1).max(200),
    taskInstructionAr: z.string().trim().min(1).max(500),
    dueDate: date,
  }),
  z.object({ action: z.literal('progress'), version }),
  z.object({
    action: z.literal('complete'),
    version,
    employeeCompletionReportAr: z.string().trim().min(1).max(2000),
  }),
])
export type TaskActionInput = z.output<typeof taskActionSchema>
