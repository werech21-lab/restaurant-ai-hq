// Server-side public API of the AI module. Browser code imports from './client' instead.
export {
  acknowledgeInsightHandler,
  approveApprovalHandler,
  commandHandler,
  dashboardHandler,
  getApprovalHandler,
  getInsightHandler,
  listApprovalsHandler,
  listInsightsHandler,
  listRulesHandler,
  rejectApprovalHandler,
  resolveInsightHandler,
  scanHandler,
  updateRuleHandler,
} from '@/modules/ai/api/v1/ai'
export { approveApproval, getApproval, listApprovals, rejectApproval } from '@/modules/ai/services/approval-service'
export { runCommand } from '@/modules/ai/services/command-service'
export { getDashboard } from '@/modules/ai/services/dashboard-service'
export type { Dashboard } from '@/modules/ai/services/dashboard-service'
export { acknowledgeInsight, getInsight, listInsights, resolveInsight } from '@/modules/ai/services/insight-service'
export { listRules, updateRule } from '@/modules/ai/services/rule-service'
export { runScan } from '@/modules/ai/services/scan-service'
export { handleInventoryEvent, registerAiEventHandlers } from '@/modules/ai/events/handlers'
export { publishAiEvents } from '@/modules/ai/events'
export type * from '@/modules/ai/events'
export type * from '@/modules/ai/domain/types'
