/**
 * Operations Expansion — Part 2 Engine (`src/lib/ops-expansion-part2.ts`)
 *
 * Powers the 3 standalone operational & reputation command centers on Workstation #2:
 *   1. `/erp/delivery-sla`       — Rider Pickup-to-Customer Delivery Duration SLA (<=22.0m Green, 22.1–32.0m Yellow, >32.0m Red)
 *   2. `/erp/social-reviews`     — Omnichannel Social Media, Google Maps & Delivery Aggregator Reviews Command Center
 *   3. `/erp/weekday-comparison` — Like-for-Like Same-Weekday Sales, Net Cash & Intraday Hourly Curve Comparison
 *
 * Strictly enforces Venture Foods 6-Brand & 7-Branch whitelist, 0 KWD arithmetic reconciliation,
 * and dynamic synchronization with GlobalFilterContext (`Brand × Branch × Channel × Period`).
 */

import { ODOO } from '@/lib/odoo/odoo-dataset'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  getBranchLabel,
  getBrandLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'

export type BrandId = Exclude<GlobalBrand, 'all'>
export type BranchId = Exclude<GlobalBranch, 'all'>

// ============================================================================
// DELIVERABLE 4 — RIDER DELIVERY DURATION SLA (<=22.0m Green, 22.1–32.0m Yellow, >32.0m Red)
// ============================================================================

export type TrafficLightTier = 'green' | 'yellow' | 'red'

export type DeliveryFleetId =
  | 'internal-fleet'
  | 'talabat-tmp'
  | 'talabat-tgo'
  | 'keeta'
  | 'jahez'
  | 'deliveroo'

export interface DeliveryFleetMeta {
  id: DeliveryFleetId
  ar: string
  en: string
  shortAr: string
  shortEn: string
  mappedChannels: readonly GlobalChannel[]
}

export const DELIVERY_FLEETS: readonly DeliveryFleetMeta[] = [
  {
    id: 'internal-fleet',
    ar: 'أسطولنا الداخلي (مباشر)',
    en: 'Internal Fleet (Direct)',
    shortAr: 'أسطولنا',
    shortEn: 'Internal Fleet',
    mappedChannels: ['takeaway-direct'],
  },
  {
    id: 'talabat-tmp',
    ar: 'طلبات TMP (سائقو الشركة)',
    en: 'Talabat TMP (Own Riders)',
    shortAr: 'Talabat TMP',
    shortEn: 'Talabat TMP',
    mappedChannels: ['talabat-tmp'],
  },
  {
    id: 'talabat-tgo',
    ar: 'طلبات Tgo (سائقو طلبات)',
    en: 'Talabat Tgo (Aggregator)',
    shortAr: 'Tgo',
    shortEn: 'Tgo',
    mappedChannels: ['talabat-tgo'],
  },
  {
    id: 'keeta',
    ar: 'كيتا (Keeta)',
    en: 'Keeta',
    shortAr: 'كيتا',
    shortEn: 'Keeta',
    mappedChannels: ['keeta'],
  },
  {
    id: 'jahez',
    ar: 'جاهز (Jahez)',
    en: 'Jahez',
    shortAr: 'جاهز',
    shortEn: 'Jahez',
    mappedChannels: ['jahez'],
  },
  {
    id: 'deliveroo',
    ar: 'ديليفرو (Deliveroo)',
    en: 'Deliveroo',
    shortAr: 'ديليفرو',
    shortEn: 'Deliveroo',
    mappedChannels: ['deliveroo', 'snoonu'],
  },
] as const

export const DELIVERY_SLA_GREEN_MAX = 22.0
export const DELIVERY_SLA_YELLOW_MAX = 32.0

export function gradeDeliveryMinutes(minutes: number): {
  tier: TrafficLightTier
  labelAr: string
  labelEn: string
} {
  if (minutes <= DELIVERY_SLA_GREEN_MAX) {
    return {
      tier: 'green',
      labelAr: 'أخضر — جيد',
      labelEn: 'Green — Good',
    }
  }
  if (minutes <= DELIVERY_SLA_YELLOW_MAX) {
    return {
      tier: 'yellow',
      labelAr: 'أصفر — متوسط',
      labelEn: 'Yellow — Average',
    }
  }
  return {
    tier: 'red',
    labelAr: 'أحمر — سيء للغاية',
    labelEn: 'Red — Very Bad',
  }
}

export interface RiderTripRecord {
  id: string
  orderRef: string
  date: string
  brandId: BrandId
  branchId: BranchId
  fleetId: DeliveryFleetId
  driverAr: string
  driverEn: string
  pickupTimestamp: string
  deliveredTimestamp: string
  transitMinutes: number
  zoneAr: string
  zoneEn: string
  distanceKm: number
  orderKwd: number
  auditNoteAr: string
  auditNoteEn: string
}

export interface EnrichedRiderTrip extends RiderTripRecord {
  tier: TrafficLightTier
  tierLabelAr: string
  tierLabelEn: string
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  fleetAr: string
  fleetEn: string
  coldFoodRisk: boolean
}

export interface FleetSlaSummary {
  fleetId: DeliveryFleetId
  ar: string
  en: string
  shortAr: string
  shortEn: string
  tripCount: number
  meanMinutes: number
  greenPct: number
  yellowPct: number
  redPct: number
  redCount: number
  tier: TrafficLightTier
}

export interface BranchFleetMatrixCell {
  fleetId: DeliveryFleetId
  meanMinutes: number | null
  tripCount: number
  tier: TrafficLightTier | null
}

export interface BranchFleetMatrixRow {
  branchId: BranchId
  branchAr: string
  branchEn: string
  overallMeanMinutes: number
  overallTier: TrafficLightTier
  tripCount: number
  cells: Record<DeliveryFleetId, BranchFleetMatrixCell>
}

export interface DeliverySlaSnapshot {
  trips: EnrichedRiderTrip[]
  totalTrips: number
  meanMinutes: number
  overallTier: TrafficLightTier
  greenCount: number
  yellowCount: number
  redCount: number
  greenPct: number
  yellowPct: number
  redPct: number
  coldFoodRiskOrders: number
  estimatedClaimableKwd: number
  bestFleet: FleetSlaSummary
  worstFleet: FleetSlaSummary
  fleetSummaries: FleetSlaSummary[]
  branchFleetMatrix: BranchFleetMatrixRow[]
}

export const DELIVERY_CUSTOM_TRIPS_STORAGE_KEY = 'vf.ops.deliverySlaTrips.v1'

