/**
 * Venture Foods Restaurant Management W.L.L.
 * Brand Sales & Channel Analytics Types (Zero Static October Baselines)
 * ---------------------------------------------------------------------
 * All hardcoded October 2026 numbers (static sales totals, purchase totals, static
 * aggregator bank payouts, canceled brands, and legacy governorate strings)
 * have been purged. Live sales & channel figures come exclusively from
 * `useGlobalFilter()` / `/api/odoo-sync`.
 */

export type BrandKey =
  | 'ALL'
  | 'China Garden'
  | "Frank's"
  | 'Tahina'
  | 'Farm Brown'
  | 'The Noodle Bar'
  | 'Karak Cafeteria'

export type ChannelKey =
  | 'ALL'
  | 'Shop Sales'
  | 'Talabat Go'
  | 'Keeta'
  | 'Deliveroo Go'
  | 'Talabat MP'
  | 'Online payment link'
  | 'Snoonu'
  | 'Jahez'
  | 'Deliveroo MP'

export type BrandScorecardRow = {
  brand: string
  brandAr: string
  orders: number
  netSalesKwd: number
  sharePercent: number
  avgOrderValueKwd: number
  itemsPerOrder: number
  discountRatePercent: number
  drinksPercent: number
  startersPercent: number
  bestSellerEn: string
  bestSellerAr: string
  bestSellerSalesKwd: number
  lowOrderWarning?: boolean
}

export type ChannelScorecardRow = {
  channel: string
  channelAr: string
  orders: number
  netSalesKwd: number
  sharePercent: number
  avgOrderValueKwd: number
  itemsPerOrder: number
  discountRatePercent: number
  drinksPercent: number
  startersPercent: number
  dessertsPercent: number
}

export type MenuItemAnalytics = {
  id: string
  nameEn: string
  nameAr: string
  brand: BrandKey
  categoryEn: 'Mains' | 'Starters & Sides' | 'Drinks' | 'Rice & Noodles' | 'Desserts' | 'Combos'
  categoryAr:
    | 'الوجبات الرئيسية'
    | 'المقبلات والجانبيات'
    | 'المشروبات'
    | 'الأرز والنودلز'
    | 'الحلويات'
    | 'الوجبات والكومبو'
  priceKwd: number
  unitsSold: number
  salesKwd: number
  costPriceKwd: number
  marginPercent: number
  classification: 'TopPerformer' | 'HighDemand' | 'HighMargin' | 'SlowMover'
  shareOfBrandPercent: number
}

export type SlowMoverItem = {
  id: string
  nameEn: string
  nameAr: string
  brand: BrandKey
  categoryEn: string
  categoryAr: string
  priceKwd: number
  unitsSold: number
  salesKwd: number
  recommendedPlaybookId: number
  playbookTitleEn: string
  playbookTitleAr: string
}

export type PlaybookAction = {
  id: number
  titleEn: string
  titleAr: string
  taglineEn: string
  taglineAr: string
  descriptionEn: string
  descriptionAr: string
  expectedImpactEn: string
  expectedImpactAr: string
  color: string
}

export const ACTION_PLAYBOOKS: PlaybookAction[] = []
export const OCTOBER_BRAND_SCORECARDS: BrandScorecardRow[] = []
export const OCTOBER_CHANNEL_SCORECARDS: ChannelScorecardRow[] = []
export const TOP_BEST_SELLERS: MenuItemAnalytics[] = []
export const SLOW_MOVERS_LIST: SlowMoverItem[] = []
export const CATEGORY_BREAKDOWN: Array<{
  nameEn: string
  nameAr: string
  salesKwd: number
  sharePercent: number
  itemsSold: number
}> = []

export type FilteredDashboardState = {
  brand: BrandKey
  channel: ChannelKey
  kpi: {
    netSalesKwd: number
    orders: number
    avgOrderValueKwd: number
    itemsSold: number
    discountsGivenKwd: number
    shareOfGroupPercent: number
  }
  highlights: {
    biggestChannelTextEn: string
    biggestChannelTextAr: string
    bestSellerTextEn: string
    bestSellerTextAr: string
    menuConcentrationTextEn: string
    menuConcentrationTextAr: string
    addOnsTextEn: string
    addOnsTextAr: string
  }
  brands: BrandScorecardRow[]
  channels: ChannelScorecardRow[]
  bestSellers: MenuItemAnalytics[]
  slowMovers: SlowMoverItem[]
  categories: typeof CATEGORY_BREAKDOWN
}

export function computeFilteredDashboard(
  selectedBrand: BrandKey,
  selectedChannel: ChannelKey,
): FilteredDashboardState {
  return {
    brand: selectedBrand,
    channel: selectedChannel,
    kpi: {
      netSalesKwd: 0,
      orders: 0,
      avgOrderValueKwd: 0,
      itemsSold: 0,
      discountsGivenKwd: 0,
      shareOfGroupPercent: 0,
    },
    highlights: {
      biggestChannelTextEn: 'No data from Odoo for this period',
      biggestChannelTextAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      bestSellerTextEn: 'No data from Odoo for this period',
      bestSellerTextAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      menuConcentrationTextEn: 'No data from Odoo for this period',
      menuConcentrationTextAr: 'لا توجد بيانات من Odoo لهذه الفترة',
      addOnsTextEn: 'No data from Odoo for this period',
      addOnsTextAr: 'لا توجد بيانات من Odoo لهذه الفترة',
    },
    brands: [],
    channels: [],
    bestSellers: [],
    slowMovers: [],
    categories: [],
  }
}

export type AggregatorAuditRow = {
  channel: string
  channelAr: string
  grossSalesKwd: number
  commissionRatePercent: number
  commissionAmountKwd: number
  marketingFeesKwd: number
  expectedNetPayoutKwd: number
  bankReceivedKwd: number
  varianceKwd: number
  disputedOrders: number
  disputedAmountKwd: number
  bank: 'National Bank (NBK)' | 'Commercial Bank (CBK)' | 'Direct POS'
  payoutStatus: 'Settled' | 'Pending Verification' | 'Disputed'
  settlementCycle: 'Weekly' | 'Bi-weekly' | 'Instant'
}

export const OCTOBER_AGGREGATOR_AUDIT: AggregatorAuditRow[] = []

export type BranchPerformanceRow = {
  id: string
  nameEn: string
  nameAr: string
  areaEn: string
  areaAr: string
  netSalesKwd: number
  orders: number
  avgOrderValueKwd: number
  topBrandEn: string
  topBrandAr: string
  deliveryPercent: number
  dineInPercent: number
  peakHourEn: string
  peakHourAr: string
  staffCount: number
}

export const OCTOBER_BRANCH_PERFORMANCE: BranchPerformanceRow[] = []

export type HourlyHeatmapSlot = {
  hour: number
  labelEn: string
  labelAr: string
  orders: number
  salesKwd: number
  traffic: 'off-peak' | 'normal' | 'rush' | 'peak'
}

export const OCTOBER_HOURLY_HEATMAP: HourlyHeatmapSlot[] = []

export type StrategicReportMeta = {
  id: number
  titleEn: string
  titleAr: string
  categoryEn: string
  categoryAr: string
  summaryEn: string
  summaryAr: string
  filename: string
}

export const STRATEGIC_15_REPORTS: StrategicReportMeta[] = []
