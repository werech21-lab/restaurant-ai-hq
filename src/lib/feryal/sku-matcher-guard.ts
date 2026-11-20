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

export type CanonicalProteinToken =
  | 'chicken'
  | 'beef'
  | 'shrimp'
  | 'fish'
  | 'lamb'
  | 'duck'
  | 'seafood'
  | 'veg'
  | 'mixed'

export const CANONICAL_PROTEIN_TOKENS: readonly CanonicalProteinToken[] = [
  'beef',
  'chicken',
  'duck',
  'fish',
  'lamb',
  'mixed',
  'seafood',
  'shrimp',
  'veg',
] as const

export interface FlavorProteinQualifiers {
  spicy: boolean
  proteins: CanonicalProteinToken[]
  tokens: string[]
}

export const PRICE_SANITY_MAX_DEVIATION_PCT = 35 as const

const ZERO = Decimal.fromParts(0n, 0)
const THIRTY_FIVE = Decimal.fromParts(35n, 0)
const HUNDRED = Decimal.fromParts(100n, 0)
const TEN_THOUSAND = Decimal.fromParts(10_000n, 0)

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
 * Extracts normalized explicit Odoo SKU bracket code when present (e.g. `[RICG0136]` -> `'RICG0136'`).
 */
export function extractExplicitSkuCode(name: string): string | null {
  const match = name.match(
    /^\s*\[([A-Za-z0-9._\s-]*\d[A-Za-z0-9._\s-]*|(?:RI)?(?:CG|KC|FR|TH|FB|TNB)[A-Za-z0-9._-]*)\]/i,
  )
  if (!match?.[1]) return null
  const normalized = match[1].replace(/[^A-Za-z0-9]+/g, '').toUpperCase()
  return normalized.length >= 2 ? normalized : null
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

/**
 * Extracts Flavor (`spicy`) & Protein/Base (`chicken`, `beef`, `shrimp`, `fish`, `lamb`,
 * `duck`, `seafood`, `veg`, `mixed`) qualifiers in English and Arabic.
 */
export function extractFlavorProteinQualifiers(name: string): FlavorProteinQualifiers {
  const stripped = stripLeadingSkuCodeOnly(name)
  const cleaned = foldArabicAndCase(stripped || name)
    .replace(/['’‘ʼ`´]+/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) {
    return { spicy: false, proteins: [], tokens: [] }
  }

  const spicy =
    /\bspicy\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:سبايسي|فلفل\s*حار|حار|حاره)(?=$|[^\p{L}])/u.test(cleaned)

  const proteinSet = new Set<CanonicalProteinToken>()

  const hasChicken =
    /\b(?:chickens?|chk)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:دجاج|فراخ)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasChicken) proteinSet.add('chicken')

  const hasBeef =
    /\b(?:beefs?|steaks?)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:لحم|لحمه|بيف|ستيك)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasBeef) proteinSet.add('beef')

  const hasShrimp =
    /\b(?:shrimps?|prawns?)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:روبيان|ربيان|جمبري)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasShrimp) proteinSet.add('shrimp')

  const hasLamb =
    /\b(?:lambs?|mutton)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:غنم|ضان)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasLamb) proteinSet.add('lamb')

  const hasDuck =
    /\bducks?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:ال)?بط(?=$|[^\p{L}])/u.test(cleaned)
  if (hasDuck) proteinSet.add('duck')

  const hasExplicitFish =
    /\b(?:fish|hammour|hamour|salmon)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:سمك|هامور|سلمون)(?=$|[^\p{L}])/u.test(cleaned)
  const hasFilletToken =
    /\bfillets?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?فيليه(?=$|[^\p{L}])/u.test(cleaned)
  if (hasExplicitFish || (hasFilletToken && !hasChicken && !hasBeef && !hasLamb && !hasDuck)) {
    proteinSet.add('fish')
  }

  const hasSeafood =
    /\bseafoods?\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:ماكولات\s*بحريه|(?:و)?(?:ب)?(?:ال)?بحري(?:ه)?)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasSeafood) proteinSet.add('seafood')

  const hasVeg =
    /\b(?:veg|vege|vegetables?|veggies?|vegetarian)\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:خضار|خضروات|نباتي(?:ه)?)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasVeg) proteinSet.add('veg')

  const hasMixed =
    /\b(?:mixed|mix|assorted)\b/i.test(cleaned) ||
    /\bhouse\s+special\b/i.test(cleaned) ||
    /(?:^|[^\p{L}])(?:و)?(?:ب)?(?:ال)?(?:مشكل|مشكله|ميكس|مكس)(?=$|[^\p{L}])/u.test(cleaned)
  if (hasMixed) proteinSet.add('mixed')

  const proteins = [...proteinSet].sort()
  const tokens = [...(spicy ? ['spicy'] : []), ...proteins].sort()
  return { spicy, proteins, tokens }
}