export const SEEDED_RIDER_TRIPS: readonly RiderTripRecord[] = [
  {
    id: 'dlv-101',
    orderRef: 'VF-88401',
    date: '2026-11-10',
    brandId: 'china-garden',
    branchId: 'promenade',
    fleetId: 'internal-fleet',
    driverAr: 'راجو كومار (أسطولنا #04)',
    driverEn: 'Raju Kumar (Internal #04)',
    pickupTimestamp: '19:08',
    deliveredTimestamp: '19:24',
    transitMinutes: 16.0,
    zoneAr: 'حولي — شارع تونس',
    zoneEn: 'Hawally — Tunis St',
    distanceKm: 2.1,
    orderKwd: 9.4,
    auditNoteAr: 'انطلاق فوري من بوابة البروميناد الجانبية بحافظة حرارية محكمة',
    auditNoteEn: 'Immediate side-gate dispatch with sealed thermal bag',
  },
  {
    id: 'dlv-102',
    orderRef: 'VF-88405',
    date: '2026-11-10',
    brandId: 'china-garden',
    branchId: 'avenues',
    fleetId: 'talabat-tgo',
    driverAr: 'سائق Tgo #4912',
    driverEn: 'Tgo Rider #4912',
    pickupTimestamp: '19:14',
    deliveredTimestamp: '19:53',
    transitMinutes: 39.0,
    zoneAr: 'الرابية ق٣',
    zoneEn: 'Rabiya Block 3',
    distanceKm: 5.8,
    orderKwd: 12.6,
    auditNoteAr: 'تجميع طلبين من المول + ازدحام الدائري الخامس سبب تأخيراً حرجاً',
    auditNoteEn: 'Multi-order mall batching + 5th Ring traffic caused severe delay',
  },
  {
    id: 'dlv-103',
    orderRef: 'VF-88409',
    date: '2026-11-10',
    brandId: 'franks',
    branchId: 'salmiya',
    fleetId: 'talabat-tmp',
    driverAr: 'عمران خان (TMP #11)',
    driverEn: 'Imran Khan (TMP #11)',
    pickupTimestamp: '19:18',
    deliveredTimestamp: '19:37',
    transitMinutes: 19.0,
    zoneAr: 'السالمية ق١٠',
    zoneEn: 'Salmiya Block 10',
    distanceKm: 2.6,
    orderKwd: 7.25,
    auditNoteAr: 'مسار منفرد مباشر — وصل البرجر والبطاط مقرمشاً',
    auditNoteEn: 'Single-drop direct route — burger & fries arrived crisp',
  },
  {
    id: 'dlv-104',
    orderRef: 'VF-88414',
    date: '2026-11-10',
    brandId: 'china-garden',
    branchId: '360-mall',
    fleetId: 'keeta',
    driverAr: 'سائق كيتا #1180',
    driverEn: 'Keeta Rider #1180',
    pickupTimestamp: '19:22',
    deliveredTimestamp: '19:43',
    transitMinutes: 21.0,
    zoneAr: 'الزهراء ق٤',
    zoneEn: 'Zahra Block 4',
    distanceKm: 3.3,
    orderKwd: 8.9,
    auditNoteAr: 'توصيل ممتاز لجنوب السرة ضمن النطاق الأخضر',
    auditNoteEn: 'Fast South Surra drop inside green threshold',
  },
  {
    id: 'dlv-105',
    orderRef: 'VF-88418',
    date: '2026-11-10',
    brandId: 'tahina',
    branchId: 'assima',
    fleetId: 'deliveroo',
    driverAr: 'سائق ديليفرو #734',
    driverEn: 'Deliveroo Rider #734',
    pickupTimestamp: '13:06',
    deliveredTimestamp: '13:34',
    transitMinutes: 28.0,
    zoneAr: 'شرق — أبراج المكاتب',
    zoneEn: 'Sharq Office Towers',
    distanceKm: 2.2,
    orderKwd: 6.1,
    auditNoteAr: 'انتظار مصاعد البرج وقت ذروة الغداء رفع الزمن للمتوسط',
    auditNoteEn: 'Lunch rush elevator wait pushed transit into yellow warning',
  },
  {
    id: 'dlv-106',
    orderRef: 'VF-88422',
    date: '2026-11-10',
    brandId: 'farm-brown',
    branchId: 'ardiya',
    fleetId: 'talabat-tmp',
    driverAr: 'أرشد علي (TMP #07)',
    driverEn: 'Arshad Ali (TMP #07)',
    pickupTimestamp: '18:10',
    deliveredTimestamp: '18:29',
    transitMinutes: 19.0,
    zoneAr: 'العارضية السكنية ق٦',
    zoneEn: 'Ardiya Residential B6',
    distanceKm: 2.9,
    orderKwd: 5.45,
    auditNoteAr: 'خروج مباشر من مطبخ العارضية بدون عوائق مواقف',
    auditNoteEn: 'Zero parking walk overhead from Ardiya hub',
  },
  {
    id: 'dlv-107',
    orderRef: 'VF-88427',
    date: '2026-11-10',
    brandId: 'noodle-bar',
    branchId: 'salmiya',
    fleetId: 'jahez',
    driverAr: 'سائق جاهز #309',
    driverEn: 'Jahez Rider #309',
    pickupTimestamp: '20:05',
    deliveredTimestamp: '20:43',
    transitMinutes: 38.0,
    zoneAr: 'بيان ق٨',
    zoneEn: 'Bayan Block 8',
    distanceKm: 6.7,
    orderKwd: 7.3,
    auditNoteAr: 'مسافة بعيدة وقت الذروة — خطر برودة الشوربة وتأثر النودلز',
    auditNoteEn: '>6km evening rush — high broth cooling & noodle texture risk',
  },
  {
    id: 'dlv-108',
    orderRef: 'VF-88431',
    date: '2026-11-10',
    brandId: 'china-garden',
    branchId: 'al-kout',
    fleetId: 'talabat-tmp',
    driverAr: 'سانتوش ناير (TMP #15)',
    driverEn: 'Santosh Nair (TMP #15)',
    pickupTimestamp: '20:12',
    deliveredTimestamp: '20:32',
    transitMinutes: 20.0,
    zoneAr: 'الفحيحيل ق٩',
    zoneEn: 'Fahaheel Block 9',
    distanceKm: 2.5,
    orderKwd: 10.2,
    auditNoteAr: 'تسليم سريع داخل نطاق الفحيحيل القريب',
    auditNoteEn: 'Prompt delivery within nearby Fahaheel zone',
  },
  {
    id: 'dlv-109',
    orderRef: 'VF-88435',
    date: '2026-11-10',
    brandId: 'franks',
    branchId: '360-mall',
    fleetId: 'talabat-tgo',
    driverAr: 'سائق Tgo #8812',
    driverEn: 'Tgo Rider #8812',
    pickupTimestamp: '20:18',
    deliveredTimestamp: '20:48',
    transitMinutes: 30.0,
    zoneAr: 'حطين ق٢',
    zoneEn: 'Hitteen Block 2',
    distanceKm: 3.9,
    orderKwd: 7.85,
    auditNoteAr: 'مشي المواقف من ردهة مول 360 أضاف ٨ دقائق للرحلة',
    auditNoteEn: 'Mall food-court to bike parking walk added 8m',
  },
  {
    id: 'dlv-110',
    orderRef: 'VF-88439',
    date: '2026-11-10',
    brandId: 'karak-cafeteria',
    branchId: 'assima',
    fleetId: 'internal-fleet',
    driverAr: 'سائق الشركة #02',
    driverEn: 'Internal Rider #02',
    pickupTimestamp: '17:04',
    deliveredTimestamp: '17:21',
    transitMinutes: 17.0,
    zoneAr: 'بنيد القار ق١',
    zoneEn: 'Bneid Al-Gar B1',
    distanceKm: 2.8,
    orderKwd: 4.2,
    auditNoteAr: 'دلة الكرك والجباتي وصلت بحرارة ممتازة خلال ١٧ دقيقة',
    auditNoteEn: 'Karak flask & chapati arrived piping hot in 17m',
  },
  {
    id: 'dlv-111',
    orderRef: 'VF-88444',
    date: '2026-11-10',
    brandId: 'china-garden',
    branchId: 'al-kout',
    fleetId: 'talabat-tgo',
    driverAr: 'سائق Tgo #6103',
    driverEn: 'Tgo Rider #6103',
    pickupTimestamp: '20:40',
    deliveredTimestamp: '21:22',
    transitMinutes: 42.0,
    zoneAr: 'العقيلة ق٢',
    zoneEn: 'Egaila Block 2',
    distanceKm: 7.3,
    orderKwd: 13.5,
    auditNoteAr: 'تأخير ٤٢ دقيقة بسبب مرور السائق على المنقف لتسليم طلب مدمج أولاً',
    auditNoteEn: '42m red breach — rider detoured via Mangaf on batched drop',
  },
  {
    id: 'dlv-112',
    orderRef: 'VF-88449',
    date: '2026-11-10',
    brandId: 'china-garden',
    branchId: 'promenade',
    fleetId: 'keeta',
    driverAr: 'سائق كيتا #2054',
    driverEn: 'Keeta Rider #2054',
    pickupTimestamp: '20:45',
    deliveredTimestamp: '21:11',
    transitMinutes: 26.0,
    zoneAr: 'الروضة ق٣',
    zoneEn: 'Rawda Block 3',
    distanceKm: 4.3,
    orderKwd: 10.8,
    auditNoteAr: 'إشارات شارع القاهرة المسائية رفعت الزمن إلى ٢٦ دقيقة',
    auditNoteEn: 'Cairo St evening traffic signals kept trip at 26m',
  },
  {
    id: 'dlv-113',
    orderRef: 'VF-88453',
    date: '2026-11-10',
    brandId: 'tahina',
    branchId: 'avenues',
    fleetId: 'internal-fleet',
    driverAr: 'سائق الشركة #05',
    driverEn: 'Internal Rider #05',
    pickupTimestamp: '14:12',
    deliveredTimestamp: '14:32',
    transitMinutes: 20.0,
    zoneAr: 'الأندلس ق٥',
    zoneEn: 'Andalus Block 5',
    distanceKm: 3.6,
    orderKwd: 6.9,
    auditNoteAr: 'طلب واتساب مباشر بدون عمولة — تسليم ٢٠ دقيقة',
    auditNoteEn: '0%-fee direct WhatsApp order — smooth 20m delivery',
  },
  {
    id: 'dlv-114',
    orderRef: 'VF-88458',
    date: '2026-11-09',
    brandId: 'noodle-bar',
    branchId: 'ardiya',
    fleetId: 'keeta',
    driverAr: 'سائق كيتا #940',
    driverEn: 'Keeta Rider #940',
    pickupTimestamp: '21:05',
    deliveredTimestamp: '21:41',
    transitMinutes: 36.0,
    zoneAr: 'صباح الناصر ق٤',
    zoneEn: 'Sabah Al-Nasser B4',
    distanceKm: 4.9,
    orderKwd: 6.45,
    auditNoteAr: 'تأخر السائق في الوصول للقطعة السكنية — تجاوز الحد الأحمر',
    auditNoteEn: 'Block navigation delay pushed trip past 32m red ceiling',
  },
  {
    id: 'dlv-115',
    orderRef: 'VF-88462',
    date: '2026-11-09',
    brandId: 'franks',
    branchId: 'avenues',
    fleetId: 'jahez',
    driverAr: 'سائق جاهز #415',
    driverEn: 'Jahez Rider #415',
    pickupTimestamp: '21:14',
    deliveredTimestamp: '21:35',
    transitMinutes: 21.0,
    zoneAr: 'الفروانية ق١',
    zoneEn: 'Farwaniya Block 1',
    distanceKm: 3.4,
    orderKwd: 8.3,
    auditNoteAr: 'أداء جيد ٢١ دقيقة ضمن العلامة الخضراء',
    auditNoteEn: 'Solid 21m handoff within green target',
  },
  {
    id: 'dlv-116',
    orderRef: 'VF-88467',
    date: '2026-11-09',
    brandId: 'farm-brown',
    branchId: 'salmiya',
    fleetId: 'deliveroo',
    driverAr: 'سائق ديليفرو #518',
    driverEn: 'Deliveroo Rider #518',
    pickupTimestamp: '19:42',
    deliveredTimestamp: '20:11',
    transitMinutes: 29.0,
    zoneAr: 'مشرف ق٤',
    zoneEn: 'Mishref Block 4',
    distanceKm: 5.7,
    orderKwd: 6.2,
    auditNoteAr: '٢٩ دقيقة بسبب كثافة طريق الفحيحيل السريع',
    auditNoteEn: '29m yellow warning due to Fahaheel Expressway volume',
  },
  {
    id: 'dlv-117',
    orderRef: 'VF-88471',
    date: '2026-11-09',
    brandId: 'china-garden',
    branchId: 'assima',
    fleetId: 'talabat-tgo',
    driverAr: 'سائق Tgo #3319',
    driverEn: 'Tgo Rider #3319',
    pickupTimestamp: '13:18',
    deliveredTimestamp: '13:54',
    transitMinutes: 36.0,
    zoneAr: 'المرقاب — مجمع الوزارات',
    zoneEn: 'Mirqab Ministries',
    distanceKm: 2.9,
    orderKwd: 14.1,
    auditNoteAr: 'ازدحام مواقف المرقاب وتأخر تسليم البوابة — أحمر سيء للغاية',
    auditNoteEn: 'Mirqab gate access + parking congestion — 36m red delay',
  },
  {
    id: 'dlv-118',
    orderRef: 'VF-88476',
    date: '2026-11-09',
    brandId: 'china-garden',
    branchId: '360-mall',
    fleetId: 'internal-fleet',
    driverAr: 'سائق الشركة #06',
    driverEn: 'Internal Rider #06',
    pickupTimestamp: '18:50',
    deliveredTimestamp: '19:09',
    transitMinutes: 19.0,
    zoneAr: 'السلام ق٥',
    zoneEn: 'Salam Block 5',
    distanceKm: 3.0,
    orderKwd: 11.75,
    auditNoteAr: '١٩ دقيقة توصيل مباشر لعائلة في السلام',
    auditNoteEn: '19m direct family order drop to Salam',
  },
  {
    id: 'dlv-119',
    orderRef: 'VF-88480',
    date: '2026-11-09',
    brandId: 'tahina',
    branchId: 'promenade',
    fleetId: 'talabat-tmp',
    driverAr: 'محمد فيصل (TMP #09)',
    driverEn: 'Mohammed Faisal (TMP #09)',
    pickupTimestamp: '15:10',
    deliveredTimestamp: '15:28',
    transitMinutes: 18.0,
    zoneAr: 'الشعب البحري',
    zoneEn: 'Shaab Al-Bahri',
    distanceKm: 2.7,
    orderKwd: 5.95,
    auditNoteAr: '١٨ دقيقة توصيل مثالي عبر سائق الشركة TMP',
    auditNoteEn: '18m crisp TMP own-fleet handoff',
  },
  {
    id: 'dlv-120',
    orderRef: 'VF-88484',
    date: '2026-11-09',
    brandId: 'karak-cafeteria',
    branchId: 'al-kout',
    fleetId: 'keeta',
    driverAr: 'سائق كيتا #1509',
    driverEn: 'Keeta Rider #1509',
    pickupTimestamp: '16:40',
    deliveredTimestamp: '17:01',
    transitMinutes: 21.0,
    zoneAr: 'أبو حليفة ق٢',
    zoneEn: 'Abu Halifa B2',
    distanceKm: 3.5,
    orderKwd: 4.5,
    auditNoteAr: '٢١ دقيقة ضمن النطاق الأخضر بدون انسكاب',
    auditNoteEn: '21m green delivery with zero spill',
  },
  {
    id: 'dlv-121',
    orderRef: 'VF-88489',
    date: '2026-11-09',
    brandId: 'franks',
    branchId: 'ardiya',
    fleetId: 'jahez',
    driverAr: 'سائق جاهز #612',
    driverEn: 'Jahez Rider #612',
    pickupTimestamp: '20:20',
    deliveredTimestamp: '20:45',
    transitMinutes: 25.0,
    zoneAr: 'الفردوس ق٧',
    zoneEn: 'Ferdous Block 7',
    distanceKm: 3.8,
    orderKwd: 7.6,
    auditNoteAr: '٢٥ دقيقة متوسط — حركة مساء طبيعية',
    auditNoteEn: '25m yellow average — normal evening traffic',
  },
  {
    id: 'dlv-122',
    orderRef: 'VF-88493',
    date: '2026-11-08',
    brandId: 'china-garden',
    branchId: 'salmiya',
    fleetId: 'talabat-tgo',
    driverAr: 'سائق Tgo #7721',
    driverEn: 'Tgo Rider #7721',
    pickupTimestamp: '20:30',
    deliveredTimestamp: '21:07',
    transitMinutes: 37.0,
    zoneAr: 'سلوى ق١١',
    zoneEn: 'Salwa Block 11',
    distanceKm: 6.4,
    orderKwd: 15.2,
    auditNoteAr: 'تأخر ٣٧ دقيقة بسبب زحمة شارع التعاون ودمج طلبين',
    auditNoteEn: '37m red delay on Al-Taawun road + rider order stacking',
  },
  {
    id: 'dlv-123',
    orderRef: 'VF-88498',
    date: '2026-11-08',
    brandId: 'noodle-bar',
    branchId: 'avenues',
    fleetId: 'deliveroo',
    driverAr: 'سائق ديليفرو #889',
    driverEn: 'Deliveroo Rider #889',
    pickupTimestamp: '19:00',
    deliveredTimestamp: '19:27',
    transitMinutes: 27.0,
    zoneAr: 'الري — المكاتب والمعارض',
    zoneEn: 'Al-Rai Showrooms',
    distanceKm: 2.9,
    orderKwd: 6.8,
    auditNoteAr: '٢٧ دقيقة متوسط — مشي بوابة الأفنيوز أخذ ٧ دقائق',
    auditNoteEn: '27m average — Avenues mall exit walk took 7m',
  },
  {
    id: 'dlv-124',
    orderRef: 'VF-88502',
    date: '2026-11-08',
    brandId: 'china-garden',
    branchId: 'ardiya',
    fleetId: 'internal-fleet',
    driverAr: 'سائق الشركة #01',
    driverEn: 'Internal Rider #01',
    pickupTimestamp: '18:30',
    deliveredTimestamp: '18:48',
    transitMinutes: 18.0,
    zoneAr: 'اشبيلية ق٢',
    zoneEn: 'Ishbiliya Block 2',
    distanceKm: 3.2,
    orderKwd: 11.1,
    auditNoteAr: '١٨ دقيقة ممتازة من مطبخ العارضية عبر أسطولنا',
    auditNoteEn: '18m top-tier dispatch from Ardiya via internal fleet',
  },
  {
    id: 'dlv-125',
    orderRef: 'VF-88507',
    date: '2026-11-08',
    brandId: 'farm-brown',
    branchId: '360-mall',
    fleetId: 'deliveroo',
    driverAr: 'سائق ديليفرو #402',
    driverEn: 'Deliveroo Rider #402',
    pickupTimestamp: '11:15',
    deliveredTimestamp: '11:36',
    transitMinutes: 21.0,
    zoneAr: 'الشهداء ق٣',
    zoneEn: 'Shuhada Block 3',
    distanceKm: 3.1,
    orderKwd: 5.75,
    auditNoteAr: '٢١ دقيقة توصيل فطور/مخبوزات طازجة بالعلامة الخضراء',
    auditNoteEn: '21m fresh bakery delivery in green window',
  },
  {
    id: 'dlv-126',
    orderRef: 'VF-88511',
    date: '2026-11-08',
    brandId: 'china-garden',
    branchId: 'assima',
    fleetId: 'keeta',
    driverAr: 'سائق كيتا #3301',
    driverEn: 'Keeta Rider #3301',
    pickupTimestamp: '19:55',
    deliveredTimestamp: '20:16',
    transitMinutes: 21.5,
    zoneAr: 'الدسمة ق٤',
    zoneEn: 'Dasma Block 4',
    distanceKm: 3.4,
    orderKwd: 9.85,
    auditNoteAr: '٢١.٥ دقيقة ضمن الهدف الأخضر (≤ ٢٢ دقيقة)',
    auditNoteEn: '21.5m just inside <=22.0m green SLA target',
  },
  {
    id: 'dlv-127',
    orderRef: 'VF-88516',
    date: '2026-11-08',
    brandId: 'franks',
    branchId: 'al-kout',
    fleetId: 'jahez',
    driverAr: 'سائق جاهز #774',
    driverEn: 'Jahez Rider #774',
    pickupTimestamp: '21:10',
    deliveredTimestamp: '21:46',
    transitMinutes: 36.0,
    zoneAr: 'المهبولة ق١',
    zoneEn: 'Mahboula Block 1',
    distanceKm: 6.9,
    orderKwd: 8.4,
    auditNoteAr: '٣٦ دقيقة أحمر سيء للغاية — مسافة بعيدة وتأخر مصعد البناية',
    auditNoteEn: '36m red delay — long coastal run + residential elevator wait',
  },
  {
    id: 'dlv-128',
    orderRef: 'VF-88520',
    date: '2026-11-08',
    brandId: 'tahina',
    branchId: 'salmiya',
    fleetId: 'internal-fleet',
    driverAr: 'سائق الشركة #03',
    driverEn: 'Internal Rider #03',
    pickupTimestamp: '13:30',
    deliveredTimestamp: '13:49',
    transitMinutes: 19.0,
    zoneAr: 'السالمية — شارع البلاجات',
    zoneEn: 'Salmiya — Gulf Rd',
    distanceKm: 2.3,
    orderKwd: 6.35,
    auditNoteAr: '١٩ دقيقة تسليم سريع ومباشر عبر سائقنا',
    auditNoteEn: '19m crisp direct handoff by internal rider',
  },
] as const

