/**
 * Venture Foods Restaurant Management Co. W.L.L. (CR 412891)
 * Exhibitions & Events Types & Pure Simulation Calculators
 * -------------------------------------------------------------
 * All static historical events, contract amounts, rosters, and menus
 * have been purged. Only pure mathematical break-even calculators remain.
 */

import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { isNonCompanyCatalogItem } from '@/lib/odoo/non-company-products'

export type EventStatus = 'feasibility' | 'licensing' | 'active' | 'closed'

export type EventType = 'mega_expo' | 'ministry_camp' | 'hotel_popup' | 'youth_sports' | 'seasonal'

export interface VentureEventCosts {
  boothRentalKwd: number
  securityDepositKwd: number
  securityDepositStatus: 'pending' | 'refunded' | 'partially_retained'
  constructionFitoutKwd: number
  permitsPowerKwd: number
  transportLogisticsKwd: number
  foodPackagingCogsKwd: number
  staffLaborOvertimeKwd: number
  wasteCompsKwd: number
  totalCostsKwd: number
}

export interface VentureEventRevenue {
  grossSalesKwd: number
  netSalesKwd: number
  knetSalesKwd: number
  applePaySalesKwd: number
  cashSalesKwd: number
  totalOrders: number
  aovKwd: number
  dailySalesVelocityKwd: number
}

export interface VentureEventProfitability {
  breakEvenPointKwd: number
  breakEvenDay: number
  netProfitKwd: number
  roiPercent: number
  profitMarginPercent: number
}

export interface VentureEvent {
  id: string
  code: string
  nameAr: string
  nameEn: string
  organizerAr: string
  organizerEn: string
  locationAr: string
  locationEn: string
  startDate: string
  endDate: string
  daysCount: number
  boothAreaSqM: number
  status: EventStatus
  eventType: EventType
  costCenterCode: string
  primaryBrands: string[]
  conceptDescriptionAr: string
  conceptDescriptionEn: string
  costs: VentureEventCosts
  revenue: VentureEventRevenue
  profitability: VentureEventProfitability
  assignedStaffCount: number
  projectManager: string
  notes: string
  bestSellingItemAr: string
  bestSellingItemEn: string
  leadSponsorOrClient?: string
}

export interface EventMenuItem {
  id: string
  nameAr: string
  nameEn: string
  brandAr: string
  brandEn: string
  brandKey: string
  categoryAr: string
  categoryEn: string
  recipeCostKwd: number
  packagingCostKwd: number
  totalUnitCostKwd: number
  eventSellingPriceKwd: number
  unitMarginKwd: number
  marginPercent: number
  prepTimeMinutes: number
  dailyParLevelWeekday: number
  dailyParLevelWeekend: number
  wasteRisk: 'very_low' | 'low' | 'medium'
  keyAllergensAr: string
  keyAllergensEn: string
  specialCookingEquipment: string
}

export interface BrandEventSuitability {
  brandKey: string
  nameAr: string
  nameEn: string
  suitabilityScore: number
  recommendedFor: EventType[]
  strengthsAr: string
  strengthsEn: string
  topEventItems: string[]
  recommendedCombinations: string[]
  historicalRoiPercent: number
}

export interface ProjectTaskItem {
  id: string
  phaseNumber: 1 | 2 | 3 | 4
  titleAr: string
  titleEn: string
  assignee: string
  roleAr: string
  roleEn: string
  daysOffset: string
  dueDate: string
  status: 'completed' | 'in_progress' | 'pending' | 'blocked'
  requiredDocumentAr?: string
  requiredDocumentEn?: string
}

export interface EquipmentChecklistItem {
  id: string
  nameAr: string
  nameEn: string
  category: 'cooking' | 'refrigeration' | 'pos_it' | 'safety' | 'furniture'
  assetCode: string
  assignedSourceWarehouse: string
  condition: 'excellent' | 'good' | 'maintenance_needed'
  powerWattage: string
  verifiedAtDispatch: boolean
  verifiedAtReturn: boolean
  returnStatus: 'pending' | 'returned_intact' | 'damaged' | 'missing'
}