/**
 * Enforces Flavor / Protein Lock:
 * - Forbids matching a `Spicy` row to a non-spicy SKU or vice versa.
 * - If EITHER side has one or more protein/diet tokens (`chicken`, `beef`, `shrimp`,
 *   `fish`, `lamb`, `duck`, `seafood`, `veg`, `mixed`), BOTH sides must have the exact same set.
 */
export function hasCompatibleFlavorProteinTokens(
  sheetItemName: string,
  odooSkuName: string,
): boolean {
  const left = extractFlavorProteinQualifiers(sheetItemName)
  const right = extractFlavorProteinQualifiers(odooSkuName)
  if (left.spicy !== right.spicy) return false
  if (left.proteins.length !== right.proteins.length) return false
  for (let i = 0; i < left.proteins.length; i += 1) {
    if (left.proteins[i] !== right.proteins[i]) return false
  }
  return true
}

const COOKING_PREP_PARENTHETICAL_WORDS = new Set([
  'pan',
  'fry',
  'fried',
  'deep',
  'steamed',
  'steam',
  'crispy',
  'crisp',
  'grilled',
  'grill',
  'boiled',
  'boil',
  'baked',
  'bake',
  'roasted',
  'roast',
  'sauteed',
  'stir',
  'tossed',
  'dry',
  'gravy',
  'sauce',
  'style',
  'sizzling',
  'hotplate',
  'soft',
  'and',
  'or',
  'with',
  'in',
  'مقلي',
  'مقليه',
  'مشوي',
  'مشويه',
  'بخار',
  'علي',
  'على',
  'البخار',
  'مقرمش',
  'مقرمشه',
  'مسلوق',
  'مسلوقه',
  'او',
  'و',
])

