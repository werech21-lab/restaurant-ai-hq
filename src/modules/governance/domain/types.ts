import type { MemoryDomain } from '@/modules/governance/domain/learning'
import type { ArchiveCategory, ArchiveRoute } from '@/modules/governance/domain/ocr'
import type { RuleType } from '@/modules/governance/domain/gate'

export type ContractAnalysis = {
  id: string
  contractId: string | null
  documentName: string
  clausesSummaryAr: string
  risks: { code: string; detailAr: string }[]
  obligations: { party: string; textAr: string }[]
  penaltyClausesAr: string
  negotiationRecommendationsAr: string
  riskScore: number
  analyzedAt: string
}

export type Circular = {
  id: string
  authorityName: string
  regulationCode: string
  titleAr: string
  targetDepartment: string
  aiRecommendationAr: string
  status: 'pending' | 'enforced'
  version: number
}

export type EnforcementRule = {
  id: string
  circularId: string | null
  ruleCode: string
  ruleType: RuleType
  thresholdValue: number
  isActive: boolean
}

export type BlockedAttempt = {
  id: string
  ruleCode: string
  actorName: string
  module: string
  attemptedActionAr: string
  blockMessageAr: string
  createdAt: string
}

export type LearningMemory = {
  id: string
  contextDomain: MemoryDomain
  managerDecisionPattern: string
  recurringIssueDetected: string
  learnedWeightAdjustment: number
  confidenceScore: number
  updatedAt: string
}

export type ArchiveDocument = {
  id: string
  fileName: string
  fileType: 'pdf' | 'image' | 'text'
  documentCategory: ArchiveCategory
  extracted: { amountMinor: number; counterparty: string; fileType: string; route: ArchiveRoute }
  amountMinor: number
  routedToModule: ArchiveRoute
  routedRecordId: string | null
  status: 'pending' | 'routed' | 'blocked' | 'held' | 'archived'
  createdAt: string
}

export type TelemetryRow = {
  id: string
  userName: string
  role: string
  activePath: string
  actionSequence: string[]
  dwellTimeSeconds: number
  anomalyFlag: boolean
  riskLevel: 'low' | 'medium' | 'high'
  recordedAt: string
}

export type RadarRow = {
  id: string
  competitorName: string
  marketSegment: string
  itemOrService: string
  ourPriceMinor: number
  competitorPriceMinor: number
  promoDetectedAr: string
  aiExecutiveInsightAr: string
  recommendedCounterActionAr: string
  scannedAt: string
}