export interface StaffRosterMember {
  id: string
  name: string
  roleAr: string
  roleEn: string
  civilId: string
  originBranchAr: string
  originBranchEn: string
  baladiyaHealthCardNo: string
  baladiyaExpiryDate: string
  isHealthCardValid: boolean
  dailyShiftHours: number
  overtimeRateHourlyKwd: number
  assignedStation: string
}

export interface CentralKitchenPrepQuota {
  itemCode: string
  nameAr: string
  nameEn: string
  unit: string
  weekdayParLevel: number
  weekendParLevel: number
  morningDispatchTime: string
  eveningDispatchTime: string
  tempRequirement: string
  shelfLifeHours: number
}

export interface BreakEvenSimulationInput {
  boothRentKwd: number
  fitoutSignageKwd: number
  permitsTransportKwd: number
  daysCount: number
  staffCount: number
  dailyWagePerStaffKwd: number
  expectedAovKwd: number
  estimatedCogsPercent: number
  dailyOtherFixedCostKwd: number
}

export interface BreakEvenSimulationResult {
  totalFixedCostsKwd: number
  totalLaborCostKwd: number
  totalPreOpeningCostsKwd: number
  dailyFixedCostKwd: number
  contributionMarginPercent: number
  contributionMarginPerOrderKwd: number
  totalBreakEvenSalesKwd: number
  totalBreakEvenOrders: number
  dailyBreakEvenOrders: number
  dailyBreakEvenSalesKwd: number
  projectedBreakEvenDay: number
  projectedNetProfitAtSales: (projectedTotalSalesKwd: number) => {
    projectedRevenueKwd: number
    totalCogsKwd: number
    grossProfitKwd: number
    netProfitKwd: number
    roiPercent: number
    profitMarginPercent: number
  }
}

export const VENTURE_FOODS_EVENTS: VentureEvent[] = []
export const BRAND_SUITABILITY_MATRIX: BrandEventSuitability[] = []
export const GOLDEN_EVENT_MENU: EventMenuItem[] = []
export const DEFAULT_EVENT_PROJECT_TASKS: ProjectTaskItem[] = []
export const CENTRAL_KITCHEN_EVENT_QUOTAS: CentralKitchenPrepQuota[] = []
export const EVENT_EQUIPMENT_ROSTER: EquipmentChecklistItem[] = []
export const EVENT_STAFF_ROSTER: StaffRosterMember[] = []

export function calculateBreakEven(input: BreakEvenSimulationInput): BreakEvenSimulationResult {
  const days = Math.max(1, input.daysCount)
  const totalPreOpeningCostsKwd = input.boothRentKwd + input.fitoutSignageKwd + input.permitsTransportKwd
  const totalLaborCostKwd = input.staffCount * input.dailyWagePerStaffKwd * days
  const totalOtherFixed = input.dailyOtherFixedCostKwd * days
  const totalFixedCostsKwd = totalPreOpeningCostsKwd + totalLaborCostKwd + totalOtherFixed
  const dailyFixedCostKwd = totalFixedCostsKwd / days

  const contributionMarginPercent = Math.max(0, 100 - input.estimatedCogsPercent)
  const cmRatio = contributionMarginPercent / 100
  const contributionMarginPerOrderKwd = input.expectedAovKwd * cmRatio

  const totalBreakEvenSalesKwd = cmRatio > 0 ? totalFixedCostsKwd / cmRatio : 0
  const totalBreakEvenOrders =
    contributionMarginPerOrderKwd > 0 ? Math.ceil(totalFixedCostsKwd / contributionMarginPerOrderKwd) : 0
  const dailyBreakEvenOrders = Math.ceil(totalBreakEvenOrders / days)
  const dailyBreakEvenSalesKwd = totalBreakEvenSalesKwd / days
  const projectedBreakEvenDay = days

  return {
    totalFixedCostsKwd,
    totalLaborCostKwd,
    totalPreOpeningCostsKwd,
    dailyFixedCostKwd,
    contributionMarginPercent,
    contributionMarginPerOrderKwd,
    totalBreakEvenSalesKwd,
    totalBreakEvenOrders,
    dailyBreakEvenOrders,
    dailyBreakEvenSalesKwd,
    projectedBreakEvenDay,
    projectedNetProfitAtSales: (projectedTotalSalesKwd: number) => {
      const totalCogsKwd = projectedTotalSalesKwd * (input.estimatedCogsPercent / 100)
      const grossProfitKwd = projectedTotalSalesKwd - totalCogsKwd
      const netProfitKwd = grossProfitKwd - totalFixedCostsKwd
      const roiPercent = totalFixedCostsKwd > 0 ? (netProfitKwd / totalFixedCostsKwd) * 100 : 0
      const profitMarginPercent = projectedTotalSalesKwd > 0 ? (netProfitKwd / projectedTotalSalesKwd) * 100 : 0
      return {
        projectedRevenueKwd: projectedTotalSalesKwd,
        totalCogsKwd,
        grossProfitKwd,
        netProfitKwd,
        roiPercent,
        profitMarginPercent,
      }
    },
  }
}

