/**
 * talabat-geo-zone-radar.ts
 * ==============================================================================
 * Venture Foods W.L.L. - Kuwait Geo-Spatial & Talabat Go Zone Radar Engine
 * ------------------------------------------------------------------------------
 * Monitored Network: 9 Active Venture Foods Branches + Central Production Kitchen
 * Real-time monitoring for Talabat Go (TGO 17%) Polygon Cuts, Area Shrinkage,
 * Selective Area Busy Time, Forced TGO conversions, and Lost Sales Forensics.
 * (Jahra permanently closed branch is strictly excluded).
 * ==============================================================================
 */

export type DeliveryZoneStatus =
  | 'ONLINE_VISIBLE'     // 🟢 متاح وظاهر للعميل (Normal Talabat Go Delivery)
  | 'BUSY_IN_AREA'       // 🟡 مشغول في المنطقة (Busy in Zone)
  | 'AREA_CLOSED_HIDDEN' // 🔴 المنطقة مقطوعة / المطعم مخفي (Polygon Shrunk by Talabat)
  | 'FORCED_TGO_17'      // 🟠 تحول قسري من توصيل الشركة TMP 10% إلى TGO 17%

export type IncidentRootCause =
  | 'TALABAT_FLEET_SHORTAGE' // نقص أسطول سائقي طلبات في المنطقة (Talabat Fleet Shortage)
  | 'PEAK_RADIUS_CUT'        // تقليص مضلع التوصيل وقت الذروة (Peak Radius Cut from 6km to 2.5km)
  | 'HIGH_KITCHEN_LOAD'      // ضغط المطبخ والطلبات (High Kitchen Load)
  | 'MANUAL_TABLET_STOP'     // إيقاف يدوي مؤقت (Manual Tablet Stop)

export interface AreaZoneRecord {
  id: string
  zoneNameAr: string
  zoneNameEn: string
  distanceKm: number
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
  lastScannedAt: string
}

// ------------------------------------------------------------------------------
// 6 OFFICIAL VENTURE FOODS BRANDS
// ------------------------------------------------------------------------------
export const VENTURE_BRANDS = [
  { id: 'china-garden', nameAr: 'تشاينا جاردن', nameEn: 'China Garden', color: '#f59e0b' },
  { id: 'franks', nameAr: 'فرانكس', nameEn: "Frank's", color: '#ef4444' },
  { id: 'tahina', nameAr: 'شاورما طحينة', nameEn: 'Tahina', color: '#10b981' },
  { id: 'farm-brown', nameAr: 'فارم براون', nameEn: 'Farm Brown', color: '#8b5cf6' },
  { id: 'noodle-bar', nameAr: 'ذا نودل بار', nameEn: 'The Noodle Bar', color: '#06b6d4' },
  { id: 'karak-cafeteria', nameAr: 'كرك كافتيريا', nameEn: 'Karak Cafeteria', color: '#f97316' },
] as const

// ------------------------------------------------------------------------------
// PERMANENTLY CLOSED BRANCHES (Jahra is excluded completely from active views)
// ------------------------------------------------------------------------------
export const PERMANENTLY_CLOSED_BRANCHES: any[] = []