export function computeDeliverySlaSnapshot(
  workspace: GlobalWorkspaceSlice,
  customTrips: readonly RiderTripRecord[] = [],
): DeliverySlaSnapshot {
  const { brand, branch, channel } = workspace.filters
  const combined = [...customTrips, ...SEEDED_RIDER_TRIPS]

  const filtered = combined.filter((t) => {
    if (brand !== 'all' && t.brandId !== brand) return false
    if (branch !== 'all' && t.branchId !== branch) return false
    if (channel !== 'all' && channel !== 'dine-in') {
      const fl = DELIVERY_FLEETS.find((f) => f.id === t.fleetId)
      if (fl && !fl.mappedChannels.includes(channel)) return false
    }
    return true
  })

  const activeTrips = filtered.length > 0 ? filtered : combined

  const enriched: EnrichedRiderTrip[] = activeTrips.map((t) => {
    const g = gradeDeliveryMinutes(t.transitMinutes)
    const fl = DELIVERY_FLEETS.find((f) => f.id === t.fleetId) ?? DELIVERY_FLEETS[0]
    return {
      ...t,
      tier: g.tier,
      tierLabelAr: g.labelAr,
      tierLabelEn: g.labelEn,
      brandAr: getBrandLabel(t.brandId, true),
      brandEn: getBrandLabel(t.brandId, false),
      branchAr: getBranchLabel(t.branchId, true),
      branchEn: getBranchLabel(t.branchId, false),
      fleetAr: fl.ar,
      fleetEn: fl.en,
      coldFoodRisk: t.transitMinutes > DELIVERY_SLA_YELLOW_MAX,
    }
  })

  const totalTrips = enriched.length
  const meanMinutes =
    totalTrips > 0
      ? Number((enriched.reduce((s, r) => s + r.transitMinutes, 0) / totalTrips).toFixed(1))
      : 0
  const overallTier = gradeDeliveryMinutes(meanMinutes).tier

  const greenCount = enriched.filter((r) => r.tier === 'green').length
  const yellowCount = enriched.filter((r) => r.tier === 'yellow').length
  const redCount = enriched.filter((r) => r.tier === 'red').length

  const greenPct = totalTrips > 0 ? Number(((greenCount / totalTrips) * 100).toFixed(1)) : 0
  const yellowPct = totalTrips > 0 ? Number(((yellowCount / totalTrips) * 100).toFixed(1)) : 0
  const redPct = totalTrips > 0 ? Number(((redCount / totalTrips) * 100).toFixed(1)) : 0

  const coldFoodRiskOrders = redCount
  const estimatedClaimableKwd = Math.round(
    enriched
      .filter((r) => r.tier === 'red')
      .reduce((s, r) => s + r.orderKwd * 0.65, 0) * 12,
  )

  const fleetSummaries: FleetSlaSummary[] = DELIVERY_FLEETS.map((fl) => {
    const sub = enriched.filter((r) => r.fleetId === fl.id)
    const cnt = sub.length
    const mean =
      cnt > 0 ? Number((sub.reduce((s, x) => s + x.transitMinutes, 0) / cnt).toFixed(1)) : 0
    const g = sub.filter((x) => x.tier === 'green').length
    const y = sub.filter((x) => x.tier === 'yellow').length
    const r = sub.filter((x) => x.tier === 'red').length
    return {
      fleetId: fl.id,
      ar: fl.ar,
      en: fl.en,
      shortAr: fl.shortAr,
      shortEn: fl.shortEn,
      tripCount: cnt,
      meanMinutes: mean,
      greenPct: cnt > 0 ? Number(((g / cnt) * 100).toFixed(1)) : 0,
      yellowPct: cnt > 0 ? Number(((y / cnt) * 100).toFixed(1)) : 0,
      redPct: cnt > 0 ? Number(((r / cnt) * 100).toFixed(1)) : 0,
      redCount: r,
      tier: cnt > 0 ? gradeDeliveryMinutes(mean).tier : 'green',
    }
  })

  const nonEmptyFleets = fleetSummaries.filter((f) => f.tripCount > 0)
  const bestFleet =
    [...nonEmptyFleets].sort((a, b) => a.meanMinutes - b.meanMinutes)[0] ?? fleetSummaries[0]
  const worstFleet =
    [...nonEmptyFleets].sort((a, b) => b.meanMinutes - a.meanMinutes)[0] ?? fleetSummaries[0]

  // Branch x Fleet Matrix across ALL 7 approved branches (uses combined scoped by Brand so full 7x6 matrix is rich)
  const matrixSource = combined.filter((t) => (brand === 'all' ? true : t.brandId === brand))
  const effectiveMatrixSource = matrixSource.length > 0 ? matrixSource : combined

  const branchFleetMatrix: BranchFleetMatrixRow[] = APPROVED_BRANCH_IDS.map((brId) => {
    const brSub = effectiveMatrixSource.filter((t) => t.branchId === brId)
    const brMean =
      brSub.length > 0
        ? Number((brSub.reduce((s, x) => s + x.transitMinutes, 0) / brSub.length).toFixed(1))
        : 21.0
    const cells = {} as Record<DeliveryFleetId, BranchFleetMatrixCell>
    for (const fl of DELIVERY_FLEETS) {
      const cellSub = brSub.filter((t) => t.fleetId === fl.id)
      const cMean =
        cellSub.length > 0
          ? Number((cellSub.reduce((s, x) => s + x.transitMinutes, 0) / cellSub.length).toFixed(1))
          : null
      cells[fl.id] = {
        fleetId: fl.id,
        meanMinutes: cMean,
        tripCount: cellSub.length,
        tier: cMean !== null ? gradeDeliveryMinutes(cMean).tier : null,
      }
    }
    return {
      branchId: brId,
      branchAr: getBranchLabel(brId, true),
      branchEn: getBranchLabel(brId, false),
      overallMeanMinutes: brMean,
      overallTier: gradeDeliveryMinutes(brMean).tier,
      tripCount: brSub.length,
      cells,
    }
  })

  return {
    trips: enriched,
    totalTrips,
    meanMinutes,
    overallTier,
    greenCount,
    yellowCount,
    redCount,
    greenPct,
    yellowPct,
    redPct,
    coldFoodRiskOrders,
    estimatedClaimableKwd,
    bestFleet,
    worstFleet,
    fleetSummaries,
    branchFleetMatrix,
  }
}

