import posRegistry from '@/lib/odoo/pos-registry.json'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { Decimal } from '@/server/ai/decimal'

export type CanonicalFeryalBrandId =
  | 'china-garden'
  | 'franks'
  | 'tahina'
  | 'farm-brown'
  | 'noodle-bar'
  | 'karak-cafeteria'

export const CANONICAL_FERYAL_BRAND_IDS: readonly CanonicalFeryalBrandId[] = [
  'china-garden',
  'franks',
  'tahina',
  'farm-brown',
  'noodle-bar',
  'karak-cafeteria',
] as const

export const PRICE_SANITY_MAX_DEVIATION_PCT = 35 as const

const ZERO = Decimal.fromParts(0n, 0)
const THIRTY_FIVE = Decimal.fromParts(35n, 0)
const HUNDRED = Decimal.fromParts(100n, 0)

interface RegistryBrandRecord {
  id?: string
  en?: string
  ar?: string
  posRoot?: string | null
}

function getRegistryBrands(): RegistryBrandRecord[] {
  const list = (posRegistry as { brands?: RegistryBrandRecord[] }).brands
  return Array.isArray(list) ? list : []
}

function normalizeDigitsAndSeparators(raw: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  const extendedArabic = '۰۱۲۳۴۵۶۷۸۹'
  let out = ''
  for (const ch of raw) {
    const idx1 = arabicIndic.indexOf(ch)
    if (idx1 >= 0) {
      out += String(idx1)
      continue
    }
    const idx2 = extendedArabic.indexOf(ch)
    if (idx2 >= 0) {
      out += String(idx2)
      continue
    }
    if (ch === '٫') {
      out += '.'
      continue
    }
    if (ch === '٬') {
      out += ','
      continue
    }
    if (ch === '−') {
      out += '-'
      continue
    }
    out += ch
  }
  return out
}

