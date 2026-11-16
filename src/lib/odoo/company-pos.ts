import registry from './pos-registry.json'
import { isExcludedOdooEntity, isExcludedRecordId } from './excluded-entities'

export const SCHOOL_CANTEEN_BRANCH_ID = 'school-canteens'

type Place = { en?: string; ar?: string; code?: string; unit?: string }

const registers = registry.registers as Record<string, { location?: string }>
const locations = registry.locations as Record<string, Place>

// TODO(Abdullah): supply the verified real Odoo pos.config IDs for the NPIS and FAIPS school canteens.
const PINNED_SCHOOL_CANTEEN_CONFIG_IDS: readonly number[] = Array.isArray(
  (registry as { schoolCanteenPosConfigIds?: unknown }).schoolCanteenPosConfigIds,
)
  ? ((registry as { schoolCanteenPosConfigIds: number[] }).schoolCanteenPosConfigIds).filter(
      (id) => Number.isInteger(id) && id > 0,
    )
  : []

let restaurantIds: number[] | null = null
let canteenIds: number[] | null = null

function placeExcluded(id: string): boolean {
  const place = locations[id]
  return (
    isExcludedOdooEntity(id) ||
    isExcludedOdooEntity(place?.en) ||
    isExcludedOdooEntity(place?.ar) ||
    isExcludedOdooEntity(place?.code)
  )
}

const NON_OPERATING_CONFIG_LABEL_RE = /\b(?:exhibition|exebition|exb|test|demo|training)\b/i

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

export function isPinnedSchoolCanteenConfigId(id: number | null | undefined): boolean {
  if (id == null || !Number.isInteger(id) || id <= 0) return false
  return schoolCanteenRegisterIds().includes(id)
}

/** Full approved company POS device list: 7 restaurant branches + pinned school canteens. */
export function companyPosRegisterIds(): number[] {
  return [...new Set([...restaurantRegisterIds(), ...schoolCanteenRegisterIds()])]
}

/**
 * Company POS allow-list:
 * 1. Archived (`active === false`) configs are NEVER included.
 * 2. Exclusions ALWAYS win over inclusion (a closed-branch street label stays excluded).
 * 3. Only explicit pinned restaurant or school-canteen config IDs are included (no name-keyword inclusion).
 */
export function companyPosConfigAllowed(
  id: number,
  name: string | null | undefined,
  active = true,
): boolean {
  if (active === false) return false
  if (!Number.isInteger(id) || id <= 0) return false
  if (isExcludedRecordId('pos_config', id)) return false
  const label = name ?? ''
  if (isExcludedOdooEntity(label)) return false
  if (NON_OPERATING_CONFIG_LABEL_RE.test(label)) return false
  return companyPosRegisterIds().includes(id)
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
 * Order count helper: a refund (`amount_total < 0` or negative net) must NEVER add +1 to the order count.
 */
export function posOrderCount(
  count: unknown,
  amountTotal: unknown,
  amountTax: unknown = 0,
): number {
  const total = Number(amountTotal)
  if (Number.isFinite(total) && total < 0) return 0
  if (posOrderNet(amountTotal, amountTax) < 0) return 0
  const parsed = Math.round(Number(count) || 0)
  return parsed > 0 ? parsed : 0
}

export function signedKwd(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

/** Today is the Kuwait calendar day, even when the newest order is still yesterday. */
export function anchorKuwaitDay(todayKwIso: string, _newestOrderKwIso?: string | null): string {
  return todayKwIso
}

/** Odoo search domain: explicit approved config IDs (restaurants + pinned canteens), active only. */
export function companyPosSearchDomain(approvedIdsIn?: readonly number[]): unknown[] {
  const ids = approvedIdsIn ? [...new Set([...approvedIdsIn, ...schoolCanteenRegisterIds()])] : companyPosRegisterIds()
  return [
    ['id', 'in', ids],
    ['active', '=', true],
  ]
}
