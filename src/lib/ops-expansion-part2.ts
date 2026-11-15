/**
 * Operations Expansion — Part 2 Engine (`src/lib/ops-expansion-part2.ts`)
 *
 * Unlinked telemetry stubs for `/erp/delivery-sla` and `/erp/social-reviews`.
 * All static trip records, synthetic reviews, pseudo-random generators, and
 * legacy location strings have been permanently purged.
 */

import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type {
  GlobalBranch,
  GlobalBrand,
  GlobalChannel,
  GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'

export type BrandId = Exclude<GlobalBrand, 'all'>
export type BranchId = Exclude<GlobalBranch, 'all'>

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
export const DELIVERY_CUSTOM_TRIPS_STORAGE_KEY = 'aether_delivery_custom_trips_v2'

export function gradeDeliveryMinutes(minutes: number): {
  tier: TrafficLightTier
  labelAr: string
  labelEn: string
} {
  if (minutes <= DELIVERY_SLA_GREEN_MAX) {
    return { tier: 'green', labelAr: 'أخضر — جيد', labelEn: 'Green — Good' }
  }
  if (minutes <= DELIVERY_SLA_YELLOW_MAX) {
    return { tier: 'yellow', labelAr: 'أصفر — متوسط', labelEn: 'Yellow — Average' }
  }
  return { tier: 'red', labelAr: 'أحمر — متأخر', labelEn: 'Red — Delayed' }
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

export interface DeliverySlaSnapshot {
  unlinkedSource: boolean
  messageAr: string
  trips: EnrichedRiderTrip[]
  totalTrips: number
  meanMinutes: number
  greenPct: number
  yellowPct: number
  redPct: number
  redCount: number
}

export function computeDeliverySlaSnapshot(
  _workspace?: GlobalWorkspaceSlice,
  _customTrips: readonly RiderTripRecord[] = [],
  _liveSummary?: OdooLiveSummary | null,
): DeliverySlaSnapshot {
  return {
    unlinkedSource: true,
    messageAr: 'غير مربوط بمصدر',
    trips: [],
    totalTrips: 0,
    meanMinutes: 0,
    greenPct: 0,
    yellowPct: 0,
    redPct: 0,
    redCount: 0,
  }
}

export type ReviewChannelId =
  | 'google-maps'
  | 'talabat'
  | 'deliveroo'
  | 'keeta'
  | 'jahez'
  | 'instagram'
  | 'tiktok'

export type ReviewSentiment = 'positive' | 'neutral' | 'negative'

export type ReviewIssueTag =
  | 'food-quality'
  | 'packaging'
  | 'delivery-delay'
  | 'missing-item'
  | 'service-praise'

export interface OmnichannelReviewItem {
  id: string
  date: string
  channelId: ReviewChannelId
  brandId: BrandId
  branchId: BranchId
  rating: number
  sentiment: ReviewSentiment
  issueTag: ReviewIssueTag
  authorHandle: string
  commentAr: string
  commentEn: string
}

export interface EnrichedReviewItem extends OmnichannelReviewItem {
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  acknowledged: boolean
}

export const SOCIAL_REVIEWS_ACK_STORAGE_KEY = 'aether_social_reviews_ack_v2'
export const SOCIAL_REVIEWS_CUSTOM_STORAGE_KEY = 'aether_social_reviews_custom_v2'

export const REVIEW_CHANNELS: readonly { id: ReviewChannelId; ar: string; en: string }[] = [
  { id: 'google-maps', ar: 'خرائط جوجل', en: 'Google Maps' },
  { id: 'talabat', ar: 'طلبات', en: 'Talabat' },
  { id: 'deliveroo', ar: 'ديليفرو', en: 'Deliveroo' },
  { id: 'keeta', ar: 'كيتا', en: 'Keeta' },
  { id: 'jahez', ar: 'جاهز', en: 'Jahez' },
  { id: 'instagram', ar: 'إنستغرام', en: 'Instagram' },
  { id: 'tiktok', ar: 'تيك توك', en: 'TikTok' },
] as const

export const ISSUE_TAG_LABELS: Record<ReviewIssueTag, { ar: string; en: string }> = {
  'food-quality': { ar: 'جودة الطعام', en: 'Food Quality' },
  packaging: { ar: 'التغليف والحرارة', en: 'Packaging & Temp' },
  'delivery-delay': { ar: 'تأخر التوصيل', en: 'Delivery Delay' },
  'missing-item': { ar: 'نقص بالطلب', en: 'Missing Item' },
  'service-praise': { ar: 'إشادة بالخدمة', en: 'Service Praise' },
}

export interface SocialReviewsSnapshot {
  unlinkedSource: boolean
  messageAr: string
  reviews: EnrichedReviewItem[]
  totalReviews: number
  avgRating: number
  positivePct: number
  negativeCount: number
}

export function computeSocialReviewsSnapshot(
  _workspace?: GlobalWorkspaceSlice,
  _ackedIds: readonly string[] = [],
  _customReviews: readonly OmnichannelReviewItem[] = [],
): SocialReviewsSnapshot {
  return {
    unlinkedSource: true,
    messageAr: 'غير مربوط بمصدر',
    reviews: [],
    totalReviews: 0,
    avgRating: 0,
    positivePct: 0,
    negativeCount: 0,
  }
}
