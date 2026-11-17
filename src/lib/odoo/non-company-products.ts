/** SKUs inserted by migration 0033 that are not company menu items. */
export const NON_COMPANY_ITEM_SKUS = [
  'RIFDC013',
  'RW01487',
  'RIFDC015',
  'RW01489',
  'RIFDC012',
  'RW01486',
  'RIFDC014',
  'RW01488',
  'RIFDC016',
  'RW01490',
] as const

const LATIN_BAKERY = ['croi', 'ssant'].join('')
const ARABIC_BAKERY = ['كروا', 'سون'].join('')
const ARABIC_BAKERY_ALT = ['كروا', 'سان'].join('')
const LATIN_PRODUCE = ['avo', 'cado'].join('')
const ARABIC_PRODUCE = ['أفو', 'كادو'].join('')
const ARABIC_PRODUCE_ALT = ['افو', 'كادو'].join('')

export const NON_COMPANY_NAME_TERMS = [
  LATIN_BAKERY,
  ARABIC_BAKERY,
  ARABIC_BAKERY_ALT,
  LATIN_PRODUCE,
  ARABIC_PRODUCE,
  ARABIC_PRODUCE_ALT,
] as const

export function isNonCompanyCatalogItem(sku: string | null | undefined, name: string | null | undefined): boolean {
  const cleanSku = (sku ?? '').trim()
  if (cleanSku && (NON_COMPANY_ITEM_SKUS as readonly string[]).includes(cleanSku)) return true
  const bracketed = /^\s*\[([^\]]+)\]/.exec(name ?? '')?.[1]?.trim()
  if (bracketed && (NON_COMPANY_ITEM_SKUS as readonly string[]).includes(bracketed)) return true
  const folded = (name ?? '').toLowerCase()
  return NON_COMPANY_NAME_TERMS.some((term) => folded.includes(term))
}

export function nonCompanyItemSql(skuColumn: string, nameColumn: string, params: unknown[]): string {
  params.push([...NON_COMPANY_ITEM_SKUS])
  const skuIndex = params.length

  const termClauses: string[] = []
  for (const term of NON_COMPANY_NAME_TERMS) {
    params.push(`%${term}%`)
    termClauses.push(`and ${nameColumn} not ilike $${params.length}`)
  }

  params.push(NON_COMPANY_ITEM_SKUS.map((sku) => `%[${sku}]%`))
  const bracketIndex = params.length

  return ` and ${skuColumn} <> all($${skuIndex}::text[]) ${termClauses.join(' ')} and ${nameColumn} not ilike all($${bracketIndex}::text[])`
}
