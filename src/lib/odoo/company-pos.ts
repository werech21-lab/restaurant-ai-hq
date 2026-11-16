import registry from './pos-registry.json'
import {
  isExcludedOdooEntity,
  isExcludedRecordId,
  isSchoolCanteenLabel,
  SCHOOL_NAME_MARKERS,
} from './excluded-entities'

export const SCHOOL_CANTEEN_BRANCH_ID = 'school-canteens'

type Place = { en?: string; ar?: string; code?: string; unit?: string }

const registers = registry.registers as Record<string, { location?: string }>
const locations = registry.locations as Record<string, Place>

let restaurantIds: number[] | null = null

function placeExcluded(id: string): boolean {
  const place = locations[id]
  return (
    isExcludedOdooEntity(id) ||
    isExcludedOdooEntity(place?.en) ||
    isExcludedOdooEntity(place?.ar) ||
    isExcludedOdooEntity(place?.code)
  )
}

/** Restaurant registers on the approved list. Exhibitions are not included. */
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
 * Company POS: an approved restaurant register, or a school canteen that is not
 * excluded for any other reason. Exhibitions and unknown configs are out.
 */
export function companyPosConfigAllowed(id: number, name: string | null | undefined): boolean {
  if (!Number.isInteger(id) || id <= 0) return false
  if (isExcludedRecordId('pos_config', id)) return false
  const label = name ?? ''
  if (isSchoolCanteenLabel(label)) return !isExcludedOdooEntity(label)
  if (!restaurantRegisterIds().includes(id)) return false
  return !isExcludedOdooEntity(label)
}

/** Signed POS net. A refund stays negative instead of being clamped to zero. */
export function posOrderNet(amountTotal: unknown, amountTax: unknown): number {
  const total = Number(amountTotal)
  const tax = Number(amountTax)
  const net = (Number.isFinite(total) ? total : 0) - (Number.isFinite(tax) ? tax : 0)
  if (!Number.isFinite(net)) return 0
  return Math.round(net * 1000) / 1000
}

export function signedKwd(value: unknown): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

/** Today is the Kuwait calendar day, even when the newest order is still yesterday. */
export function anchorKuwaitDay(todayKwIso: string, _newestOrderKwIso?: string | null): string {
  return todayKwIso
}

/** Odoo search domain: approved restaurant ids, plus school-canteen names. */
export function companyPosSearchDomain(restaurantIdsIn: readonly number[]): unknown[] {
  const terms: unknown[] = [['id', 'in', [...restaurantIdsIn]]]
  for (const mark of SCHOOL_NAME_MARKERS) terms.push(['name', 'ilike', mark])
  const domain: unknown[] = []
  for (let i = 0; i < terms.length - 1; i += 1) domain.push('|')
  domain.push(...terms)
  domain.push(['active', 'in', [true, false]])
  return domain
}
