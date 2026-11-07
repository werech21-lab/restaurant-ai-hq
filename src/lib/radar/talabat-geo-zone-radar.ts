/**
 * talabat-geo-zone-radar.ts
 * ==============================================================================
 * Venture Foods W.L.L. - Kuwait Geo-Spatial & Aggregator Radar Engine
 * ------------------------------------------------------------------------------
 * Strictly separates 4 operational concepts:
 * 1. الفروع الفعلية للمطعم (Restaurant Branches): 8 real operational branches
 *    (السالمية، شرق، حولي، الفحيحيل/الكوت، العارضية، الفروانية، المهبولة، صباح السالم/مبارك الكبير)
 * 2. أفرع المناطق وتغطية المطعم (Restaurant Zone Accounts): Platform accounts covering
 *    sectors under each branch via Tgo (Talabat Go - توصيل المنصة) or M (Marketplace - توصيل المطعم)
 * 3. مناطق الزبائن (Customer Delivery Areas): Residential areas where customers order from,
 *    mapped to the serving Restaurant Branch and coverage mode (Tgo or M).
 * ==============================================================================
 */
import { zoneLabelAr } from '@/modules/governance/domain/zone-labels'

export type DeliveryZoneStatus =
  | 'ONLINE_VISIBLE'     // 🟢 متاح وظاهر للعميل
  | 'BUSY_IN_AREA'       // 🟡 مشغول في المنطقة (Busy in Zone)
  | 'AREA_CLOSED_HIDDEN' // 🔴 المنطقة مقطوعة / المطعم مخفي (Polygon Shrunk)
  | 'FORCED_TGO_17'      // 🟠 تحول قسري من توصيل المطعم M 10% إلى Tgo 17%

export type AccountDeliveryMode = 'Tgo' | 'M'

export type RadarPlatform = 'Talabat' | 'Deliveroo' | 'Keeta' | 'Jahez'

export type IncidentRootCause =
  | 'TALABAT_FLEET_SHORTAGE' // نقص أسطول سائقي طلبات في المنطقة (Talabat Fleet Shortage)
  | 'PEAK_RADIUS_CUT'        // تقليص مضلع التوصيل وقت الذروة (Peak Radius Cut)
  | 'HIGH_KITCHEN_LOAD'      // ضغط المطبخ والطلبات (High Kitchen Load)
  | 'MANUAL_TABLET_STOP'     // إيقاف يدوي مؤقت (Manual Tablet Stop)

/** ثانياً: أفرع المناطق وتغطية المطعم (Restaurant Zone Accounts) */
export interface RestaurantZoneAccount {
  accountId: string
  accountCode: string
  accountNameAr: string
  accountNameEn: string
  branchId: string
  branchCode: string
  branchNameAr: string
  branchNameEn: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  platform: RadarPlatform
  deliveryMode: AccountDeliveryMode
  commissionPct: number
  sectorNameAr: string
  sectorNameEn: string
  coveredAreasAr: string[]
  coveredAreasEn: string[]
  status: DeliveryZoneStatus
}

/** ثالثاً: مناطق الزبائن (Customer Delivery Areas) */
export interface AreaZoneRecord {
  id: string
  zoneNameAr: string
  zoneNameEn: string
  distanceKm: number
  deliveryMode: AccountDeliveryMode
  platform: RadarPlatform
  brandId: string
  brandNameAr: string
  brandNameEn: string
  zoneAccountId: string
  zoneAccountNameAr: string
  zoneAccountNameEn: string
  status: DeliveryZoneStatus
  startTime: string
  endTime: string | null
  isOngoing: boolean
  durationMinutes: number
  rootCause: IncidentRootCause
  rootCauseLabelAr: string
  rootCauseLabelEn: string
  estimatedLostOrders: number
  estimatedLostKwd: number
  forcedTgoPenaltyKwd: number
}

/** أولاً: الفروع الفعلية للمطعم (Restaurant Branches) */
export interface BranchRadarProfile {
  branchId: string
  branchCode: string
  branchNameAr: string
  branchNameEn: string
  primaryBrandId: string
  primaryBrandNameAr: string
  primaryBrandNameEn: string
  supportedBrandIds: string[]
  tabletOnline: boolean
  batteryPct: number
  assignedFleetType: 'TALABAT_GO_17' | 'HYBRID_TMP_TGO'
  totalZonesCount: number
  onlineZonesCount: number
  busyZonesCount: number
  hiddenZonesCount: number
  openRatioPct: number
  totalLostKwdToday: number
  zoneAccounts: RestaurantZoneAccount[]
  zones: AreaZoneRecord[]
}

export interface ChronologicalIncident {
  id: string
  timestamp: string
  date: string
  brandNameAr: string
  brandNameEn: string
  branchNameAr: string
  branchNameEn: string
  zoneNameAr: string
  zoneNameEn: string
  status: DeliveryZoneStatus
  startTime: string
  endTime: string
  durationMinutes: number
  isOngoing: boolean
  rootCauseLabelAr: string
  rootCauseLabelEn: string
  faultParty: 'TALABAT' | 'BRANCH'
  lostOrders: number
  lostKwd: number
  penaltyKwd: number
  remedyActionAr: string
  remedyActionEn: string
}

export interface GeoRadarKpis {
  totalMonitoredZones: number
  onlineZonesCount: number
  onlineZonesPct: number
  busyZonesCount: number
  avgBusyDurationMinutes: number
  hiddenZonesCount: number
  forcedTgoZonesCount: number
  totalLostSalesKwd: number
  totalTgoPenaltiesKwd: number
  totalFinancialImpactKwd: number
  totalActiveAccounts: number
  tgoAccountsCount: number
  mAccountsCount: number
  issueAccountsCount: number
  lastScannedAt: string
}

// ------------------------------------------------------------------------------
// 6 OFFICIAL VENTURE FOODS BRANDS
// ------------------------------------------------------------------------------
export const VENTURE_BRANDS = [
  { id: 'china-garden', nameAr: 'تشاينا جاردن', nameEn: 'China Garden', color: '#2563EB' },
  { id: 'franks', nameAr: 'فرانكس', nameEn: "Frank's", color: '#DC2626' },
  { id: 'tahina', nameAr: 'شاورما طحينة', nameEn: 'Tahina', color: '#059669' },
  { id: 'farm-brown', nameAr: 'فارم براون', nameEn: 'Farm Brown', color: '#7C3AED' },
  { id: 'noodle-bar', nameAr: 'ذا نودل بار', nameEn: 'The Noodle Bar', color: '#0891B2' },
  { id: 'karak-cafeteria', nameAr: 'كرك كافتيريا', nameEn: 'Karak Cafeteria', color: '#EA580C' },
] as const

export const PERMANENTLY_CLOSED_BRANCHES: any[] = []

