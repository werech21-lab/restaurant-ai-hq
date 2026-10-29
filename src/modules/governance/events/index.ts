import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = { name: N; version: 1; occurredAt: string; tenantId: string; payload: P }

export type GovernanceContractAnalyzed = EventBase<'governance.contract.analyzed', { analysisId: string; contractId: string; riskScore: number; analyzedBy: string }>
export type GovernanceCircularEnforced = EventBase<'governance.circular.enforced', { circularId: string; regulationCode: string; enforcedBy: string }>
export type GovernanceComplianceBlocked = EventBase<'governance.compliance.blocked', { blockId: string; ruleCode: string; module: string; blockedBy: string }>
export type GovernanceArchiveRouted = EventBase<'governance.archive.routed', { documentId: string; routedToModule: string; routedRecordId: string | null; routedBy: string }>
export type GovernanceRadarRecorded = EventBase<'governance.radar.recorded', { radarId: string; competitorName: string; recordedBy: string }>
export type GovernanceTelemetryRecorded = EventBase<'governance.telemetry.recorded', { telemetryId: string; activePath: string; anomalyFlag: boolean; recordedBy: string }>
export type GovernanceEvent =
  | GovernanceContractAnalyzed
  | GovernanceCircularEnforced
  | GovernanceComplianceBlocked
  | GovernanceArchiveRouted
  | GovernanceRadarRecorded
  | GovernanceTelemetryRecorded

export async function publishGovernanceEvents(events: readonly GovernanceEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