function isSafeCookingPrepParenthetical(innerRaw: string): boolean {
  if (!innerRaw.trim()) return true
  if (extractSizePackQualifiers(innerRaw).length > 0) return false
  const fp = extractFlavorProteinQualifiers(innerRaw)
  if (fp.spicy || fp.proteins.length > 0) return false

  const words = foldArabicAndCase(innerRaw)
    .replace(/['’‘ʼ`´]+/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return true
  return words.every((word) => COOKING_PREP_PARENTHETICAL_WORDS.has(word))
}

/**
 * Safe String Normalization (`normalizeSkuMenuLabel`):
 * - Strips leading `[CODE]` SKU bracket prefix when present.
 * - Strips parenthetical cooking/prep notes like `(Pan Fry & Steamed)`, `(Steamed & Pan Fried)`,
 *   `(Pan Fried)`, `(Steamed)`, `(Crispy)`, `(Fried)` ONLY when those parentheses do NOT contain
 *   any size/pack qualifiers (`For 6`, `Platter`, `Box`, `Dozen`, `Single`, `Mini`, `Kids`) or
 *   protein/spicy qualifiers.
 * - Strips apostrophes/smart quotes (`Nim's` / `Nim’s` -> `nims`), normalizes `&` -> `and`,
 *   normalizes hyphens/slashes/punctuation to spaces, and canonicalizes
 *   `vege`/`vegetable`/`vegetables`/`veggie`/`vegetarian` -> `veg`.
 */
export function normalizeSkuMenuLabel(raw: string): string {
  if (!raw) return ''
  const strippedCode = stripLeadingSkuCodeOnly(raw)
  const base = strippedCode.length > 0 ? strippedCode : raw

  const withoutPrepNotes = base.replace(/\(([^()]*)\)/g, (fullMatch, inner: string) =>
    isSafeCookingPrepParenthetical(inner) ? ' ' : ` ${inner} `,
  )

  return foldArabicAndCase(withoutPrepNotes)
    .replace(/['’‘ʼ`´]+/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\b(?:vegetables?|veggies?|vegetarian|vege)\b/gi, 'veg')
    .replace(/\s+/g, ' ')
    .trim()
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

const STOPWORD_TOKENS = new Set(['and', 'with', 'in', 'the', 'of', 'مع', 'في', 'من'])

function extractContentTokens(normalizedLabel: string): string[] {
  const all = normalizedLabel.split(/\s+/).filter(Boolean)
  if (all.length <= 1) return all
  const filtered = all.filter((tok) => !STOPWORD_TOKENS.has(tok))
  return filtered.length > 0 ? filtered : all
}

function computeTokenSimilarity(
  leftTokens: readonly string[],
  rightTokens: readonly string[],
): { jaccard: number; dice: number; combined: number; isSubset: boolean } {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return { jaccard: 0, dice: 0, combined: 0, isSubset: false }
  }
  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  let intersection = 0
  for (const tok of leftSet) {
    if (rightSet.has(tok)) intersection += 1
  }
  const union = leftSet.size + rightSet.size - intersection
  const jaccard = union > 0 ? intersection / union : 0
  const dice = (2 * intersection) / (leftSet.size + rightSet.size)
  const isSubset = intersection === leftSet.size || intersection === rightSet.size
  return {
    jaccard,
    dice,
    combined: (jaccard + dice) / 2,
    isSubset,
  }
}

function computePriceGapBps(
  sheetCurrentPriceKwd: string | null | undefined,
  odooUnitPriceKwd: string | null | undefined,
): number {
  const sheetDec = parseKwdDecimal(sheetCurrentPriceKwd)
  const odooDec = parseKwdDecimal(odooUnitPriceKwd)
  if (!sheetDec || sheetDec.compare(ZERO) <= 0 || !odooDec || odooDec.compare(ZERO) <= 0) {
    return 999_999
  }
  const gapDec = absDecimal(sheetDec.sub(odooDec)).mul(TEN_THOUSAND).div(odooDec, 0)
  if (!gapDec) return 999_999
  const num = Number(gapDec.canonical())
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 999_999
}

export interface OneToOneRowInput {
  rowIndex: number
  itemName: string
  brand?: string | null
  currentPriceKwd?: string | null
  preferredProductId?: number | null
  excluded?: boolean
}

export interface OneToOneCandidateSku {
  productId: number
  name: string
  unitPriceKwd?: string | null
  netSalesKwd?: string | null
  brandId?: string | null
}

export interface OneToOneRejectedHint {
  odooProductId: number
  odooName: string
  odooUnitPriceKwd: string
  diffPct: string
  reason: 'price_deviation' | 'duplicate_sku_collision'
}

export interface OneToOneRowAssignment {
  rowIndex: number
  matched: boolean
  productId: number | null
  rejectedWrongVariant: boolean
  rejectedHint: OneToOneRejectedHint | null
}

interface CandidateMatchEdge {
  rowIndex: number
  productId: number
  skuName: string
  skuUnitPriceKwd: string | null
  skuBrandId: string | null
  matchTier: number
  simBps: number
  preferredBonus: number
  priceGapBps: number
  netSalesDec: Decimal
}

/**
 * Enforces Strict 1-to-1 SKU Matching Across Rows:
 * - Evaluates every `(rowIndex, productId)` pair through Brand Lock, Size/Pack Lock,
 *   Flavor/Protein Lock, Cross-Brand Ambiguity Lock, and `<= 35%` Price Sanity Gate.
 * - Ranks valid edges deterministically:
 *   explicit SKU code match > exact normalized name match > exact token-set match >
 *   token Jaccard/Dice similarity, tie-breaking by smallest percentage price gap between
 *   sheet current price and Odoo realized unit price, higher POS net sales, rowIndex, and productId.
 * - Assigns each `product_id` to at most ONE row; secondary colliding rows that competed for an
 *   already-assigned `product_id` and have no other valid unassigned SKU are flagged as
 *   `rejectedWrongVariant: true` (`reason: 'duplicate_sku_collision'`) so POS volume is never double-counted.
 */
export function enforceOneToOneSkuMatches(
  rows: readonly OneToOneRowInput[],
  candidates: readonly OneToOneCandidateSku[],
  options?: { contextBrand?: string | null },
): OneToOneRowAssignment[] {
  const contextBrandId = resolveCanonicalBrandId(options?.contextBrand)

  const preparedSkus = candidates
    .filter((sku) => Boolean(sku.name && !isExcludedOdooEntity(sku.name)))
    .map((sku) => {
      const normName = normalizeSkuMenuLabel(sku.name)
      return {
        sku,
        code: extractExplicitSkuCode(sku.name),
        normName,
        contentTokens: extractContentTokens(normName),
        netSalesDec: parseKwdDecimal(sku.netSalesKwd) ?? ZERO,
      }
    })

  const validEdges: CandidateMatchEdge[] = []
  const bestSanityRejectedByRow = new Map<
    number,
    { edge: CandidateMatchEdge; hint: OneToOneRejectedHint }
  >()

  const compareEdges = (a: CandidateMatchEdge, b: CandidateMatchEdge): number => {
    if (b.matchTier !== a.matchTier) return b.matchTier - a.matchTier
    if (b.simBps !== a.simBps) return b.simBps - a.simBps
    if (b.preferredBonus !== a.preferredBonus) return b.preferredBonus - a.preferredBonus
    if (a.priceGapBps !== b.priceGapBps) return a.priceGapBps - b.priceGapBps
    const netCmp = b.netSalesDec.compare(a.netSalesDec)
    if (netCmp !== 0) return netCmp
    if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex
    return a.productId - b.productId
  }

  for (const row of rows) {
    if (row.excluded || !row.itemName || !row.itemName.trim() || isExcludedOdooEntity(row.itemName)) {
      continue
    }

    const explicitRowBrandId =
      resolveCanonicalBrandId(row.brand) ?? inferBrandIdFromSkuName(row.itemName)
    if (contextBrandId && explicitRowBrandId && explicitRowBrandId !== contextBrandId) {
      continue
    }
    const effectiveRowBrandId = explicitRowBrandId ?? contextBrandId

    const rowCode = extractExplicitSkuCode(row.itemName)
    const normRow = normalizeSkuMenuLabel(row.itemName)
    if (!normRow && !rowCode) continue
    const rowContentTokens = extractContentTokens(normRow)

    const rowRawEdges: CandidateMatchEdge[] = []

    for (const prep of preparedSkus) {
      const { sku } = prep
      if (
        !areSkuBrandsCompatible({
          rowBrand: explicitRowBrandId ?? row.brand,
          sheetItemName: row.itemName,
          candidateBrand: sku.brandId,
          candidateSkuName: sku.name,
          contextBrand: contextBrandId,
        })
      ) {
        continue
      }
      if (!hasCompatibleSizePackTokens(row.itemName, sku.name)) {
        continue
      }
      if (!hasCompatibleFlavorProteinTokens(row.itemName, sku.name)) {
        continue
      }

      const sim = computeTokenSimilarity(rowContentTokens, prep.contentTokens)
      const isCodeMatch = rowCode !== null && prep.code !== null && rowCode === prep.code
      const isExactNorm = normRow.length >= 2 && normRow === prep.normName
      const isExactTokenSet = rowContentTokens.length >= 2 && sim.jaccard === 1
      const isSubstring =
        normRow.length >= 3 &&
        prep.normName.length >= 3 &&
        (prep.normName.includes(normRow) || normRow.includes(prep.normName))
      const isSubsetFuzzy =
        normRow.length >= 3 &&
        prep.normName.length >= 3 &&
        sim.isSubset &&
        sim.combined >= 0.65
      const isPreferredId = row.preferredProductId != null && row.preferredProductId === sku.productId

      let matchTier = 0
      let simBps = 0
      if (isCodeMatch) {
        matchTier = 4000
        simBps = 10_000
      } else if (isExactNorm) {
        matchTier = 3000
        simBps = 10_000
      } else if (isExactTokenSet) {
        matchTier = 2800
        simBps = 10_000
      } else if (isPreferredId && (isSubstring || sim.combined >= 0.5)) {
        matchTier = 2500
        simBps = Math.max(7_500, Math.round(sim.combined * 10_000))
      } else if (isSubstring || isSubsetFuzzy) {
        matchTier = 2000
        simBps = Math.round(sim.combined * 10_000)
      } else if (isPreferredId) {
        matchTier = 1500
        simBps = Math.round(sim.combined * 10_000)
      }

      if (matchTier === 0) continue

      rowRawEdges.push({
        rowIndex: row.rowIndex,
        productId: sku.productId,
        skuName: sku.name,
        skuUnitPriceKwd: sku.unitPriceKwd ?? null,
        skuBrandId: sku.brandId ?? null,
        matchTier,
        simBps,
        preferredBonus: isPreferredId ? 1 : 0,
        priceGapBps: computePriceGapBps(row.currentPriceKwd, sku.unitPriceKwd),
        netSalesDec: prep.netSalesDec,
      })
    }

    if (rowRawEdges.length === 0) continue

    rowRawEdges.sort(compareEdges)
    const topTier = rowRawEdges[0]?.matchTier ?? 0
    const topTierGroup = rowRawEdges
      .filter((edge) => edge.matchTier === topTier)
      .map((edge) => ({ brandId: edge.skuBrandId, name: edge.skuName }))

    if (hasCrossBrandAmbiguity(topTierGroup, effectiveRowBrandId)) {
      continue
    }

    // For substring/fuzzy Tier 2 matches under the same brand, preserve ambiguity guard when
    // >=2 distinct SKUs match only via substring (no exact match and no preferred ID).
    if (topTier === 2000) {
      const tier2Group = rowRawEdges.filter((edge) => edge.matchTier === 2000)
      if (tier2Group.length > 1 && tier2Group[0]?.simBps === tier2Group[1]?.simBps) {
        const sanityFiltered = row.currentPriceKwd
          ? tier2Group.filter(
              (edge) => !checkPriceSanityDeviation(row.currentPriceKwd, edge.skuUnitPriceKwd).exceedsThreshold,
            )
          : tier2Group
        if (sanityFiltered.length > 1 && sanityFiltered[0]?.priceGapBps === sanityFiltered[1]?.priceGapBps) {
          continue
        }
      }
    }

    for (const edge of rowRawEdges) {
      const sanity = checkPriceSanityDeviation(row.currentPriceKwd, edge.skuUnitPriceKwd)
      if (sanity.exceedsThreshold) {
        if (sanity.odooPriceKwd && !bestSanityRejectedByRow.has(row.rowIndex)) {
          bestSanityRejectedByRow.set(row.rowIndex, {
            edge,
            hint: {
              odooProductId: edge.productId,
              odooName: edge.skuName,
              odooUnitPriceKwd: sanity.odooPriceKwd,
              diffPct: sanity.diffPct ?? '35',
              reason: 'price_deviation',
            },
          })
        }
        continue
      }
      validEdges.push(edge)
    }
  }

  validEdges.sort(compareEdges)

  const assignedByRow = new Map<number, CandidateMatchEdge>()
  const assignedProducts = new Set<number>()

  for (const edge of validEdges) {
    if (assignedByRow.has(edge.rowIndex) || assignedProducts.has(edge.productId)) {
      continue
    }
    assignedByRow.set(edge.rowIndex, edge)
    assignedProducts.add(edge.productId)
  }

  const edgesByRow = new Map<number, CandidateMatchEdge[]>()
  for (const edge of validEdges) {
    const list = edgesByRow.get(edge.rowIndex) ?? []
    list.push(edge)
    edgesByRow.set(edge.rowIndex, list)
  }

  return rows.map((row) => {
    const assigned = assignedByRow.get(row.rowIndex)
    if (assigned) {
      return {
        rowIndex: row.rowIndex,
        matched: true,
        productId: assigned.productId,
        rejectedWrongVariant: false,
        rejectedHint: null,
      }
    }

    const rowValidCandidates = edgesByRow.get(row.rowIndex) ?? []
    const collidedEdge = rowValidCandidates.find((edge) => assignedProducts.has(edge.productId))
    if (collidedEdge) {
      const sanity = checkPriceSanityDeviation(row.currentPriceKwd, collidedEdge.skuUnitPriceKwd)
      const unitParsed = parseKwdDecimal(collidedEdge.skuUnitPriceKwd)
      const shownOdooUnit =
        sanity.odooPriceKwd ?? (unitParsed ? formatDecimalKwd3(unitParsed) : '0.000')
      return {
        rowIndex: row.rowIndex,
        matched: false,
        productId: null,
        rejectedWrongVariant: true,
        rejectedHint: {
          odooProductId: collidedEdge.productId,
          odooName: collidedEdge.skuName,
          odooUnitPriceKwd: shownOdooUnit,
          diffPct: sanity.diffPct ?? '0',
          reason: 'duplicate_sku_collision',
        },
      }
    }

    const sanityRejected = bestSanityRejectedByRow.get(row.rowIndex)
    if (sanityRejected) {
      return {
        rowIndex: row.rowIndex,
        matched: false,
        productId: null,
        rejectedWrongVariant: true,
        rejectedHint: sanityRejected.hint,
      }
    }

    return {
      rowIndex: row.rowIndex,
      matched: false,
      productId: null,
      rejectedWrongVariant: false,
      rejectedHint: null,
    }
  })
}