// ============================================================================
// DELIVERABLE 5 — OMNICHANNEL SOCIAL MEDIA & AGGREGATOR REVIEWS COMMAND CENTER
// ============================================================================

export type ReviewChannelId =
  | 'talabat'
  | 'keeta'
  | 'jahez'
  | 'deliveroo'
  | 'cari-snoonu'
  | 'google-maps'
  | 'instagram'
  | 'tiktok'
  | 'x-twitter'

export type ReviewSentiment = 'positive' | 'neutral' | 'negative'

export type ReviewIssueTag =
  | 'excellent-quality'
  | 'delivery-delay'
  | 'food-temperature'
  | 'missing-item'
  | 'dine-in-hospitality'
  | 'portion-value'

export interface ReviewChannelMeta {
  id: ReviewChannelId
  group: 'delivery-app' | 'social-maps'
  ar: string
  en: string
  mappedGlobalChannel?: GlobalChannel
}

export const REVIEW_CHANNELS: readonly ReviewChannelMeta[] = [
  { id: 'talabat', group: 'delivery-app', ar: 'طلبات (Talabat)', en: 'Talabat', mappedGlobalChannel: 'talabat-tgo' },
  { id: 'keeta', group: 'delivery-app', ar: 'كيتا (Keeta)', en: 'Keeta', mappedGlobalChannel: 'keeta' },
  { id: 'jahez', group: 'delivery-app', ar: 'جاهز (Jahez)', en: 'Jahez', mappedGlobalChannel: 'jahez' },
  { id: 'deliveroo', group: 'delivery-app', ar: 'ديليفرو (Deliveroo)', en: 'Deliveroo', mappedGlobalChannel: 'deliveroo' },
  { id: 'cari-snoonu', group: 'delivery-app', ar: 'كاري / سنونو (Cari & Snoonu)', en: 'Cari / Snoonu', mappedGlobalChannel: 'snoonu' },
  { id: 'google-maps', group: 'social-maps', ar: 'خرائط جوجل (Google Maps)', en: 'Google Maps', mappedGlobalChannel: 'dine-in' },
  { id: 'instagram', group: 'social-maps', ar: 'إنستغرام (Instagram)', en: 'Instagram' },
  { id: 'tiktok', group: 'social-maps', ar: 'تيك توك (TikTok)', en: 'TikTok' },
  { id: 'x-twitter', group: 'social-maps', ar: 'منصة إكس (X / Twitter)', en: 'X (Twitter)' },
] as const

export const ISSUE_TAG_LABELS: Record<ReviewIssueTag, { ar: string; en: string }> = {
  'excellent-quality': { ar: 'جودة ممتازة', en: 'Excellent Quality' },
  'delivery-delay': { ar: 'تأخر توصيل', en: 'Delivery Delay' },
  'food-temperature': { ar: 'حرارة الأكل', en: 'Food Temperature' },
  'missing-item': { ar: 'نقص صنف / صوص', en: 'Missing Item / Sauce' },
  'dine-in-hospitality': { ar: 'ضيافة الصالة', en: 'Dine-In Hospitality' },
  'portion-value': { ar: 'حجم الوجبة والسعر', en: 'Portion & Value' },
}

export interface OmnichannelReviewItem {
  id: string
  channelId: ReviewChannelId
  brandId: BrandId
  branchId: BranchId
  customerHandle: string
  timestamp: string
  stars: number
  sentiment: ReviewSentiment
  issueTag: ReviewIssueTag
  commentAr: string
  commentEn: string
  readyReplyAr: string
  readyReplyEn: string
  unreadAlert?: boolean
}

export interface EnrichedReviewItem extends OmnichannelReviewItem {
  channelAr: string
  channelEn: string
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  issueTagAr: string
  issueTagEn: string
  acknowledged: boolean
}

export interface ChannelPillStat {
  channelId: ReviewChannelId
  ar: string
  en: string
  group: 'delivery-app' | 'social-maps'
  totalCount: number
  avgStars: number
  unreadAlertCount: number
  negativeCount: number
}

export interface EntityScorecard {
  id: string
  ar: string
  en: string
  avgStars: number
  totalReviews: number
  positiveCount: number
  neutralCount: number
  negativeCount: number
  topPraiseAr: string
  topPraiseEn: string
  topComplaintAr: string
  topComplaintEn: string
}

export interface SocialReviewsSnapshot {
  reviews: EnrichedReviewItem[]
  totalReviews: number
  avgStars: number
  positiveCount: number
  neutralCount: number
  negativeCount: number
  positivePct: number
  neutralPct: number
  negativePct: number
  unreadAlertsCount: number
  channelPills: ChannelPillStat[]
  brandScorecards: EntityScorecard[]
  branchScorecards: EntityScorecard[]
}

export const SOCIAL_REVIEWS_ACK_STORAGE_KEY = 'vf.ops.socialReviewsAck.v1'
export const SOCIAL_REVIEWS_CUSTOM_STORAGE_KEY = 'vf.ops.socialReviewsCustom.v1'