export function recommendBrandForEvent(
  _eventType: EventType,
  _expectedDailyVisitors: number,
  _averageBudgetPerPerson: 'budget' | 'medium' | 'premium',
): {
  primaryBrands: string[]
  recommendedConceptAr: string
  recommendedConceptEn: string
  reasoningAr: string
  reasoningEn: string
  projectedAovKwd: number
  recommendedMenu: EventMenuItem[]
  suggestedBoothSqM: number
  recommendedStaffCount: number
} {
  return {
    primaryBrands: [],
    recommendedConceptAr: 'غير مربوط بمصدر',
    recommendedConceptEn: 'Not linked to a data source',
    reasoningAr: 'غير مربوط بمصدر بيانات تاريخي للفعاليات في Odoo.',
    reasoningEn: 'Not linked to historical event records in Odoo.',
    projectedAovKwd: 0,
    recommendedMenu: [],
    suggestedBoothSqM: 0,
    recommendedStaffCount: 0,
  }
}

export interface EXBMenuItem {
  code: string
  nameAr: string
  nameEn: string
  brandKey: string
  brandNameAr: string
  brandNameEn: string
  categoryAr: string
  categoryEn: string
  standardBranchPriceKwd: number
  previousExbPriceKwd: number
  recommendedExbPriceKwd: number
  foodPackagingCogsKwd: number
  prepTimeSeconds: number
  activeOnMenu: boolean
  isSpecialSpecialty?: boolean
  notes?: string
}

export const OFFICIAL_EXB_MENUS: EXBMenuItem[] = []

export interface HistoricalBenchmarkRecord {
  id: string
  nameAr: string
  nameEn: string
  periodSeason: string
  daysCount: number
  boothRentKwd: number
  dailyRentKwd: number
  dailySalesKwd: number
  dailyBreakEvenKwd: number
  cogsPercent: number
  rentToSalesPercent: number
  netProfitKwd: number
  netProfitPercent: number
  roiPercent: number
  primaryBrands: string[]
  viabilityStatus: 'highly_viable' | 'caution_renegotiate' | 'high_risk'
  verdictAr: string
  verdictEn: string
}

export const HISTORICAL_BENCHMARKS: HistoricalBenchmarkRecord[] = []

export interface ScenarioMetrics {
  trafficFactor: number
  scenarioNameAr: string
  scenarioNameEn: string
  dailyOrders: number
  totalOrders: number
  dailySalesKwd: number
  grossSalesKwd: number
  cogsKwd: number
  cogsPercent: number
  grossProfitKwd: number
  rentKwd: number
  rentToSalesPercent: number
  rentWarning: boolean
  fitoutAmortizedKwd: number
  staffLaborKwd: number
  marketingOpexKwd: number
  totalOpexKwd: number
  netProfitKwd: number
  netProfitMarginPercent: number
  roiPercent: number
  dailyBreakEvenSalesKwd: number
  dailyBreakEvenOrders: number
  breakEvenDay: number
}

export interface ThreeScenarioInput {
  daysCount: number
  totalRentKwd: number
  fitoutKwd: number
  staffCount: number
  dailyWagePerStaffKwd: number
  expectedAovKwd: number
  estimatedCogsPercent: number
  marketingOpexKwd: number
  baselineDailyOrders: number
  selectedBrands: string[]
}