function foldArabicAndCase(raw: string): string {
  return normalizeDigitsAndSeparators(raw)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDecimalKwd3(value: Decimal): string {
  const rounded = value.roundHalfUp(3)
  const canon = rounded.canonical()
  const negative = canon.startsWith('-')
  const body = negative ? canon.slice(1) : canon
  const [intPart = '0', fracPart = ''] = body.split('.')
  const paddedFrac = (fracPart + '000').slice(0, 3)
  return `${negative ? '-' : ''}${intPart}.${paddedFrac}`
}

function absDecimal(value: Decimal): Decimal {
  return value.sign() < 0 ? Decimal.fromParts(-value.scaled, value.scale) : value
}

function parseKwdDecimal(raw: string | null | undefined): Decimal | null {
  if (raw == null) return null
  const cleaned = normalizeDigitsAndSeparators(raw)
    .replace(/(?:kwd|kd|د\.?\s*ك\.?|دينار(?:\s+كويتي)?)/gi, '')
    .replace(/,/g, '')
    .trim()
  if (!cleaned || !/^[+-]?\d+(?:\.\d+)?$/.test(cleaned)) return null
  return Decimal.parse(cleaned)
}

function isCanonicalBrandId(value: string): value is CanonicalFeryalBrandId {
  return (CANONICAL_FERYAL_BRAND_IDS as readonly string[]).includes(value)
}

const BRAND_ALIAS_GROUPS: ReadonlyArray<{
  id: CanonicalFeryalBrandId
  aliases: readonly string[]
}> = [
  {
    id: 'china-garden',
    aliases: [
      'china-garden',
      'china garden',
      'cg',
      'ricg',
      'تشاينا جاردن',
      'تشاينا غاردن',
      'شينا جاردن',
    ],
  },
  {
    id: 'franks',
    aliases: ['franks', "frank's", 'frank', 'rifr', 'فرانكس'],
  },
  {
    id: 'tahina',
    aliases: ['tahina', 'rith', 'طحينة', 'طحينه', 'شاورما طحينة', 'شاورما طحينه'],
  },
  {
    id: 'farm-brown',
    aliases: ['farm-brown', 'farm brown', 'fb', 'rifb', 'فارم براون'],
  },
  {
    id: 'noodle-bar',
    aliases: [
      'noodle-bar',
      'the noodle bar',
      'noodle bar',
      'tnb',
      'ritnb',
      'ذا نودل بار',
      'نودل بار',
    ],
  },
  {
    id: 'karak-cafeteria',
    aliases: [
      'karak-cafeteria',
      'karak cafeteria',
      'karak',
      'kc',
      'rikc',
      'كافيتيريا كرك',
      'كرك كافيتيريا',
      'كرك كافتيريا',
      'شاي كرك',
    ],
  },
]

export function brandIdForPosRoot(posRoot: string | null | undefined): CanonicalFeryalBrandId | null {
  if (!posRoot) return null
  const trimmed = posRoot.trim()
  if (!trimmed || isExcludedOdooEntity(trimmed)) return null
  const folded = foldArabicAndCase(trimmed)
  for (const entry of getRegistryBrands()) {
    if (!entry.id || !isCanonicalBrandId(entry.id)) continue
    if (entry.posRoot && foldArabicAndCase(entry.posRoot) === folded) {
      return entry.id
    }
  }
  return resolveCanonicalBrandId(trimmed)
}

export function resolveCanonicalBrandId(
  rawBrand: string | null | undefined,
): CanonicalFeryalBrandId | null {
  if (!rawBrand) return null
  const trimmed = rawBrand.trim()
  if (!trimmed || trimmed.toLowerCase() === 'all' || isExcludedOdooEntity(trimmed)) return null

  const lower = trimmed.toLowerCase()
  if (isCanonicalBrandId(lower)) return lower

  const folded = foldArabicAndCase(trimmed)
  const strippedPunct = folded.replace(/['’`._-]+/g, ' ').replace(/\s+/g, ' ').trim()

  for (const entry of getRegistryBrands()) {
    if (!entry.id || !isCanonicalBrandId(entry.id)) continue
    const candidates = [entry.id, entry.en, entry.ar, entry.posRoot].filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    )
    for (const candidate of candidates) {
      const candFolded = foldArabicAndCase(candidate)
      if (candFolded === folded || candFolded.replace(/['’`._-]+/g, ' ').trim() === strippedPunct) {
        return entry.id
      }
    }
  }

  for (const group of BRAND_ALIAS_GROUPS) {
    for (const alias of group.aliases) {
      const aliasFolded = foldArabicAndCase(alias)
      if (
        aliasFolded === folded ||
        aliasFolded.replace(/['’`._-]+/g, ' ').trim() === strippedPunct
      ) {
        return group.id
      }
    }
  }

  return null
}

function inferBrandFromCodeToken(rawCode: string): CanonicalFeryalBrandId | null {
  const code = rawCode.trim()
  if (!code) return null
  if (/^(?:ri[-_\s]*)?tnb(?:[-_\s\d]|$)/i.test(code)) return 'noodle-bar'
  if (/^(?:ri[-_\s]*)?cg(?:[-_\s\d]|$)/i.test(code)) return 'china-garden'
  if (/^(?:ri[-_\s]*)?(?:kc|karak)(?:[-_\s\d]|$)/i.test(code)) return 'karak-cafeteria'
  if (/^(?:ri[-_\s]*)?(?:fr|frank'?s?)(?:[-_\s\d]|$)/i.test(code)) return 'franks'
  if (/^(?:ri[-_\s]*)?(?:fb|farm[\s_-]*brown)(?:[-_\s\d]|$)/i.test(code)) return 'farm-brown'
  if (/^(?:ri[-_\s]*)?(?:th|tahina)(?:[-_\s\d]|$)/i.test(code)) return 'tahina'
  return null
}

/**
 * Deterministic SKU brand inference from Odoo `[CODE]` prefix (`[RICG...]`, `[RIKC...]`,
 * `[RIFR...]`, `[RITH...]`, `[RIFB...]`, `[RITNB...]`, `[CG-...]`, etc.) or explicit brand
 * qualifiers in the SKU / sheet item name.
 */
export function inferBrandIdFromSkuName(
  skuName: string | null | undefined,
): CanonicalFeryalBrandId | null {
  if (!skuName) return null
  const trimmed = skuName.trim()
  if (!trimmed || isExcludedOdooEntity(trimmed)) return null

  const bracketMatch = trimmed.match(/^\s*\[([^\]]+)\]/)
  if (bracketMatch?.[1]) {
    const fromBracket = inferBrandFromCodeToken(bracketMatch[1])
    if (fromBracket) return fromBracket
    const byDirectBrand = resolveCanonicalBrandId(bracketMatch[1])
    if (byDirectBrand) return byDirectBrand
  }

  const withoutBracket = trimmed.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
  const folded = foldArabicAndCase(withoutBracket)

  // Check leading code-style prefix without brackets (e.g. "RICG-01 ...", "CG - Pepsi", "TNB ...")
  if (/^(?:ritnb|tnb)(?:[\s:_-]+\d*|\d+)\b/i.test(withoutBracket)) return 'noodle-bar'
  if (/^(?:ricg|cg)(?:[\s:_-]+\d*|\d+)\b/i.test(withoutBracket)) return 'china-garden'
  if (/^(?:rikc|kc)(?:[\s:_-]+\d*|\d+)\b/i.test(withoutBracket)) return 'karak-cafeteria'
  if (/^(?:rifr|fr)(?:[\s:_-]+\d*|\d+)\b/i.test(withoutBracket)) return 'franks'
  if (/^(?:rifb|fb)(?:[\s:_-]+\d*|\d+)\b/i.test(withoutBracket)) return 'farm-brown'
  if (/^(?:rith|th)(?:[\s:_-]+\d*|\d+)\b/i.test(withoutBracket)) return 'tahina'

  // Check explicit brand names in English or Arabic
  if (
    /\bchina\s+garden\b/i.test(folded) ||
    /(?:^|[^\p{L}])(?:تشاينا\s*جاردن|تشاينا\s*غاردن|شينا\s*جاردن)(?:$|[^\p{L}])/u.test(folded)
  ) {
    return 'china-garden'
  }
  if (
    /\bnoodle\s+bar\b/i.test(folded) ||
    /(?:^|[^\p{L}])(?:ذا\s*نودل\s*بار|نودل\s*بار)(?:$|[^\p{L}])/u.test(folded)
  ) {
    return 'noodle-bar'
  }
  if (
    /\bfarm\s+brown\b/i.test(folded) ||
    /(?:^|[^\p{L}])فارم\s*براون(?:$|[^\p{L}])/u.test(folded)
  ) {
    return 'farm-brown'
  }
  if (
    /\bkarak(?:\s+cafeteria)?\b/i.test(folded) ||
    /(?:^|[^\p{L}])(?:كافيتيريا\s*كرك|كرك\s*كافيتيريا|كرك\s*كافتيريا|كرك)(?:$|[^\p{L}])/u.test(folded)
  ) {
    return 'karak-cafeteria'
  }
  if (
    /\bfrank['’]?s?\b/i.test(folded) ||
    /(?:^|[^\p{L}])فرانكس(?:$|[^\p{L}])/u.test(folded)
  ) {
    return 'franks'
  }
  if (
    /\btahina\b/i.test(folded) ||
    /(?:^|[^\p{L}])(?:شاورما\s*طحينه|طحينه)(?:$|[^\p{L}])/u.test(folded)
  ) {
    return 'tahina'
  }

  return null
}

export interface BrandCompatibilityInput {
  rowBrand?: string | null
  sheetItemName: string
  candidateBrand?: string | null
  candidateSkuName: string
  contextBrand?: string | null
}

/**
 * Enforces Rule 1 (Strict Brand-Scoped Matching):
 * - Rejects if contextBrand is set (e.g. 'china-garden') and the sheet row explicitly
 *   identifies a different brand (e.g. 'karak-cafeteria').
 * - Rejects whenever effectiveRowBrand and effectiveCandidateBrand are both known and differ.
 */
export function areSkuBrandsCompatible(input: BrandCompatibilityInput): boolean {
  const contextBrandId = resolveCanonicalBrandId(input.contextBrand)
  const explicitRowBrandId =
    resolveCanonicalBrandId(input.rowBrand) ?? inferBrandIdFromSkuName(input.sheetItemName)

  if (contextBrandId && explicitRowBrandId && explicitRowBrandId !== contextBrandId) {
    return false
  }

  const effectiveRowBrandId = explicitRowBrandId ?? contextBrandId
  const effectiveCandidateBrandId =
    resolveCanonicalBrandId(input.candidateBrand) ??
    inferBrandIdFromSkuName(input.candidateSkuName) ??
    contextBrandId

  if (
    effectiveRowBrandId &&
    effectiveCandidateBrandId &&
    effectiveRowBrandId !== effectiveCandidateBrandId
  ) {
    return false
  }

  return true
}

/**
 * Prevents cross-brand guessing when a brandless sheet row matches identically-named SKUs
 * across two or more different brands under `All Brands`.
 */
export function hasCrossBrandAmbiguity(
  candidates: ReadonlyArray<{ brandId?: string | null; name: string }>,
  rowBrandId: CanonicalFeryalBrandId | null,
): boolean {
  if (rowBrandId !== null || candidates.length <= 1) return false
  const distinctBrands = new Set<CanonicalFeryalBrandId>()
  for (const candidate of candidates) {
    const resolved =
      resolveCanonicalBrandId(candidate.brandId) ?? inferBrandIdFromSkuName(candidate.name)
    if (resolved) distinctBrands.add(resolved)
  }
  return distinctBrands.size > 1
}

function stripLeadingSkuCodeOnly(name: string): string {
  return name
    .replace(
      /^\s*\[(?:[A-Za-z0-9._\s-]*\d[A-Za-z0-9._\s-]*|(?:RI)?(?:CG|KC|FR|TH|FB|TNB)[A-Za-z0-9._-]*)\]\s*/i,
      '',
    )
    .trim()
}

/**
 * Extracts normalized size & packing qualifiers (Rule 2):
 * - Bulk / multi-pack: `platter`, `for_<N>`, `box`, `half_dozen`, `dozen`, `meal`,
 *   `combo`, `family`, `gathering`, `bucket`
 * - Portion-down / small: `single`, `little`, `mini`, `kids`
 */
export function extractSizePackQualifiers(name: string): string[] {
  const cleaned = foldArabicAndCase(stripLeadingSkuCodeOnly(name))
  if (!cleaned) return []

  const qualifiers = new Set<string>()

  // 1. Bulk / Multi-Pack Qualifiers
  if (
    /\bplatters?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:بلاتر|صينيه|صواني)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('platter')
  }

  for (const match of cleaned.matchAll(/\bfor\s*(\d+)\b/gi)) {
    const count = Number(match[1])
    if (Number.isInteger(count) && count > 0) qualifiers.add(`for_${count}`)
  }
  for (const match of cleaned.matchAll(/\b(\d+)\s*(?:pax|persons?|people)\b/gi)) {
    const count = Number(match[1])
    if (Number.isInteger(count) && count > 0) qualifiers.add(`for_${count}`)
  }
  for (const match of cleaned.matchAll(/(?:^|[^\p{L}])(?:لعدد|يكفي|لـ?\s*عدد)\s*(\d+)(?=$|[^\d])/gu)) {
    const count = Number(match[1])
    if (Number.isInteger(count) && count > 0) qualifiers.add(`for_${count}`)
  }
  for (const match of cleaned.matchAll(/(?:^|[^\p{L}\d])(\d+)\s*(?:اشخاص|شخص)(?=$|[^\p{L}])/gu)) {
    const count = Number(match[1])
    if (Number.isInteger(count) && count > 0) qualifiers.add(`for_${count}`)
  }

  if (
    /\bbox(?:es)?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:بوكس|بوكسات)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('box')
  }

  const hasHalfDozen =
    /\bhalf[\s-]*dozens?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:نصف|نص)\s*درزن(?:$|[^\p{L}])/u.test(cleaned)
  if (hasHalfDozen) {
    qualifiers.add('half_dozen')
  }
  const withoutHalfDozen = cleaned
    .replace(/\bhalf[\s-]*dozens?\b/gi, ' ')
    .replace(/(?:نصف|نص)\s*درزن/gu, ' ')
  if (
    /\bdozens?\b/i.test(withoutHalfDozen) ||
    /(?:^|[^\p{L}])درزن(?:$|[^\p{L}])/u.test(withoutHalfDozen)
  ) {
    qualifiers.add('dozen')
  }

  if (
    /\bmeals?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:وجبه|وجبات)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('meal')
  }

  if (/\bcombos?\b/i.test(cleaned) || /(?:^|[^\p{L}])كومبو(?:$|[^\p{L}])/u.test(cleaned)) {
    qualifiers.add('combo')
  }
  if (
    /\bfamily\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:عائلي|عائليه)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('family')
  }
  if (
    /\bgatherings?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:جمعه|جمعات)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('gathering')
  }
  if (
    /\bbuckets?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:باكيت|سطل)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('bucket')
  }

  // 2. Portion-Down / Small Qualifiers
  if (
    /\bsingles?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:سنجل|سينجل|فردي|مفرد)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('single')
  }
  if (/\blittle\b/i.test(cleaned)) {
    qualifiers.add('little')
  }
  if (/\bminis?\b/i.test(cleaned) || /(?:^|[^\p{L}])ميني(?:$|[^\p{L}])/u.test(cleaned)) {
    qualifiers.add('mini')
  }
  if (
    /\b(?:kids?|junior|child(?:ren)?)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:اطفال|كيدز|جونيور)(?:$|[^\p{L}])/u.test(cleaned)
  ) {
    qualifiers.add('kids')
  }

  return [...qualifiers].sort()
}

