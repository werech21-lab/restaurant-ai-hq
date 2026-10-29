// Browser-safe public API of the AI module: types, Zod schemas and pure rules. It must never import server code.
export {
  actionTypes,
  approvalStatuses,
  insightCategories,
  insightSeverities,
  insightStatuses,
  ruleKeys,
  scenarioOptionKeys,
} from '@/modules/ai/domain/types'
export type {
  ActionType,
  Approval,
  ApprovalStatus,
  AutomationRule,
  CommandOutcome,
  CommandResult,
  CommandResultKind,
  DashboardKpis,
  DraftMessage,
  ExecutionResult,
  Insight,
  InsightCategory,
  InsightSeverity,
  InsightStatus,
  MetricUnit,
  ResultRef,
  RuleKey,
  ScanResult,
  ScanSkip,
  ScenarioOptionKey,
} from '@/modules/ai/domain/types'
export { parseCommand } from '@/modules/ai/domain/command'
export type { ParsedCommand } from '@/modules/ai/domain/command'
export { thresholdSchemas } from '@/modules/ai/domain/thresholds'
export { formatBps, formatKwd } from '@/modules/ai/domain/messages'
export type { Dashboard } from '@/modules/ai/services/dashboard-service'
