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

export type DeskLog = { at: string; action: string; noteAr: string }

export type GovViolation = {
  id: string
  violationNumber: string
  issuingAuthority: string
  branchId: string | null
  violationTypeAr: string
  fineAmountMinor: number
  assignedEmployeeName: string
  slaDeadline: string
  workflowStage: string
  employeeStatementAr: string | null
  actionLog: DeskLog[]
  closureProofDocUrl: string | null
  isNeglectedFlag: boolean
  neglected: boolean
  version: number
  createdAt: string
}

export type ConnectedDevice = {
  id: string
  deviceType: 'biometric_terminal' | 'ai_camera_cctv' | 'work_phone_mdm'
  deviceName: string
  branchId: string | null
  ipOrStreamUrl: string
  status: 'online' | 'offline'
  version: number
}

export type MonitorEvent = {
  id: string
  deviceId: string
  deviceName: string
  branchId: string | null
  employeeName: string
  violationCategory: string
  aiConfidenceScore: number
  snapshotEvidenceRef: string
  autoActionTakenAr: string
  status: 'detected' | 'converted_to_investigation' | 'penalized' | 'dismissed'
  detectedAt: string
  version: number
}

export type InquiryStatement = { questionAr: string; answerAr: string }

export type Investigation = {
  id: string
  caseNumber: string
  sourceType: string
  sourceReferenceId: string | null
  subjectEmployeeName: string
  investigatorName: string
  incidentSummaryAr: string
  statements: InquiryStatement[]
  evidenceFiles: string[]
  legalFindingAr: string | null
  recommendedDisciplinaryActionAr: string | null
  managerFinalDecision: string | null
  status: string
  version: number
  createdAt: string
}

export type ExecutiveTask = {
  id: string
  alertCategory: string
  severity: 'critical' | 'high' | 'medium'
  titleAr: string
  aiRecommendationAr: string
  assignedToEmployee: string | null
  taskInstructionAr: string
  dueDate: string | null
  employeeCompletionReportAr: string | null
  status: string
  version: number
  createdAt: string
}

export type GeoRankSnapshot = {
  id: string
  snapshotIntervalTime: string
  platformName: 'Talabat' | 'Keeta' | 'Jahez' | 'Snoonu' | 'Deliveroo'
  geoZoneAr: string
  ourBrandName: string
  ourBranchName: string
  currentRank: number
  previousRank5mAgo: number
  rankDelta: number
  overallRatingBps: number
  reviewsCount: number
  estimatedVisitsImpressions: number
  conversionRateBps: number
  avgOrderAcceptanceSeconds: number
  prepTimeMinutes: number
  cancellationRateBps: number
  algorithmPenaltyReasonAr: string | null
  deliveryEtaMinutes: number
  deliveryFeeMinor: number
  minOrderMinor: number
  logisticsMode: 'platform_fleet' | 'vendor_own_fleet'
  isSponsoredAdActive: boolean
  recordedAt: string
  version: number
}

export type CompetitorBench = {
  id: string
  snapshotId: string
  platformName: 'Talabat' | 'Keeta' | 'Jahez' | 'Snoonu' | 'Deliveroo'
  geoZoneAr: string
  competitorRank: number
  competitorBrandName: string
  competitorRatingBps: number
  competitorReviewsCount: number
  competitorVisitsEstimate: number
  competitorEtaMinutes: number
  competitorDeliveryFeeMinor: number
  competitorLogisticsMode: 'platform_fleet' | 'vendor_own_fleet'
  competitorConversionBps: number
  activePromoBadgeAr: string
  detectedRatingBoostPolicyAr: string
  exactGapAnalysisAr: string
  gap: { rankGap: number; etaGapMinutes: number; feeGapMinor: number; ratingGapBps: number }
}

export type EscalationCard = {
  id: string
  platformName: 'Talabat' | 'Keeta' | 'Jahez' | 'Snoonu' | 'Deliveroo'
  geoZoneAr: string
  ourBranchName: string
  currentRank: number
  targetRank: number
  rootCauseAr: string
  recommendationAr: string
  actionType: string
  estimatedRankJump: number
  estimatedRevenueUpliftMinor: number
  penaltyDiagnosedAr: string
  stepByStepPlanAr: string
  logisticsSwitchAr: string
  ratingBoostTacticAr: string
  estimatedDailyOrdersGain: number
  estimatedMonthlyRevenueUpliftMinor: number
  status: 'pending' | 'approved_executing' | 'completed'
  createdAt: string
  version: number
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
