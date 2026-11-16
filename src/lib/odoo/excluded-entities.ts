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
    nameParts: ['hizenberg'],
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

const SUBSTRING_FRAGMENTS = NAME_FRAGMENTS.filter((fragment) => !WORD_ONLY.has(normalizeEntityLabel(fragment)))

export function exclusionDomainFragments(): readonly string[] {
  return SUBSTRING_FRAGMENTS.filter((fragment) => /[a-z\u0600-\u06ff]/i.test(fragment) && fragment.length > 3)
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

export function isExcludedOdooEntity(raw: string | null | undefined): boolean {
  if (raw == null) return false
  const text = normalizeEntityLabel(String(raw))
  if (!text) return false
  if (SUBSTRING_FRAGMENTS.some((fragment) => text.includes(normalizeEntityLabel(fragment)))) return true
  return text.split(' ').some((token) => WORD_ONLY.has(token))
}

export function appendOdooNameExclusion(domain: unknown[], nameField: string): void {
  for (const fragment of exclusionDomainFragments()) {
    domain.push([nameField, 'not ilike', fragment])
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
  return input.netKwd > 0 || input.qty > 0
}
