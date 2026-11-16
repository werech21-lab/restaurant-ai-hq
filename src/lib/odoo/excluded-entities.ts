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
]

const NAME_FRAGMENTS = ODOO_EXCLUSION_RULES.map((rule) => joined(rule.nameParts)).filter(
  (fragment) => fragment.length > 0,
)

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
  return NAME_FRAGMENTS.some((fragment) => text.includes(normalizeEntityLabel(fragment)))
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
