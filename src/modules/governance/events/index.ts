import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = { name: N; version: 1; occurredAt: string; tenantId: string; payload: P }

export type GovernanceContractAnalyzed = EventBase<'governance.contract.analyzed', { analysisId: string; contractId: string; riskScore: number; analyzedBy: string }>
export type GovernanceCircularEnforced = EventBase<'governance.circular.enforced', { circularId: string; regulationCode: string; enforcedBy: string }>
export type GovernanceComplianceBlocked = EventBase<'governance.compliance.blocked', { blockId: string; ruleCode: string; module: string; blockedBy: string }>
export type GovernanceArchiveRouted = EventBase<'governance.archive.routed', { documentId: string; routedToModule: string; routedRecordId: string | null; routedBy: string }>
export type GovernanceRadarRecorded = EventBase<'governance.radar.recorded', { radarId: string; competitorName: string; recordedBy: string }>
export type GovernanceTelemetryRecorded = EventBase<'governance.telemetry.recorded', { telemetryId: string; activePath: string; anomalyFlag: boolean; recordedBy: string }>
export type GovernanceViolationClosed = EventBase<'governance.violation.closed', { violationId: string; violationNumber: string; closedBy: string }>
export type GovernanceMonitoringConverted = EventBase<'governance.monitoring.converted', { eventId: string; investigationId: string; convertedBy: string }>
export type GovernanceInvestigationOpened = EventBase<'governance.investigation.opened', { investigationId: string; caseNumber: string; openedBy: string }>
export type GovernanceInvestigationRuled = EventBase<'governance.investigation.ruled', { investigationId: string; caseNumber: string; ruledBy: string }>
export type GovernanceTaskDispatched = EventBase<'governance.task.dispatched', { taskId: string; dispatchedBy: string }>
export type GovernanceTaskCompleted = EventBase<'governance.task.completed', { taskId: string; completedBy: string }>
export type GovernanceAggregatorScanned = EventBase<'governance.aggregator.scanned', { recorded: number; scannedBy: string }>
export type GovernanceAggregatorEscalated = EventBase<'governance.aggregator.escalated', { actionId: string; targetRank: number; decidedBy: string }>
export type GovernanceEvent =
  | GovernanceContractAnalyzed
  | GovernanceCircularEnforced
  | GovernanceComplianceBlocked
  | GovernanceArchiveRouted
  | GovernanceRadarRecorded
  | GovernanceTelemetryRecorded
  | GovernanceViolationClosed
  | GovernanceMonitoringConverted
  | GovernanceInvestigationOpened
  | GovernanceInvestigationRuled
  | GovernanceTaskDispatched
  | GovernanceTaskCompleted
  | GovernanceAggregatorScanned
  | GovernanceAggregatorEscalated

export async function publishGovernanceEvents(events: readonly GovernanceEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
