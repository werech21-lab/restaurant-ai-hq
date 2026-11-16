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

export function isNonCompanyCatalogItem(sku: string | null | undefined, name: string | null | undefined): boolean {
  if (sku && (NON_COMPANY_ITEM_SKUS as readonly string[]).includes(sku)) return true
  const folded = (name ?? '').toLowerCase()
  return folded.includes(LATIN_BAKERY) || folded.includes(ARABIC_BAKERY)
}

export function nonCompanyItemSql(skuColumn: string, nameColumn: string, params: unknown[]): string {
  params.push([...NON_COMPANY_ITEM_SKUS])
  const skuIndex = params.length
  params.push(`%${LATIN_BAKERY}%`)
  const latinIndex = params.length
  params.push(`%${ARABIC_BAKERY}%`)
  const arabicIndex = params.length
  return ` and ${skuColumn} <> all($${skuIndex}::text[]) and ${nameColumn} not ilike $${latinIndex} and ${nameColumn} not ilike $${arabicIndex}`
}