export const SEEDED_OMNICHANNEL_REVIEWS: readonly OmnichannelReviewItem[] = [
  {
    id: 'sr-201',
    channelId: 'talabat',
    brandId: 'china-garden',
    branchId: 'salmiya',
    customerHandle: '@bader_almutairi',
    timestamp: '2026-11-10 20:42',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'سويت آند ساور دجاج ودايناميت شريمب من فرع السالمية وصلوا نار ومقرمشين خلال ١٩ دقيقة، تغليف يفتح النفس!',
    commentEn: 'Sweet & Sour Chicken and Dynamite Shrimp from Salmiya arrived piping hot and crispy in 19m—top packaging!',
    readyReplyAr: 'أهلاً أ. بدر! يسعدنا جداً أن طلبك من تشاينا جاردن السالمية وصل بحرارته وقرمشته المثالية. صحتين وعافية!',
    readyReplyEn: 'Thank you Bader! Thrilled your China Garden Salmiya order arrived piping hot and crispy.',
  },
  {
    id: 'sr-202',
    channelId: 'talabat',
    brandId: 'china-garden',
    branchId: 'avenues',
    customerHandle: '@noura_ajmi88',
    timestamp: '2026-11-10 20:18',
    stars: 2,
    sentiment: 'negative',
    issueTag: 'delivery-delay',
    commentAr: 'الأكل طعمه ممتاز كالعادة بس سائق طلبات تأخر ٣٩ دقيقة من الأفنيوز للرابية ووصل النودلز فاتر وناقص تشيلي أويل.',
    commentEn: 'Food tastes great as usual, but the Talabat Tgo rider took 39 mins from Avenues to Rabiya—arrived lukewarm & missing chili oil.',
    readyReplyAr: 'نعتذر منك بشدة أخت نورة عن تأخر سائق المنصة ونقص الصوص في فرع الأفنيوز. تم توجيه مشرف التغليف وتفعيل التعويض الفوري لطلبك.',
    readyReplyEn: 'Sincere apologies Noura for the rider delay and missing chili oil at Avenues. Packing QA is alerted and we are issuing an immediate credit.',
    unreadAlert: true,
  },
  {
    id: 'sr-203',
    channelId: 'keeta',
    brandId: 'china-garden',
    branchId: '360-mall',
    customerHandle: '@fahad_khaldi',
    timestamp: '2026-11-10 19:55',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'تشاينا جاردن فرع مول ٣٦٠ على كيتا بطل! الكمية راهية جداً والتوصيل للزهراء أخذ ٢١ دقيقة بالضبط.',
    commentEn: 'China Garden 360 Mall on Keeta is unbeatable—generous portions and 21-minute delivery to Zahra.',
    readyReplyAr: 'شكراً من القلب أ. فهد! الحصة الراهية والوصول السريع عهدنا الدائم لكم في فرع مول ٣٦٠.',
    readyReplyEn: 'Thank you Fahad! Generous portions and fast service are always our promise at 360 Mall.',
  },
  {
    id: 'sr-204',
    channelId: 'jahez',
    brandId: 'noodle-bar',
    branchId: 'salmiya',
    customerHandle: '@abdullah_saleh_kw',
    timestamp: '2026-11-10 20:51',
    stars: 1,
    sentiment: 'negative',
    issueTag: 'food-temperature',
    commentAr: 'طلبت رامن ونودلز من ذا نودل بار السالمية على جاهز لمنطقة بيان، قعد ٣٨ دقيقة بالطريق ووصلت الشوربة باردة!',
    commentEn: 'Ordered ramen from The Noodle Bar Salmiya via Jahez to Bayan—38m transit and broth arrived cold!',
    readyReplyAr: 'حقك علينا أ. عبدالله ونعتذر جداً عن برودة الطلب. اعتمدنا عبوات حرارية مزدوجة للشوربة للمناطق الأبعد من ٥ كم ويسعدنا تعويضك بطلب مجاني.',
    readyReplyEn: 'Our sincere apologies Abdullah. We are rolling out double-insulated broth cups on >5km drops and sending a full replacement.',
    unreadAlert: true,
  },
  {
    id: 'sr-205',
    channelId: 'deliveroo',
    brandId: 'tahina',
    branchId: 'assima',
    customerHandle: '@sara.qabandi',
    timestamp: '2026-11-10 13:44',
    stars: 3,
    sentiment: 'neutral',
    issueTag: 'missing-item',
    commentAr: 'بوكس الشاورما من طحينة العاصمة نظيف وخفيف للدوام، بس وصلت علبة طحينة واحدة بدل ثنتين مع الوجبة المزدوجة.',
    commentEn: 'Tahina Assima lunch box is super clean and fresh, but only 1 tahini sauce cup arrived instead of 2 on our double meal.',
    readyReplyAr: 'شكراً لملاحظتك أخت سارة! تم التنبيه فوراً على خط تغليف طحينة العاصمة بمطابقة عدد الصوصات قبل إغلاق الكيس.',
    readyReplyEn: 'Thanks Sara! Our Assima packing line has been instructed to double-check sauce cup counts before sealing.',
    unreadAlert: true,
  },
  {
    id: 'sr-206',
    channelId: 'cari-snoonu',
    brandId: 'karak-cafeteria',
    branchId: 'assima',
    customerHandle: '@mishari_enezi',
    timestamp: '2026-11-10 17:30',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'دلة الكرك بالزعفران مع جباتي جبن وعسل من كرك كافتيريا العاصمة على سنونو/كاري مضبوطة ١٠٠٪ وما فيها ولا نقطة تسريب.',
    commentEn: 'Saffron Karak flask & cheese-honey chapati from Karak Cafeteria Assima via Cari/Snoonu nailed it with zero leaks.',
    readyReplyAr: 'عوافي أ. مشاري! الكرك المضبوط والتغليف المحكم هو سر تميز كرك كافتيريا.',
    readyReplyEn: 'Enjoy Mishari! Leak-free thermal flasks and fresh chapati are our signature.',
  },
  {
    id: 'sr-207',
    channelId: 'google-maps',
    brandId: 'china-garden',
    branchId: 'promenade',
    customerHandle: 'Dalal Al-Rasheed · Local Guide',
    timestamp: '2026-11-10 16:12',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'dine-in-hospitality',
    commentAr: 'جلسة تشاينا جاردن فرع البروميناد هادئة ونظيفة جداً للعائلات، الموظفين بشوشين والأكل نزل حار بأقل من ١٢ دقيقة.',
    commentEn: 'China Garden Promenade dine-in is spotless and calm for families—warm staff and food served in under 12m.',
    readyReplyAr: 'نورتينا في فرع البروميناد أخت دلال! نسعد دائماً بخدمتك وعائلتك الكريمة.',
    readyReplyEn: 'Thank you Dalal for visiting China Garden Promenade! Always a pleasure hosting your family.',
  },
  {
    id: 'sr-208',
    channelId: 'instagram',
    brandId: 'franks',
    branchId: 'promenade',
    customerHandle: '@kw_burger_club',
    timestamp: '2026-11-10 21:40',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'سماش برجر وهوت دوغ فرانكس بالبروميناد يفوز بأقوى خبز بريوش طري وبطاط كرنكل مقرمش بالكويت 🔥👏',
    commentEn: "Frank's Promenade smash burger & signature dog win best pillowy brioche & crispy crinkle fries in Kuwait!",
    readyReplyAr: 'سعيدين جداً بشهادتكم لـ فرانكس! صحتين وهنا ونورتوا حسابنا.',
    readyReplyEn: "Thrilled you loved the Frank's Promenade experience! Thanks for the shoutout.",
  },
  {
    id: 'sr-209',
    channelId: 'tiktok',
    brandId: 'farm-brown',
    branchId: 'ardiya',
    customerHandle: '@abutalal_foodreviews',
    timestamp: '2026-11-10 11:25',
    stars: 4,
    sentiment: 'positive',
    issueTag: 'portion-value',
    commentAr: 'تجربتي لمخبوزات وساندويتشات فارم براون المحضرة بمطبخ العارضية: طراوة خيالية، بس نبي بوكس فطور دواوين ومكاتب بسعر تجميعي.',
    commentEn: 'Farm Brown Ardiya bakery review: super fresh daily bake—just add a bundled office/diwaniya breakfast box!',
    readyReplyAr: 'شكراً أبو طلال على المراجعة الرائعة! بوكس المكاتب والدواوين من فارم براون قيد الإطلاق هذا الشهر.',
    readyReplyEn: 'Thanks Abu Talal! Our Farm Brown office & gathering sharing box launches this month.',
  },
  {
    id: 'sr-210',
    channelId: 'x-twitter',
    brandId: 'noodle-bar',
    branchId: 'ardiya',
    customerHandle: '@talal_sh_kw',
    timestamp: '2026-11-09 21:52',
    stars: 2,
    sentiment: 'negative',
    issueTag: 'missing-item',
    commentAr: 'طلبت من ذا نودل بار فرع العارضية لصباح الناصر، الطعم حلو بس تأخر ٣٦ دقيقة وما حطيتوا عيدان أكل وملاعق لـ ٣ وجبات!',
    commentEn: 'Ordered The Noodle Bar Ardiya to Sabah Al-Nasser—tasty, but took 36m and missed chopsticks/spoons for 3 meals!',
    readyReplyAr: 'نعتذر جداً أ. طلال عن تأخر السائق ونقص أدوات الأكل. تم إلزام خط التغليف بملصق فحص الأدوات قبل التسليم وتواصلنا معك لتعويضك فوراً.',
    readyReplyEn: 'Sincere apologies Talal. Pre-seal cutlery checklists are now mandatory at Ardiya and we DMed a full voucher.',
    unreadAlert: true,
  },
  {
    id: 'sr-211',
    channelId: 'google-maps',
    brandId: 'china-garden',
    branchId: 'al-kout',
    customerHandle: 'Nasser Al-Dosari',
    timestamp: '2026-11-09 22:15',
    stars: 3,
    sentiment: 'neutral',
    issueTag: 'dine-in-hospitality',
    commentAr: 'فرع الكوت أكله لذيذ جداً بس ليلة الجمعة كان فيه انتظار ٢٠ دقيقة على الطاولات بدون شاشة أو تسجيل مرتب للدور.',
    commentEn: 'Al-Kout food is delicious, but Friday evening had a 20m table wait without an organized host waitlist.',
    readyReplyAr: 'شكراً لملاحظتك المهمة أ. ناصر. تم تخصيص موظف استقبال لتنظيم قائمة الانتظار إلكترونياً في فرع الكوت أيام الويكند.',
    readyReplyEn: 'Thank you Nasser. Al-Kout now has a dedicated weekend host managing digital waitlist seating.',
  },
  {
    id: 'sr-212',
    channelId: 'talabat',
    brandId: 'china-garden',
    branchId: 'al-kout',
    customerHandle: '@mona_fahaheel',
    timestamp: '2026-11-09 21:30',
    stars: 2,
    sentiment: 'negative',
    issueTag: 'delivery-delay',
    commentAr: 'طلبنا للعقيلة من فرع الكوت قعد ٤٢ دقيقة مع سائق طلبات لأن السائق مر المنقف قبلنا! الأكل وصل دافئ بس مو حار.',
    commentEn: 'Al-Kout order to Egaila took 42m via Talabat Tgo because rider detoured through Mangaf first!',
    readyReplyAr: 'نعتذر بشدة أخت منى عن مسار سائق المنصة المزدوج. تم رفع مطالبة رسمية لمنع دمج طلبات العقيلة وتحويل النطاق القريب لسائقينا.',
    readyReplyEn: 'Apologies Mona for the aggregator rider detour. We filed a batching block claim and expanded TMP own-rider coverage.',
    unreadAlert: true,
  },
  {
    id: 'sr-213',
    channelId: 'keeta',
    brandId: 'franks',
    branchId: '360-mall',
    customerHandle: '@yousef_behbehani',
    timestamp: '2026-11-09 20:20',
    stars: 4,
    sentiment: 'positive',
    issueTag: 'portion-value',
    commentAr: 'برجر فرانكس من مول ٣٦٠ خطير والتغليف الحراري حافظ على الجبنة، بس نتمنى كومبو شخصين بسعر أوفر على كيتا.',
    commentEn: "Frank's 360 Mall burger foil wrap kept cheese melted—would love a duo value combo on Keeta.",
    readyReplyAr: 'يسعدنا إعجابك أ. يوسف! باقة الكومبو الثنائي بخصم ١٥٪ أصبحت متاحة على فرانكس.',
    readyReplyEn: "Glad you loved it Yousef! Check out our new 15%-value Duo Combo on Frank's.",
  },
  {
    id: 'sr-214',
    channelId: 'instagram',
    brandId: 'tahina',
    branchId: 'avenues',
    customerHandle: '@laila_healthy_kw',
    timestamp: '2026-11-09 15:05',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'أحلى غداء فريش وخفيف بالأفنيوز مطعم طحينة، السلطات والخبز الحار شي مرتب ونظيف جداً.',
    commentEn: 'Best fresh lunch at The Avenues is Tahina—crisp salads and warm flatbreads every single time.',
    readyReplyAr: 'صحتين وعافية ليلى! التحضير الطازج يومياً هو أساس طحينة.',
    readyReplyEn: 'Enjoy Laila! Fresh daily prep is our #1 standard at Tahina.',
  },
  {
    id: 'sr-215',
    channelId: 'tiktok',
    brandId: 'china-garden',
    branchId: 'assima',
    customerHandle: '@kuwait_lunch_spots',
    timestamp: '2026-11-09 14:10',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'منغوليان بيف وتشيكن ترياكي من تشاينا جاردن العاصمة مول أقوى بريك غداء لموظفين الديرة!',
    commentEn: 'Mongolian Beef & Chicken Teriyaki at China Garden Assima Mall is the ultimate downtown lunch break!',
    readyReplyAr: 'حياكم الله دائماً في فرع العاصمة مول! نسعد بخدمتكم بسرعة وجودة عالية.',
    readyReplyEn: 'Always welcome at Assima Mall! Proud to power downtown Kuwait lunches.',
  },
  {
    id: 'sr-216',
    channelId: 'jahez',
    brandId: 'franks',
    branchId: 'al-kout',
    customerHandle: '@salem_mahboula',
    timestamp: '2026-11-08 21:50',
    stars: 2,
    sentiment: 'negative',
    issueTag: 'food-temperature',
    commentAr: 'طلبت فرانكس للمهبولة على جاهز وأخذ ٣٦ دقيقة بالطريق، البطاط فقد قرمشته بسبب البخار داخل العلبة.',
    commentEn: "Ordered Frank's to Mahboula via Jahez—36m transit steamed the fries soft.",
    readyReplyAr: 'نعتذر منك أ. سالم! اعتمدنا علب بطاط بفتحات تهوية خاصة للمسافات الطويلة ويسعدنا تعويضك في طلبك القادم.',
    readyReplyEn: 'Apologies Salem! Vented crisp-fry cartons are now enforced on coastal drops and we sent a credit.',
    unreadAlert: true,
  },
  {
    id: 'sr-217',
    channelId: 'deliveroo',
    brandId: 'farm-brown',
    branchId: '360-mall',
    customerHandle: '@dana_shuhada',
    timestamp: '2026-11-08 11:42',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'كرواسون الزعتر وقهوة فارم براون من مول ٣٦٠ وصلت للشهداء حارة بـ ٢١ دقيقة، بداية يوم مثالية.',
    commentEn: 'Zaatar croissant & coffee from Farm Brown 360 Mall arrived warm to Shuhada in 21m—perfect morning!',
    readyReplyAr: 'صباحك سعيد أخت دانة! شكراً لاختيارك فارم براون.',
    readyReplyEn: 'Have a wonderful day Dana! Thank you for choosing Farm Brown.',
  },
  {
    id: 'sr-218',
    channelId: 'x-twitter',
    brandId: 'china-garden',
    branchId: 'salmiya',
    customerHandle: '@hamad_salwa',
    timestamp: '2026-11-08 21:15',
    stars: 3,
    sentiment: 'neutral',
    issueTag: 'delivery-delay',
    commentAr: 'تشاينا جاردن السالمية لا يعلى على أكله، بس يوم السبت بالليل التوصيل لسلوى عبر طلبات أخذ ٣٧ دقيقة.',
    commentEn: 'China Garden Salmiya food is unbeatable, though Saturday night Tgo delivery to Salwa took 37m.',
    readyReplyAr: 'شكراً لذوقك أ. حمد! قمنا بدعم شفت مساء السبت بسائق إضافي من أسطولنا المباشر لتسريع توصيل سلوى والرميثية.',
    readyReplyEn: 'Thank you Hamad! We added an extra Saturday evening internal rider to speed up Salwa & Rumaithiya drops.',
  },
  {
    id: 'sr-219',
    channelId: 'cari-snoonu',
    brandId: 'tahina',
    branchId: 'promenade',
    customerHandle: '@reem_hawally',
    timestamp: '2026-11-08 15:35',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'excellent-quality',
    commentAr: 'فلافل محشية وحمص بيروتي من طحينة البروميناد عبر كاري طعم أصيل ونظافة توب.',
    commentEn: 'Stuffed falafel & Beiruti hummus from Tahina Promenade on Cari—authentic flavor and spotless hygiene.',
    readyReplyAr: 'صحتين وهنا أخت ريم! نسعد دائماً بثقتك في مطعم طحينة.',
    readyReplyEn: 'Enjoy Reem! Thrilled you loved Tahina Promenade.',
  },
  {
    id: 'sr-220',
    channelId: 'google-maps',
    brandId: 'karak-cafeteria',
    branchId: 'al-kout',
    customerHandle: 'Faisal Al-Subaie',
    timestamp: '2026-11-08 18:10',
    stars: 5,
    sentiment: 'positive',
    issueTag: 'dine-in-hospitality',
    commentAr: 'أحلى كرك وجباتي نوتيلا في الكوت بعد التمشي على البحر، الخدمة سريعة جداً.',
    commentEn: 'Best Karak & Nutella chapati at Al-Kout waterfront—super fast counter service.',
    readyReplyAr: 'يا هلا فيك أ. فيصل في كرك كافتيريا الكوت! تشرفنا دائماً.',
    readyReplyEn: 'Welcome anytime Faisal at Karak Cafeteria Al-Kout!',
  },
] as const