// ------------------------------------------------------------------------------
// 8 ACTUAL OPERATIONAL RESTAURANT BRANCHES (الفروع الفعلية للمطعم)
// 1. السالمية (Salmiya)
// 2. شرق (Sharq)
// 3. حولي (Hawally)
// 4. الفحيحيل / الكوت (Fahaheel / Al-Kout)
// 5. العارضية (Ardiya)
// 6. الفروانية (Farwaniya)
// 7. المهبولة (Mahboula)
// 8. صباح السالم / مبارك الكبير (Sabah Al-Salem / Mubarak Al-Kabeer)
// ------------------------------------------------------------------------------
export const INITIAL_BRANCH_PROFILES: BranchRadarProfile[] = [
  // 1. فرع السالمية
  {
    branchId: 'BR-SLM',
    branchCode: 'SLM',
    branchNameAr: 'فرع السالمية',
    branchNameEn: 'Salmiya Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'noodle-bar', 'karak-cafeteria'],
    tabletOnline: true,
    batteryPct: 94,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 6,
    onlineZonesCount: 4,
    busyZonesCount: 1,
    hiddenZonesCount: 1,
    openRatioPct: 66.7,
    totalLostKwdToday: 68.500,
    zoneAccounts: [
      {
        accountId: 'ACC-SLM-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع السالمية (Tgo)',
        accountNameEn: 'China Garden - Salmiya Sector Account (Tgo)',
        branchId: 'BR-SLM',
        branchCode: 'SLM',
        branchNameAr: 'فرع السالمية',
        branchNameEn: 'Salmiya Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع السالمية والرميثية وسلوى وبيان',
        sectorNameEn: 'Salmiya, Rumaithiya, Salwa & Bayan Sector',
        coveredAreasAr: ['السالمية', 'الرميثية', 'سلوى', 'بيان'],
        coveredAreasEn: ['Salmiya', 'Rumaithiya', 'Salwa', 'Bayan'],
        status: 'BUSY_IN_AREA',
      },
      {
        accountId: 'ACC-SLM-CG-M',
        accountCode: '101513',
        accountNameAr: 'تشاينا جاردن - حساب توصيل المطعم السالمية (TMP)',
        accountNameEn: 'China Garden - Salmiya Marketplace Account (TMP)',
        branchId: 'BR-SLM',
        branchCode: 'SLM',
        branchNameAr: 'فرع السالمية',
        branchNameEn: 'Salmiya Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - السالمية والرميثية وميدان حولي',
        sectorNameEn: 'Restaurant Fleet - Salmiya, Rumaithiya & Maidan Hawally',
        coveredAreasAr: ['السالمية', 'الرميثية', 'ميدان حولي'],
        coveredAreasEn: ['Salmiya', 'Rumaithiya', 'Maidan Hawally'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-SLM-NB-KEETA',
        accountCode: '101527',
        accountNameAr: 'ذا نودل بار - حساب كيتا السالمية (Tgo)',
        accountNameEn: 'The Noodle Bar - Salmiya Keeta Account (Tgo)',
        branchId: 'BR-SLM',
        branchCode: 'SLM',
        branchNameAr: 'فرع السالمية',
        branchNameEn: 'Salmiya Branch',
        brandId: 'noodle-bar',
        brandNameAr: 'ذا نودل بار',
        brandNameEn: 'The Noodle Bar',
        platform: 'Keeta',
        deliveryMode: 'Tgo',
        commissionPct: 12,
        sectorNameAr: 'قطاع السالمية والشعب البحري',
        sectorNameEn: 'Salmiya & Shaab Seafront Sector',
        coveredAreasAr: ['السالمية', 'الشعب البحري'],
        coveredAreasEn: ['Salmiya', 'Shaab Seafront'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-SLM-FR-DELIVEROO-M',
        accountCode: '101515',
        accountNameAr: 'فرانكس - حساب ديليفرو توصيل المطعم (TMP)',
        accountNameEn: "Frank's - Salmiya Deliveroo Marketplace (TMP)",
        branchId: 'BR-SLM',
        branchCode: 'SLM',
        branchNameAr: 'فرع السالمية',
        branchNameEn: 'Salmiya Branch',
        brandId: 'franks',
        brandNameAr: 'فرانكس',
        brandNameEn: "Frank's",
        platform: 'Deliveroo',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - السالمية والبدع',
        sectorNameEn: 'Restaurant Fleet - Salmiya & Bidaa',
        coveredAreasAr: ['السالمية', 'الرميثية'],
        coveredAreasEn: ['Salmiya', 'Rumaithiya'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      {
        id: 'SLM-Z1',
        zoneNameAr: 'السالمية',
        zoneNameEn: 'Salmiya',
        distanceKm: 1.2,
        deliveryMode: 'M',
        platform: 'Talabat',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        zoneAccountId: 'ACC-SLM-CG-M',
        zoneAccountNameAr: 'تشاينا جاردن - حساب توصيل المطعم السالمية (TMP)',
        zoneAccountNameEn: 'China Garden - Salmiya Marketplace Account (TMP)',
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - تغطية أسطول المطعم (TMP) متاحة',
        rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP) Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z2',
        zoneNameAr: 'الرميثية',
        zoneNameEn: 'Rumaithiya',
        distanceKm: 2.8,
        deliveryMode: 'M',
        platform: 'Talabat',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        zoneAccountId: 'ACC-SLM-CG-M',
        zoneAccountNameAr: 'تشاينا جاردن - حساب توصيل المطعم السالمية (TMP)',
        zoneAccountNameEn: 'China Garden - Salmiya Marketplace Account (TMP)',
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - تغطية أسطول المطعم (TMP) متاحة',
        rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP) Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z3',
        zoneNameAr: 'سلوى',
        zoneNameEn: 'Salwa',
        distanceKm: 4.1,
        deliveryMode: 'Tgo',
        platform: 'Talabat',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        zoneAccountId: 'ACC-SLM-CG-TGO',
        zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع السالمية (Tgo)',
        zoneAccountNameEn: 'China Garden - Salmiya Sector Account (Tgo)',
        status: 'BUSY_IN_AREA',
        startTime: '01:15 PM',
        endTime: '02:05 PM',
        isOngoing: false,
        durationMinutes: 50,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في منطقة سلوى',
        rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Salwa',
        estimatedLostOrders: 5,
        estimatedLostKwd: 27.500,
        forcedTgoPenaltyKwd: 4.675,
      },
      {
        id: 'SLM-Z4',
        zoneNameAr: 'بيان',
        zoneNameEn: 'Bayan',
        distanceKm: 5.2,
        deliveryMode: 'Tgo',
        platform: 'Talabat',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        zoneAccountId: 'ACC-SLM-CG-TGO',
        zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع السالمية (Tgo)',
        zoneAccountNameEn: 'China Garden - Salmiya Sector Account (Tgo)',
        status: 'AREA_CLOSED_HIDDEN',
        startTime: '01:25 PM',
        endTime: null,
        isOngoing: true,
        durationMinutes: 42,
        rootCause: 'PEAK_RADIUS_CUT',
        rootCauseLabelAr: 'تقليص مضلع توصيل المنصة (Tgo) وقت الذروة',
        rootCauseLabelEn: 'Platform (Tgo) Peak Radius Shrinkage (< 3km)',
        estimatedLostOrders: 7,
        estimatedLostKwd: 41.000,
        forcedTgoPenaltyKwd: 6.970,
      },
      {
        id: 'SLM-Z5',
        zoneNameAr: 'الشعب البحري',
        zoneNameEn: 'Shaab Seafront',
        distanceKm: 3.9,
        deliveryMode: 'Tgo',
        platform: 'Keeta',
        brandId: 'noodle-bar',
        brandNameAr: 'ذا نودل بار',
        brandNameEn: 'The Noodle Bar',
        zoneAccountId: 'ACC-SLM-NB-KEETA',
        zoneAccountNameAr: 'ذا نودل بار - حساب كيتا السالمية (Tgo)',
        zoneAccountNameEn: 'The Noodle Bar - Salmiya Keeta Account (Tgo)',
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo) متاحة',
        rootCauseLabelEn: 'Normal - Platform Fleet (Tgo) Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z6',
        zoneNameAr: 'ميدان حولي',
        zoneNameEn: 'Maidan Hawally',
        distanceKm: 2.5,
        deliveryMode: 'M',
        platform: 'Deliveroo',
        brandId: 'franks',
        brandNameAr: 'فرانكس',
        brandNameEn: "Frank's",
        zoneAccountId: 'ACC-SLM-FR-DELIVEROO-M',
        zoneAccountNameAr: 'فرانكس - حساب ديليفرو توصيل المطعم (TMP)',
        zoneAccountNameEn: "Frank's - Salmiya Deliveroo Marketplace (TMP)",
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP) متاحة',
        rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP) Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
    ],
  },

  // 2. فرع شرق
  {
    branchId: 'BR-SHQ',
    branchCode: 'SHQ',
    branchNameAr: 'فرع شرق',
    branchNameEn: 'Sharq Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'tahina'],
    tabletOnline: true,
    batteryPct: 91,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 6,
    onlineZonesCount: 6,
    busyZonesCount: 0,
    hiddenZonesCount: 0,
    openRatioPct: 100.0,
    totalLostKwdToday: 0.000,
    zoneAccounts: [
      {
        accountId: 'ACC-SHQ-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع شرق والعاصمة (Tgo)',
        accountNameEn: 'China Garden - Sharq & Capital Sector Account (Tgo)',
        branchId: 'BR-SHQ',
        branchCode: 'SHQ',
        branchNameAr: 'فرع شرق',
        branchNameEn: 'Sharq Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع مدينة الكويت وشرق وبنيد القار والدسمة',
        sectorNameEn: 'Kuwait City, Sharq, Bneid Al-Gar & Dasma Sector',
        coveredAreasAr: ['شرق', 'دسمان', 'بنيد القار', 'الدسمة'],
        coveredAreasEn: ['Sharq', 'Dasman', 'Bneid Al-Gar', 'Dasma'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-SHQ-FR-M',
        accountCode: '101513',
        accountNameAr: 'فرانكس - حساب توصيل المطعم شرق (TMP)',
        accountNameEn: "Frank's - Sharq Marketplace Account (TMP)",
        branchId: 'BR-SHQ',
        branchCode: 'SHQ',
        branchNameAr: 'فرع شرق',
        branchNameEn: 'Sharq Branch',
        brandId: 'franks',
        brandNameAr: 'فرانكس',
        brandNameEn: "Frank's",
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - شرق والمرقاب وقبلة والدعية',
        sectorNameEn: 'Restaurant Fleet - Sharq, Mirqab, Qibla & Daiya',
        coveredAreasAr: ['شرق', 'المرقاب', 'الدعية'],
        coveredAreasEn: ['Sharq', 'Mirqab', 'Daiya'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-SHQ-TH-KEETA',
        accountCode: '101527',
        accountNameAr: 'شاورما طحينة - حساب كيتا شرق (Tgo)',
        accountNameEn: 'Tahina - Sharq Keeta Account (Tgo)',
        branchId: 'BR-SHQ',
        branchCode: 'SHQ',
        branchNameAr: 'فرع شرق',
        branchNameEn: 'Sharq Branch',
        brandId: 'tahina',
        brandNameAr: 'شاورما طحينة',
        brandNameEn: 'Tahina',
        platform: 'Keeta',
        deliveryMode: 'Tgo',
        commissionPct: 12,
        sectorNameAr: 'قطاع شرق والمنصورية والدعية',
        sectorNameEn: 'Sharq, Mansouriya & Daiya Sector',
        coveredAreasAr: ['شرق', 'الدعية', 'الدسمة'],
        coveredAreasEn: ['Sharq', 'Daiya', 'Dasma'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      { id: 'SHQ-Z1', zoneNameAr: 'شرق', zoneNameEn: 'Sharq', distanceKm: 0.8, deliveryMode: 'M', platform: 'Talabat', brandId: 'franks', brandNameAr: 'فرانكس', brandNameEn: "Frank's", zoneAccountId: 'ACC-SHQ-FR-M', zoneAccountNameAr: 'فرانكس - حساب توصيل المطعم شرق (TMP)', zoneAccountNameEn: "Frank's - Sharq Marketplace Account (TMP)", status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'SHQ-Z2', zoneNameAr: 'دسمان', zoneNameEn: 'Dasman', distanceKm: 1.5, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-SHQ-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع شرق والعاصمة (Tgo)', zoneAccountNameEn: 'China Garden - Sharq & Capital Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'SHQ-Z3', zoneNameAr: 'بنيد القار', zoneNameEn: 'Bneid Al-Gar', distanceKm: 2.2, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-SHQ-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع شرق والعاصمة (Tgo)', zoneAccountNameEn: 'China Garden - Sharq & Capital Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'SHQ-Z4', zoneNameAr: 'المرقاب', zoneNameEn: 'Mirqab', distanceKm: 1.9, deliveryMode: 'M', platform: 'Talabat', brandId: 'franks', brandNameAr: 'فرانكس', brandNameEn: "Frank's", zoneAccountId: 'ACC-SHQ-FR-M', zoneAccountNameAr: 'فرانكس - حساب توصيل المطعم شرق (TMP)', zoneAccountNameEn: "Frank's - Sharq Marketplace Account (TMP)", status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'SHQ-Z5', zoneNameAr: 'الدعية', zoneNameEn: 'Daiya', distanceKm: 2.6, deliveryMode: 'Tgo', platform: 'Keeta', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', zoneAccountId: 'ACC-SHQ-TH-KEETA', zoneAccountNameAr: 'شاورما طحينة - حساب كيتا شرق (Tgo)', zoneAccountNameEn: 'Tahina - Sharq Keeta Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'SHQ-Z6', zoneNameAr: 'الدسمة', zoneNameEn: 'Dasma', distanceKm: 3.4, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-SHQ-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع شرق والعاصمة (Tgo)', zoneAccountNameEn: 'China Garden - Sharq & Capital Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },

  // 3. فرع حولي
  {
    branchId: 'BR-HWL',
    branchCode: 'HWL',
    branchNameAr: 'فرع حولي',
    branchNameEn: 'Hawally Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'noodle-bar', 'karak-cafeteria'],
    tabletOnline: true,
    batteryPct: 90,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 6,
    onlineZonesCount: 5,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 83.3,
    totalLostKwdToday: 32.400,
    zoneAccounts: [
      {
        accountId: 'ACC-HWL-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع حولي والسرّة (Tgo)',
        accountNameEn: 'China Garden - Hawally & Surra Sector Account (Tgo)',
        branchId: 'BR-HWL',
        branchCode: 'HWL',
        branchNameAr: 'فرع حولي',
        branchNameEn: 'Hawally Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع حولي والجابرية والروضة والشهداء',
        sectorNameEn: 'Hawally, Jabriya, Rawda & Shuhada Sector',
        coveredAreasAr: ['حولي', 'الجابرية', 'الروضة', 'الشهداء'],
        coveredAreasEn: ['Hawally', 'Jabriya', 'Rawda', 'Shuhada'],
        status: 'BUSY_IN_AREA',
      },
      {
        accountId: 'ACC-HWL-KK-M',
        accountCode: '101513',
        accountNameAr: 'كرك كافتيريا - حساب توصيل المطعم حولي (TMP)',
        accountNameEn: 'Karak Cafeteria - Hawally Marketplace Account (TMP)',
        branchId: 'BR-HWL',
        branchCode: 'HWL',
        branchNameAr: 'فرع حولي',
        branchNameEn: 'Hawally Branch',
        brandId: 'karak-cafeteria',
        brandNameAr: 'كرك كافتيريا',
        brandNameEn: 'Karak Cafeteria',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - حولي والعديلية والسرة',
        sectorNameEn: 'Restaurant Fleet - Hawally, Adailiya & Surra',
        coveredAreasAr: ['حولي', 'العديلية', 'السرة'],
        coveredAreasEn: ['Hawally', 'Adailiya', 'Surra'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-HWL-NB-DELIVEROO',
        accountCode: '101514',
        accountNameAr: 'ذا نودل بار - حساب ديليفرو حولي (Tgo)',
        accountNameEn: 'The Noodle Bar - Hawally Deliveroo Account (Tgo)',
        branchId: 'BR-HWL',
        branchCode: 'HWL',
        branchNameAr: 'فرع حولي',
        branchNameEn: 'Hawally Branch',
        brandId: 'noodle-bar',
        brandNameAr: 'ذا نودل بار',
        brandNameEn: 'The Noodle Bar',
        platform: 'Deliveroo',
        deliveryMode: 'Tgo',
        commissionPct: 18,
        sectorNameAr: 'قطاع حولي والجابرية والسرّة',
        sectorNameEn: 'Hawally, Jabriya & Surra Sector',
        coveredAreasAr: ['حولي', 'الجابرية', 'السرة'],
        coveredAreasEn: ['Hawally', 'Jabriya', 'Surra'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      { id: 'HWL-Z1', zoneNameAr: 'حولي', zoneNameEn: 'Hawally', distanceKm: 0.9, deliveryMode: 'M', platform: 'Talabat', brandId: 'karak-cafeteria', brandNameAr: 'كرك كافتيريا', brandNameEn: 'Karak Cafeteria', zoneAccountId: 'ACC-HWL-KK-M', zoneAccountNameAr: 'كرك كافتيريا - حساب توصيل المطعم حولي (TMP)', zoneAccountNameEn: 'Karak Cafeteria - Hawally Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'HWL-Z2', zoneNameAr: 'الجابرية', zoneNameEn: 'Jabriya', distanceKm: 2.1, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-HWL-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع حولي والسرّة (Tgo)', zoneAccountNameEn: 'China Garden - Hawally & Surra Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'HWL-Z3', zoneNameAr: 'الروضة', zoneNameEn: 'Rawda', distanceKm: 2.4, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-HWL-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع حولي والسرّة (Tgo)', zoneAccountNameEn: 'China Garden - Hawally & Surra Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'HWL-Z4', zoneNameAr: 'العديلية', zoneNameEn: 'Adailiya', distanceKm: 3.2, deliveryMode: 'M', platform: 'Talabat', brandId: 'karak-cafeteria', brandNameAr: 'كرك كافتيريا', brandNameEn: 'Karak Cafeteria', zoneAccountId: 'ACC-HWL-KK-M', zoneAccountNameAr: 'كرك كافتيريا - حساب توصيل المطعم حولي (TMP)', zoneAccountNameEn: 'Karak Cafeteria - Hawally Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'HWL-Z5', zoneNameAr: 'السرة', zoneNameEn: 'Surra', distanceKm: 3.5, deliveryMode: 'Tgo', platform: 'Deliveroo', brandId: 'noodle-bar', brandNameAr: 'ذا نودل بار', brandNameEn: 'The Noodle Bar', zoneAccountId: 'ACC-HWL-NB-DELIVEROO', zoneAccountNameAr: 'ذا نودل بار - حساب ديليفرو حولي (Tgo)', zoneAccountNameEn: 'The Noodle Bar - Hawally Deliveroo Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'HWL-Z6', zoneNameAr: 'الشهداء', zoneNameEn: 'Shuhada', distanceKm: 3.8, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-HWL-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع حولي والسرّة (Tgo)', zoneAccountNameEn: 'China Garden - Hawally & Surra Sector Account (Tgo)', status: 'BUSY_IN_AREA', startTime: '01:40 PM', endTime: null, isOngoing: true, durationMinutes: 28, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في منطقة الشهداء', rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Shuhada', estimatedLostOrders: 6, estimatedLostKwd: 32.400, forcedTgoPenaltyKwd: 5.508 },
    ],
  },

  // 4. فرع الفحيحيل / الكوت
  {
    branchId: 'BR-KOT',
    branchCode: 'KOT',
    branchNameAr: 'فرع الفحيحيل / الكوت',
    branchNameEn: 'Fahaheel / Al-Kout Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'tahina', 'farm-brown'],
    tabletOnline: true,
    batteryPct: 86,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 5,
    onlineZonesCount: 4,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 80.0,
    totalLostKwdToday: 28.000,
    zoneAccounts: [
      {
        accountId: 'ACC-KOT-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع الفحيحيل والأحمدي (Tgo)',
        accountNameEn: 'China Garden - Fahaheel & Ahmadi Sector Account (Tgo)',
        branchId: 'BR-KOT',
        branchCode: 'KOT',
        branchNameAr: 'فرع الفحيحيل / الكوت',
        branchNameEn: 'Fahaheel / Al-Kout Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع الفحيحيل والمنقف والأحمدي والصباحية',
        sectorNameEn: 'Fahaheel, Mangaf, Ahmadi & Sabahiya Sector',
        coveredAreasAr: ['الفحيحيل', 'المنقف', 'الأحمدي', 'الصباحية'],
        coveredAreasEn: ['Fahaheel', 'Mangaf', 'Ahmadi', 'Sabahiya'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-KOT-TH-M',
        accountCode: '101513',
        accountNameAr: 'شاورما طحينة - حساب توصيل المطعم الفحيحيل (TMP)',
        accountNameEn: 'Tahina - Fahaheel Marketplace Account (TMP)',
        branchId: 'BR-KOT',
        branchCode: 'KOT',
        branchNameAr: 'فرع الفحيحيل / الكوت',
        branchNameEn: 'Fahaheel / Al-Kout Branch',
        brandId: 'tahina',
        brandNameAr: 'شاورما طحينة',
        brandNameEn: 'Tahina',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - الفحيحيل والمنقف وأبو حليفة',
        sectorNameEn: 'Restaurant Fleet - Fahaheel, Mangaf & Abu Halifa',
        coveredAreasAr: ['الفحيحيل', 'المنقف', 'أبو حليفة'],
        coveredAreasEn: ['Fahaheel', 'Mangaf', 'Abu Halifa'],
        status: 'BUSY_IN_AREA',
      },
    ],
    zones: [
      { id: 'KOT-Z1', zoneNameAr: 'الفحيحيل', zoneNameEn: 'Fahaheel', distanceKm: 1.0, deliveryMode: 'M', platform: 'Talabat', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', zoneAccountId: 'ACC-KOT-TH-M', zoneAccountNameAr: 'شاورما طحينة - حساب توصيل المطعم الفحيحيل (TMP)', zoneAccountNameEn: 'Tahina - Fahaheel Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z2', zoneNameAr: 'المنقف', zoneNameEn: 'Mangaf', distanceKm: 2.5, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-KOT-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع الفحيحيل والأحمدي (Tgo)', zoneAccountNameEn: 'China Garden - Fahaheel & Ahmadi Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z3', zoneNameAr: 'أبو حليفة', zoneNameEn: 'Abu Halifa', distanceKm: 3.8, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-KOT-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع الفحيحيل والأحمدي (Tgo)', zoneAccountNameEn: 'China Garden - Fahaheel & Ahmadi Sector Account (Tgo)', status: 'BUSY_IN_AREA', startTime: '01:10 PM', endTime: null, isOngoing: true, durationMinutes: 45, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في أبو حليفة', rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Abu Halifa', estimatedLostOrders: 5, estimatedLostKwd: 28.000, forcedTgoPenaltyKwd: 4.760 },
      { id: 'KOT-Z4', zoneNameAr: 'الأحمدي', zoneNameEn: 'Ahmadi', distanceKm: 4.5, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-KOT-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع الفحيحيل والأحمدي (Tgo)', zoneAccountNameEn: 'China Garden - Fahaheel & Ahmadi Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z5', zoneNameAr: 'الصباحية', zoneNameEn: 'Sabahiya', distanceKm: 3.2, deliveryMode: 'M', platform: 'Talabat', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', zoneAccountId: 'ACC-KOT-TH-M', zoneAccountNameAr: 'شاورما طحينة - حساب توصيل المطعم الفحيحيل (TMP)', zoneAccountNameEn: 'Tahina - Fahaheel Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },

  // 5. فرع العارضية
  {
    branchId: 'BR-ARD',
    branchCode: 'ARD',
    branchNameAr: 'فرع العارضية',
    branchNameEn: 'Ardiya Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'farm-brown', 'tahina'],
    tabletOnline: true,
    batteryPct: 95,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 6,
    onlineZonesCount: 5,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 83.3,
    totalLostKwdToday: 38.200,
    zoneAccounts: [
      {
        accountId: 'ACC-ARD-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع العارضية والري (Tgo)',
        accountNameEn: 'China Garden - Ardiya & Rai Sector Account (Tgo)',
        branchId: 'BR-ARD',
        branchCode: 'ARD',
        branchNameAr: 'فرع العارضية',
        branchNameEn: 'Ardiya Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع العارضية وصباح الناصر والفردوس والخالدية',
        sectorNameEn: 'Ardiya, Sabah Al-Nasser, Firdous & Khaldiya Sector',
        coveredAreasAr: ['العارضية السكنية', 'صباح الناصر', 'الفردوس', 'الخالدية'],
        coveredAreasEn: ['Ardiya Residential', 'Sabah Al-Nasser', 'Firdous', 'Khaldiya'],
        status: 'BUSY_IN_AREA',
      },
      {
        accountId: 'ACC-ARD-FB-M',
        accountCode: '101513',
        accountNameAr: 'فارم براون - حساب توصيل المطعم العارضية (TMP)',
        accountNameEn: 'Farm Brown - Ardiya Marketplace Account (TMP)',
        branchId: 'BR-ARD',
        branchCode: 'ARD',
        branchNameAr: 'فرع العارضية',
        branchNameEn: 'Ardiya Branch',
        brandId: 'farm-brown',
        brandNameAr: 'فارم براون',
        brandNameEn: 'Farm Brown',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - العارضية والأندلس والرقعي',
        sectorNameEn: 'Restaurant Fleet - Ardiya, Andalus & Riggae',
        coveredAreasAr: ['العارضية السكنية', 'الأندلس', 'الرقعي'],
        coveredAreasEn: ['Ardiya Residential', 'Andalus', 'Riggae'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      { id: 'ARD-Z1', zoneNameAr: 'العارضية السكنية', zoneNameEn: 'Ardiya Residential', distanceKm: 1.5, deliveryMode: 'M', platform: 'Talabat', brandId: 'farm-brown', brandNameAr: 'فارم براون', brandNameEn: 'Farm Brown', zoneAccountId: 'ACC-ARD-FB-M', zoneAccountNameAr: 'فارم براون - حساب توصيل المطعم العارضية (TMP)', zoneAccountNameEn: 'Farm Brown - Ardiya Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z2', zoneNameAr: 'صباح الناصر', zoneNameEn: 'Sabah Al-Nasser', distanceKm: 2.6, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-ARD-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع العارضية والري (Tgo)', zoneAccountNameEn: 'China Garden - Ardiya & Rai Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z3', zoneNameAr: 'الفردوس', zoneNameEn: 'Firdous', distanceKm: 3.1, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-ARD-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع العارضية والري (Tgo)', zoneAccountNameEn: 'China Garden - Ardiya & Rai Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z4', zoneNameAr: 'الأندلس', zoneNameEn: 'Andalus', distanceKm: 3.5, deliveryMode: 'M', platform: 'Talabat', brandId: 'farm-brown', brandNameAr: 'فارم براون', brandNameEn: 'Farm Brown', zoneAccountId: 'ACC-ARD-FB-M', zoneAccountNameAr: 'فارم براون - حساب توصيل المطعم العارضية (TMP)', zoneAccountNameEn: 'Farm Brown - Ardiya Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z5', zoneNameAr: 'الرقعي', zoneNameEn: 'Riggae', distanceKm: 3.8, deliveryMode: 'M', platform: 'Talabat', brandId: 'farm-brown', brandNameAr: 'فارم براون', brandNameEn: 'Farm Brown', zoneAccountId: 'ACC-ARD-FB-M', zoneAccountNameAr: 'فارم براون - حساب توصيل المطعم العارضية (TMP)', zoneAccountNameEn: 'Farm Brown - Ardiya Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z6', zoneNameAr: 'الخالدية', zoneNameEn: 'Khaldiya', distanceKm: 4.2, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-ARD-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع العارضية والري (Tgo)', zoneAccountNameEn: 'China Garden - Ardiya & Rai Sector Account (Tgo)', status: 'BUSY_IN_AREA', startTime: '01:30 PM', endTime: null, isOngoing: true, durationMinutes: 35, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في الخالدية', rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Khaldiya', estimatedLostOrders: 7, estimatedLostKwd: 38.200, forcedTgoPenaltyKwd: 6.494 },
    ],
  },

  // 6. فرع الفروانية
  {
    branchId: 'BR-FRW',
    branchCode: 'FRW',
    branchNameAr: 'فرع الفروانية',
    branchNameEn: 'Farwaniya Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'tahina', 'karak-cafeteria'],
    tabletOnline: true,
    batteryPct: 88,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 5,
    onlineZonesCount: 4,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 80.0,
    totalLostKwdToday: 24.800,
    zoneAccounts: [
      {
        accountId: 'ACC-FRW-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع الفروانية وخيطان (Tgo)',
        accountNameEn: 'China Garden - Farwaniya & Khaitan Sector Account (Tgo)',
        branchId: 'BR-FRW',
        branchCode: 'FRW',
        branchNameAr: 'فرع الفروانية',
        branchNameEn: 'Farwaniya Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع الفروانية وخيطان والعمرية والرابية',
        sectorNameEn: 'Farwaniya, Khaitan, Omariya & Rabia Sector',
        coveredAreasAr: ['الفروانية', 'خيطان', 'العمرية', 'الرابية'],
        coveredAreasEn: ['Farwaniya', 'Khaitan', 'Omariya', 'Rabia'],
        status: 'BUSY_IN_AREA',
      },
      {
        accountId: 'ACC-FRW-TH-M',
        accountCode: '101513',
        accountNameAr: 'شاورما طحينة - حساب توصيل المطعم الفروانية (TMP)',
        accountNameEn: 'Tahina - Farwaniya Marketplace Account (TMP)',
        branchId: 'BR-FRW',
        branchCode: 'FRW',
        branchNameAr: 'فرع الفروانية',
        branchNameEn: 'Farwaniya Branch',
        brandId: 'tahina',
        brandNameAr: 'شاورما طحينة',
        brandNameEn: 'Tahina',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - الفروانية وإشبيلية والرحاب',
        sectorNameEn: 'Restaurant Fleet - Farwaniya, Ishbiliya & Rehab',
        coveredAreasAr: ['الفروانية', 'إشبيلية'],
        coveredAreasEn: ['Farwaniya', 'Ishbiliya'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      { id: 'FRW-Z1', zoneNameAr: 'الفروانية', zoneNameEn: 'Farwaniya', distanceKm: 1.0, deliveryMode: 'M', platform: 'Talabat', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', zoneAccountId: 'ACC-FRW-TH-M', zoneAccountNameAr: 'شاورما طحينة - حساب توصيل المطعم الفروانية (TMP)', zoneAccountNameEn: 'Tahina - Farwaniya Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z2', zoneNameAr: 'خيطان', zoneNameEn: 'Khaitan', distanceKm: 2.3, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-FRW-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع الفروانية وخيطان (Tgo)', zoneAccountNameEn: 'China Garden - Farwaniya & Khaitan Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z3', zoneNameAr: 'العمرية', zoneNameEn: 'Omariya', distanceKm: 2.7, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-FRW-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع الفروانية وخيطان (Tgo)', zoneAccountNameEn: 'China Garden - Farwaniya & Khaitan Sector Account (Tgo)', status: 'BUSY_IN_AREA', startTime: '01:35 PM', endTime: null, isOngoing: true, durationMinutes: 30, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في العمرية', rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Omariya', estimatedLostOrders: 4, estimatedLostKwd: 24.800, forcedTgoPenaltyKwd: 4.216 },
      { id: 'FRW-Z4', zoneNameAr: 'الرابية', zoneNameEn: 'Rabia', distanceKm: 3.4, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-FRW-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع الفروانية وخيطان (Tgo)', zoneAccountNameEn: 'China Garden - Farwaniya & Khaitan Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z5', zoneNameAr: 'إشبيلية', zoneNameEn: 'Ishbiliya', distanceKm: 4.1, deliveryMode: 'M', platform: 'Talabat', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', zoneAccountId: 'ACC-FRW-TH-M', zoneAccountNameAr: 'شاورما طحينة - حساب توصيل المطعم الفروانية (TMP)', zoneAccountNameEn: 'Tahina - Farwaniya Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },

  // 7. فرع المهبولة
  {
    branchId: 'BR-MHB',
    branchCode: 'MHB',
    branchNameAr: 'فرع المهبولة',
    branchNameEn: 'Mahboula Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'noodle-bar', 'farm-brown'],
    tabletOnline: true,
    batteryPct: 92,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 4,
    onlineZonesCount: 3,
    busyZonesCount: 0,
    hiddenZonesCount: 1,
    openRatioPct: 75.0,
    totalLostKwdToday: 34.000,
    zoneAccounts: [
      {
        accountId: 'ACC-MHB-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع المهبولة والفنطاس (Tgo)',
        accountNameEn: 'China Garden - Mahboula & Fintas Sector Account (Tgo)',
        branchId: 'BR-MHB',
        branchCode: 'MHB',
        branchNameAr: 'فرع المهبولة',
        branchNameEn: 'Mahboula Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع المهبولة والفنطاس والعقيلة وجابر العلي',
        sectorNameEn: 'Mahboula, Fintas, Egaila & Jaber Al-Ali Sector',
        coveredAreasAr: ['المهبولة', 'الفنطاس', 'العقيلة', 'جابر العلي'],
        coveredAreasEn: ['Mahboula', 'Fintas', 'Egaila', 'Jaber Al-Ali'],
        status: 'AREA_CLOSED_HIDDEN',
      },
      {
        accountId: 'ACC-MHB-NB-M',
        accountCode: '101513',
        accountNameAr: 'ذا نودل بار - حساب توصيل المطعم المهبولة (TMP)',
        accountNameEn: 'The Noodle Bar - Mahboula Marketplace Account (TMP)',
        branchId: 'BR-MHB',
        branchCode: 'MHB',
        branchNameAr: 'فرع المهبولة',
        branchNameEn: 'Mahboula Branch',
        brandId: 'noodle-bar',
        brandNameAr: 'ذا نودل بار',
        brandNameEn: 'The Noodle Bar',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - المهبولة والفنطاس والعقيلة',
        sectorNameEn: 'Restaurant Fleet - Mahboula, Fintas & Egaila',
        coveredAreasAr: ['المهبولة', 'الفنطاس', 'العقيلة'],
        coveredAreasEn: ['Mahboula', 'Fintas', 'Egaila'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      { id: 'MHB-Z1', zoneNameAr: 'المهبولة', zoneNameEn: 'Mahboula', distanceKm: 1.1, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-MHB-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع المهبولة والفنطاس (Tgo)', zoneAccountNameEn: 'China Garden - Mahboula & Fintas Sector Account (Tgo)', status: 'AREA_CLOSED_HIDDEN', startTime: '01:00 PM', endTime: '01:50 PM', isOngoing: false, durationMinutes: 50, rootCause: 'PEAK_RADIUS_CUT', rootCauseLabelAr: 'تقليص مضلع توصيل المنصة (Tgo) وقت الذروة', rootCauseLabelEn: 'Platform (Tgo) Peak Radius Shrinkage', estimatedLostOrders: 6, estimatedLostKwd: 34.000, forcedTgoPenaltyKwd: 5.780 },
      { id: 'MHB-Z2', zoneNameAr: 'الفنطاس', zoneNameEn: 'Fintas', distanceKm: 2.4, deliveryMode: 'M', platform: 'Talabat', brandId: 'noodle-bar', brandNameAr: 'ذا نودل بار', brandNameEn: 'The Noodle Bar', zoneAccountId: 'ACC-MHB-NB-M', zoneAccountNameAr: 'ذا نودل بار - حساب توصيل المطعم المهبولة (TMP)', zoneAccountNameEn: 'The Noodle Bar - Mahboula Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'MHB-Z3', zoneNameAr: 'العقيلة', zoneNameEn: 'Egaila', distanceKm: 3.1, deliveryMode: 'M', platform: 'Talabat', brandId: 'noodle-bar', brandNameAr: 'ذا نودل بار', brandNameEn: 'The Noodle Bar', zoneAccountId: 'ACC-MHB-NB-M', zoneAccountNameAr: 'ذا نودل بار - حساب توصيل المطعم المهبولة (TMP)', zoneAccountNameEn: 'The Noodle Bar - Mahboula Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'MHB-Z4', zoneNameAr: 'جابر العلي', zoneNameEn: 'Jaber Al-Ali', distanceKm: 4.3, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-MHB-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع المهبولة والفنطاس (Tgo)', zoneAccountNameEn: 'China Garden - Mahboula & Fintas Sector Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },

  // 8. فرع صباح السالم / مبارك الكبير
  {
    branchId: 'BR-QRN',
    branchCode: 'QRN',
    branchNameAr: 'فرع صباح السالم / مبارك الكبير',
    branchNameEn: 'Sabah Al-Salem / Mubarak Al-Kabeer Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria'],
    tabletOnline: true,
    batteryPct: 98,
    assignedFleetType: 'HYBRID_TMP_TGO',
    totalZonesCount: 6,
    onlineZonesCount: 4,
    busyZonesCount: 1,
    hiddenZonesCount: 1,
    openRatioPct: 66.7,
    totalLostKwdToday: 55.400,
    zoneAccounts: [
      {
        accountId: 'ACC-QRN-CG-TGO',
        accountCode: '101512',
        accountNameAr: 'تشاينا جاردن - حساب قطاع صباح السالم ومبارك الكبير (Tgo)',
        accountNameEn: 'China Garden - Sabah Al-Salem & Mubarak Al-Kabeer (Tgo)',
        branchId: 'BR-QRN',
        branchCode: 'QRN',
        branchNameAr: 'فرع صباح السالم / مبارك الكبير',
        branchNameEn: 'Sabah Al-Salem / Mubarak Al-Kabeer Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'Tgo',
        commissionPct: 17,
        sectorNameAr: 'قطاع صباح السالم والعدان والقصور والفنيطيس',
        sectorNameEn: 'Sabah Al-Salem, Adan, Qusoor & Funaitees Sector',
        coveredAreasAr: ['صباح السالم', 'العدان', 'القصور', 'الفنيطيس'],
        coveredAreasEn: ['Sabah Al-Salem', 'Adan', 'Qusoor', 'Funaitees'],
        status: 'BUSY_IN_AREA',
      },
      {
        accountId: 'ACC-QRN-CG-M',
        accountCode: '101513',
        accountNameAr: 'تشاينا جاردن - حساب توصيل المطعم مبارك الكبير (TMP)',
        accountNameEn: 'China Garden - Mubarak Al-Kabeer Marketplace Account (TMP)',
        branchId: 'BR-QRN',
        branchCode: 'QRN',
        branchNameAr: 'فرع صباح السالم / مبارك الكبير',
        branchNameEn: 'Sabah Al-Salem / Mubarak Al-Kabeer Branch',
        brandId: 'china-garden',
        brandNameAr: 'تشاينا جاردن',
        brandNameEn: 'China Garden',
        platform: 'Talabat',
        deliveryMode: 'M',
        commissionPct: 10,
        sectorNameAr: 'تغطية أسطول المطعم - مبارك الكبير والقصور والمسيلة',
        sectorNameEn: 'Restaurant Fleet - Mubarak Al-Kabeer, Qusoor & Messila',
        coveredAreasAr: ['مبارك الكبير', 'القصور', 'المسيلة'],
        coveredAreasEn: ['Mubarak Al-Kabeer', 'Qusoor', 'Messila'],
        status: 'ONLINE_VISIBLE',
      },
      {
        accountId: 'ACC-QRN-TH-KEETA',
        accountCode: '101527',
        accountNameAr: 'شاورما طحينة - حساب كيتا صباح السالم (Tgo)',
        accountNameEn: 'Tahina - Sabah Al-Salem Keeta Account (Tgo)',
        branchId: 'BR-QRN',
        branchCode: 'QRN',
        branchNameAr: 'فرع صباح السالم / مبارك الكبير',
        branchNameEn: 'Sabah Al-Salem / Mubarak Al-Kabeer Branch',
        brandId: 'tahina',
        brandNameAr: 'شاورما طحينة',
        brandNameEn: 'Tahina',
        platform: 'Keeta',
        deliveryMode: 'Tgo',
        commissionPct: 12,
        sectorNameAr: 'قطاع صباح السالم والمسيلة والفنيطيس',
        sectorNameEn: 'Sabah Al-Salem, Messila & Funaitees Sector',
        coveredAreasAr: ['صباح السالم', 'المسيلة', 'الفنيطيس'],
        coveredAreasEn: ['Sabah Al-Salem', 'Messila', 'Funaitees'],
        status: 'ONLINE_VISIBLE',
      },
    ],
    zones: [
      { id: 'QRN-Z1', zoneNameAr: 'أسواق القرين', zoneNameEn: 'Aswaq Al-Qurain', distanceKm: 0.5, deliveryMode: 'M', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-QRN-CG-M', zoneAccountNameAr: 'تشاينا جاردن - حساب توصيل المطعم مبارك الكبير (TMP)', zoneAccountNameEn: 'China Garden - Mubarak Al-Kabeer Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z2', zoneNameAr: 'مبارك الكبير', zoneNameEn: 'Mubarak Al-Kabeer', distanceKm: 2.1, deliveryMode: 'M', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-QRN-CG-M', zoneAccountNameAr: 'تشاينا جاردن - حساب توصيل المطعم مبارك الكبير (TMP)', zoneAccountNameEn: 'China Garden - Mubarak Al-Kabeer Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z3', zoneNameAr: 'القصور', zoneNameEn: 'Qusoor', distanceKm: 2.9, deliveryMode: 'M', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-QRN-CG-M', zoneAccountNameAr: 'تشاينا جاردن - حساب توصيل المطعم مبارك الكبير (TMP)', zoneAccountNameEn: 'China Garden - Mubarak Al-Kabeer Marketplace Account (TMP)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المطعم (TMP)', rootCauseLabelEn: 'Normal - Restaurant Fleet (TMP)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z4', zoneNameAr: 'العدان', zoneNameEn: 'Adan', distanceKm: 3.4, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-QRN-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع صباح السالم ومبارك الكبير (Tgo)', zoneAccountNameEn: 'China Garden - Sabah Al-Salem & Mubarak Al-Kabeer (Tgo)', status: 'BUSY_IN_AREA', startTime: '01:20 PM', endTime: null, isOngoing: true, durationMinutes: 38, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في العدان', rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Adan', estimatedLostOrders: 4, estimatedLostKwd: 22.400, forcedTgoPenaltyKwd: 3.808 },
      { id: 'QRN-Z5', zoneNameAr: 'صباح السالم', zoneNameEn: 'Sabah Al-Salem', distanceKm: 4.8, deliveryMode: 'Tgo', platform: 'Talabat', brandId: 'china-garden', brandNameAr: 'تشاينا جاردن', brandNameEn: 'China Garden', zoneAccountId: 'ACC-QRN-CG-TGO', zoneAccountNameAr: 'تشاينا جاردن - حساب قطاع صباح السالم ومبارك الكبير (Tgo)', zoneAccountNameEn: 'China Garden - Sabah Al-Salem & Mubarak Al-Kabeer (Tgo)', status: 'AREA_CLOSED_HIDDEN', startTime: '01:05 PM', endTime: '01:45 PM', isOngoing: false, durationMinutes: 40, rootCause: 'PEAK_RADIUS_CUT', rootCauseLabelAr: 'تقليص مضلع توصيل المنصة (Tgo) وقت الذروة', rootCauseLabelEn: 'Platform (Tgo) Peak Radius Shrinkage', estimatedLostOrders: 6, estimatedLostKwd: 33.000, forcedTgoPenaltyKwd: 5.610 },
      { id: 'QRN-Z6', zoneNameAr: 'الفنيطيس', zoneNameEn: 'Funaitees', distanceKm: 5.2, deliveryMode: 'Tgo', platform: 'Keeta', brandId: 'tahina', brandNameAr: 'شاورما طحينة', brandNameEn: 'Tahina', zoneAccountId: 'ACC-QRN-TH-KEETA', zoneAccountNameAr: 'شاورما طحينة - حساب كيتا صباح السالم (Tgo)', zoneAccountNameEn: 'Tahina - Sabah Al-Salem Keeta Account (Tgo)', status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي - تغطية المنصة (Tgo)', rootCauseLabelEn: 'Normal - Platform Fleet (Tgo)', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
]

// ------------------------------------------------------------------------------
// HISTORICAL CHRONOLOGICAL SLA BREACH & BLACKOUT INCIDENTS LOG
// ------------------------------------------------------------------------------
export const HISTORICAL_CHRONOLOGICAL_INCIDENTS: ChronologicalIncident[] = [
  {
    id: 'INC-20261103-01',
    timestamp: '2026-11-03 13:25:00',
    date: '2026-11-03',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    branchNameAr: 'فرع السالمية',
    branchNameEn: 'Salmiya Branch',
    zoneNameAr: 'بيان',
    zoneNameEn: 'Bayan',
    status: 'AREA_CLOSED_HIDDEN',
    startTime: '01:25 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 42,
    isOngoing: true,
    rootCauseLabelAr: 'تقليص مضلع التوصيل (Tgo) وقت الذروة من طلبات',
    rootCauseLabelEn: 'Talabat Go (Tgo) Peak Radius Shrinkage (< 3km)',
    faultParty: 'TALABAT',
    lostOrders: 7,
    lostKwd: 41.000,
    penaltyKwd: 6.970,
    remedyActionAr: 'تقديم مطالبة رسمية لطلب تعويض مالي أو التحويل إلى تغطية المطعم (TMP)',
    remedyActionEn: 'Lodge formal SLA breach claim or switch zone to Restaurant Fleet (TMP)',
  },
  {
    id: 'INC-20261103-02',
    timestamp: '2026-11-03 13:40:00',
    date: '2026-11-03',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    branchNameAr: 'فرع حولي',
    branchNameEn: 'Hawally Branch',
    zoneNameAr: 'الشهداء',
    zoneNameEn: 'Shuhada',
    status: 'BUSY_IN_AREA',
    startTime: '01:40 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 28,
    isOngoing: true,
    rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في المنطقة',
    rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Shuhada',
    faultParty: 'TALABAT',
    lostOrders: 6,
    lostKwd: 32.400,
    penaltyKwd: 5.508,
    remedyActionAr: 'إرسال تنبيه آلي لمدير الحساب في طلبات لمطالبة زيادة السائقين',
    remedyActionEn: 'Dispatch automated fleet escalation to Talabat KAM',
  },
  {
    id: 'INC-20261103-03',
    timestamp: '2026-11-03 13:30:00',
    date: '2026-11-03',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    branchNameAr: 'فرع العارضية',
    branchNameEn: 'Ardiya Branch',
    zoneNameAr: 'الخالدية',
    zoneNameEn: 'Khaldiya',
    status: 'BUSY_IN_AREA',
    startTime: '01:30 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 35,
    isOngoing: true,
    rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في المنطقة',
    rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Khaldiya',
    faultParty: 'TALABAT',
    lostOrders: 7,
    lostKwd: 38.200,
    penaltyKwd: 6.494,
    remedyActionAr: 'مطالبة بتعويض مبيعات الغداء المفقودة بتقرير المطالبة الرسمي',
    remedyActionEn: 'Submit lunch order loss compensation claim to Talabat',
  },
  {
    id: 'INC-20261103-04',
    timestamp: '2026-11-03 13:10:00',
    date: '2026-11-03',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    branchNameAr: 'فرع الفحيحيل / الكوت',
    branchNameEn: 'Fahaheel / Al-Kout Branch',
    zoneNameAr: 'أبو حليفة',
    zoneNameEn: 'Abu Halifa',
    status: 'BUSY_IN_AREA',
    startTime: '01:10 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 45,
    isOngoing: true,
    rootCauseLabelAr: 'نقص أسطول سائقي المنصة (Tgo) في المنطقة',
    rootCauseLabelEn: 'Talabat Go (Tgo) Fleet Shortage in Abu Halifa',
    faultParty: 'TALABAT',
    lostOrders: 5,
    lostKwd: 28.000,
    penaltyKwd: 4.760,
    remedyActionAr: 'تسجيل قيد المطالبة بحساب 1123 ذمم طلبات المدينة',
    remedyActionEn: 'Record penalty contra-entry to account 1123 Talabat clearing',
  },
]

// ------------------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------------------
export function calculateGeoRadarKpis(branches: BranchRadarProfile[]): GeoRadarKpis {
  let totalMonitoredZones = 0
  let onlineZonesCount = 0
  let busyZonesCount = 0
  let hiddenZonesCount = 0
  let forcedTgoZonesCount = 0
  let totalLostSalesKwd = 0
  let totalTgoPenaltiesKwd = 0
  let totalBusyMinutes = 0
  let totalActiveAccounts = 0
  let tgoAccountsCount = 0
  let mAccountsCount = 0
  let issueAccountsCount = 0

  for (const branch of branches) {
    for (const acc of branch.zoneAccounts) {
      totalActiveAccounts += 1
      if (acc.deliveryMode === 'Tgo') tgoAccountsCount += 1
      else mAccountsCount += 1
      if (acc.status !== 'ONLINE_VISIBLE') issueAccountsCount += 1
    }
    for (const zone of branch.zones) {
      totalMonitoredZones += 1
      if (zone.status === 'ONLINE_VISIBLE') {
        onlineZonesCount += 1
      } else if (zone.status === 'BUSY_IN_AREA') {
        busyZonesCount += 1
        totalBusyMinutes += zone.durationMinutes
      } else if (zone.status === 'AREA_CLOSED_HIDDEN') {
        hiddenZonesCount += 1
        totalBusyMinutes += zone.durationMinutes
      } else if (zone.status === 'FORCED_TGO_17') {
        forcedTgoZonesCount += 1
      }
      totalLostSalesKwd += zone.estimatedLostKwd
      totalTgoPenaltiesKwd += zone.forcedTgoPenaltyKwd
    }
  }

  const onlineZonesPct = totalMonitoredZones > 0
    ? Number(((onlineZonesCount / totalMonitoredZones) * 100).toFixed(1))
    : 0

  const avgBusyDurationMinutes = (busyZonesCount + hiddenZonesCount) > 0
    ? Math.round(totalBusyMinutes / (busyZonesCount + hiddenZonesCount))
    : 0

  return {
    totalMonitoredZones,
    onlineZonesCount,
    onlineZonesPct,
    busyZonesCount,
    avgBusyDurationMinutes,
    hiddenZonesCount,
    forcedTgoZonesCount,
    totalLostSalesKwd: Number(totalLostSalesKwd.toFixed(3)),
    totalTgoPenaltiesKwd: Number(totalTgoPenaltiesKwd.toFixed(3)),
    totalFinancialImpactKwd: Number((totalLostSalesKwd + totalTgoPenaltiesKwd).toFixed(3)),
    totalActiveAccounts,
    tgoAccountsCount,
    mAccountsCount,
    issueAccountsCount,
    lastScannedAt: new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

/** Formats a clean formal email text table for the 3 designated executives */
export function formatTalabatAreaAlertEmail(branches: BranchRadarProfile[], kpis: GeoRadarKpis): string {
  const lines: string[] = [
    '========================================================================================',
    '🚨 AetherBI · VENTURE FOODS W.L.L. — AGGREGATOR (Tgo & M) BUSY & HIDDEN AREAS ALERT',
    '========================================================================================',
    `Date & Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuwait' })} (Kuwait Time)`,
    `Active Accounts: ${kpis.totalActiveAccounts} (Tgo: ${kpis.tgoAccountsCount} | M: ${kpis.mAccountsCount})`,
    `Monitored Customer Areas: ${kpis.totalMonitoredZones} | Online: ${kpis.onlineZonesCount} (${kpis.onlineZonesPct}%)`,
    `⚠️ Busy Areas: ${kpis.busyZonesCount} | 🛑 Hidden / Shrunk Polygons: ${kpis.hiddenZonesCount}`,
    `Estimated Lost Sales Today: ${kpis.totalLostSalesKwd.toFixed(3)} KWD`,
    `Tgo 17% Commission Penalty: ${kpis.totalTgoPenaltiesKwd.toFixed(3)} KWD`,
    `Total Commercial Loss: ${kpis.totalFinancialImpactKwd.toFixed(3)} KWD`,
    '----------------------------------------------------------------------------------------',
    'BREAKDOWN OF AFFECTED RESTAURANT BRANCHES & CUSTOMER DELIVERY AREAS:',
    '----------------------------------------------------------------------------------------',
  ]

  for (const b of branches) {
    const affected = b.zones.filter((z) => z.status !== 'ONLINE_VISIBLE')
    if (affected.length === 0) continue

    lines.push(`\n🏢 [${b.branchCode}] ${b.branchNameAr} (${b.primaryBrandNameAr}):`)
    for (const z of affected) {
      const statusIcon = z.status === 'BUSY_IN_AREA' ? '🟡 BUSY' : '🔴 HIDDEN / POLYGON CUT'
      const timeStr = z.isOngoing ? `منذ ${z.startTime} (مستمر - ${z.durationMinutes} دقيقة)` : `من ${z.startTime} إلى ${z.endTime} (${z.durationMinutes} دقيقة)`
      lines.push(`   - [${z.deliveryMode}] ${statusIcon} في منطقة [${zoneLabelAr(z.zoneNameAr)}]: ${timeStr}`)
      lines.push(`     * السبب: ${z.rootCauseLabelAr}`)
      lines.push(`     * الخسارة التقديرية: -${z.estimatedLostKwd.toFixed(3)} د.ك | الطلبات الضائعة: ~${z.estimatedLostOrders} طلب`)
    }
  }

  lines.push('\n========================================================================================')
  lines.push('ACTION REQUIRED:')
  lines.push('1. Contact Talabat Key Account Manager to challenge area blackout & polygon restriction.')
  lines.push('2. Export formal SLA Breach penalty claim for invoice reconciliation.')
  lines.push('========================================================================================')

  return lines.join('\n')
}