export interface ThreeScenarioOutput {
  conservative: ScenarioMetrics
  realistic: ScenarioMetrics
  optimistic: ScenarioMetrics
  dailyRentKwd: number
  securityDepositKwd: number
  brandBreakdown: {
    brandName: string
    sharePercent: number
    realisticSalesKwd: number
    realisticCogsKwd: number
    realisticGrossProfitKwd: number
  }[]
}

export function calculateThreeScenarios(input: ThreeScenarioInput): ThreeScenarioOutput {
  const days = Math.max(1, input.daysCount)
  const dailyRent = input.totalRentKwd / days
  const securityDeposit = Math.round(input.totalRentKwd * 0.25)
  const totalLabor = input.staffCount * input.dailyWagePerStaffKwd * days
  const fixedOverheads = input.totalRentKwd + input.fitoutKwd + totalLabor + input.marketingOpexKwd

  const buildScenario = (factor: number, nameAr: string, nameEn: string): ScenarioMetrics => {
    const dailyOrders = Math.round(input.baselineDailyOrders * factor)
    const totalOrders = dailyOrders * days
    const dailySales = dailyOrders * input.expectedAovKwd
    const grossSales = dailySales * days
    const cogsKwd = grossSales * (input.estimatedCogsPercent / 100)
    const grossProfit = grossSales - cogsKwd
    const rentToSales = grossSales > 0 ? (input.totalRentKwd / grossSales) * 100 : 100
    const rentWarning = rentToSales > 30.0
    const totalOpex = fixedOverheads
    const netProfit = grossProfit - totalOpex
    const margin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0
    const roi = totalOpex > 0 ? (netProfit / totalOpex) * 100 : 0

    const marginPerOrder = input.expectedAovKwd * (1 - input.estimatedCogsPercent / 100)
    const totalBeOrders = marginPerOrder > 0 ? Math.ceil(totalOpex / marginPerOrder) : 0
    const dailyBeOrders = Math.ceil(totalBeOrders / days)
    const dailyBeSales = dailyBeOrders * input.expectedAovKwd

    const dailyNetContribution =
      dailySales * (1 - input.estimatedCogsPercent / 100) -
      input.staffCount * input.dailyWagePerStaffKwd -
      dailyRent
    const preOpening = input.fitoutKwd + input.marketingOpexKwd
    const beDay =
      dailyNetContribution > 0 ? Math.min(days, Math.max(1, Math.ceil(preOpening / dailyNetContribution))) : days

    return {
      trafficFactor: factor,
      scenarioNameAr: nameAr,
      scenarioNameEn: nameEn,
      dailyOrders,
      totalOrders,
      dailySalesKwd: dailySales,
      grossSalesKwd: grossSales,
      cogsKwd,
      cogsPercent: input.estimatedCogsPercent,
      grossProfitKwd: grossProfit,
      rentKwd: input.totalRentKwd,
      rentToSalesPercent: rentToSales,
      rentWarning,
      fitoutAmortizedKwd: input.fitoutKwd,
      staffLaborKwd: totalLabor,
      marketingOpexKwd: input.marketingOpexKwd,
      totalOpexKwd: totalOpex,
      netProfitKwd: netProfit,
      netProfitMarginPercent: margin,
      roiPercent: roi,
      dailyBreakEvenSalesKwd: dailyBeSales,
      dailyBreakEvenOrders: dailyBeOrders,
      breakEvenDay: beDay,
    }
  }

  const conservative = buildScenario(0.8, 'السيناريو المتحفظ (80% تقدير)', 'Conservative (80% Estimate)')
  const realistic = buildScenario(1.0, 'السيناريو الأساسي (100% تقدير)', 'Baseline (100% Estimate)')
  const optimistic = buildScenario(1.25, 'السيناريو المتفائل (125% تقدير)', 'Optimistic (125% Estimate)')

  const cleanSelectedBrands = input.selectedBrands.filter(
    (brandName) =>
      Boolean(brandName && brandName.trim()) &&
      !isExcludedOdooEntity(brandName) &&
      !isNonCompanyCatalogItem(null, brandName),
  )
  const brandCount = Math.max(1, cleanSelectedBrands.length)
  const share = 100 / brandCount
  const brandBreakdown = cleanSelectedBrands.map((brandName) => {
    const brandSales = realistic.grossSalesKwd * (share / 100)
    const brandCogs = brandSales * (input.estimatedCogsPercent / 100)
    return {
      brandName,
      sharePercent: share,
      realisticSalesKwd: brandSales,
      realisticCogsKwd: brandCogs,
      realisticGrossProfitKwd: brandSales - brandCogs,
    }
  })

  return {
    conservative,
    realistic,
    optimistic,
    dailyRentKwd: dailyRent,
    securityDepositKwd: securityDeposit,
    brandBreakdown,
  }
}