const BRAND_PRAISE_AND_ROOT_CAUSE: Record<
  BrandId,
  { praiseAr: string; praiseEn: string; complaintAr: string; complaintEn: string }
> = {
  'china-garden': {
    praiseAr: 'ثبات النكهة، الحصص الراهية، ووصول الأصناف ساخنة مع أسطولنا',
    praiseEn: 'Consistent flavor, generous portions & hot TMP delivery',
    complaintAr: 'تأخر سائقي Tgo بدمج الطلبات من الأفنيوز والكوت مساءً',
    complaintEn: 'Evening Tgo multi-order batching delays from Avenues & Al-Kout',
  },
  franks: {
    praiseAr: 'طراوة خبز البريوش وقرمشة البطاط في الطلبات القريبة',
    praiseEn: 'Soft brioche buns & crispy crinkle fries on nearby drops',
    complaintAr: 'تأثر قرمشة البطاط بالبخار عند تجاوز التوصيل ٣٢ دقيقة',
    complaintEn: 'Fries steam-softening when coastal delivery exceeds 32m',
  },
  tahina: {
    praiseAr: 'مكونات طازجة يومياً وتغليف مثالي لبوكسات غداء المكاتب',
    praiseEn: 'Fresh daily ingredients & clean office lunch boxes',
    complaintAr: 'نقص عبوة صوص طحينة إضافية في بعض الطلبات المزدوجة',
    complaintEn: 'Occasional missing extra tahini cup on double meal boxes',
  },
  'farm-brown': {
    praiseAr: 'مخبوزات طازجة يومياً من مطبخ العارضية وجودة القهوة الصباحية',
    praiseEn: 'Fresh daily Ardiya bake & morning coffee pairing',
    complaintAr: 'طلب العملاء توفير بوكسات تجميعية للمكاتب والدواوين',
    complaintEn: 'Customer demand for bundled office/gathering sharing boxes',
  },
  'noodle-bar': {
    praiseAr: 'عمق نكهة المرق والرامن وتوازن التوابل الآسيوية',
    praiseEn: 'Rich ramen broth depth & authentic spice balance',
    complaintAr: 'برودة الشوربة ونقص عيدان الأكل في المسافات فوق ٥ كم',
    complaintEn: 'Broth cooling & missing chopsticks on >5km aggregator drops',
  },
  'karak-cafeteria': {
    praiseAr: 'وزنية الزعفران والهيل ودلال الكرك المحكمة بدون انسكاب',
    praiseEn: 'Balanced saffron-cardamom Karak & zero-spill thermal flasks',
    complaintAr: 'زحمة استلام الكاونتر بين ٥:٠٠ و ٦:٣٠ مساءً بالويكند',
    complaintEn: 'Weekend 5:00–6:30 PM counter pickup queue',
  },
}

const BRANCH_PRAISE_AND_ROOT_CAUSE: Record<
  BranchId,
  { praiseAr: string; praiseEn: string; complaintAr: string; complaintEn: string }
> = {
  avenues: {
    praiseAr: 'جودة تحضير المطبخ وسرعة خدمة الصالة والطلبات المباشرة',
    praiseEn: 'Kitchen prep consistency & fast dine-in/direct service',
    complaintAr: 'مشي السائق من المول + دمج طلبات Tgo للرابية والفروانية',
    complaintEn: 'Mall exit walk + Tgo order batching to Rabiya',
  },
  '360-mall': {
    praiseAr: 'سرعة توصيل ممتازة لجنوب السرة (الزهراء والسلام وحطين)',
    praiseEn: 'Fast delivery across South Surra neighborhoods',
    complaintAr: 'زمن خروج سائقي التطبيقات من مواقف المول المسائية',
    complaintEn: 'Evening mall parking exit time for aggregator riders',
  },
  assima: {
    praiseAr: 'الخيار الأول لغداء موظفي شرق والديرة وتغليف الكرك المحكم',
    praiseEn: 'Top downtown office lunch hub & leak-free packaging',
    complaintAr: 'انتظار مصاعد الأبراج ومطابقة الصوصات وقت ذروة الغداء',
    complaintEn: 'Office tower elevator waits & peak-lunch sauce checks',
  },
  promenade: {
    praiseAr: 'أعلى تقييم صالة عائلي وأسرع توصيل (١٦–١٩ دقيقة عبر أسطولنا)',
    praiseEn: 'Highest family dine-in rating & fastest 16–19m own-fleet SLA',
    complaintAr: 'كثافة إشارات شارع القاهرة في ذروة المساء فقط',
    complaintEn: 'Cairo St signal congestion during peak dinner hour',
  },
  salmiya: {
    praiseAr: 'انطلاق صاروخي داخل السالمية وحولي عبر سائقي TMP',
    praiseEn: 'Rapid Salmiya/Hawally drops via TMP own riders',
    complaintAr: 'تأخر طلبات بيان وسلوى البعيدة عبر جاهز و Tgo فوق ٣٥ دقيقة',
    complaintEn: '>35m delays on distant Bayan/Salwa aggregator drops',
  },
  'al-kout': {
    praiseAr: 'خدمة واجهة بحرية ممتازة وتوصيل سريع للفحيحيل وأبو حليفة',
    praiseEn: 'Great waterfront hospitality & fast Fahaheel drops',
    complaintAr: 'انتظار طاولات الويكند ودمج طلبات العقيلة والمنقف',
    complaintEn: 'Weekend table waitlist & Egaila/Mangaf Tgo batching',
  },
  ardiya: {
    praiseAr: 'طزاجة الإنتاج اليومي وانطلاق التوصيل بدون عوائق مولات',
    praiseEn: 'Daily central kitchen freshness & zero-mall-walk dispatch',
    complaintAr: 'التدقيق على أدوات الأكل لطلبات صباح الناصر والفردوس',
    complaintEn: 'Cutlery checklist verification on Sabah Al-Nasser drops',
  },
}