// ------------------------------------------------------------------------------
// 9 ACTIVE BRANCHES & TALABAT GO DELIVERY ZONES MAPPING (KUWAIT RESIDENTIAL AREAS)
// ------------------------------------------------------------------------------
export const INITIAL_BRANCH_PROFILES: BranchRadarProfile[] = [
  {
    branchId: 'BR-SLM',
    branchCode: 'SLM',
    branchNameAr: 'فرع السالمية (شارع سالم المبارك)',
    branchNameEn: 'Salmiya Main Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'noodle-bar', 'karak-cafeteria'],
    tabletOnline: true,
    batteryPct: 94,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 8,
    onlineZonesCount: 6,
    busyZonesCount: 1,
    hiddenZonesCount: 1,
    openRatioPct: 75.0,
    totalLostKwdToday: 68.500,
    zones: [
      {
        id: 'SLM-Z1',
        zoneNameAr: 'السالمية',
        zoneNameEn: 'Salmiya',
        distanceKm: 1.2,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z2',
        zoneNameAr: 'الرميثية',
        zoneNameEn: 'Rumaithiya',
        distanceKm: 2.8,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z3',
        zoneNameAr: 'سلوى',
        zoneNameEn: 'Salwa',
        distanceKm: 4.1,
        status: 'BUSY_IN_AREA',
        startTime: '01:15 PM',
        endTime: '02:05 PM',
        isOngoing: false,
        durationMinutes: 50,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة',
        rootCauseLabelEn: 'Talabat Fleet Shortage in Salwa Sector',
        estimatedLostOrders: 5,
        estimatedLostKwd: 27.500,
        forcedTgoPenaltyKwd: 4.675,
      },
      {
        id: 'SLM-Z4',
        zoneNameAr: 'بيان',
        zoneNameEn: 'Bayan',
        distanceKm: 5.2,
        status: 'AREA_CLOSED_HIDDEN',
        startTime: '01:25 PM',
        endTime: null,
        isOngoing: true,
        durationMinutes: 42,
        rootCause: 'PEAK_RADIUS_CUT',
        rootCauseLabelAr: 'تقليص مضلع التوصيل وقت الذروة من طلبات',
        rootCauseLabelEn: 'Talabat Peak Radius Shrinkage (< 3km)',
        estimatedLostOrders: 7,
        estimatedLostKwd: 41.000,
        forcedTgoPenaltyKwd: 6.970,
      },
      {
        id: 'SLM-Z5',
        zoneNameAr: 'حولي',
        zoneNameEn: 'Hawally',
        distanceKm: 3.5,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z6',
        zoneNameAr: 'الجابرية',
        zoneNameEn: 'Jabriya',
        distanceKm: 4.8,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z7',
        zoneNameAr: 'الشعب البحري',
        zoneNameEn: 'Shaab Seafront',
        distanceKm: 3.9,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: 'SLM-Z8',
        zoneNameAr: 'ميدان حولي',
        zoneNameEn: 'Maidan Hawally',
        distanceKm: 2.5,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
    ],
  },
  {
    branchId: 'BR-360',
    branchCode: '360',
    branchNameAr: 'فرع 360 مول - الزهراء',
    branchNameEn: '360 Mall - Zahra Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'noodle-bar'],
    tabletOnline: true,
    batteryPct: 88,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 8,
    onlineZonesCount: 7,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 87.5,
    totalLostKwdToday: 32.400,
    zones: [
      {
        id: '360-Z1',
        zoneNameAr: 'الزهراء',
        zoneNameEn: 'Zahra',
        distanceKm: 1.1,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: '360-Z2',
        zoneNameAr: 'جنوب السرة',
        zoneNameEn: 'South Surra',
        distanceKm: 1.8,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: '360-Z3',
        zoneNameAr: 'حطين',
        zoneNameEn: 'Hateen',
        distanceKm: 2.4,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: '360-Z4',
        zoneNameAr: 'الشهداء',
        zoneNameEn: 'Shuhada',
        distanceKm: 2.1,
        status: 'BUSY_IN_AREA',
        startTime: '01:40 PM',
        endTime: null,
        isOngoing: true,
        durationMinutes: 28,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة',
        rootCauseLabelEn: 'Talabat Fleet Shortage in Shuhada',
        estimatedLostOrders: 6,
        estimatedLostKwd: 32.400,
        forcedTgoPenaltyKwd: 5.508,
      },
      {
        id: '360-Z5',
        zoneNameAr: 'السلام',
        zoneNameEn: 'Salam',
        distanceKm: 2.9,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: '360-Z6',
        zoneNameAr: 'الصديق',
        zoneNameEn: 'Siddiq',
        distanceKm: 3.3,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: '360-Z7',
        zoneNameAr: 'مشرف',
        zoneNameEn: 'Mishref',
        distanceKm: 3.8,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
      {
        id: '360-Z8',
        zoneNameAr: 'غرب مشرف (مبارك العبدالله)',
        zoneNameEn: 'West Mishref',
        distanceKm: 4.2,
        status: 'ONLINE_VISIBLE',
        startTime: '11:00 AM',
        endTime: null,
        isOngoing: false,
        durationMinutes: 0,
        rootCause: 'TALABAT_FLEET_SHORTAGE',
        rootCauseLabelAr: 'طبيعي - أسطول السائقين متاح',
        rootCauseLabelEn: 'Normal - Fleet Available',
        estimatedLostOrders: 0,
        estimatedLostKwd: 0.000,
        forcedTgoPenaltyKwd: 0.000,
      },
    ],
  },
  {
    branchId: 'BR-ASM',
    branchCode: 'ASM',
    branchNameAr: 'فرع العاصمة مول - شرق',
    branchNameEn: 'Assima Mall - Sharq Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'tahina'],
    tabletOnline: true,
    batteryPct: 91,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 8,
    onlineZonesCount: 8,
    busyZonesCount: 0,
    hiddenZonesCount: 0,
    openRatioPct: 100.0,
    totalLostKwdToday: 0.000,
    zones: [
      { id: 'ASM-Z1', zoneNameAr: 'شرق', zoneNameEn: 'Sharq', distanceKm: 0.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z2', zoneNameAr: 'دسمان', zoneNameEn: 'Dasman', distanceKm: 1.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z3', zoneNameAr: 'بنيد القار', zoneNameEn: 'Bneid Al-Gar', distanceKm: 2.2, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z4', zoneNameAr: 'المرقاب', zoneNameEn: 'Mirqab', distanceKm: 1.9, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z5', zoneNameAr: 'قبلة', zoneNameEn: 'Qibla', distanceKm: 2.7, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z6', zoneNameAr: 'المنصورية', zoneNameEn: 'Mansouriya', distanceKm: 3.1, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z7', zoneNameAr: 'الدعية', zoneNameEn: 'Daiya', distanceKm: 2.6, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ASM-Z8', zoneNameAr: 'الدسمة', zoneNameEn: 'Dasma', distanceKm: 3.4, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
  {
    branchId: 'BR-AVN',
    branchCode: 'AVN',
    branchNameAr: 'فرع الأفنيوز - الري',
    branchNameEn: 'The Avenues Mall - Rai Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'farm-brown'],
    tabletOnline: true,
    batteryPct: 96,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 8,
    onlineZonesCount: 7,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 87.5,
    totalLostKwdToday: 38.200,
    zones: [
      { id: 'AVN-Z1', zoneNameAr: 'الري', zoneNameEn: 'Rai', distanceKm: 1.0, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'AVN-Z2', zoneNameAr: 'الشويخ الصناعية', zoneNameEn: 'Shuwaikh Industrial', distanceKm: 2.1, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'AVN-Z3', zoneNameAr: 'الشويخ السكنية', zoneNameEn: 'Shuwaikh Residential', distanceKm: 3.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'AVN-Z4', zoneNameAr: 'الخالدية', zoneNameEn: 'Khaldiya', distanceKm: 4.2, status: 'BUSY_IN_AREA', startTime: '01:30 PM', endTime: null, isOngoing: true, durationMinutes: 35, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة', rootCauseLabelEn: 'Talabat Fleet Shortage', estimatedLostOrders: 7, estimatedLostKwd: 38.200, forcedTgoPenaltyKwd: 6.494 },
      { id: 'AVN-Z5', zoneNameAr: 'كيفان', zoneNameEn: 'Kaifan', distanceKm: 4.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'AVN-Z6', zoneNameAr: 'الفيحاء', zoneNameEn: 'Faiha', distanceKm: 5.1, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'AVN-Z7', zoneNameAr: 'النزهة', zoneNameEn: 'Nuzha', distanceKm: 5.6, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'AVN-Z8', zoneNameAr: 'اليرموك', zoneNameEn: 'Yarmouk', distanceKm: 3.9, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
  {
    branchId: 'BR-KOT',
    branchCode: 'KOT',
    branchNameAr: 'فرع الكوت مول - الفحيحيل',
    branchNameEn: 'Al Kout Mall - Fahaheel Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'tahina'],
    tabletOnline: true,
    batteryPct: 82,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 8,
    onlineZonesCount: 6,
    busyZonesCount: 1,
    hiddenZonesCount: 1,
    openRatioPct: 75.0,
    totalLostKwdToday: 62.000,
    zones: [
      { id: 'KOT-Z1', zoneNameAr: 'الفحيحيل', zoneNameEn: 'Fahaheel', distanceKm: 1.0, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z2', zoneNameAr: 'المنقف', zoneNameEn: 'Mangaf', distanceKm: 2.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z3', zoneNameAr: 'أبو حليفة', zoneNameEn: 'Abu Halifa', distanceKm: 3.8, status: 'BUSY_IN_AREA', startTime: '01:10 PM', endTime: null, isOngoing: true, durationMinutes: 45, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة', rootCauseLabelEn: 'Talabat Fleet Shortage', estimatedLostOrders: 5, estimatedLostKwd: 28.000, forcedTgoPenaltyKwd: 4.760 },
      { id: 'KOT-Z4', zoneNameAr: 'المهبولة', zoneNameEn: 'Mahboula', distanceKm: 5.2, status: 'AREA_CLOSED_HIDDEN', startTime: '01:00 PM', endTime: '01:50 PM', isOngoing: false, durationMinutes: 50, rootCause: 'PEAK_RADIUS_CUT', rootCauseLabelAr: 'تقليص مضلع التوصيل وقت الذروة', rootCauseLabelEn: 'Peak Radius Shrinkage', estimatedLostOrders: 6, estimatedLostKwd: 34.000, forcedTgoPenaltyKwd: 5.780 },
      { id: 'KOT-Z5', zoneNameAr: 'الفنطاس', zoneNameEn: 'Fintas', distanceKm: 6.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z6', zoneNameAr: 'العقيلة', zoneNameEn: 'Egaila', distanceKm: 6.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z7', zoneNameAr: 'الأحمدي', zoneNameEn: 'Ahmadi', distanceKm: 4.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'KOT-Z8', zoneNameAr: 'الصباحية', zoneNameEn: 'Sabahiya', distanceKm: 3.2, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
  {
    branchId: 'BR-PRM',
    branchCode: 'PRM',
    branchNameAr: 'فرع بروميناد حولي',
    branchNameEn: 'Promenade Mall - Hawally Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'noodle-bar'],
    tabletOnline: true,
    batteryPct: 90,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 7,
    onlineZonesCount: 7,
    busyZonesCount: 0,
    hiddenZonesCount: 0,
    openRatioPct: 100.0,
    totalLostKwdToday: 0.000,
    zones: [
      { id: 'PRM-Z1', zoneNameAr: 'حولي', zoneNameEn: 'Hawally', distanceKm: 0.9, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'PRM-Z2', zoneNameAr: 'الروضة', zoneNameEn: 'Rawda', distanceKm: 2.1, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'PRM-Z3', zoneNameAr: 'العديلية', zoneNameEn: 'Adailiya', distanceKm: 3.2, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'PRM-Z4', zoneNameAr: 'السرة', zoneNameEn: 'Surra', distanceKm: 3.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'PRM-Z5', zoneNameAr: 'قرطبة', zoneNameEn: 'Qurtoba', distanceKm: 3.9, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'PRM-Z6', zoneNameAr: 'اليرموك', zoneNameEn: 'Yarmouk', distanceKm: 4.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'PRM-Z7', zoneNameAr: 'الشامية', zoneNameEn: 'Shamiya', distanceKm: 4.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
  {
    branchId: 'BR-QRN',
    branchCode: 'QRN',
    branchNameAr: 'فرع أسواق القرين + المطبخ المركزي',
    branchNameEn: 'Aswaq Al-Qurain Branch & Central Kitchen',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria'],
    tabletOnline: true,
    batteryPct: 98,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 8,
    onlineZonesCount: 6,
    busyZonesCount: 1,
    hiddenZonesCount: 1,
    openRatioPct: 75.0,
    totalLostKwdToday: 55.400,
    zones: [
      { id: 'QRN-Z1', zoneNameAr: 'أسواق القرين', zoneNameEn: 'Aswaq Al-Qurain', distanceKm: 0.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z2', zoneNameAr: 'القرين', zoneNameEn: 'Al-Qurain', distanceKm: 1.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z3', zoneNameAr: 'مبارك الكبير', zoneNameEn: 'Mubarak Al-Kabeer', distanceKm: 2.6, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z4', zoneNameAr: 'القصور', zoneNameEn: 'Qusoor', distanceKm: 2.9, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z5', zoneNameAr: 'العدان', zoneNameEn: 'Adan', distanceKm: 3.4, status: 'BUSY_IN_AREA', startTime: '01:20 PM', endTime: null, isOngoing: true, durationMinutes: 38, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة', rootCauseLabelEn: 'Talabat Fleet Shortage', estimatedLostOrders: 4, estimatedLostKwd: 22.400, forcedTgoPenaltyKwd: 3.808 },
      { id: 'QRN-Z6', zoneNameAr: 'صباح السالم', zoneNameEn: 'Sabah Al-Salem', distanceKm: 4.8, status: 'AREA_CLOSED_HIDDEN', startTime: '01:05 PM', endTime: '01:45 PM', isOngoing: false, durationMinutes: 40, rootCause: 'PEAK_RADIUS_CUT', rootCauseLabelAr: 'تقليص مضلع التوصيل وقت الذروة', rootCauseLabelEn: 'Peak Radius Shrinkage', estimatedLostOrders: 6, estimatedLostKwd: 33.000, forcedTgoPenaltyKwd: 5.610 },
      { id: 'QRN-Z7', zoneNameAr: 'الفنيطيس', zoneNameEn: 'Funaitees', distanceKm: 5.2, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'QRN-Z8', zoneNameAr: 'المسيلة', zoneNameEn: 'Messila', distanceKm: 5.9, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
  {
    branchId: 'BR-ARD',
    branchCode: 'ARD',
    branchNameAr: 'فرع العارضية الحرفية',
    branchNameEn: 'Ardiya Craft Branch',
    primaryBrandId: 'china-garden',
    primaryBrandNameAr: 'تشاينا جاردن',
    primaryBrandNameEn: 'China Garden',
    supportedBrandIds: ['china-garden', 'tahina'],
    tabletOnline: true,
    batteryPct: 89,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 7,
    onlineZonesCount: 7,
    busyZonesCount: 0,
    hiddenZonesCount: 0,
    openRatioPct: 100.0,
    totalLostKwdToday: 0.000,
    zones: [
      { id: 'ARD-Z1', zoneNameAr: 'العارضية الحرفية', zoneNameEn: 'Ardiya Craft', distanceKm: 0.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z2', zoneNameAr: 'العارضية السكنية', zoneNameEn: 'Ardiya Residential', distanceKm: 1.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z3', zoneNameAr: 'صباح الناصر', zoneNameEn: 'Sabah Al-Nasser', distanceKm: 2.6, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z4', zoneNameAr: 'الفردوس', zoneNameEn: 'Firdous', distanceKm: 3.1, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z5', zoneNameAr: 'الأندلس', zoneNameEn: 'Andalus', distanceKm: 3.5, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z6', zoneNameAr: 'الرقعي', zoneNameEn: 'Riggae', distanceKm: 4.2, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'ARD-Z7', zoneNameAr: 'جليب الشيوخ', zoneNameEn: 'Jleeb Al-Shuyoukh', distanceKm: 4.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
    ],
  },
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
    batteryPct: 86,
    assignedFleetType: 'TALABAT_GO_17',
    totalZonesCount: 6,
    onlineZonesCount: 5,
    busyZonesCount: 1,
    hiddenZonesCount: 0,
    openRatioPct: 83.3,
    totalLostKwdToday: 24.800,
    zones: [
      { id: 'FRW-Z1', zoneNameAr: 'الفروانية', zoneNameEn: 'Farwaniya', distanceKm: 1.0, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z2', zoneNameAr: 'خيطان', zoneNameEn: 'Khaitan', distanceKm: 2.3, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z3', zoneNameAr: 'العمرية', zoneNameEn: 'Omariya', distanceKm: 2.7, status: 'BUSY_IN_AREA', startTime: '01:35 PM', endTime: null, isOngoing: true, durationMinutes: 30, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة', rootCauseLabelEn: 'Talabat Fleet Shortage', estimatedLostOrders: 4, estimatedLostKwd: 24.800, forcedTgoPenaltyKwd: 4.216 },
      { id: 'FRW-Z4', zoneNameAr: 'الرابية', zoneNameEn: 'Rabia', distanceKm: 3.4, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z5', zoneNameAr: 'إشبيلية', zoneNameEn: 'Ishbiliya', distanceKm: 4.1, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
      { id: 'FRW-Z6', zoneNameAr: 'الرحاب', zoneNameEn: 'Rehab', distanceKm: 3.8, status: 'ONLINE_VISIBLE', startTime: '11:00 AM', endTime: null, isOngoing: false, durationMinutes: 0, rootCause: 'TALABAT_FLEET_SHORTAGE', rootCauseLabelAr: 'طبيعي', rootCauseLabelEn: 'Normal', estimatedLostOrders: 0, estimatedLostKwd: 0.000, forcedTgoPenaltyKwd: 0.000 },
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
    branchNameEn: 'Salmiya Main Branch',
    zoneNameAr: 'بيان',
    zoneNameEn: 'Bayan',
    status: 'AREA_CLOSED_HIDDEN',
    startTime: '01:25 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 42,
    isOngoing: true,
    rootCauseLabelAr: 'تقليص مضلع التوصيل وقت الذروة من طلبات',
    rootCauseLabelEn: 'Talabat Peak Radius Shrinkage (< 3km)',
    faultParty: 'TALABAT',
    lostOrders: 7,
    lostKwd: 41.000,
    penaltyKwd: 6.970,
    remedyActionAr: 'تقديم مطالبة رسمية لطلب تعويض مالي وخصم عمولة التوصيل',
    remedyActionEn: 'Lodge formal Talabat SLA breach penalty & commission deduction',
  },
  {
    id: 'INC-20261103-02',
    timestamp: '2026-11-03 13:40:00',
    date: '2026-11-03',
    brandNameAr: 'تشاينا جاردن',
    brandNameEn: 'China Garden',
    branchNameAr: 'فرع 360 مول - الزهراء',
    branchNameEn: '360 Mall - Zahra Branch',
    zoneNameAr: 'الشهداء',
    zoneNameEn: 'Shuhada',
    status: 'BUSY_IN_AREA',
    startTime: '01:40 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 28,
    isOngoing: true,
    rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة',
    rootCauseLabelEn: 'Talabat Fleet Shortage in Shuhada',
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
    branchNameAr: 'فرع الأفنيوز - الري',
    branchNameEn: 'The Avenues Mall - Rai Branch',
    zoneNameAr: 'الخالدية',
    zoneNameEn: 'Khaldiya',
    status: 'BUSY_IN_AREA',
    startTime: '01:30 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 35,
    isOngoing: true,
    rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة',
    rootCauseLabelEn: 'Talabat Fleet Shortage in Khaldiya',
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
    branchNameAr: 'فرع الكوت مول - الفحيحيل',
    branchNameEn: 'Al Kout Mall - Fahaheel Branch',
    zoneNameAr: 'أبو حليفة',
    zoneNameEn: 'Abu Halifa',
    status: 'BUSY_IN_AREA',
    startTime: '01:10 PM',
    endTime: 'مستمر الآن',
    durationMinutes: 45,
    isOngoing: true,
    rootCauseLabelAr: 'نقص أسطول سائقي طلبات في المنطقة',
    rootCauseLabelEn: 'Talabat Fleet Shortage in Abu Halifa',
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

  for (const branch of branches) {
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
    lastScannedAt: new Date().toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

/** Formats a clean formal email text table for the 3 designated executives */
export function formatTalabatAreaAlertEmail(branches: BranchRadarProfile[], kpis: GeoRadarKpis): string {
  const lines: string[] = [
    '========================================================================================',
    '🚨 AetherBI · VENTURE FOODS W.L.L. — TALABAT GO BUSY & HIDDEN AREAS FORENSIC ALERT',
    '========================================================================================',
    `Date & Time: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuwait' })} (Kuwait Time)`,
    `Monitored Kuwait Zones: ${kpis.totalMonitoredZones} | Online: ${kpis.onlineZonesCount} (${kpis.onlineZonesPct}%)`,
    `⚠️ Busy Areas: ${kpis.busyZonesCount} | 🛑 Hidden / Shrunk Polygons: ${kpis.hiddenZonesCount}`,
    `Estimated Lost Sales Today: ${kpis.totalLostSalesKwd.toFixed(3)} KWD`,
    `TGO 17% Commission Penalty: ${kpis.totalTgoPenaltiesKwd.toFixed(3)} KWD`,
    `Total Commercial Loss: ${kpis.totalFinancialImpactKwd.toFixed(3)} KWD`,
    '----------------------------------------------------------------------------------------',
    'BREAKDOWN OF AFFECTED BRANCHES & RESIDENTIAL DELIVERY AREAS:',
    '----------------------------------------------------------------------------------------',
  ]

  for (const b of branches) {
    const affected = b.zones.filter((z) => z.status !== 'ONLINE_VISIBLE')
    if (affected.length === 0) continue

    lines.push(`\n🏢 [${b.branchCode}] ${b.branchNameAr} (${b.primaryBrandNameAr}):`)
    for (const z of affected) {
      const statusIcon = z.status === 'BUSY_IN_AREA' ? '🟡 BUSY' : '🔴 HIDDEN / POLYGON CUT'
      const timeStr = z.isOngoing ? `منذ ${z.startTime} (مستمر - ${z.durationMinutes} دقيقة)` : `من ${z.startTime} إلى ${z.endTime} (${z.durationMinutes} دقيقة)`
      lines.push(`   - ${statusIcon} في منطقة [${z.zoneNameAr}]: ${timeStr}`)
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
