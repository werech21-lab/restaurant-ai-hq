import registry from './pos-registry.json'
import {
  ODOO_EXCLUSION_RULES,
  isClosedBranchFamilyFragment,
  isExcludedOdooEntity,
  isExcludedRecordId,
  normalizeEntityLabel,
} from './excluded-entities'

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
const EXHIBITION_NON_OPERATING_LABEL_RE = /\b(?:test|demo|training)\b/i

const NON_CANTEEN_EXCLUSION_MARKS = new Set(
  ODOO_EXCLUSION_RULES.map((rule) => normalizeEntityLabel(rule.nameParts.join(''))).filter(
    (mark) => mark.length > 0 && !isClosedBranchFamilyFragment(mark),
  ),
)

const ARABIC_CLITIC_RE = /^(?:لل|ب|و|ل)/
const LATIN_AL_PREFIX_RE = /^al(?=[a-z]{4,})/
const JOINED_SUFFIX_RE = /(?:kw|kwt|kuwait|wh|pos)$/
const NON_CANTEEN_CODE_DIGITS_RE = /^(?:jhr)\d*$/
const LATIN_BRAND_PREFIX_RE = /^(?:heisenberg|heizenberg|hizenberg|heisenburg|haisenberg)/
const ARABIC_BRAND_STEM = 'هايزن'

function expandTokenCandidates(token: string): string[] {
  const set = new Set<string>([token])
  const arStripped = token.replace(ARABIC_CLITIC_RE, '')
  if (arStripped !== token && arStripped.length > 0) set.add(arStripped)
  const alStripped = token.replace(LATIN_AL_PREFIX_RE, '')
  if (alStripped !== token && alStripped.length > 0) set.add(alStripped)
  for (const current of [...set]) {
    const suffixStripped = current.replace(JOINED_SUFFIX_RE, '')
    if (suffixStripped !== current && suffixStripped.length >= 3) {
      set.add(suffixStripped)
    }
  }
  return [...set]
}

function hasPinnedCanteenVetoExclusion(raw: string | null | undefined): boolean {
  if (raw == null) return false
  const text = normalizeEntityLabel(String(raw))
  if (!text) return false
  const tokens = text.split(' ').filter(Boolean)
  for (const token of tokens) {
    for (const candidate of expandTokenCandidates(token)) {
      if (isClosedBranchFamilyFragment(candidate)) continue
      if (
        NON_CANTEEN_CODE_DIGITS_RE.test(candidate) ||
        NON_CANTEEN_EXCLUSION_MARKS.has(candidate) ||
        LATIN_BRAND_PREFIX_RE.test(candidate) ||
        candidate.startsWith(ARABIC_BRAND_STEM)
      ) {
        return true
      }
    }
  }
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = ''
    for (let index = start; index < tokens.length && index < start + 12; index += 1) {
      joined += tokens[index]?.replace(/[^a-z0-9]+/g, '') ?? ''
      if (!isClosedBranchFamilyFragment(joined) && LATIN_BRAND_PREFIX_RE.test(joined)) {
        return true
      }
      if (joined.length > 16) break
    }
  }
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
/** Live cashier "Delivery (Qurain)". Included in company totals (founder, 2026-11-19). */
export function isDeliveryQurainConfig(name: string | null | undefined): boolean {
  return /^delivery\s*\(\s*qurain\s*\)$/i.test((name ?? '').trim())
}

export function companyPosRegisterIds(): number[] {
  return [...new Set([...restaurantRegisterIds(), ...schoolCanteenRegisterIds(), ...exhibitionRegisterIds()])]
}

/**
 * Company POS allow-list:
 * 1. Archived (`active === false`) configs are NEVER included (`ARCHIVED_PINNED_REGISTER_POLICY`).
 * 2. Pinned school-canteen config IDs are excluded ONLY when Jahra or Heisenberg markers appear in `name`.
 * 3. Exhibition-booth config IDs (`exhibitionRegisterIds()`) pass unless excluded by entity name or test/demo/training.
 * 4. Other config IDs must pass full entity & non-operating checks and belong to `restaurantRegisterIds()`.
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
  if (isPinnedSchoolCanteenConfigId(id)) {
    return !hasPinnedCanteenVetoExclusion(label)
  }
  if (isDeliveryQurainConfig(label)) return true
  if (isExcludedOdooEntity(label)) return false
  if (isExhibitionConfigId(id)) {
    // Booth registers are named "Exhibition…/EXB" by design; only test/demo/training are non-operating.
    return !EXHIBITION_NON_OPERATING_LABEL_RE.test(label)
  }
  if (NON_OPERATING_CONFIG_LABEL_RE.test(label)) return false
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