/**
 * Enforces Rule 2 (Size / Packing Token Lock):
 * If either side has any bulk/pack or portion-down qualifier that the other side lacks,
 * returns `false` across all matching tiers.
 */
export function hasCompatibleSizePackTokens(
  sheetItemName: string,
  odooSkuName: string,
): boolean {
  const left = extractSizePackQualifiers(sheetItemName)
  const right = extractSizePackQualifiers(odooSkuName)
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }
  return true
}

export interface PriceSanityEvaluation {
  exceedsThreshold: boolean
  diffPct: string | null
  sheetPriceKwd: string | null
  odooPriceKwd: string | null
}

/**
 * Enforces Rule 3 (`> 35%` Price Sanity Gate on SKU Matching) using exact `Decimal` math:
 * `abs(sheetCurrent - odooRealized) * 100 > odooRealized * 35`.
 */
export function checkPriceSanityDeviation(
  sheetCurrentPriceKwd: string | null | undefined,
  odooRealizedUnitPriceKwd: string | null | undefined,
): PriceSanityEvaluation {
  const sheetDec = parseKwdDecimal(sheetCurrentPriceKwd)
  const odooDec = parseKwdDecimal(odooRealizedUnitPriceKwd)

  if (!sheetDec || sheetDec.compare(ZERO) <= 0 || !odooDec || odooDec.compare(ZERO) <= 0) {
    return {
      exceedsThreshold: false,
      diffPct: null,
      sheetPriceKwd: sheetDec && sheetDec.compare(ZERO) > 0 ? formatDecimalKwd3(sheetDec) : null,
      odooPriceKwd: odooDec && odooDec.compare(ZERO) > 0 ? formatDecimalKwd3(odooDec) : null,
    }
  }

  const signedDiff = sheetDec.sub(odooDec)
  const absDiff = absDecimal(signedDiff)
  const exceedsThreshold = absDiff.mul(HUNDRED).compare(odooDec.mul(THIRTY_FIVE)) > 0
  const diffPctDec = signedDiff.mul(HUNDRED).div(odooDec, 2)

  return {
    exceedsThreshold,
    diffPct: diffPctDec ? diffPctDec.canonical() : null,
    sheetPriceKwd: formatDecimalKwd3(sheetDec),
    odooPriceKwd: formatDecimalKwd3(odooDec),
  }
}