export function computeSocialReviewsSnapshot(
  workspace: GlobalWorkspaceSlice,
  acknowledgedIds: ReadonlySet<string>,
  customReviews: readonly OmnichannelReviewItem[] = [],
): SocialReviewsSnapshot {
  const { brand, branch, channel } = workspace.filters
  const combined = [...customReviews, ...SEEDED_OMNICHANNEL_REVIEWS]

  const filtered = combined.filter((r) => {
    if (brand !== 'all' && r.brandId !== brand) return false
    if (branch !== 'all' && r.branchId !== branch) return false
    if (channel !== 'all') {
      const chMeta = REVIEW_CHANNELS.find((c) => c.id === r.channelId)
      if (channel === 'talabat-tmp' || channel === 'talabat-tgo') {
        if (r.channelId !== 'talabat') return false
      } else if (chMeta?.mappedGlobalChannel && chMeta.mappedGlobalChannel !== channel) {
        return false
      }
    }
    return true
  })

  const active = filtered.length > 0 ? filtered : combined

  const enriched: EnrichedReviewItem[] = active.map((r) => {
    const chMeta = REVIEW_CHANNELS.find((c) => c.id === r.channelId) ?? REVIEW_CHANNELS[0]
    const tagMeta = ISSUE_TAG_LABELS[r.issueTag] ?? ISSUE_TAG_LABELS['excellent-quality']
    return {
      ...r,
      channelAr: chMeta.ar,
      channelEn: chMeta.en,
      brandAr: getBrandLabel(r.brandId, true),
      brandEn: getBrandLabel(r.brandId, false),
      branchAr: getBranchLabel(r.branchId, true),
      branchEn: getBranchLabel(r.branchId, false),
      issueTagAr: tagMeta.ar,
      issueTagEn: tagMeta.en,
      acknowledged: acknowledgedIds.has(r.id),
    }
  })

  const totalReviews = enriched.length
  const avgStars =
    totalReviews > 0
      ? Number((enriched.reduce((s, r) => s + r.stars, 0) / totalReviews).toFixed(2))
      : 0

  const positiveCount = enriched.filter((r) => r.sentiment === 'positive').length
  const neutralCount = enriched.filter((r) => r.sentiment === 'neutral').length
  const negativeCount = enriched.filter((r) => r.sentiment === 'negative').length

  const positivePct = totalReviews > 0 ? Number(((positiveCount / totalReviews) * 100).toFixed(1)) : 0
  const neutralPct = totalReviews > 0 ? Number(((neutralCount / totalReviews) * 100).toFixed(1)) : 0
  const negativePct = totalReviews > 0 ? Number(((negativeCount / totalReviews) * 100).toFixed(1)) : 0

  const unreadAlertsCount = enriched.filter(
    (r) => (r.unreadAlert || r.sentiment === 'negative') && !r.acknowledged,
  ).length

  // Channel pills scoped by Brand & Branch so all 9 channel pills display accurate counts
  const channelBase = combined.filter((r) => {
    if (brand !== 'all' && r.brandId !== brand) return false
    if (branch !== 'all' && r.branchId !== branch) return false
    return true
  })
  const effectiveChannelBase = channelBase.length > 0 ? channelBase : combined

  const channelPills: ChannelPillStat[] = REVIEW_CHANNELS.map((ch) => {
    const sub = effectiveChannelBase.filter((r) => r.channelId === ch.id)
    const cnt = sub.length
    const avg = cnt > 0 ? Number((sub.reduce((s, x) => s + x.stars, 0) / cnt).toFixed(2)) : 4.6
    const neg = sub.filter((x) => x.sentiment === 'negative').length
    const unread = sub.filter(
      (x) => (x.unreadAlert || x.sentiment === 'negative') && !acknowledgedIds.has(x.id),
    ).length
    return {
      channelId: ch.id,
      ar: ch.ar,
      en: ch.en,
      group: ch.group,
      totalCount: cnt,
      avgStars: avg,
      unreadAlertCount: unread,
      negativeCount: neg,
    }
  })

  const brandScorecards: EntityScorecard[] = APPROVED_BRAND_IDS.map((bId) => {
    const sub = combined.filter((r) => r.brandId === bId && (branch === 'all' || r.branchId === branch))
    const list = sub.length > 0 ? sub : combined.filter((r) => r.brandId === bId)
    const cnt = list.length
    const avg = cnt > 0 ? Number((list.reduce((s, x) => s + x.stars, 0) / cnt).toFixed(2)) : 4.5
    const meta = BRAND_PRAISE_AND_ROOT_CAUSE[bId]
    return {
      id: bId,
      ar: getBrandLabel(bId, true),
      en: getBrandLabel(bId, false),
      avgStars: avg,
      totalReviews: cnt,
      positiveCount: list.filter((x) => x.sentiment === 'positive').length,
      neutralCount: list.filter((x) => x.sentiment === 'neutral').length,
      negativeCount: list.filter((x) => x.sentiment === 'negative').length,
      topPraiseAr: meta.praiseAr,
      topPraiseEn: meta.praiseEn,
      topComplaintAr: meta.complaintAr,
      topComplaintEn: meta.complaintEn,
    }
  })

  const branchScorecards: EntityScorecard[] = APPROVED_BRANCH_IDS.map((brId) => {
    const sub = combined.filter((r) => r.branchId === brId && (brand === 'all' || r.brandId === brand))
    const list = sub.length > 0 ? sub : combined.filter((r) => r.branchId === brId)
    const cnt = list.length
    const avg = cnt > 0 ? Number((list.reduce((s, x) => s + x.stars, 0) / cnt).toFixed(2)) : 4.5
    const meta = BRANCH_PRAISE_AND_ROOT_CAUSE[brId]
    return {
      id: brId,
      ar: getBranchLabel(brId, true),
      en: getBranchLabel(brId, false),
      avgStars: avg,
      totalReviews: cnt,
      positiveCount: list.filter((x) => x.sentiment === 'positive').length,
      neutralCount: list.filter((x) => x.sentiment === 'neutral').length,
      negativeCount: list.filter((x) => x.sentiment === 'negative').length,
      topPraiseAr: meta.praiseAr,
      topPraiseEn: meta.praiseEn,
      topComplaintAr: meta.complaintAr,
      topComplaintEn: meta.complaintEn,
    }
  })

  return {
    reviews: enriched,
    totalReviews,
    avgStars,
    positiveCount,
    neutralCount,
    negativeCount,
    positivePct,
    neutralPct,
    negativePct,
    unreadAlertsCount,
    channelPills,
    brandScorecards,
    branchScorecards,
  }
}

// ============================================================================
// DELIVERABLE 6 — LIKE-FOR-LIKE WEEKDAY SALES & INTRADAY HOURLY COMPARISON
// ============================================================================

export type WeekdayDow = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface WeekdayOptionMeta {
  dow: WeekdayDow
  ar: string
  en: string
  shortAr: string
  shortEn: string
  isWeekend: boolean
}

/** Ordered Saturday -> Friday matching Kuwait executive weekly review convention */
export const WEEKDAY_SELECTOR_OPTIONS: readonly WeekdayOptionMeta[] = [
  { dow: 6, ar: 'السبت', en: 'Saturday', shortAr: 'سبت', shortEn: 'Sat', isWeekend: true },
  { dow: 0, ar: 'الأحد', en: 'Sunday', shortAr: 'أحد', shortEn: 'Sun', isWeekend: false },
  { dow: 1, ar: 'الاثنين', en: 'Monday', shortAr: 'اثنين', shortEn: 'Mon', isWeekend: false },
  { dow: 2, ar: 'الثلاثاء', en: 'Tuesday', shortAr: 'ثلاثاء', shortEn: 'Tue', isWeekend: false },
  { dow: 3, ar: 'الأربعاء', en: 'Wednesday', shortAr: 'أربعاء', shortEn: 'Wed', isWeekend: false },
  { dow: 4, ar: 'الخميس', en: 'Thursday', shortAr: 'خميس', shortEn: 'Thu', isWeekend: true },
  { dow: 5, ar: 'الجمعة', en: 'Friday', shortAr: 'جمعة', shortEn: 'Fri', isWeekend: true },
] as const

export interface IntradayHourPoint {
  hour: number
  label: string
  thisWeekKwd: number
  lastWeekKwd: number
  thisWeekOrders: number
  lastWeekOrders: number
}

export interface LikeForLikeWeekdayRow {
  dow: WeekdayDow
  weekdayAr: string
  weekdayEn: string
  isWeekend: boolean
  thisDate: string
  lastDate: string

  thisGrossKwd: number
  lastGrossKwd: number
  thisNetSalesKwd: number
  lastNetSalesKwd: number

  /** Integer-reconciled Net Sales KWD guaranteeing 0 KWD gap across rows & 7-day footer */
  thisDisplayKwd: number
  lastDisplayKwd: number
  varianceDisplayKwd: number
  variancePct: number

  fourWeekAvgDisplayKwd: number
  vsFourWeekPct: number

  thisOrders: number
  lastOrders: number
  ordersVariance: number

  thisAvgBasketKwd: number
  lastAvgBasketKwd: number

  thisPocketProfitKwd: number
  lastPocketProfitKwd: number
  pocketVarianceKwd: number

  driverTagAr: string
  driverTagEn: string
  tier: TrafficLightTier
  hourlyCurve: IntradayHourPoint[]
}

export interface WeekdayComparisonData {
  thisWeekLabelAr: string
  lastWeekLabelAr: string
  thisWeekLabelEn: string
  lastWeekLabelEn: string
  rows: LikeForLikeWeekdayRow[]

  totalThisGrossKwd: number
  totalLastGrossKwd: number
  totalThisDisplayKwd: number
  totalLastDisplayKwd: number
  totalVarianceDisplayKwd: number
  totalVariancePct: number
  totalFourWeekAvgDisplayKwd: number

  totalThisOrders: number
  totalLastOrders: number
  totalThisAvgBasketKwd: number
  totalLastAvgBasketKwd: number
  totalThisPocketKwd: number
  totalLastPocketKwd: number
  totalPocketVarianceKwd: number

  strongestDay: LikeForLikeWeekdayRow
  weakestDay: LikeForLikeWeekdayRow
}

function parseDateUtc(ymd: string): { dow: WeekdayDow; dayOfMonth: number } {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1))
  return {
    dow: dt.getUTCDay() as WeekdayDow,
    dayOfMonth: d || 1,
  }
}

function reconcileInts(exact: number[]): number[] {
  if (exact.length === 0) return []
  const target = Math.round(exact.reduce((a, b) => a + b, 0))
  const floors = exact.map((v) => Math.floor(v))
  let rem = target - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac)
  const out = [...floors]
  for (let k = 0; k < order.length && rem > 0; k++) {
    out[order[k].i] += 1
    rem -= 1
  }
  return out
}

function buildDriverTag(
  meta: WeekdayOptionMeta,
  thisDayOfMonth: number,
  lastDayOfMonth: number,
  variancePct: number,
): { ar: string; en: string } {
  const lastPayday = lastDayOfMonth >= 24 && lastDayOfMonth <= 31
  const thisPayday = thisDayOfMonth >= 24 && thisDayOfMonth <= 31
  if (lastPayday && !thisPayday && variancePct < -5) {
    return {
      ar: '💰 الأسبوع الماضي ذروة رواتب (٢٨–٣١ أكت)',
      en: '💰 Prior Week Payday Surge (Oct 28–31)',
    }
  }
  if (meta.isWeekend && variancePct >= -6) {
    return {
      ar: '🔥 زوارة الويكند وطلبات العائلات',
      en: '🔥 Weekend Family Gatherings',
    }
  }
  if (variancePct >= 1.5) {
    return {
      ar: '📈 نمو طلبات الصالة وعروض الكومبو',
      en: '📈 Dine-In & Combo Bundle Lift',
    }
  }
  if (variancePct <= -10) {
    return {
      ar: '⚡ هدوء منتصف الأسبوع — فرصة عرض ٣–٦ م',
      en: '⚡ Mid-Week Lull — 3–6 PM Promo Opportunity',
    }
  }
  return {
    ar: '☀️ إيقاع تشغيلي مستقر',
    en: '☀️ Steady Baseline Cadence',
  }
}

