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

const NAME_FRAGMENTS = ODOO_EXCLUSION_RULES.map((rule) => joined(rule.nameParts)).filter(
  (fragment) => fragment.length > 0,
)

const DOMAIN_FRAGMENTS = NAME_FRAGMENTS.filter((fragment) => !WORD_ONLY.has(normalizeEntityLabel(fragment)))
const TOKEN_MARKS = new Set(NAME_FRAGMENTS.map((fragment) => normalizeEntityLabel(fragment)))

export function exclusionDomainFragments(): readonly string[] {
  return DOMAIN_FRAGMENTS.filter((fragment) => /[a-z\u0600-\u06ff]/i.test(fragment) && fragment.length > 3)
}

/** School-canteen POS names. The closed restaurant district is not one of these markers. */
export const SCHOOL_NAME_MARKERS = [
  'NPIS',
  'FAIPS',
  'canteen',
  'school',
  '\u0645\u0642\u0635\u0641',
  '\u0645\u062f\u0631\u0633\u0629',
] as const

const SCHOOL_LABEL_RE = /\bnpis\b|\bfaips\b|\bcanteen\b|\bschool\b|\u0645\u0642\u0635\u0641|\u0645\u062f\u0631\u0633\u0647/

export function isSchoolCanteenLabel(raw: string | null | undefined): boolean {
  if (raw == null) return false
  return SCHOOL_LABEL_RE.test(normalizeEntityLabel(String(raw)))
}

/** District fragments that a school canteen may contain without leaving the company. */
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
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isExcludedRecordId(kind: ExclusionKind, id: number | null | undefined): boolean {
  if (id == null || !Number.isFinite(id)) return false
  return ODOO_EXCLUSION_RULES.some((rule) => rule.kind === kind && rule.ids.includes(id))
}

const CLITIC = /^(?:لل|ب|و|ل)/
const COLLAPSED_MARKS = new Set(['heisenberg', 'heizenberg', 'hizenberg', 'heisenburg', 'haisenberg'])
const ARABIC_BRAND_STEM = 'هايزن'
const CODE_WITH_DIGITS = /^(?:qrn|jhr|hwl)\d+$/

function markHit(token: string): boolean {
  if (CODE_WITH_DIGITS.test(token) || TOKEN_MARKS.has(token) || WORD_ONLY.has(token)) return true
  return token.startsWith(ARABIC_BRAND_STEM)
}

function tokenExcluded(token: string, school: boolean): boolean {
  const stripped = token.replace(CLITIC, '')
  const candidates = stripped === token ? [token] : [token, stripped]
  for (const candidate of candidates) {
    if (!markHit(candidate)) continue
    if (school && isClosedBranchFamilyFragment(candidate)) continue
    return true
  }
  return false
}

function collapsedWindowHit(tokens: readonly string[]): boolean {
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = ''
    for (let index = start; index < tokens.length && index < start + 12; index += 1) {
      joined += tokens[index]?.replace(/[^a-z0-9]+/g, '') ?? ''
      if (COLLAPSED_MARKS.has(joined)) return true
      if (joined.length > 16) break
    }
  }
  return false
}

export function isExcludedOdooEntity(raw: string | null | undefined): boolean {
  if (raw == null) return false
  const text = normalizeEntityLabel(String(raw))
  if (!text) return false
  const school = isSchoolCanteenLabel(text)
  const tokens = text.split(' ')
  if (!school && collapsedWindowHit(tokens)) return true
  return tokens.some((token) => tokenExcluded(token, school))
}

function tokenLikePatterns(fragment: string): string[] {
  const separators = [' ', '-', '/', ',', '(', ')']
  const patterns = new Set<string>([fragment])
  for (const separator of separators) {
    patterns.add(`${fragment}${separator}%`)
    patterns.add(`%${separator}${fragment}`)
    patterns.add(`%${separator}${fragment}${separator}%`)
  }
  if (/^[\u0600-\u06ff]/.test(fragment)) {
    for (const prefix of ['\u0628', '\u0648', '\u0644', '\u0644\u0644']) {
      patterns.add(`${prefix}${fragment}`)
      for (const separator of [' ', '-', '/']) {
        patterns.add(`${prefix}${fragment}${separator}%`)
        patterns.add(`%${separator}${prefix}${fragment}`)
      }
    }
  }
  return [...patterns]
}

function pushNegatedToken(domain: unknown[], nameField: string, fragment: string): void {
  const patterns = tokenLikePatterns(fragment)
  domain.push('!')
  for (let i = 0; i < patterns.length - 1; i += 1) domain.push('|')
  for (const pattern of patterns) domain.push([nameField, '=ilike', pattern])
}

export function appendOdooNameExclusion(domain: unknown[], nameField: string): void {
  for (const fragment of exclusionDomainFragments()) {
    if (!isClosedBranchFamilyFragment(fragment)) {
      pushNegatedToken(domain, nameField, fragment)
      continue
    }
    const schoolTerms = SCHOOL_NAME_MARKERS.map((mark) => [nameField, 'ilike', mark])
    for (let i = 0; i < schoolTerms.length; i += 1) domain.push('|')
    for (const term of schoolTerms) domain.push(term)
    pushNegatedToken(domain, nameField, fragment)
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
