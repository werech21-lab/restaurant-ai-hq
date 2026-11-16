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

export function isNonCompanyCatalogItem(sku: string | null | undefined, name: string | null | undefined): boolean {
  const cleanSku = (sku ?? '').trim()
  if (cleanSku && (NON_COMPANY_ITEM_SKUS as readonly string[]).includes(cleanSku)) return true
  const bracketed = /^\s*\[([^\]]+)\]/.exec(name ?? '')?.[1]?.trim()
  if (bracketed && (NON_COMPANY_ITEM_SKUS as readonly string[]).includes(bracketed)) return true
  const folded = (name ?? '').toLowerCase()
  return (
    folded.includes(LATIN_BAKERY) ||
    folded.includes(ARABIC_BAKERY) ||
    folded.includes(ARABIC_BAKERY_ALT) ||
    folded.includes(LATIN_PRODUCE) ||
    folded.includes(ARABIC_PRODUCE) ||
    folded.includes(ARABIC_PRODUCE_ALT)
  )
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