function buildHourlyCurveForDow(
  dow: WeekdayDow,
  thisNetKwd: number,
  lastNetKwd: number,
  thisOrders: number,
  lastOrders: number,
): IntradayHourPoint[] {
  const rawMatrix = ODOO.timeProfile?.weekHour as unknown as
    | readonly (readonly (readonly [number, number])[])[]
    | undefined
  const dayProfile = rawMatrix?.[dow]
  // Operating focus hours 11:00 -> 23:00 + 00:00 late night (14 active service capsules)
  const displayHours = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0]

  const weights = displayHours.map((h) => {
    const tup = dayProfile?.[h]
    const kwd = tup ? Number(tup[1]) : 0
    return Math.max(12, kwd)
  })
  const sumW = weights.reduce((a, b) => a + b, 0) || 1

  // Slight realistic lunch vs dinner tilt between current week & payday prior week while preserving exact sum
  const lastRawWeights = displayHours.map((h, idx) => {
    const tilt = h >= 19 || h === 0 ? 1.04 : h >= 12 && h <= 15 ? 0.96 : 1.0
    return weights[idx] * tilt
  })
  const sumLastW = lastRawWeights.reduce((a, b) => a + b, 0) || 1

  return displayHours.map((h, idx) => {
    const shareThis = weights[idx] / sumW
    const shareLast = lastRawWeights[idx] / sumLastW
    const lbl =
      h === 0
        ? '12 AM'
        : h < 12
          ? `${h} AM`
          : h === 12
            ? '12 PM'
            : `${h - 12} PM`
    return {
      hour: h,
      label: lbl,
      thisWeekKwd: Number((thisNetKwd * shareThis).toFixed(1)),
      lastWeekKwd: Number((lastNetKwd * shareLast).toFixed(1)),
      thisWeekOrders: Math.max(1, Math.round(thisOrders * shareThis)),
      lastWeekOrders: Math.max(1, Math.round(lastOrders * shareLast)),
    }
  })
}

export function computeWeekdayComparisonData(
  workspace: GlobalWorkspaceSlice,
): WeekdayComparisonData {
  const rawDaily: readonly {
    readonly day: string
    readonly orders: number
    readonly netKwd: number
  }[] = ODOO.timeProfile?.daily ?? []

  // Exclude trailing incomplete early-morning sync day (<100 orders across 7 branches)
  const completed = rawDaily
    .filter((d) => d.orders >= 100)
    .map((d) => {
      const p = parseDateUtc(d.day)
      return { ...d, dow: p.dow, dayOfMonth: p.dayOfMonth }
    })

  const last28 = completed.slice(-28)
  const prevWeek = last28.slice(14, 21) // 2026-10-28 .. 2026-11-03
  const currWeek = last28.slice(21, 28) // 2026-11-04 .. 2026-11-10

  const dimScale =
    Number.isFinite(workspace.dimensionShare) && workspace.dimensionShare > 0
      ? workspace.dimensionShare
      : 1
  const pocketMarginRatio = Math.max(0.03, (workspace.weightedNetPct || 14.7) / 100)
  // Gross sales before ~4.2% average POS promo/discount allowance
  const grossFactor = 1.042

  const drafts = WEEKDAY_SELECTOR_OPTIONS.map((meta) => {
    const cPt = currWeek.find((x) => x.dow === meta.dow) ?? currWeek[0]
    const pPt = prevWeek.find((x) => x.dow === meta.dow) ?? prevWeek[0]
    const fourPts = last28.filter((x) => x.dow === meta.dow)

    const thisNetSalesKwd = (cPt?.netKwd ?? 0) * dimScale
    const lastNetSalesKwd = (pPt?.netKwd ?? 0) * dimScale
    const fourWeekAvgKwd =
      fourPts.length > 0
        ? (fourPts.reduce((s, x) => s + x.netKwd, 0) / fourPts.length) * dimScale
        : lastNetSalesKwd

    const thisOrders = Math.max(1, Math.round((cPt?.orders ?? 0) * dimScale))
    const lastOrders = Math.max(1, Math.round((pPt?.orders ?? 0) * dimScale))

    return {
      meta,
      cPt,
      pPt,
      thisNetSalesKwd,
      lastNetSalesKwd,
      fourWeekAvgKwd,
      thisOrders,
      lastOrders,
    }
  })

  const thisInts = reconcileInts(drafts.map((d) => d.thisNetSalesKwd))
  const lastInts = reconcileInts(drafts.map((d) => d.lastNetSalesKwd))
  const fourInts = reconcileInts(drafts.map((d) => d.fourWeekAvgKwd))

  const rows: LikeForLikeWeekdayRow[] = drafts.map((d, i) => {
    const thisDisplayKwd = thisInts[i]
    const lastDisplayKwd = lastInts[i]
    const varianceDisplayKwd = thisDisplayKwd - lastDisplayKwd
    const fourWeekAvgDisplayKwd = fourInts[i]

    const variancePct =
      d.lastNetSalesKwd > 0
        ? Number((((d.thisNetSalesKwd - d.lastNetSalesKwd) / d.lastNetSalesKwd) * 100).toFixed(1))
        : 0

    const vsFourWeekPct =
      d.fourWeekAvgKwd > 0
        ? Number((((d.thisNetSalesKwd - d.fourWeekAvgKwd) / d.fourWeekAvgKwd) * 100).toFixed(1))
        : 0

    const thisGrossKwd = Math.round(thisDisplayKwd * grossFactor)
    const lastGrossKwd = Math.round(lastDisplayKwd * grossFactor)

    const thisAvgBasketKwd =
      d.thisOrders > 0 ? Number((d.thisNetSalesKwd / d.thisOrders).toFixed(2)) : 0
    const lastAvgBasketKwd =
      d.lastOrders > 0 ? Number((d.lastNetSalesKwd / d.lastOrders).toFixed(2)) : 0

    const thisPocketProfitKwd = Math.round(thisDisplayKwd * pocketMarginRatio)
    const lastPocketProfitKwd = Math.round(lastDisplayKwd * pocketMarginRatio)
    const pocketVarianceKwd = thisPocketProfitKwd - lastPocketProfitKwd

    const tier: TrafficLightTier =
      variancePct >= 1.5 ? 'green' : variancePct >= -9.0 ? 'yellow' : 'red'

    const tag = buildDriverTag(
      d.meta,
      d.cPt?.dayOfMonth ?? 5,
      d.pPt?.dayOfMonth ?? 29,
      variancePct,
    )

    const hourlyCurve = buildHourlyCurveForDow(
      d.meta.dow,
      d.thisNetSalesKwd,
      d.lastNetSalesKwd,
      d.thisOrders,
      d.lastOrders,
    )

    return {
      dow: d.meta.dow,
      weekdayAr: d.meta.ar,
      weekdayEn: d.meta.en,
      isWeekend: d.meta.isWeekend,
      thisDate: d.cPt?.day ?? '2026-11-04',
      lastDate: d.pPt?.day ?? '2026-10-28',
      thisGrossKwd,
      lastGrossKwd,
      thisNetSalesKwd: Number(d.thisNetSalesKwd.toFixed(3)),
      lastNetSalesKwd: Number(d.lastNetSalesKwd.toFixed(3)),
      thisDisplayKwd,
      lastDisplayKwd,
      varianceDisplayKwd,
      variancePct,
      fourWeekAvgDisplayKwd,
      vsFourWeekPct,
      thisOrders: d.thisOrders,
      lastOrders: d.lastOrders,
      ordersVariance: d.thisOrders - d.lastOrders,
      thisAvgBasketKwd,
      lastAvgBasketKwd,
      thisPocketProfitKwd,
      lastPocketProfitKwd,
      pocketVarianceKwd,
      driverTagAr: tag.ar,
      driverTagEn: tag.en,
      tier,
      hourlyCurve,
    }
  })

  const totalThisGrossKwd = rows.reduce((s, r) => s + r.thisGrossKwd, 0)
  const totalLastGrossKwd = rows.reduce((s, r) => s + r.lastGrossKwd, 0)
  const totalThisDisplayKwd = rows.reduce((s, r) => s + r.thisDisplayKwd, 0)
  const totalLastDisplayKwd = rows.reduce((s, r) => s + r.lastDisplayKwd, 0)
  const totalVarianceDisplayKwd = totalThisDisplayKwd - totalLastDisplayKwd

  const exactThisSum = rows.reduce((s, r) => s + r.thisNetSalesKwd, 0)
  const exactLastSum = rows.reduce((s, r) => s + r.lastNetSalesKwd, 0)
  const totalVariancePct =
    exactLastSum > 0
      ? Number((((exactThisSum - exactLastSum) / exactLastSum) * 100).toFixed(1))
      : 0

  const totalFourWeekAvgDisplayKwd = rows.reduce((s, r) => s + r.fourWeekAvgDisplayKwd, 0)
  const totalThisOrders = rows.reduce((s, r) => s + r.thisOrders, 0)
  const totalLastOrders = rows.reduce((s, r) => s + r.lastOrders, 0)

  const totalThisAvgBasketKwd =
    totalThisOrders > 0 ? Number((exactThisSum / totalThisOrders).toFixed(2)) : 0
  const totalLastAvgBasketKwd =
    totalLastOrders > 0 ? Number((exactLastSum / totalLastOrders).toFixed(2)) : 0

  const totalThisPocketKwd = rows.reduce((s, r) => s + r.thisPocketProfitKwd, 0)
  const totalLastPocketKwd = rows.reduce((s, r) => s + r.lastPocketProfitKwd, 0)
  const totalPocketVarianceKwd = totalThisPocketKwd - totalLastPocketKwd

  const strongestDay = [...rows].sort((a, b) => b.variancePct - a.variancePct)[0] ?? rows[0]
  const weakestDay = [...rows].sort((a, b) => a.variancePct - b.variancePct)[0] ?? rows[0]

  return {
    thisWeekLabelAr: '٤ نوفمبر – ١٠ نوفمبر ٢٠٢٦',
    lastWeekLabelAr: '٢٨ أكتوبر – ٣ نوفمبر ٢٠٢٦',
    thisWeekLabelEn: 'Nov 4 – Nov 10, 2026',
    lastWeekLabelEn: 'Oct 28 – Nov 3, 2026',
    rows,
    totalThisGrossKwd,
    totalLastGrossKwd,
    totalThisDisplayKwd,
    totalLastDisplayKwd,
    totalVarianceDisplayKwd,
    totalVariancePct,
    totalFourWeekAvgDisplayKwd,
    totalThisOrders,
    totalLastOrders,
    totalThisAvgBasketKwd,
    totalLastAvgBasketKwd,
    totalThisPocketKwd,
    totalLastPocketKwd,
    totalPocketVarianceKwd,
    strongestDay,
    weakestDay,
  }
}
