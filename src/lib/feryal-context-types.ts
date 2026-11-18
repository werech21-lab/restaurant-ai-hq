export type FeryalPackSectionStatus = 'ok' | 'unavailable'

export interface FeryalPackSource {
  model: string
  period: {
    from: string
    to: string
  }
  lastSyncAt: string | null
}

export interface FeryalPackSection<T> {
  status: FeryalPackSectionStatus
  reason?: string
  source: FeryalPackSource
  data?: T
}

export interface FeryalChatHistoryTurn {
  role: 'user' | 'assistant'
  text: string
}

export type AdvisorId = 'cfo' | 'delivery' | 'hr' | 'inventory' | 'seasons'

export interface AdvisorEvidenceNumber {
  value: number
  section: string
}

export interface AdvisorEvidenceItem {
  text: string
  numbers: AdvisorEvidenceNumber[]
  section: string
}

export interface AdvisorRootCauseItem {
  text: string
  kind: 'hypothesis'
}

export interface AdvisorProposalItem {
  text: string
  owner?: string
  kind: 'proposal'
}

export interface AdvisorReport {
  advisor: AdvisorId
  period: {
    from: string
    to: string
  }
  evidence: AdvisorEvidenceItem[]
  rootCauses: AdvisorRootCauseItem[]
  proposals: AdvisorProposalItem[]
}

export interface FeryalLlmNumberCitation {
  value: number
  section: string
}

export interface FeryalLlmClaim {
  text: string
  numbers: FeryalLlmNumberCitation[]
}

export interface FeryalLlmProposal {
  text: string
  owner: string
  kind: 'proposal'
}

export interface FeryalLlmRootCause {
  text: string
  kind: 'hypothesis'
}

export interface FeryalLlmContract {
  answer_ar: string
  claims: FeryalLlmClaim[]
  proposals: FeryalLlmProposal[]
  missing_metrics: string[]
  root_causes?: FeryalLlmRootCause[]
}

export interface FeryalCompanyTotalsData {
  netSalesKwd: number
  orders: number
  aovKwd: number
  mappedBranchesNetKwd: number
  unattributedSalesKwd: number
  totalDiscountKwd?: number
  avgDiscountPct?: number
  discountedLinesCount?: number
}

export type FeryalBranchGroup = 'restaurant' | 'canteen' | 'exhibition'

export interface FeryalBranchPackItem {
  branchId: string
  nameAr: string
  nameEn: string
  netKwd: number
  orders: number
  aovKwd: number
  group: FeryalBranchGroup
}

export interface FeryalBranchesData {
  items: FeryalBranchPackItem[]
}

export interface FeryalUnattributedData {
  labelAr: string
  labelEn: string
  netKwd: number
  orders: number
}

export interface FeryalChannelCompanyItem {
  channelId: string
  netKwd: number
  payments: number
  sharePct: number
}

export interface FeryalBranchChannelItem {
  channelId: string
  netKwd: number
  payments: number
}

export interface FeryalChannelsData {
  company: FeryalChannelCompanyItem[]
  byBranch: Record<string, FeryalBranchChannelItem[]>
}

export interface FeryalBrandPackItem {
  brandId: string
  nameAr: string
  nameEn: string
  netKwd: number
  orders: number | null
  qty?: number
}

export interface FeryalBrandsData {
  items: FeryalBrandPackItem[]
}

export interface FeryalTopProductPackItem {
  productId?: number | null
  name: string
  netKwd: number
  qty: number
}

export interface FeryalTopProductsData {
  items: FeryalTopProductPackItem[]
  totalDiscountKwd?: number
  discountedLinesCount?: number
}

export interface FeryalHourlyPoint {
  hour: number
  orders: number
  netKwd: number
}

export interface FeryalHourlyData {
  hourlySeries: FeryalHourlyPoint[]
  peakHour: FeryalHourlyPoint | null
  weakestHours: FeryalHourlyPoint[]
}

export interface FeryalDeltasData {
  currentNetKwd: number
  previousNetKwd: number
  deltaKwd: number
  deltaPct: number | null
  currentOrders: number
  previousOrders: number
  ordersDeltaPct: number | null
}

export interface FeryalGlData {
  totalRevenueKwd: number | null
  cogsKwd: number | null
  deliveryCommissionsKwd: number | null
  expenseKwd: number | null
  operatingProfitKwd: number | null
  profitWithheld: boolean
  glIncomplete: boolean
  glClosedThroughDate: string | null
}

export interface FeryalReceivablesData {
  openLinesCount: number
  pendingReconciliation: boolean
  statusAr: string
  statusEn: string
  fromDate?: string | null
  toDate?: string | null
}

export interface FeryalPurchasesVendorItem {
  name: string
  totalKwd: number
}

export interface FeryalPurchasesData {
  totalSpendKwd: number
  ordersCount: number
  topVendors?: FeryalPurchasesVendorItem[]
}

export interface FeryalStockData {
  transferCount: number
  scrapCount: number
  scrapQty?: number
}

export interface FeryalHrData {
  activeEmployeeCount: number
}

export interface FeryalContextPackPeriod {
  from: string
  to: string
  days: number
  labelAr: string
  labelEn: string
}

export interface FeryalContextPack {
  generatedAtIso: string
  connected: boolean
  period: FeryalContextPackPeriod
  previousPeriod: {
    from: string
    to: string
  }
  elapsedDaysInMonth: number
  totalDaysInMonth: number
  companyTotals: FeryalPackSection<FeryalCompanyTotalsData>
  branches: FeryalPackSection<FeryalBranchesData>
  unattributed: FeryalPackSection<FeryalUnattributedData>
  channels: FeryalPackSection<FeryalChannelsData>
  brands: FeryalPackSection<FeryalBrandsData>
  topProducts: FeryalPackSection<FeryalTopProductsData>
  hourly: FeryalPackSection<FeryalHourlyData>
  deltas: FeryalPackSection<FeryalDeltasData>
  gl: FeryalPackSection<FeryalGlData>
  receivables: FeryalPackSection<FeryalReceivablesData>
  purchases: FeryalPackSection<FeryalPurchasesData>
  stock: FeryalPackSection<FeryalStockData>
  hr: FeryalPackSection<FeryalHrData>
  advisorReports: AdvisorReport[]
  companyContext: string
}

export type FeryalPackSectionKey =
  | 'companyTotals'
  | 'branches'
  | 'unattributed'
  | 'channels'
  | 'brands'
  | 'topProducts'
  | 'hourly'
  | 'deltas'
  | 'gl'
  | 'receivables'
  | 'purchases'
  | 'stock'
  | 'hr'