export interface EventContractRiskDetail {
  id: string
  titleAr: string
  titleEn: string
  category: 'cooking_flame' | 'engineering_fitout' | 'operating_hours' | 'payment_deposit' | 'moci_compliance'
  severity: 'critical' | 'high' | 'medium'
  extractedClauseAr: string
  extractedClauseEn: string
  systemRecommendationAr: string
  systemRecommendationEn: string
  actionOwner: string
  deadline: string
  equipmentOrActionList?: string[]
}

export interface EventContractIntelligence {
  contractId: string
  contractFileName: string
  eventNameAr: string
  eventNameEn: string
  organizerAr: string
  organizerEn: string
  organizerContact: string
  locationAr: string
  locationEn: string
  commercialLicenseNo: string
  licenseHolderName: string
  licenseHolderCivilId: string
  permittedBrand: string
  startDate: string
  endDate: string
  daysCount: number
  boothDimensions: string
  boothAreaSqM: number
  boothType: string
  rentAmountKwd: number
  securityDepositKwd: number
  totalImmediateDueKwd: number
  paymentMethod: string
  paymentDeadlineHours: number
  withdrawalNoticeDays: number
  depositRefundConditionAr: string
  ministerialDecreeRef: string
  operationalRisks: EventContractRiskDetail[]
  actionPlanMilestones: {
    id: string
    phaseNumber: 1 | 2 | 3 | 4
    phaseAr: string
    phaseEn: string
    titleAr: string
    titleEn: string
    deadlineAr: string
    deadlineEn: string
    ownerAr: string
    detailsAr: string
    detailsEn: string
    completed: boolean
  }[]
  mociPledgeTemplate: {
    decreeNumber: string
    year: string
    companyName: string
    crNumber: string
    licenseNumber: string
    authorizedSignatory: string
    civilId: string
    organizerName: string
    eventName: string
    permittedBrand: string
    boothNumber: string
    clauses: string[]
  }
}

export const MARINA_KASHTA_CONTRACT_DATA: EventContractIntelligence = {
  contractId: '',
  contractFileName: '',
  eventNameAr: 'غير مربوط بمصدر',
  eventNameEn: 'Not linked to a data source',
  organizerAr: '',
  organizerEn: '',
  organizerContact: '',
  locationAr: '',
  locationEn: '',
  commercialLicenseNo: '',
  licenseHolderName: '',
  licenseHolderCivilId: '',
  permittedBrand: '',
  startDate: '',
  endDate: '',
  daysCount: 0,
  boothDimensions: '',
  boothAreaSqM: 0,
  boothType: '',
  rentAmountKwd: 0,
  securityDepositKwd: 0,
  totalImmediateDueKwd: 0,
  paymentMethod: '',
  paymentDeadlineHours: 0,
  withdrawalNoticeDays: 0,
  depositRefundConditionAr: '',
  ministerialDecreeRef: '',
  operationalRisks: [],
  actionPlanMilestones: [],
  mociPledgeTemplate: {
    decreeNumber: '',
    year: '',
    companyName: '',
    crNumber: '',
    licenseNumber: '',
    authorizedSignatory: '',
    civilId: '',
    organizerName: '',
    eventName: '',
    permittedBrand: '',
    boothNumber: '',
    clauses: [],
  },
}
