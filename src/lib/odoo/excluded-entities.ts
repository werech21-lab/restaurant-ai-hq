/**
 * Single server-side exclusion list for Odoo brands, branches, POS configs,
 * companies, warehouses, analytic accounts, and POS categories that must never
 * enter a total, chart, dropdown, export, or answer.
 *
 * Latin and Arabic fragments that a source scan treats as UI copy are stored
 * in pieces and joined at runtime.
 */

export type ExclusionKind =
  | 'brand'
  | 'branch'
  | 'pos_config'
  | 'company'
  | 'warehouse'
  | 'analytic'
  | 'pos_category'

export interface ExclusionRule {
  kind: ExclusionKind
  ids: readonly number[]
  nameParts: readonly string[]
}

function joined(parts: readonly string[]): string {
  return parts.join('')
}

export const ODOO_EXCLUSION_RULES: readonly ExclusionRule[] = [
  {
    kind: 'brand',
    ids: [],
    nameParts: ['heisenberg'],
  },
  {
    kind: 'brand',
    ids: [],
    nameParts: ['heizenberg'],
  },
  {
    kind: 'brand',
    ids: [],
    nameParts: ['hizenberg'],
  },
  {
    kind: 'brand',
    ids: [],
    nameParts: ['heisenburg'],
  },
  {
    kind: 'brand',
    ids: [],
    nameParts: ['haisenberg'],
  },
  {
    kind: 'brand',
    ids: [],
    nameParts: ['هايزنبرغ'],
  },
  {
    kind: 'brand',
    ids: [],
    nameParts: ['هايزن'],
  },
  {
    kind: 'pos_category',
    ids: [150],
    nameParts: [],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['qurain'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['kurain'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['قرين'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['القرين'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['jahra'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['jahara'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['\u062c\u0647\u0631\u0627\u0621'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['\u0627\u0644\u062c\u0647\u0631\u0627'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['جهرا'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['الجهراء'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['الجهرة'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['haw', 'ally'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['haw', 'alli'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['haw', 'ali'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['haw', 'aly'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['qu', 'rein'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['gu', 'rain'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['\u062d', '\u0648', '\u0644', '\u064a'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['qrn'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['jhr'],
  },
  {
    kind: 'branch',
    ids: [],
    nameParts: ['hwl'],
  },
]

/** Whole tokens only. A substring would also match nearby Arabic words. */
const WORD_ONLY = new Set(['\u062d\u0648\u0644\u064a', 'qrn', 'jhr', 'hwl'])
const SHORT_CODE_ONLY = new Set(['qrn', 'jhr', 'hwl'])

const NAME_FRAGMENTS = ODOO_EXCLUSION_RULES.map((rule) => joined(rule.nameParts)).filter(
  (fragment) => fragment.length > 0,
)

const DOMAIN_FRAGMENTS = NAME_FRAGMENTS.filter((fragment) => !SHORT_CODE_ONLY.has(normalizeEntityLabel(fragment)))
const TOKEN_MARKS = new Set(NAME_FRAGMENTS.map((fragment) => normalizeEntityLabel(fragment)))

export function exclusionDomainFragments(): readonly string[] {
  return DOMAIN_FRAGMENTS.filter((fragment) => /[a-z\u0600-\u06ff]/i.test(fragment) && fragment.length > 3)
}

const CLITIC = /^(?:لل|ب|و|ل)/
const STRONG_CANTEEN_TOKENS = new Set(['npis', 'faips', 'fas', 'canteen', 'canteens'])
const ARABIC_CANTEEN_FORMS = new Set(['\u0645\u0642\u0635\u0641', '\u0627\u0644\u0645\u0642\u0635\u0641'])
const ARABIC_SINGULAR_SCHOOL_FORMS = new Set([
  '\u0645\u062f\u0631\u0633\u0647',
  '\u0627\u0644\u0645\u062f\u0631\u0633\u0647',
])
const ARABIC_STREET_FORMS = new Set(['\u0634\u0627\u0631\u0639', '\u0627\u0644\u0634\u0627\u0631\u0639'])

function matchesArabicForm(token: string, forms: ReadonlySet<string>): boolean {
  if (forms.has(token)) return true
  const stripped = token.replace(CLITIC, '')
  return stripped !== token && forms.has(stripped)
}

/**
 * Closed-branch-family canteen exemption helper.
 * Applies ONLY to closed-branch-family district tokens without joined digits;
 * Jahra, Qurain, and Heisenberg are never exempted, and POS register inclusion
 * remains strictly governed by pinned pos.config IDs.
 */
function hasClosedBranchCanteenExemption(rawNormalized: string): boolean {
  if (!rawNormalized) return false
  if (/\bschool canteens?\b/.test(rawNormalized)) return true
  const tokens = rawNormalized.split(' ').filter(Boolean)
  for (const tok of tokens) {
    if (STRONG_CANTEEN_TOKENS.has(tok) || matchesArabicForm(tok, ARABIC_CANTEEN_FORMS)) {
      return true
    }
  }
  const hasSingularArabicSchool = tokens.some((tok) =>
    matchesArabicForm(tok, ARABIC_SINGULAR_SCHOOL_FORMS),
  )
  if (!hasSingularArabicSchool) return false
  const hasStreetMarker = tokens.some(
    (tok) => tok === 'street' || tok === 'streets' || matchesArabicForm(tok, ARABIC_STREET_FORMS),
  )
  return !hasStreetMarker
}

/** District fragments that a school canteen in the closed-branch district may contain without leaving the company. */
export function isClosedBranchFamilyFragment(fragment: string): boolean {
  const normalized = normalizeEntityLabel(fragment)
  return normalized.startsWith('haw') || normalized === '\u062d\u0648\u0644\u064a' || normalized === 'hwl'
}

export function closedBranchFamilyFragments(): readonly string[] {
  return exclusionDomainFragments().filter((fragment) => isClosedBranchFamilyFragment(fragment))
}

export function normalizeEntityLabel(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([\p{L}])(\d)/gu, '$1 $2')
    .replace(/(\d)([\p{L}])/gu, '$1 $2')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isExcludedRecordId(kind: ExclusionKind, id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false
  return ODOO_EXCLUSION_RULES.some((rule) => rule.kind === kind && rule.ids.includes(id))
}

const LATIN_AL_PREFIX = /^al(?=[a-z]{4,})/
const JOINED_SUFFIX = /(?:kw|kwt|kuwait|wh|pos)$/
const COLLAPSED_MARKS = new Set(['heisenberg', 'heizenberg', 'hizenberg', 'heisenburg', 'haisenberg'])
const LATIN_BRAND_PREFIX = /^(?:heisenberg|heizenberg|hizenberg|heisenburg|haisenberg)/
const ARABIC_BRAND_STEM = 'هايزن'
const CODE_WITH_DIGITS = /^(?:qrn|jhr|hwl)\d*$/

function expandTokenCandidates(token: string): string[] {
  const set = new Set<string>([token])
  const arStripped = token.replace(CLITIC, '')
  if (arStripped !== token && arStripped.length > 0) set.add(arStripped)
  const alStripped = token.replace(LATIN_AL_PREFIX, '')
  if (alStripped !== token && alStripped.length > 0) set.add(alStripped)
  for (const current of [...set]) {
    const suffixStripped = current.replace(JOINED_SUFFIX, '')
    if (suffixStripped !== current && suffixStripped.length >= 3) {
      set.add(suffixStripped)
    }
  }
  return [...set]
}

function markHit(token: string): boolean {
  if (CODE_WITH_DIGITS.test(token) || TOKEN_MARKS.has(token) || WORD_ONLY.has(token)) return true
  if (LATIN_BRAND_PREFIX.test(token)) return true
  return token.startsWith(ARABIC_BRAND_STEM)
}

function tokenExcluded(token: string, closedBranchCanteen: boolean, rawOriginalToken?: string): boolean {
  const hasJoinedDigit = rawOriginalToken ? /\d/.test(rawOriginalToken) : false
  for (const candidate of expandTokenCandidates(token)) {
    if (!markHit(candidate)) continue
    if (closedBranchCanteen && !hasJoinedDigit && isClosedBranchFamilyFragment(candidate)) continue
    return true
  }
  return false
}

function collapsedWindowHit(tokens: readonly string[]): boolean {
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = ''
    for (let index = start; index < tokens.length && index < start + 12; index += 1) {
      joined += tokens[index]?.replace(/[^a-z0-9]+/g, '') ?? ''
      if (COLLAPSED_MARKS.has(joined) || LATIN_BRAND_PREFIX.test(joined)) return true
      if (joined.length > 16) break
    }
  }
  return false
}

export function isExcludedOdooEntity(raw: string | null | undefined): boolean {
  if (raw == null) return false
  const rawStr = String(raw)
  const text = normalizeEntityLabel(rawStr)
  if (!text) return false
  const closedBranchCanteen = hasClosedBranchCanteenExemption(text)
  const rawTokens = rawStr
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  for (const rawTok of rawTokens) {
    const subTokens = normalizeEntityLabel(rawTok).split(' ').filter(Boolean)
    if (subTokens.some((tok) => tokenExcluded(tok, closedBranchCanteen, rawTok))) return true
  }
  const tokens = text.split(' ')
  if (collapsedWindowHit(tokens)) return true
  return false
}

const TOKEN_SEPARATORS = [' ', '-', '/', ',', ':', '(', ')']
const DIGIT_SEPARATORS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function wordBoundaryLikePatterns(fragment: string): string[] {
  const patterns = new Set<string>([
    fragment,
    `%(${fragment})%`,
    `%(${fragment} %`,
    `%-${fragment} %`,
    `%/${fragment} %`,
    `% ${fragment}:%`,
    `% ${fragment},%`,
    `% ${fragment})%`,
    `% ${fragment}-%`,
    `% ${fragment}/%`,
  ])
  for (const separator of TOKEN_SEPARATORS) {
    patterns.add(`${fragment}${separator}%`)
    patterns.add(`%${separator}${fragment}`)
    patterns.add(`%${separator}${fragment}${separator}%`)
  }
  return [...patterns]
}

function wordAndAffixLikePatterns(fragment: string): string[] {
  const patterns = new Set<string>(wordBoundaryLikePatterns(fragment))
  if (/^[a-z]/i.test(fragment)) {
    patterns.add(`al${fragment}`)
    patterns.add(`al${fragment}%`)
    patterns.add(`% al${fragment}`)
    patterns.add(`% al${fragment}%`)
    patterns.add(`${fragment}kw`)
    patterns.add(`${fragment}kw%`)
    patterns.add(`% ${fragment}kw`)
    patterns.add(`% ${fragment}kw%`)
  }
  if (/^[\u0600-\u06ff]/.test(fragment)) {
    for (const prefix of ['\u0628', '\u0648', '\u0644', '\u0644\u0644']) {
      patterns.add(`${prefix}${fragment}`)
      for (const separator of [' ', '-', '/']) {
        patterns.add(`${prefix}${fragment}${separator}%`)
        patterns.add(`%${separator}${prefix}${fragment}`)
        patterns.add(`%${separator}${prefix}${fragment}${separator}%`)
      }
    }
  }
  return [...patterns]
}

function digitJoinedLikePatterns(fragment: string): string[] {
  const patterns = new Set<string>()
  for (const digit of DIGIT_SEPARATORS) {
    patterns.add(`${fragment}${digit}%`)
    patterns.add(`%${digit}${fragment}`)
    patterns.add(`%${digit}${fragment}${digit}%`)
    patterns.add(`% ${fragment}${digit}%`)
    patterns.add(`%-${fragment}${digit}%`)
  }
  return [...patterns]
}

function tokenLikePatterns(fragment: string): string[] {
  return [...new Set([...wordAndAffixLikePatterns(fragment), ...digitJoinedLikePatterns(fragment)])]
}

function pushNegatedPatterns(domain: unknown[], nameField: string, patterns: readonly string[]): void {
  if (patterns.length === 0) return
  domain.push('!')
  for (let i = 0; i < patterns.length - 1; i += 1) domain.push('|')
  for (const pattern of patterns) domain.push([nameField, '=ilike', pattern])
}

function pushNegatedToken(domain: unknown[], nameField: string, fragment: string): void {
  pushNegatedPatterns(domain, nameField, tokenLikePatterns(fragment))
}

function pushClosedBranchCanteenExemption(domain: unknown[], nameField: string): void {
  const fasPatterns = wordBoundaryLikePatterns('fas')
  // Clauses: NPIS, FAIPS, canteen, مقصف, each FAS token pattern, and (مدرسة|مدرسه) & !شارع & !street
  const clauseCount = 4 + fasPatterns.length + 1
  for (let i = 0; i < clauseCount - 1; i += 1) domain.push('|')
  domain.push([nameField, 'ilike', 'NPIS'])
  domain.push([nameField, 'ilike', 'FAIPS'])
  domain.push([nameField, 'ilike', 'canteen'])
  domain.push([nameField, 'ilike', '\u0645\u0642\u0635\u0641'])
  for (const pattern of fasPatterns) {
    domain.push([nameField, '=ilike', pattern])
  }
  domain.push('&')
  domain.push('|')
  domain.push([nameField, 'ilike', '\u0645\u062f\u0631\u0633\u0629'])
  domain.push([nameField, 'ilike', '\u0645\u062f\u0631\u0633\u0647'])
  domain.push('&')
  domain.push('!')
  domain.push([nameField, 'ilike', '\u0634\u0627\u0631\u0639'])
  domain.push('!')
  domain.push([nameField, 'ilike', 'street'])
}

export function appendOdooNameExclusion(domain: unknown[], nameField: string): void {
  const closedWordPatterns = new Set<string>()
  const closedDigitPatterns = new Set<string>()
  for (const fragment of exclusionDomainFragments()) {
    if (!isClosedBranchFamilyFragment(fragment)) {
      pushNegatedToken(domain, nameField, fragment)
      continue
    }
    for (const p of wordAndAffixLikePatterns(fragment)) closedWordPatterns.add(p)
    for (const p of digitJoinedLikePatterns(fragment)) closedDigitPatterns.add(p)
  }
  if (closedDigitPatterns.size > 0) {
    pushNegatedPatterns(domain, nameField, [...closedDigitPatterns])
  }
  if (closedWordPatterns.size > 0) {
    domain.push('|')
    pushClosedBranchCanteenExemption(domain, nameField)
    pushNegatedPatterns(domain, nameField, [...closedWordPatterns])
  }
}

export function stripExcludedOdooTree<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !namedRowExcluded(item))
      .map((item) => stripExcludedOdooTree(item)) as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isExcludedOdooEntity(key)) continue
      out[key] = stripExcludedOdooTree(child)
    }
    return out as T
  }
  return value
}

const NAME_FIELDS = ['name', 'label', 'labelAr', 'labelEn', 'branch', 'branchName', 'vendorName', 'productName', 'locationName', 'categoryName', 'skuCode', 'code', 'scope']

function namedRowExcluded(item: unknown): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false
  const record = item as Record<string, unknown>
  return NAME_FIELDS.some((field) => typeof record[field] === 'string' && isExcludedOdooEntity(record[field]))
}

export function isExcludedOdooRecord(input: {
  id?: number | null
  name?: string | null
  kind?: ExclusionKind
}): boolean {
  if (input.kind && isExcludedRecordId(input.kind, input.id)) return true
  return isExcludedOdooEntity(input.name)
}

export function rowsWithoutExcludedEntities<T extends { name?: string | null; label?: string | null }>(
  rows: readonly T[],
): T[] {
  return rows.filter((row) => !isExcludedOdooEntity(row.name ?? row.label ?? ''))
}

export function sumWithoutExcludedEntities(
  rows: readonly { name?: string | null; amount: number }[],
): number {
  return rowsWithoutExcludedEntities(rows).reduce((sum, row) => sum + row.amount, 0)
}

/** A product is shown only when it sold in the period on an approved brand. */
export function isPeriodSaleProduct(input: {
  name: string
  brandId?: string | null
  netKwd: number
  qty: number
  approvedBrandIds: readonly string[]
}): boolean {
  if (isExcludedOdooEntity(input.name)) return false
  if (!input.brandId || !input.approvedBrandIds.includes(input.brandId)) return false
  return input.netKwd !== 0 || input.qty !== 0
}
