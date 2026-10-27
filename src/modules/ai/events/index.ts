import { emit } from '@/lib/events/bus'
import type { ActionType, InsightCategory, InsightSeverity, RuleKey } from '@/modules/ai/domain/types'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

export type InsightDetectedEvent = EventBase<
  'ai.insight.detected',
  { insightId: string; ruleKey: RuleKey; severity: InsightSeverity; category: InsightCategory }
>

export type ApprovalRequestedEvent = EventBase<
  'ai.approval.requested',
  { approvalId: string; ruleKey: RuleKey; actionType: ActionType; estimatedImpactFils: number }
>

export type ApprovalExecutedEvent = EventBase<
  'ai.approval.executed',
  { approvalId: string; actionType: ActionType; executedBy: string }
>

export type ApprovalRejectedEvent = EventBase<
  'ai.approval.rejected',
  { approvalId: string; actionType: ActionType; rejectedBy: string }
>

export type ScanCompletedEvent = EventBase<
  'ai.scan.completed',
  { scannedBy: string; rulesRun: RuleKey[]; findings: number; insightsCreated: number; approvalsCreated: number }
>

export type AiEvent =
  | InsightDetectedEvent
  | ApprovalRequestedEvent
  | ApprovalExecutedEvent
  | ApprovalRejectedEvent
  | ScanCompletedEvent

/** Call only after the transaction that wrote the data has committed. */
export async function publishAiEvents(events: readonly AiEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}

/** Fills the fields every event shares. */
export function aiEventBase(tenantId: string): { version: 1; occurredAt: string; tenantId: string } {
  return { version: 1, occurredAt: new Date().toISOString(), tenantId }
}
