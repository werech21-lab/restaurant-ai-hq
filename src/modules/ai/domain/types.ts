import type { Currency } from '@/lib/money'

// ---- insights and alerts ----

export const insightSeverities = ['critical', 'warning', 'opportunity'] as const
export type InsightSeverity = (typeof insightSeverities)[number]

export const insightCategories = ['finance', 'inventory', 'crm'] as const
export type InsightCategory = (typeof insightCategories)[number]

export const insightStatuses = ['open', 'acknowledged', 'resolved'] as const
export type InsightStatus = (typeof insightStatuses)[number]

/** What `metricValue` counts: fils, a number of things, days or basis points. */
export const metricUnits = ['fils', 'count', 'days', 'bps'] as const
export type MetricUnit = (typeof metricUnits)[number]

export const insightEntityTypes = ['item', 'customer', 'lead', 'invoice'] as const
export type InsightEntityType = (typeof insightEntityTypes)[number]

export type Insight = {
  id: string
  ruleKey: RuleKey
  fingerprint: string
  severity: InsightSeverity
  category: InsightCategory
  titleAr: string
  descriptionAr: string
  metricValue: number
  metricUnit: MetricUnit
  status: InsightStatus
  sourceEntityType: InsightEntityType | null
  sourceEntityId: string | null
  detectedAt: string
  resolvedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

// ---- action approvals ----

export const actionTypes = [
  'auto_reorder',
  'credit_hold',
  'discount_approval',
  'price_adjustment',
  'payment_reminder',
  'lead_followup',
  'scenario_choice',
] as const
export type ActionType = (typeof actionTypes)[number]

export const approvalStatuses = ['pending', 'approved', 'rejected', 'executed'] as const
export type ApprovalStatus = (typeof approvalStatuses)[number]

/** A reference to a record the execution touched, so the screen can link to it. */
export type ResultRef = {
  type: 'stock_movement' | 'item' | 'customer' | 'quotation' | 'lead'
  id: string
}

/** A ready-to-send message. The system never sends it. `whatsappUrl` is null when the customer has no usable phone. */
export type DraftMessage = {
  textAr: string
  phone: string | null
  whatsappUrl: string | null
}

/** What executing a request did. Stored on the request and shown to the executive. */
export type ExecutionResult = {
  summaryAr: string
  refs: ResultRef[]
  message: DraftMessage | null
}

export type Approval = {
  id: string
  insightId: string | null
  ruleKey: RuleKey
  fingerprint: string
  actionType: ActionType
  titleAr: string
  summaryAr: string
  payloadJson: Record<string, unknown>
  /** Signed. What the business gains, collects or protects is positive. What it spends or gives up is negative. */
  estimatedImpactFils: number
  status: ApprovalStatus
  requestedByAiAt: string
  decidedBy: string | null
  decidedAt: string | null
  decisionNote: string | null
  resultJson: ExecutionResult | null
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

// ---- automation rules ----

export const ruleKeys = [
  'inventory.low_stock',
  'inventory.fast_depleting',
  'finance.payment_reminder',
  'finance.credit_hold',
  'finance.margin_floor',
  'crm.stalled_leads',
  'crm.discount_incentive',
  'operations.cost_scenarios',
] as const
export type RuleKey = (typeof ruleKeys)[number]

/** Events a rule can run on. A full scan runs every active rule whatever its trigger. */
export const SCAN_TRIGGER = 'ai.scan.requested'
export const REORDER_TRIGGER = 'inventory.item.reorder_level_reached'

export type AutomationRule = {
  id: string
  ruleKey: RuleKey
  name: string
  descriptionAr: string
  triggerEvent: string
  conditionJson: Record<string, unknown>
  actionType: ActionType
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

// ---- what the evaluators produce ----

export type InsightDraft = {
  severity: InsightSeverity
  category: InsightCategory
  titleAr: string
  descriptionAr: string
  metricValue: number
  metricUnit: MetricUnit
  sourceEntityType: InsightEntityType
  sourceEntityId: string
}

export type AutoReorderPayload = {
  itemId: string
  sku: string
  itemName: string
  warehouseId: string
  warehouseCode: string
  quantity: number
  unitCostMinor: number
  totalCostMinor: number
  currentStock: number
  reorderLevel: number
  /** The stock level the restock aims for. The request is stale once stock reaches it. */
  targetStock: number
  outQuantity: number
  windowDays: number
}

export type CustomerOverduePayload = {
  customerId: string
  customerName: string
  overdueMinor: number
  overdueInvoiceCount: number
  oldestDaysOverdue: number
  invoices: Array<{ id: string; number: string; dueDate: string; balanceMinor: number; daysOverdue: number }>
}

export type PriceAdjustmentPayload = {
  itemId: string
  sku: string
  itemName: string
  currentPriceMinor: number
  unitCostMinor: number
  newPriceMinor: number
  /** Null when the current price is zero, where a margin has no meaning. */
  currentMarginBps: number | null
  newMarginBps: number
  marginFloorBps: number
  outQuantity: number
  windowDays: number
}

export type DiscountPayload = {
  leadId: string
  leadTitle: string
  customerId: string
  customerName: string
  quotationId: string
  quoteNumber: string
  quotationVersion: number
  subtotalMinor: number
  discountBps: number
  estimatedDiscountMinor: number
}

export type LeadFollowupPayload = {
  leadId: string
  leadTitle: string
  stage: string
  probability: number
  expectedRevenueMinor: number
  daysStalled: number
  customerId: string
  customerName: string
}

export const scenarioOptionKeys = ['renegotiate', 'adjust_menu', 'reduce_waste'] as const
export type ScenarioOptionKey = (typeof scenarioOptionKeys)[number]

export type ScenarioOption = {
  key: ScenarioOptionKey
  impactMinor: number
  titleAr: string
  summaryAr: string
  newPriceMinor: number | null
}

export type ProposalDraft = {
  actionType: ActionType
  titleAr: string
  summaryAr: string
  payload: Record<string, unknown>
  estimatedImpactFils: number
}

/** One thing a rule found: the insight to show and, when it can be fixed, the action to approve. */
export type Finding = {
  ruleKey: RuleKey
  /** Same finding, same fingerprint, on every scan. It is what stops a rescan from creating duplicates. */
  fingerprint: string
  insight: InsightDraft
  proposal: ProposalDraft | null
}

// ---- dashboard ----

export type DashboardKpis = {
  currency: Currency
  /** Each block is null when the caller may not read that module. */
  revenue: { monthMinor: number; previousMonthMinor: number } | null
  receivables: { outstandingMinor: number; overdueMinor: number; overdueCount: number } | null
  inventory: { valuationMinor: number; lowStockCount: number; outOfStockCount: number } | null
  pipeline: { activeValueMinor: number; activeCount: number } | null
  pendingApprovals: number | null
  openInsights: { critical: number; warning: number; opportunity: number; total: number } | null
}

export type ScanSkip = { ruleKey: RuleKey; reason: 'missing_permission' | 'invalid_condition' | 'inactive' }

export type ScanResult = {
  scannedAt: string
  rulesRun: RuleKey[]
  skipped: ScanSkip[]
  findings: number
  insightsCreated: number
  insightsUpdated: number
  insightsResolved: number
  approvalsCreated: number
  approvalsUpdated: number
  approvalsWithdrawn: number
}

// ---- command bar ----

export type CommandResultKind = 'invoice' | 'item' | 'customer'

export type CommandResult = {
  kind: CommandResultKind
  id: string
  label: string
  detail: string
  href: string
}

export type CommandOutcome = {
  /** What the bar understood: run a scan, filter insights, or search records. */
  intent: 'scan' | 'filter' | 'search'
  insights: Insight[]
  results: CommandResult[]
  scan: ScanResult | null
}
