export type BriefProvider = 'anthropic' | 'google' | 'xai'

export type BriefModelStatus = 'ran' | 'failed' | 'rejected' | 'not_configured' | 'not_called'

export type BriefSectionStatus = 'linked' | 'not_linked' | 'unverified'

export const ODOO_SOURCE_MODELS = [
  'pos.order',
  'pos.order.line',
  'product.product',
  'account.move.line',
  'purchase.order',
] as const

export type OdooSourceModel = (typeof ODOO_SOURCE_MODELS)[number]

export type OdooDomainOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not in'

export type OdooDomainValue = string | number | boolean | string[] | number[]

export interface OdooDomainTerm {
  field: string
  operator: OdooDomainOperator
  value: OdooDomainValue
}

export type FactSourceGap =
  | 'missing_config_ids'
  | 'brand_unresolved'
  | 'commission_classifier'
  | 'aging_unverified'
  | 'missing_product_id'

export interface FactRecordRef {
  model: 'product.product'
  id: number
}

/** Odoo model, domain, and record ids that produced a fact. A URL is built later from ODOO_URL. */
export interface FactSource {
  model: OdooSourceModel
  domain: OdooDomainTerm[]
  records: FactRecordRef[]
  gap: FactSourceGap | null
  scopeLabel: string
}

export interface BriefFact {
  id: string
  metric: string
  period: string
  scope: string
  value: string
  unit: 'KWD' | 'orders'
  source?: FactSource | null
}

export interface BriefSection {
  id: string
  status: BriefSectionStatus
  noteAr: string
}

export interface BriefCitation {
  metric: string
  period: string
  scope: string
  value: string
  unit: string
  source?: FactSource | null
}

export interface BriefModelNote {
  provider: BriefProvider
  modelId: string
  text: string
}

export interface BriefFinding {
  factIds: string[]
  citations: BriefCitation[]
  notes: BriefModelNote[]
}

export interface BriefSupporter {
  provider: BriefProvider
  modelId: string
  solution: string
}

export interface BriefRecommendation {
  factIds: string[]
  citations: BriefCitation[]
  supporters: BriefSupporter[]
}

export interface BriefDispute {
  factIds: string[]
  citations: BriefCitation[]
  support: BriefSupporter[]
  dispute: BriefSupporter[]
}

export interface BriefDropped {
  factIds: string[]
  citations: BriefCitation[]
  provider: BriefProvider
  modelId: string
  solution: string
}

export interface BriefUnadoptedFinding {
  factIds: string[]
  citations: BriefCitation[]
  provider: BriefProvider
  modelId: string
  text: string
}

export type AdvisoryTopic = 'organization' | 'strategic_plan' | 'app_capability'

export interface BriefAdvisory {
  topic: AdvisoryTopic
  text: string
  provider: BriefProvider
  modelId: string
  kind: 'opinion'
}

export interface BriefProposal {
  id: string
  text: string
  provider: BriefProvider
  modelId: string
  status: 'proposed'
  kind: 'opinion'
}

export interface BriefModelState {
  provider: BriefProvider
  modelId: string
  status: BriefModelStatus
  errorCode: string | null
}

export interface StoredBriefReport {
  generatedAt: string
  trigger: 'schedule' | 'manual'
  configuration: 'configured' | 'not_configured'
  missingKeys: string[]
  odoo: 'linked' | 'not_linked'
  periods: { yesterday: string; prior: string } | null
  sections: BriefSection[]
  findings: BriefFinding[]
  unadoptedFindings: BriefUnadoptedFinding[]
  recommendations: BriefRecommendation[]
  disputed: BriefDispute[]
  dropped: BriefDropped[]
  advisory: BriefAdvisory[]
  proposals: BriefProposal[]
  models: BriefModelState[]
}

export interface ReviewedBriefItem {
  factIds: string[]
  text: string
  stance: 'support' | 'dispute'
}

export interface ReviewedAdvisoryItem {
  topic: AdvisoryTopic
  text: string
}

export interface ReviewedBriefModel {
  provider: BriefProvider
  modelId: string
  status: BriefModelStatus
  errorCode: string | null
  findings: ReviewedBriefItem[]
  recommendations: ReviewedBriefItem[]
  advisory: ReviewedAdvisoryItem[]
}
