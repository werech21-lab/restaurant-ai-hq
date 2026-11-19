import registry from './pos-registry.json'
import { isExcludedRecordId } from './excluded-entities'

export const SCHOOL_CANTEEN_BRANCH_ID = 'school-canteens'
/** Exhibition booths (registry unit "exhibition") — counted in company totals as their own group (owner decision 2026-11-18). */
export const EXHIBITION_BRANCH_ID = 'exhibitions'

// TODO(Abdullah): confirm whether archived pinned registers #16 E-Mall (Promenade) and #35 Delivery (Ardiya Temp) should remain active-only or include historical orders.
export const ARCHIVED_PINNED_REGISTER_POLICY = 'active_only_todo_abdullah' as const

type Place = { en?: string; ar?: string; code?: string; unit?: string }

const registers = registry.registers as Record<string, { location?: string }>
const locations = registry.locations as Record<string, Place>

// TODO(Abdullah): supply the verified real Odoo pos.config IDs for the NPIS and FAIPS school canteens.
// pos.config 43 FAS Fahaheel: school canteen, confirmed by the owner on 2026-11-17.
const PINNED_SCHOOL_CANTEEN_CONFIG_IDS: readonly number[] = Array.isArray(
  (registry as { schoolCanteenPosConfigIds?: unknown }).schoolCanteenPosConfigIds,
)
  ? ((registry as { schoolCanteenPosConfigIds: number[] }).schoolCanteenPosConfigIds).filter(
      (id) => Number.isInteger(id) && id > 0,
    )
  : []

let restaurantIds: number[] | null = null
let canteenIds: number[] | null = null
let exhibitionIds: number[] | null = null

function placeExcluded(_id: string): boolean {
  return false
}


/** Restaurant registers on the approved list. Exhibitions and school canteens are not included here. */
export function restaurantRegisterIds(): number[] {
  if (restaurantIds) return restaurantIds
  restaurantIds = registry.allowedPosConfigIds.filter((cfgId) => {
    const loc = registers[String(cfgId)]?.location
    if (!loc || locations[loc]?.unit !== 'restaurant' || placeExcluded(loc)) return false
    return true
  })
  return restaurantIds
}

/**
 * School-canteen POS registers pinned explicitly by pos.config ID (never by name keyword).
 * TODO(Abdullah): confirm/replace the pinned IDs in pos-registry.json once verified in Odoo.
 */
export function schoolCanteenRegisterIds(): number[] {
  if (canteenIds) return canteenIds
  canteenIds = PINNED_SCHOOL_CANTEEN_CONFIG_IDS.filter((cfgId) => {
    if (isExcludedRecordId('pos_config', cfgId)) return false
    const loc = registers[String(cfgId)]?.location
    if (!loc || locations[loc]?.unit !== 'canteen') return false
    return true
  })
  return canteenIds
}

/**
 * Exhibition-booth registers on the approved list (registry location unit "exhibition"), e.g.
 * pos.config 26–33, 37, 38. Record-id and place exclusions still apply.
 */
export function exhibitionRegisterIds(): number[] {
  if (exhibitionIds) return exhibitionIds
  exhibitionIds = registry.allowedPosConfigIds.filter((cfgId) => {
    if (isExcludedRecordId('pos_config', cfgId)) return false
    const loc = registers[String(cfgId)]?.location
    if (!loc || locations[loc]?.unit !== 'exhibition' || placeExcluded(loc)) return false
    return true
  })
  return exhibitionIds
}

export function isExhibitionConfigId(id: number | null | undefined): boolean {
  if (id == null || !Number.isInteger(id) || id <= 0) return false
  return exhibitionRegisterIds().includes(id)
}

export function isPinnedSchoolCanteenConfigId(id: number | null | undefined): boolean {
  if (id == null || !Number.isInteger(id) || id <= 0) return false
  return schoolCanteenRegisterIds().includes(id)
}

/** Full approved company POS device list: 7 restaurant branches + pinned school canteens + exhibition booths. */
/**
 * Delivery (Qurain) pos.config ids. Id 24 matched the Odoo cashier pivot
 * (about 21,590 KWD / 3,099 orders in the 30 days to 14 Nov 2026, against
 * Qurain's Oct 24,543 and 1–19 Nov 13,074). Inclusion is by id, not by name.
 */
export const QURAIN_POS_CONFIG_IDS = [24, 36] as const

export function isQurainPosConfigId(id: number | null | undefined): boolean {
  return typeof id === 'number' && (QURAIN_POS_CONFIG_IDS as readonly number[]).includes(id)
}

/** Name hint for the admin diagnostic. Company totals do not use this. */
export function isDeliveryQurainConfig(name: string | null | undefined): boolean {
  return /^delivery\s*\(\s*qurain\s*\)$/i.test((name ?? '').trim())
}

export function companyPosRegisterIds(): number[] {
  return [...new Set([...restaurantRegisterIds(), ...schoolCanteenRegisterIds(), ...exhibitionRegisterIds()])]
}

/**
 * Company POS allow-list. The name is display-only.
 * 1. Delivery (Qurain) ids are included even when archived or in another company.
 * 2. Every other archived config stays out.
 * 3. Excluded pos.config ids (Jahra 25/39, inactive 40) stay out.
 * 4. School-canteen, exhibition, and restaurant ids come from pos-registry.json.
 */
export function companyPosConfigAllowed(
  id: number,
  _name: string | null | undefined,
  active = true,
): boolean {
  if (!Number.isInteger(id) || id <= 0) return false
  if (isQurainPosConfigId(id)) return true
  if (active === false) return false
  if (isExcludedRecordId('pos_config', id)) return false
  if (isPinnedSchoolCanteenConfigId(id)) return true
  if (isExhibitionConfigId(id)) return true
  return restaurantRegisterIds().includes(id)
}

/** Signed POS net. A refund stays negative instead of being clamped to zero. */
export function posOrderNet(amountTotal: unknown, amountTax: unknown): number {
  const total = Number(amountTotal)
  const tax = Number(amountTax)
  const net = (Number.isFinite(total) ? total : 0) - (Number.isFinite(tax) ? tax : 0)
  if (!Number.isFinite(net)) return 0
  return Math.round(net * 1000) / 1000
}

/**
 * Single-order count helper (`0` or `1` ONLY):
 * A refund (`amount_total < 0` or negative net) contributes `0` orders.
 * Throws `RangeError` if `Number(count) > 1` so grouped rows can never call it and zero a negative-net group.
 */
export function posOrderCount(
  count: unknown,
  amountTotal: unknown,
  amountTax: unknown = 0,
): number {
  const numeric = count == null || count === '' ? 0 : Number(count)
  if (!Number.isFinite(numeric)) return 0
  if (numeric > 1) {
    throw new RangeError(
      `posOrderCount is restricted to single orders (0 or 1); received ${String(count)}`,
    )
  }
  if (numeric <= 0) return 0
  const total = Number(amountTotal)
  if (Number.isFinite(total) && total < 0) return 0
  if (posOrderNet(amountTotal, amountTax) < 0) return 0
  return Math.round(numeric) > 0 ? 1 : 0
}

export function signedKwd(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

/** Today is the Kuwait calendar day, even when the newest order is still yesterday. */
export function anchorKuwaitDay(todayKwIso: string, _newestOrderKwIso?: string | null): string {
  return todayKwIso
}

/** Odoo search domain: explicit approved config IDs (restaurants + pinned canteens + exhibition booths), active only. */
export function companyPosSearchDomain(approvedIdsIn?: readonly number[]): unknown[] {
  const ids = approvedIdsIn
    ? [...new Set([...approvedIdsIn, ...schoolCanteenRegisterIds(), ...exhibitionRegisterIds()])]
    : companyPosRegisterIds()
  return [
    ['id', 'in', ids],
    ['active', '=', true],
  ]
}
