import { Decimal } from '@/server/ai/decimal'
import {
  DETERMINISTIC_SIMULATION_LABEL,
  DETERMINISTIC_SIMULATION_LABEL_AR,
  ODOO_VERIFIED_ACTUAL_LABEL_AR,
  ODOO_VERIFIED_ACTUALS_LABEL,
  PROPOSED_USER_INPUT_LABEL,
  USER_INPUT_CONFIRMED_LABEL_AR,
} from '@/server/ai/number-guard'
import { QURAIN_POS_CONFIG_IDS } from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity, isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import { kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  areSkuBrandsCompatible,
  brandIdForPosRoot,
  extractExplicitSkuCode,
  extractFlavorProteinQualifiers,
  hasCompatibleSizePackTokens,
  hasCrossBrandAmbiguity,
  inferBrandIdFromSkuName,
  normalizeSkuMenuLabel,
  resolveCanonicalBrandId,
  type CanonicalFeryalBrandId,
} from '@/lib/feryal/sku-matcher-guard'
import { logger } from '@/lib/logger'

/** Same ids as the company exclusion list: Jahra 25 and 39, inactive 40. */
export const ITEM_PRICING_EXCLUDED_POS_CONFIG_IDS = [25, 39, 40] as const
/** Delivery (Qurain), included by Odoo id. 36 is archived and is not in the registry. */
export const ITEM_PRICING_QURAIN_POS_CONFIG_IDS = QURAIN_POS_CONFIG_IDS
export const ITEM_PRICING_RPC_TIMEOUT_MS = 8_000
export const ITEM_PRICING_CHUNK_DAYS = 31
const EXCLUDED_POS_CATEGORY_ID = 150
const READ_ONLY_METHODS = new Set(['search_read', 'read', 'read_group', 'search_count', 'fields_get'])

export const COGS_UNAVAILABLE_REPLY =
  'standard_price is not readable for integration user 225. COGS and margin are not estimated.'

export const COGS_UNAVAILABLE_REPLY_AR =
  'لا يمكن احتساب تكلفة الصنف أو هوامش الربح الإجمالية والصافية نظراً لقيود صلاحية قراءة حقل تكلفة الصنف على حساب الربط في أودو (المستخدم رقم 225)، ولا يتم تقدير التكلفة أو الهامش.' as const

export const MISSING_COST_SUGGESTED_PRICE_PHRASE_AR =
  'ما بقدر أحسب سعر مقترح بلا تكلفة' as const

export function detectItemPricingLocale(question: string): 'ar' | 'en' {
  const arChars = (question.match(/[\u0600-\u06FF]/g) ?? []).length
  const enChars = (question.match(/[A-Za-z]/g) ?? []).length
  if (arChars === 0) return 'en'
  if (arChars >= enChars) return 'ar'
  return arChars >= 4 ? 'ar' : 'en'
}

export function renderCogsUnavailableReply(locale: 'ar' | 'en'): string {
  return locale === 'ar' ? COGS_UNAVAILABLE_REPLY_AR : COGS_UNAVAILABLE_REPLY
}

export interface ItemPricingRow {
  productId: number
  name: string
  qty: string
  netKwd: string
  unitPriceKwd: string | null
  unitCostKwd?: string | null
  categoryId: number | null
  brandId?: string | null
}

export interface ItemPricingRead {
  rows: ItemPricingRow[]
  domain: unknown[]
  groupby: ['product_id']
  chunks: number
  configIds: number[]
}

export interface PosCategoryRecord {
  id: number
  name: string
  parentId: number | null
}

interface RegistryBrand {
  id: string
  en?: string
  ar?: string
  posRoot?: string | null
}

interface RegistryRegister {
  location?: string
}

function registryBrands(): RegistryBrand[] {
  const brands = (posRegistry as { brands?: RegistryBrand[] }).brands
  return Array.isArray(brands) ? brands : []
}

function registryRegisters(): Record<string, RegistryRegister> {
  return (posRegistry as { registers?: Record<string, RegistryRegister> }).registers ?? {}
}

export function posRootForBrand(brandId: string | null): string | null {
  if (!brandId) return null
  const root = registryBrands().find((brand) => brand.id === brandId)?.posRoot
  return typeof root === 'string' && root.trim() ? root.trim() : null
}

export function brandLabel(brandId: string | null): { en: string; ar: string } | null {
  if (!brandId) return null
  const brand = registryBrands().find((item) => item.id === brandId)
  if (!brand) return null
  return { en: brand.en ?? brandId, ar: brand.ar ?? brand.en ?? brandId }
}

/**
 * Register ids for an item read. A branch is matched by its registry location id.
 * Names are never consulted. Excluded pos.config ids stay out. Qurain 24 and 36
 * are added by id for a company read and for the Qurain delivery location.
 */
export function itemPricingRegisterIds(branchLocation: string | null): number[] {
  const ids = new Set<number>()
  for (const [rawId, meta] of Object.entries(registryRegisters())) {
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0 || isExcludedRecordId('pos_config', id)) continue
    if (branchLocation && meta.location !== branchLocation) continue
    ids.add(id)
  }
  const includeQurain = branchLocation == null || branchLocation === 'qurain-delivery'
  if (includeQurain) {
    for (const id of ITEM_PRICING_QURAIN_POS_CONFIG_IDS) {
      if (!isExcludedRecordId('pos_config', id)) ids.add(id)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

export function categoryIdsForPosRoot(
  categories: readonly PosCategoryRecord[],
  posRoot: string,
): number[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const excluded = (category: PosCategoryRecord | undefined): boolean => {
    if (!category) return false
    if (isExcludedRecordId('pos_category', category.id)) return true
    return isExcludedOdooEntity(category.name)
  }
  const rootOf = (id: number): PosCategoryRecord | null => {
    let current = byId.get(id)
    let guard = 0
    while (current?.parentId != null && guard < 12) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
      guard += 1
    }
    return current ?? null
  }
  const wanted = posRoot.trim().toLowerCase()
  const ids: number[] = []
  for (const category of categories) {
    if (excluded(category)) continue
    const root = rootOf(category.id)
    if (!root || excluded(root)) continue
    if (root.name.trim().toLowerCase() !== wanted) continue
    ids.push(category.id)
  }
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function nonExcludedCategoryIds(categories: readonly PosCategoryRecord[]): number[] {
  return categories
    .filter((category) => category.id !== EXCLUDED_POS_CATEGORY_ID)
    .filter((category) => !isExcludedRecordId('pos_category', category.id))
    .filter((category) => !isExcludedOdooEntity(category.name))
    .map((category) => category.id)
    .sort((a, b) => a - b)
}

export function categoryBrandByIdMap(
  categories: readonly PosCategoryRecord[],
): Map<number, CanonicalFeryalBrandId> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const excluded = (category: PosCategoryRecord | undefined): boolean => {
    if (!category) return false
    if (category.id === EXCLUDED_POS_CATEGORY_ID) return true
    if (isExcludedRecordId('pos_category', category.id)) return true
    return isExcludedOdooEntity(category.name)
  }
  const rootOf = (id: number): PosCategoryRecord | null => {
    let current = byId.get(id)
    let guard = 0
    while (current?.parentId != null && guard < 12) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
      guard += 1
    }
    return current ?? null
  }
  const result = new Map<number, CanonicalFeryalBrandId>()
  for (const category of categories) {
    if (excluded(category)) continue
    const root = rootOf(category.id)
    if (!root || excluded(root)) continue
    const resolved = brandIdForPosRoot(root.name) ?? resolveCanonicalBrandId(root.name)
    if (resolved) {
      result.set(category.id, resolved)
    }
  }
  return result
}

function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Inclusive Kuwait dates, each window at most `maxDays`, covering the range once. */
export function chunkInclusiveIsoDates(
  fromIso: string,
  toIso: string,
  maxDays = ITEM_PRICING_CHUNK_DAYS,
): Array<{ from: string; to: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso) || toIso < fromIso) {
    return []
  }
  const span = Math.max(1, maxDays)
  const chunks: Array<{ from: string; to: string }> = []
  let cursor = fromIso
  while (cursor <= toIso) {
    const end = shiftIso(cursor, span - 1)
    const to = end < toIso ? end : toIso
    chunks.push({ from: cursor, to })
    if (to === toIso) break
    cursor = shiftIso(to, 1)
  }
  return chunks
}

/**
 * `pos.order.config_id` is not stored. Lines are filtered through the session, and config is not a group.
 */
export function buildItemLineDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  configIds: readonly number[]
  categoryIds: readonly number[] | null
}): unknown[] {
  const domain: unknown[] = [
    ['order_id.date_order', '>=', input.fromUtc],
    ['order_id.date_order', '<', input.toExclusiveUtc],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
    ['order_id.session_id.config_id', 'in', [...input.configIds]],
    ['product_id.pos_categ_id', '!=', EXCLUDED_POS_CATEGORY_ID],
  ]
  if (input.categoryIds && input.categoryIds.length > 0) {
    domain.push(['product_id.pos_categ_id', 'in', [...input.categoryIds]])
  }
  return domain
}

export function revenueDeltaKwd(qty: string, currentPrice: string, proposedPrice: string): string | null {
  const quantity = Decimal.parse(qty)
  const current = Decimal.parse(currentPrice)
  const proposed = Decimal.parse(proposedPrice)
  if (!quantity || !current || !proposed || quantity.sign() === 0) return null
  return quantity.mul(proposed.sub(current)).roundHalfUp(3).canonical()
}

export function unitPriceKwd(netKwd: string, qty: string): string | null {
  const net = Decimal.parse(netKwd)
  const quantity = Decimal.parse(qty)
  if (!net || !quantity || quantity.sign() === 0) return null
  return net.div(quantity, 3)?.canonical() ?? null
}

function canonicalAmount(raw: string): string | null {
  const parsed = Decimal.parse(raw.replace(/,/g, ''))
  return parsed ? parsed.canonical() : null
}

export interface ProposedPrice {
  label: string
  amount: string
}

const ARABIC_DISH_TOKEN_DICTIONARY: Readonly<Record<string, string>> = {
  // Noodles / Pasta
  نودلز: 'noodles',
  نودل: 'noodles',
  معكرونه: 'noodles',
  مكرونه: 'noodles',
  // Chicken
  دجاج: 'chicken',
  دياي: 'chicken',
  جكن: 'chicken',
  تشيكن: 'chicken',
  تشكن: 'chicken',
  فراخ: 'chicken',
  // Beef
  لحم: 'beef',
  لحمه: 'beef',
  بقري: 'beef',
  بيف: 'beef',
  // Shrimp
  روبيان: 'shrimp',
  ربيان: 'shrimp',
  شرمب: 'shrimp',
  شريمب: 'shrimp',
  جمبري: 'shrimp',
  // Fish / Fillet
  سمك: 'fish',
  فيليه: 'fish',
  // Rice
  رز: 'rice',
  ارز: 'rice',
  عيش: 'rice',
  رايس: 'rice',
  // Burger / Wrap / Fries
  برجر: 'burger',
  بيرجر: 'burger',
  برغر: 'burger',
  بيرغر: 'burger',
  ساندوتش: 'wrap',
  ساندويش: 'wrap',
  ساندويتش: 'wrap',
  راب: 'wrap',
  بطاط: 'fries',
  بطاطس: 'fries',
  فرايز: 'fries',
  // Cheese / Flavor / Cooking prep
  جبن: 'cheese',
  جبنه: 'cheese',
  تشيز: 'cheese',
  حار: 'spicy',
  حاره: 'spicy',
  سبايسي: 'spicy',
  مشوي: 'grilled',
  مشويه: 'grilled',
  كرسبي: 'crispy',
  مقرمش: 'crispy',
  مقرمشه: 'crispy',
  مقلي: 'fried',
  مقليه: 'fried',
  // Karak / Chapati / Combo / Sizes
  كرك: 'karak',
  شباتي: 'chapati',
  جباتي: 'chapati',
  وجبه: 'combo',
  وجبات: 'combo',
  كومبو: 'combo',
  عائلي: 'family',
  عائليه: 'family',
  صغير: 'small',
  صغيره: 'small',
  وسط: 'medium',
  كبير: 'large',
  كبيره: 'large',
  // Common Venture Foods menu items
  سبرينج: 'spring',
  سبرنج: 'spring',
  رول: 'roll',
  شاورما: 'shawarma',
  خضار: 'veg',
  خضروات: 'veg',
  نباتي: 'veg',
  مشروم: 'mushroom',
  فطر: 'mushroom',
  دمبلنغ: 'dumplings',
  دامبلنج: 'dumplings',
  داينامايت: 'dynamite',
  ديناميت: 'dynamite',
}

const ENGLISH_DISH_SYNONYM_MAP: Readonly<Record<string, string>> = {
  noodle: 'noodles',
  noodles: 'noodles',
  chicken: 'chicken',
  chickens: 'chicken',
  chk: 'chicken',
  beef: 'beef',
  beefs: 'beef',
  shrimp: 'shrimp',
  shrimps: 'shrimp',
  prawn: 'shrimp',
  prawns: 'shrimp',
  fish: 'fish',
  fishes: 'fish',
  rice: 'rice',
  burger: 'burger',
  burgers: 'burger',
  wrap: 'wrap',
  wraps: 'wrap',
  sandwich: 'wrap',
  sandwiches: 'wrap',
  fries: 'fries',
  cheese: 'cheese',
  spicy: 'spicy',
  grilled: 'grilled',
  grill: 'grilled',
  crispy: 'crispy',
  crisp: 'crispy',
  karak: 'karak',
  chapati: 'chapati',
  chapatis: 'chapati',
  combo: 'combo',
  combos: 'combo',
  family: 'family',
  small: 'small',
  medium: 'medium',
  large: 'large',
  vegetable: 'veg',
  vegetables: 'veg',
  veggie: 'veg',
  veggies: 'veg',
  vegetarian: 'veg',
  vege: 'veg',
}

const DISH_STOPWORDS = new Set([
  'and',
  'with',
  'in',
  'the',
  'of',
  'a',
  'an',
  'why',
  'مع',
  'في',
  'من',
  'على',
  'علي',
  'الى',
  'عن',
  'ليش',
  'وليش',
  'لماذا',
  'ولماذا',
  'ليه',
  'وليه',
  'شو',
  'وشو',
  'شنو',
  'وشنو',
  'وش',
  'كيف',
  'وكيف',
  'شلون',
  'وشلون',
  'هل',
  'وهل',
])

const GENERIC_NON_DISH_TARGETS = new Set([
  'منيو',
  'المنيو',
  'قائمه',
  'القائمه',
  'اصناف',
  'الاصناف',
  'اطباق',
  'الاطباق',
  'منتجات',
  'المنتجات',
  'كل',
  'جميع',
  'كل الاصناف',
  'جميع الاصناف',
  'اصناف المنيو',
  'العلامه',
  'علامه',
  'الشركه',
  'الفرع',
  'فرع',
  'تشاينا جاردن',
  'تشاينا غاردن',
  'شينا جاردن',
  'فرانكس',
  'طحينه',
  'شاورما طحينه',
  'فارم براون',
  'ذا نودل بار',
  'نودل بار',
  'كافيتيريا كرك',
  'كرك كافيتيريا',
  'كرك كافتيريا',
  'menu',
  'items',
  'menu items',
  'all items',
  'all skus',
  'skus',
  'products',
  'china garden',
  'franks',
  'tahina',
  'farm brown',
  'the noodle bar',
  'noodle bar',
  'karak cafeteria',
])

const PORTFOLIO_STRATEGY_RE =
  /\b(?:pareto|abc\b|tier[- ]?a\b|elasticity|stress[- ]?test|scenarios?|simulator|simulation|price\s+sheet|menu\s+engineering|playbook|cfo)\b|(?:باريتو|تصنيف\s*abc|تحليل\s*abc|فئات\s*abc|هندسه\s*(?:المنيو|القائمه|الاصناف)|هندسة\s*(?:المنيو|القائمة|الأصناف)|مرونه|مرونة|سيناريو|سيناريوهات|محاكاه|محاكاة|جدول\s*(?:الاسعار|الأسعار|تسعير)|استراتيجيه\s*التسعير|استراتيجية\s*التسعير|خطه\s*تسعير|خطة\s*تسعير|رفع\s*(?:اسعار|أسعار)\s*(?:المنيو|الاصناف|الأصناف|القائمه|القائمة)|تعديل\s*(?:اسعار|أسعار))/iu

function normalizeArabicDishText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function translateDishToken(rawToken: string): string {
  const norm = normalizeArabicDishText(rawToken).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  if (!norm) return ''

  const enMapped = ENGLISH_DISH_SYNONYM_MAP[norm]
  if (enMapped) return enMapped

  const directAr = ARABIC_DISH_TOKEN_DICTIONARY[norm]
  if (directAr) return directAr

  if (norm.startsWith('ال') && norm.length > 3) {
    const bare = norm.slice(2)
    return ARABIC_DISH_TOKEN_DICTIONARY[bare] ?? bare
  }

  for (const longClitic of ['بال', 'وال', 'فال', 'كال']) {
    if (norm.startsWith(longClitic) && norm.length > longClitic.length + 1) {
      const bare = norm.slice(longClitic.length)
      return ARABIC_DISH_TOKEN_DICTIONARY[bare] ?? bare
    }
  }

  if (norm.startsWith('لل') && norm.length > 3) {
    const keepSecondLam = norm.slice(1)
    if (ARABIC_DISH_TOKEN_DICTIONARY[keepSecondLam]) {
      return ARABIC_DISH_TOKEN_DICTIONARY[keepSecondLam]
    }
    const dropBothLams = norm.slice(2)
    return ARABIC_DISH_TOKEN_DICTIONARY[dropBothLams] ?? dropBothLams
  }

  for (const shortClitic of ['ل', 'ب', 'و']) {
    if (norm.startsWith(shortClitic) && norm.length > 3) {
      const bare = norm.slice(1)
      if (ARABIC_DISH_TOKEN_DICTIONARY[bare]) {
        return ARABIC_DISH_TOKEN_DICTIONARY[bare]
      }
      if (bare.startsWith('ال') && bare.length > 3) {
        const bareNoAl = bare.slice(2)
        if (ARABIC_DISH_TOKEN_DICTIONARY[bareNoAl]) {
          return ARABIC_DISH_TOKEN_DICTIONARY[bareNoAl]
        }
      }
    }
  }

  return norm
}

export function stripDishInterrogativeTail(rawPhrase: string): string {
  return rawPhrase
    .replace(/[؟?،,!؛"«»]+/g, ' ')
    .replace(
      /\s+(?:وليش|ليش|ولماذا|لماذا|وليه|ليه|وشنو\s+السبب|شنو\s+السبب|وشو\s+السبب|شو\s+السبب|وما\s+هو\s+السبب|وما\s+السبب|ما\s+السبب|وكيف|وشلون|وهل|علشان\s+ايه|عشان\s+ايه|عشان\s+شنو|عشان\s+شو|بسبب\s+شنو|بسبب\s+شو)(?=\s|$).*$/iu,
      '',
    )
    .replace(/\s+(?:and\s+why|why\s+is\s+that|why)(?=\s|$).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTrailingScopeClause(rawPhrase: string): string {
  return stripDishInterrogativeTail(
    rawPhrase
      .replace(
        /\s+(?:في|لدى|لدي|عند|بفرع|فرع|لعلامه|لعلامة|بعلامه|بعلامة|علامه|علامة|لبراند|براند|خلال|لهذا|هذا|هذه|الشهر|الاسبوع|الأسبوع|السنه|السنة|العام|اليوم|امس|أمس|اخر\s+\d+|آخر\s+\d+|وما|وكم|ومقارن|وليش|ليش|ولماذا|لماذا|وليه|ليه)(?=[\s؟?.,!؛:]|$).*$/iu,
        '',
      )
      .replace(
        /\s+(?:in|at|for|from|during|this|last)\s+(?:china\s+garden|frank'?s?|tahina|farm\s+brown|the\s+noodle\s+bar|noodle\s+bar|karak\s+cafeteria|rice|360\s+mall|avenues|salmiya|al[- ]?kout|ardiya|promenade|assima|month|week|year|today|yesterday|odoo)\b.*$/i,
        '',
      )
      .trim(),
  )
}

export function canonicalizeDishLabel(rawLabel: string): { text: string; tokens: string[] } {
  const stripped = stripTrailingScopeClause(stripLeadingCode(rawLabel))
  const normalized = normalizeSkuMenuLabel(stripped)
  const fallback =
    normalized ||
    normalizeArabicDishText(stripped)
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  if (!fallback) return { text: '', tokens: [] }

  const rawWords = fallback.split(/\s+/).filter(Boolean)
  const translated: string[] = []
  const seen = new Set<string>()
  for (const word of rawWords) {
    if (DISH_STOPWORDS.has(word)) continue
    const mapped = translateDishToken(word)
    if (!mapped || DISH_STOPWORDS.has(mapped) || seen.has(mapped)) continue
    seen.add(mapped)
    translated.push(mapped)
  }
  return {
    text: translated.join(' '),
    tokens: translated,
  }
}

function extractInlineSkuCodeFromText(raw: string): string | null {
  const direct = extractExplicitSkuCode(raw)
  if (direct) return direct
  const inlineBracket = raw.match(
    /\[([A-Za-z0-9._\s-]*\d[A-Za-z0-9._\s-]*|(?:RI)?(?:CG|KC|FR|TH|FB|TNB)[A-Za-z0-9._-]*)\]/i,
  )
  if (inlineBracket?.[1]) {
    const cleaned = inlineBracket[1].replace(/[^A-Za-z0-9]+/g, '').toUpperCase()
    if (cleaned.length >= 2) return cleaned
  }
  const bareSkuToken = raw.match(/\b(RI[A-Za-z]*\d[A-Za-z0-9_-]*)\b/i)
  if (bareSkuToken?.[1]) {
    return bareSkuToken[1].replace(/[^A-Za-z0-9]+/g, '').toUpperCase()
  }
  return null
}

function looksLikeNaturalPricingQuestion(text: string): boolean {
  const norm = normalizeArabicDishText(text)
  return /(?:(?:ال)?سعر\s+(?:ال)?مقترح|(?:ال)?اسعار\s+(?:ال)?مقترحه|تسعير|كم\s+سعر|ما\s+سعر|ما\s+هو\s+سعر|شنو\s+سعر|شو\s+سعر|وش\s+سعر|لصنف|لطبق|لوجبه|\b(?:suggested|recommended|proposed)\s+prices?\b|\bwhat\s+is\s+the\s+(?:suggested\s+|recommended\s+)?price\b|\bwhat[- ]if\b|[؟?])/iu.test(
    norm,
  )
}

export function extractTargetDishFromQuestion(question: string): string | null {
  const trimmed = (question ?? '').trim()
  if (!trimmed) return null
  if (parseProposedPrices(trimmed).length > 0) return null

  const inlineCode = extractInlineSkuCodeFromText(trimmed)
  const cleanedPunct = trimmed
    .replace(/[؟?،,!؛"«»]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const norm = normalizeArabicDishText(cleanedPunct)

  let candidate: string | null = null
  let precededByExplicitItemNoun = false

  const arItemNounMatch = norm.match(
    /(?:^|\s)(?:ل|ب)?(?:ال)?(?:صنف|طبق|ايتم|منتج)\s+(.+)$/u,
  )
  if (arItemNounMatch?.[1]) {
    candidate = arItemNounMatch[1].trim()
    precededByExplicitItemNoun = true
  }

  if (!candidate) {
    const arPriceIntroMatch = norm.match(
      /(?:(?:ال)?سعر\s+(?:ال)?مقترح|(?:ال)?اسعار\s+(?:ال)?مقترحه|تسعير|كم\s+سعر|ما\s+سعر|ما\s+هو\s+سعر|شنو\s+سعر|شو\s+سعر|وش\s+سعر)\s+(?:(?:لـ|للـ|عشان|حق|على|علي)\s*)?(.+)$/u,
    )
    if (arPriceIntroMatch?.[1]) {
      candidate = arPriceIntroMatch[1]
        .replace(/^(?:(?:ل|ب)?(?:ال)?(?:صنف|طبق|ايتم|منتج)\s+)/u, () => {
          precededByExplicitItemNoun = true
          return ''
        })
        .trim()
    }
  }

  if (!candidate) {
    const enMatch = cleanedPunct.match(
      /\b(?:(?:suggested|recommended|proposed)\s+prices?|pricing|what\s+is\s+the\s+price)\s+(?:for|of|on)\s+(?:(?:item|dish|sku|product)\s+)?(.+)$/i,
    )
    if (enMatch?.[1]) {
      candidate = enMatch[1].trim()
      if (/\b(?:item|dish|sku)\b/i.test(cleanedPunct)) {
        precededByExplicitItemNoun = true
      }
    }
  }

  if (!candidate && inlineCode) {
    return `[${inlineCode}]`
  }

  if (!candidate) return null

  const strippedScope = stripTrailingScopeClause(candidate)
    .replace(/^[لـ\s]+(?=\[|[A-Za-z])/u, '')
    .replace(/\.+$/, '')
    .trim()

  if (!strippedScope || strippedScope.length < 2) {
    return inlineCode ? `[${inlineCode}]` : null
  }

  const checkKey = normalizeArabicDishText(stripLeadingCode(strippedScope))
  if (!precededByExplicitItemNoun && GENERIC_NON_DISH_TARGETS.has(checkKey)) {
    return inlineCode ? `[${inlineCode}]` : null
  }
  if (
    precededByExplicitItemNoun &&
    (checkKey === 'ما' || checkKey === 'معين' || checkKey === 'محدد' || checkKey === 'منيو' || checkKey === 'المنيو')
  ) {
    return null
  }

  if (inlineCode && !strippedScope.toUpperCase().includes(inlineCode)) {
    return `[${inlineCode}] ${strippedScope}`
  }
  return strippedScope
}

export function asksSuggestedPriceQuestion(question: string): boolean {
  if (!question || parseProposedPrices(question).length > 0) return false
  const norm = normalizeArabicDishText(question)
  return /(?:(?:ال)?سعر\s*(?:ال)?مقترح|(?:ال)?اسعار\s*(?:ال)?مقترحه|اقترح(?:ي)?\s+سعر|كم\s+نقترح\s+سعر|\b(?:suggested|recommended)\s+prices?\b)/iu.test(
    norm,
  )
}

export function isSpecificItemPricingQuestion(question: string): boolean {
  const trimmed = (question ?? '').trim()
  if (!trimmed) return false
  if (parseProposedPrices(trimmed).length > 0) return true
  if (extractInlineSkuCodeFromText(trimmed) !== null) return true
  const hasPortfolioStrategy = PORTFOLIO_STRATEGY_RE.test(trimmed)
  if (hasPortfolioStrategy) return false
  if (extractTargetDishFromQuestion(trimmed) !== null) return true
  const norm = normalizeArabicDishText(trimmed)
  return /(?:^|\s)(?:ال)?سعر\s*(?:ال)?مقترح(?=$|[\s؟?.,!؛:])/u.test(norm) || /\b(?:suggested|recommended)\s+price\b/i.test(norm)
}

export function parseProposedPrices(question: string): ProposedPrice[] {
  const found: ProposedPrice[] = []
  const seen = new Set<string>()
  const push = (label: string, raw: string) => {
    const amount = canonicalAmount(raw)
    const name = stripTrailingScopeClause(label.replace(/\s+/g, ' ').trim())
    if (!amount || name.length < 2) return
    if (/\[[^\]]*$/.test(name)) return
    const key = `${name.toLowerCase()}|${amount}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ label: name, amount })
  }
  const patterns = [
    /proposed price for\s+([^:\n]+?)\s*[:=]\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
    /what[- ]if\s+([^0-9\n]+?)\s+(?:is|at|becomes|to)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
    /(?:ال)?سعر\s+(?:ال)?مقترح(?:\s+(?:لـ?\s*(?:صنف|الصنف|طبق|الطبق)|لل(?:صنف|طبق)|لـ?|للـ?))?\s*([^:\n]+?)\s*[:=]\s*([0-9][0-9,]*(?:\.[0-9]+)?)/giu,
    /(?:ال)?سعر\s+(?:ال)?مقترح(?:\s+(?:لـ?\s*(?:صنف|الصنف|طبق|الطبق)|لل(?:صنف|طبق)|لـ?|للـ?))?\s*([^0-9:\n]+?)\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:د\.?\s*ك|دينار|kwd|kd)\b/giu,
  ]
  for (const pattern of patterns) {
    for (const match of question.matchAll(pattern)) {
      push(match[1] ?? '', match[2] ?? '')
    }
  }
  if (/proposed|what[- ]if|سعر/i.test(question)) {
    for (const line of question.split(/\n/)) {
      const match = line.match(/^\s*(.+?)\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:kwd|د\.ك)?\s*$/i)
      if (!match) continue
      if (/proposed|what|سعر|show|menu|odoo|top/i.test(match[1] ?? '')) continue
      push(match[1] ?? '', match[2] ?? '')
    }
  }
  return found
}

function foldName(value: string): string {
  const normalized = normalizeSkuMenuLabel(value)
  if (normalized) return normalized
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function stripLeadingCode(value: string): string {
  return value.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
}

export interface FindMatchingMenuItemsOptions {
  rowBrand?: string | null
  contextBrand?: string | null
  strictSingleVariant?: boolean
}

export function findMatchingMenuItems(
  questionOrLabel: string,
  rows: readonly ItemPricingRow[],
  options?: FindMatchingMenuItemsOptions,
): ItemPricingRow[] {
  const rawInput = (questionOrLabel ?? '').trim()
  if (!rawInput) return []

  const explicitCode = extractInlineSkuCodeFromText(rawInput)
  if (explicitCode) {
    const codeHits = rows.filter((row) => {
      if (!row.name || isExcludedOdooEntity(row.name)) return false
      if (
        !areSkuBrandsCompatible({
          rowBrand: options?.rowBrand,
          sheetItemName: rawInput,
          candidateBrand: row.brandId,
          candidateSkuName: row.name,
          contextBrand: options?.contextBrand,
        })
      ) {
        return false
      }
      return extractExplicitSkuCode(row.name) === explicitCode
    })
    if (codeHits.length > 0) return codeHits
  }

  const dishLabel = looksLikeNaturalPricingQuestion(rawInput)
    ? (extractTargetDishFromQuestion(rawInput) ?? '')
    : stripTrailingScopeClause(stripLeadingCode(rawInput))
  if (!dishLabel) return []

  const wantedCanonical = canonicalizeDishLabel(dishLabel)
  const wantedFolded = foldName(stripLeadingCode(dishLabel))
  if (wantedCanonical.tokens.length === 0 && wantedFolded.length < 3) {
    return []
  }

  const leftFp = extractFlavorProteinQualifiers(wantedCanonical.text || dishLabel)
  const strictSingle = options?.strictSingleVariant === true

  const candidateHits = rows.filter((row) => {
    if (!row.name || isExcludedOdooEntity(row.name)) return false
    if (
      !areSkuBrandsCompatible({
        rowBrand: options?.rowBrand,
        sheetItemName: dishLabel,
        candidateBrand: row.brandId,
        candidateSkuName: row.name,
        contextBrand: options?.contextBrand,
      })
    ) {
      return false
    }
    if (!hasCompatibleSizePackTokens(dishLabel, row.name)) {
      const mealTranslatedToCombo =
        !strictSingle &&
        /(?:^|\s)(?:ال)?وجب[ةه](?=$|\s)/u.test(dishLabel) &&
        /\bcombos?\b/i.test(row.name) &&
        hasCompatibleSizePackTokens(wantedCanonical.text, row.name)
      if (!mealTranslatedToCombo) {
        return false
      }
    }

    const rowCanonical = canonicalizeDishLabel(row.name)
    const rightFp = extractFlavorProteinQualifiers(rowCanonical.text || row.name)
    if (leftFp.proteins.length !== rightFp.proteins.length) return false
    for (let i = 0; i < leftFp.proteins.length; i += 1) {
      if (leftFp.proteins[i] !== rightFp.proteins[i]) return false
    }
    if (strictSingle && leftFp.spicy !== rightFp.spicy) {
      return false
    }
    if (!strictSingle && leftFp.spicy && !rightFp.spicy) {
      return false
    }

    const rowTokenSet = new Set(rowCanonical.tokens)
    const allWantedTokensPresent =
      wantedCanonical.tokens.length > 0 &&
      wantedCanonical.tokens.every((tok) => rowTokenSet.has(tok))
    if (allWantedTokensPresent) {
      return true
    }

    const nameFolded = foldName(stripLeadingCode(row.name))
    const canonicalSubstrMatch =
      wantedCanonical.text.length >= 3 &&
      rowCanonical.text.length >= 3 &&
      (rowCanonical.text.includes(wantedCanonical.text) ||
        wantedCanonical.text.includes(rowCanonical.text))
    const rawSubstrMatch =
      wantedFolded.length >= 3 &&
      nameFolded.length >= 3 &&
      (nameFolded.includes(wantedFolded) || wantedFolded.includes(nameFolded))
    return canonicalSubstrMatch || rawSubstrMatch
  })

  if (!strictSingle && candidateHits.length === 1 && !leftFp.spicy) {
    const sole = candidateHits[0]
    if (sole) {
      const soleFp = extractFlavorProteinQualifiers(canonicalizeDishLabel(sole.name).text || sole.name)
      if (soleFp.spicy) return []
    }
  }

  return candidateHits
}

export function matchProposedPrice(
  proposal: ProposedPrice,
  rows: readonly ItemPricingRow[],
  options?: {
    rowBrand?: string | null
    contextBrand?: string | null
  },
): ItemPricingRow | null {
  const rowBrandId =
    resolveCanonicalBrandId(options?.rowBrand) ??
    inferBrandIdFromSkuName(proposal.label) ??
    resolveCanonicalBrandId(options?.contextBrand)

  const hits = findMatchingMenuItems(proposal.label, rows, {
    rowBrand: options?.rowBrand,
    contextBrand: options?.contextBrand,
    strictSingleVariant: true,
  })
  if (hasCrossBrandAmbiguity(hits, rowBrandId)) return null
  return hits.length === 1 ? hits[0] ?? null : null
}

export function asksMarginOrCogs(question: string): boolean {
  return /(cogs|margin|standard_price|تكلفه|تكلفة|هامش)/i.test(question)
}

function formatGrouped(canonical: string, fractionDigits: number | null): string {
  const negative = canonical.startsWith('-')
  const body = negative ? canonical.slice(1) : canonical
  const [intPart, frac = ''] = body.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction =
    fractionDigits == null ? frac : (frac + '0'.repeat(fractionDigits)).slice(0, fractionDigits)
  const shown = fractionDigits == null ? (frac ? `${grouped}.${frac}` : grouped) : `${grouped}.${fraction}`
  return negative ? `-${shown}` : shown
}

export interface PricedItemLine {
  productId: number
  name: string
  qty: string
  netKwd: string
  unitPriceKwd: string | null
  proposed: string | null
  deltaKwd: string | null
}

export function priceItemRows(question: string, rows: readonly ItemPricingRow[]): PricedItemLine[] {
  const assigned = new Map<number, string>()
  for (const proposal of parseProposedPrices(question)) {
    const hit = matchProposedPrice(proposal, rows)
    if (hit && !assigned.has(hit.productId)) assigned.set(hit.productId, proposal.amount)
  }
  return rows.map((row) => {
    const proposed = assigned.get(row.productId) ?? null
    const delta =
      proposed && row.unitPriceKwd ? revenueDeltaKwd(row.qty, row.unitPriceKwd, proposed) : null
    return {
      productId: row.productId,
      name: row.name,
      qty: row.qty,
      netKwd: row.netKwd,
      unitPriceKwd: row.unitPriceKwd,
      proposed,
      deltaKwd: delta,
    }
  })
}

function pushNumber(target: number[], canonical: string | null): void {
  if (!canonical) return
  const parsed = Number(canonical)
  if (Number.isFinite(parsed)) target.push(parsed)
}

export function buildItemPricingAnswer(input: {
  question: string
  periodLabel: string
  brandNameAr: string | null
  rows: readonly ItemPricingRow[]
}): {
  reply: string
  toolNumbers: number[]
  allowedEntityNames: string[]
  structuredFacts: Record<string, unknown>
} {
  const priced = priceItemRows(input.question, input.rows)
    .slice()
    .sort((a, b) => {
      const left = Decimal.parse(b.netKwd)
      const right = Decimal.parse(a.netKwd)
      if (!left || !right) return 0
      return left.compare(right)
    })
  const toolNumbers: number[] = []
  const allowedEntityNames: string[] = []
  if (input.brandNameAr) allowedEntityNames.push(input.brandNameAr)
  let netSum = Decimal.parse('0') ?? Decimal.fromParts(0n, 0)
  let qtySum = Decimal.parse('0') ?? Decimal.fromParts(0n, 0)
  let deltaSum = Decimal.parse('0') ?? Decimal.fromParts(0n, 0)
  let pricedCount = 0
  for (const row of priced) {
    const net = Decimal.parse(row.netKwd)
    const qty = Decimal.parse(row.qty)
    if (net) netSum = netSum.add(net)
    if (qty) qtySum = qtySum.add(qty)
    if (row.deltaKwd) {
      const delta = Decimal.parse(row.deltaKwd)
      if (delta) {
        deltaSum = deltaSum.add(delta)
        pricedCount += 1
      }
    }
    allowedEntityNames.push(row.name)
  }
  const locale = detectItemPricingLocale(input.question)
  const isArPrompt = locale === 'ar'
  const verifiedActualLabel = isArPrompt ? ODOO_VERIFIED_ACTUAL_LABEL_AR : ODOO_VERIFIED_ACTUALS_LABEL
  const userProposedLabel = isArPrompt ? USER_INPUT_CONFIRMED_LABEL_AR : PROPOSED_USER_INPUT_LABEL

  const listed = priced.slice(0, 12)
  const scope = input.brandNameAr ? `علامة ${input.brandNameAr}` : 'كل العلامات'
  const itemText = listed
    .map((row) => {
      pushNumber(toolNumbers, row.qty)
      pushNumber(toolNumbers, row.netKwd)
      pushNumber(toolNumbers, row.unitPriceKwd)
      const qtyText = formatGrouped(row.qty, null)
      const netText = formatGrouped(row.netKwd, 3)
      const unitText = row.unitPriceKwd ? formatGrouped(row.unitPriceKwd, 3) : '—'
      return `${row.name} (الكمية ${qtyText} — ${verifiedActualLabel} ${netText} د.ك — السعر الحالي ${unitText} د.ك)`
    })
    .join('، ')
  const proposalLines = listed
    .filter((row) => row.proposed && row.deltaKwd)
    .map((row) => {
      pushNumber(toolNumbers, row.proposed)
      pushNumber(toolNumbers, row.deltaKwd)
      return `${row.name}: ${userProposedLabel} ${formatGrouped(row.proposed ?? '0', 3)} د.ك، فرق الإيراد ${formatGrouped(row.deltaKwd ?? '0', 3)} د.ك = الكمية × (المقترح − السعر الحالي)`
    })
  pushNumber(toolNumbers, String(priced.length))
  pushNumber(toolNumbers, netSum.canonical())
  pushNumber(toolNumbers, qtySum.canonical())
  if (pricedCount > 0) pushNumber(toolNumbers, deltaSum.roundHalfUp(3).canonical())
  const totalNet = formatGrouped(netSum.canonical(), 3)
  const totalQty = formatGrouped(qtySum.canonical(), null)
  const countText = formatGrouped(String(priced.length), null)
  const deltaClause =
    pricedCount > 0
      ? isArPrompt
        ? ` مجموع فرق الإيراد للأسعار المقترحة ${formatGrouped(deltaSum.roundHalfUp(3).canonical(), 3)} د.ك، محسوب من كميات أودو الفعلية فقط.`
        : ` مجموع فرق الإيراد للأسعار المقترحة ${formatGrouped(deltaSum.roundHalfUp(3).canonical(), 3)} د.ك، محسوب من كميات Odoo فقط.`
      : ''
  const proposalBlock = proposalLines.length > 0 ? ` ${proposalLines.join(' ')}` : ''
  const cogs = asksMarginOrCogs(input.question)
  if (cogs) toolNumbers.push(225)
  const cogsLine = cogs ? ` ${renderCogsUnavailableReply(locale)}` : ''
  const sourceHeader = isArPrompt
    ? 'وفق سطور طلبات نقاط البيع في أودو (صافي الإيرادات غير شاملة الضريبة)'
    : 'وفق pos.order.line (price_subtotal بدون الضريبة)'
  const reply = [
    `• الرقم: ${sourceHeader} للفترة ${input.periodLabel} (${scope})، ${countText} صنفاً بكمية ${totalQty} وصافي ${totalNet} د.ك. أعلى الأصناف: ${itemText}.${proposalBlock}${deltaClause}`,
    `• السبب من البيانات: الكميات والصافي من ${verifiedActualLabel}. أي سعر كتبه المستخدم موسوم بـ «${userProposedLabel}»، وفرق الإيراد = الكمية × (السعر المقترح − السعر الحالي).`,
    `• الإجراء المحدد: يراجع مدير العلامة الأسعار المقترحة مقابل الكميات المرحلة قبل اعتمادها.${cogsLine}`,
    `• الأثر المتوقع (تقدير): تقدير — فرق الإيراد أعلاه هو أثر السعر على الكمية المرحلة، وليس هامش ربح.`,
  ].join('\n')
  return {
    reply,
    toolNumbers,
    allowedEntityNames,
    structuredFacts: {
      model: 'pos.order.line',
      scope,
      itemCount: priced.length,
      itemQtyTotal: Number(qtySum.canonical()),
      itemNetTotalKwd: Number(netSum.canonical()),
      itemRows: priced.slice(0, 40).map((row) => ({
        productId: row.productId,
        name: row.name,
        qty: Number(row.qty),
        netKwd: Number(row.netKwd),
        unitPriceKwd: row.unitPriceKwd ? Number(row.unitPriceKwd) : null,
      })),
      userInputs: priced
        .filter((row) => row.proposed)
        .map((row) => ({
          label: PROPOSED_USER_INPUT_LABEL,
          productId: row.productId,
          name: row.name,
          amount: row.proposed,
        })),
    },
  }
}

const TWENTY_DEC = Decimal.fromParts(20n, 0)
const HUNDRED_DEC = Decimal.fromParts(100n, 0)
const THIRTY_DEC = Decimal.fromParts(30n, 0)
const ONE_POINT_ZERO_FIVE_DEC = Decimal.parse('1.05') ?? Decimal.fromParts(105n, 2)
const ZERO_POINT_ZERO_FIVE_DEC = Decimal.parse('0.050') ?? Decimal.fromParts(50n, 3)

function roundDecimalToKuwaitFils50(amount: Decimal): Decimal {
  const steps = amount.mul(TWENTY_DEC).roundHalfUp(0)
  return (steps.div(TWENTY_DEC, 3) ?? amount).roundHalfUp(3)
}

export interface DeterministicSuggestedPriceCalculation {
  suggestedPriceKwd: string
  currentUnitPriceKwd: string | null
  unitCostKwd: string
  unitMarginKwd: string
  revenueDeltaKwd: string | null
}

export function computeDeterministicSuggestedPrice(
  row: Pick<ItemPricingRow, 'qty' | 'netKwd' | 'unitPriceKwd' | 'unitCostKwd'>,
): DeterministicSuggestedPriceCalculation | null {
  if (!row.unitCostKwd) return null
  const costDec = Decimal.parse(row.unitCostKwd)
  if (!costDec || costDec.sign() <= 0) return null

  const derivedCurrent = row.unitPriceKwd ?? unitPriceKwd(row.netKwd, row.qty)
  const currentDec = derivedCurrent ? Decimal.parse(derivedCurrent) : null
  const qtyDec = Decimal.parse(row.qty)

  const rawBenchmark = costDec.mul(HUNDRED_DEC).div(THIRTY_DEC, 6) ?? costDec
  let suggestedDec = roundDecimalToKuwaitFils50(rawBenchmark)
  if (suggestedDec.compare(costDec) <= 0) {
    suggestedDec = roundDecimalToKuwaitFils50(costDec.add(ZERO_POINT_ZERO_FIVE_DEC))
  }
  if (currentDec && currentDec.sign() > 0 && suggestedDec.compare(currentDec) <= 0) {
    const step5Pct = roundDecimalToKuwaitFils50(currentDec.mul(ONE_POINT_ZERO_FIVE_DEC))
    suggestedDec =
      step5Pct.compare(currentDec) > 0
        ? step5Pct
        : roundDecimalToKuwaitFils50(currentDec.add(ZERO_POINT_ZERO_FIVE_DEC))
  }

  const unitMarginDec = suggestedDec.sub(costDec).roundHalfUp(3)
  const revenueDeltaDec =
    currentDec && qtyDec && qtyDec.sign() > 0
      ? qtyDec.mul(suggestedDec.sub(currentDec)).roundHalfUp(3)
      : null

  return {
    suggestedPriceKwd: suggestedDec.canonical(),
    currentUnitPriceKwd: currentDec && currentDec.sign() > 0 ? currentDec.canonical() : null,
    unitCostKwd: costDec.canonical(),
    unitMarginKwd: unitMarginDec.canonical(),
    revenueDeltaKwd: revenueDeltaDec ? revenueDeltaDec.canonical() : null,
  }
}

export function buildMultiMatchClarificationAnswer(input: {
  matches: readonly ItemPricingRow[]
  brandNameAr: string | null
}): {
  reply: string
  toolNumbers: number[]
  allowedEntityNames: string[]
  structuredFacts: Record<string, unknown>
  skipFourPartRequirement: true
} {
  const capped = input.matches.slice(0, 8)
  const allowedEntityNames: string[] = []
  if (input.brandNameAr) allowedEntityNames.push(input.brandNameAr)
  for (const row of capped) {
    allowedEntityNames.push(row.name)
  }
  const namesList = capped.map((row) => row.name).join('، ')
  const reply = `يرجى تحديد الصنف المطلوب بدقة من أصناف أودو المطابقة التالية قبل احتساب التسعير: ${namesList}.`

  return {
    reply,
    toolNumbers: [],
    allowedEntityNames,
    skipFourPartRequirement: true,
    structuredFacts: {
      model: 'pos.order.line',
      clarificationRequired: true,
      itemRows: capped.map((row) => ({
        productId: row.productId,
        name: row.name,
        qty: Number(row.qty),
        netKwd: Number(row.netKwd),
        unitPriceKwd: row.unitPriceKwd ? Number(row.unitPriceKwd) : null,
      })),
    },
  }
}

export const SUGGESTED_ITEM_COST_SOURCES = [
  'standard_price',
  'valuation_layer',
  'purchase',
] as const

export type SuggestedItemCostSource = (typeof SUGGESTED_ITEM_COST_SOURCES)[number]

function isAllowedSuggestedCostSource(value: unknown): value is SuggestedItemCostSource {
  return (
    typeof value === 'string' &&
    (SUGGESTED_ITEM_COST_SOURCES as readonly string[]).includes(value)
  )
}

export function buildSuggestedItemPricingAnswer(input: {
  question: string
  periodLabel: string
  brandNameAr: string | null
  matchedRow: ItemPricingRow | null
  costSource?: SuggestedItemCostSource | null
  allRows: readonly ItemPricingRow[]
}): {
  reply: string
  toolNumbers: number[]
  allowedEntityNames: string[]
  structuredFacts: Record<string, unknown>
  skipFourPartRequirement: boolean
} {
  const locale = detectItemPricingLocale(input.question)
  const isArPrompt = locale === 'ar'
  const verifiedActualLabel = isArPrompt ? ODOO_VERIFIED_ACTUAL_LABEL_AR : ODOO_VERIFIED_ACTUALS_LABEL
  const simLabel = isArPrompt ? DETERMINISTIC_SIMULATION_LABEL_AR : DETERMINISTIC_SIMULATION_LABEL
  const scope = input.brandNameAr ? `علامة ${input.brandNameAr}` : 'كل العلامات'

  const allowedEntityNames: string[] = []
  if (input.brandNameAr) allowedEntityNames.push(input.brandNameAr)
  for (const r of input.allRows.slice(0, 40)) {
    allowedEntityNames.push(r.name)
  }

  const fallbackItemRows = input.allRows.slice(0, 40).map((row) => ({
    productId: row.productId,
    name: row.name,
    qty: Number(row.qty),
    netKwd: Number(row.netKwd),
    unitPriceKwd: row.unitPriceKwd ? Number(row.unitPriceKwd) : null,
  }))

  if (!input.matchedRow) {
    return {
      reply: `لم يتم تحديد صنف مطابق بتكلفة موثّقة للفترة ${input.periodLabel} (${scope}). ${MISSING_COST_SUGGESTED_PRICE_PHRASE_AR} لأن تكلفة الصنف غير متاحة في أودو.`,
      toolNumbers: [],
      allowedEntityNames,
      skipFourPartRequirement: true,
      structuredFacts: {
        model: 'pos.order.line',
        scope,
        cogsReadable: false,
        itemRows: fallbackItemRows,
      },
    }
  }

  const matched = input.matchedRow
  if (!allowedEntityNames.includes(matched.name)) {
    allowedEntityNames.push(matched.name)
  }

  const calc = computeDeterministicSuggestedPrice(matched)
  if (!calc) {
    const toolNumbers: number[] = []
    pushNumber(toolNumbers, matched.qty)
    pushNumber(toolNumbers, matched.netKwd)
    pushNumber(toolNumbers, matched.unitPriceKwd)
    const qtyText = formatGrouped(matched.qty, null)
    const netText = formatGrouped(matched.netKwd, 3)
    const currentText = matched.unitPriceKwd ? formatGrouped(matched.unitPriceKwd, 3) : null
    const actualSentence = currentText
      ? `السعر الفعلي الحالي للصنف ${matched.name} هو ${currentText} د.ك (${ODOO_VERIFIED_ACTUAL_LABEL_AR}: الكمية ${qtyText} بصافي ${netText} د.ك).`
      : `الصنف ${matched.name} مسجل بكمية ${qtyText} وصافي ${netText} د.ك (${ODOO_VERIFIED_ACTUAL_LABEL_AR}).`
    const reply = `${actualSentence} ${MISSING_COST_SUGGESTED_PRICE_PHRASE_AR} لأن تكلفة الصنف غير متاحة في أودو.`

    return {
      reply,
      toolNumbers,
      allowedEntityNames,
      skipFourPartRequirement: true,
      structuredFacts: {
        model: 'pos.order.line',
        scope,
        cogsReadable: false,
        itemRows: fallbackItemRows,
      },
    }
  }

  const toolNumbers: number[] = []
  pushNumber(toolNumbers, matched.qty)
  pushNumber(toolNumbers, matched.netKwd)
  pushNumber(toolNumbers, calc.currentUnitPriceKwd)
  pushNumber(toolNumbers, calc.unitCostKwd)
  pushNumber(toolNumbers, calc.suggestedPriceKwd)
  pushNumber(toolNumbers, calc.unitMarginKwd)
  pushNumber(toolNumbers, calc.revenueDeltaKwd)

  const qtyText = formatGrouped(matched.qty, null)
  const netText = formatGrouped(matched.netKwd, 3)
  const suggestedText = formatGrouped(calc.suggestedPriceKwd, 3)
  const costText = formatGrouped(calc.unitCostKwd, 3)
  const marginText = formatGrouped(calc.unitMarginKwd, 3)
  const currentClause = calc.currentUnitPriceKwd
    ? ` مقابل السعر الفعلي الحالي ${formatGrouped(calc.currentUnitPriceKwd, 3)} د.ك`
    : ''
  const safeCostSource = isAllowedSuggestedCostSource(input.costSource) ? input.costSource : null
  const costSourceClause = safeCostSource
    ? ` — التكلفة من أودو (${safeCostSource})`
    : ''
  const deltaSentence = calc.revenueDeltaKwd
    ? `عند ثبات الكمية الفعلية البالغة ${qtyText}، يبلغ فرق الإيراد المحسوب ${formatGrouped(calc.revenueDeltaKwd, 3)} د.ك (${simLabel}: الكمية × (السعر المقترح − السعر الحالي)).`
    : `يعتمد احتساب فرق الإيراد الكلي على الكمية الفعلية المسجلة للصنف ${matched.name} البالغة ${qtyText}.`

  const reply = [
    `• الرقم: السعر المقترح المحسوب برمجياً للصنف ${matched.name} للفترة ${input.periodLabel} (${scope}) هو ${suggestedText} د.ك (${simLabel})${currentClause} استناداً إلى التكلفة الموثّقة ${costText} د.ك${costSourceClause} (${verifiedActualLabel}: الكمية ${qtyText} بصافي ${netText} د.ك).`,
    `• السبب من البيانات: بناءً على التكلفة الموثّقة ${costText} د.ك (${verifiedActualLabel})، يحقق السعر المقترح ${suggestedText} د.ك فائضاً فوق التكلفة للوحدة قدره ${marginText} د.ك.`,
    `• الإجراء المحدد: يراجع مدير العلامة اعتماد السعر المقترح ${suggestedText} د.ك للصنف ${matched.name} على شاشات نقاط البيع مع متابعة استقرار الكمية المباعة البالغة ${qtyText}.`,
    `• الأثر المتوقع (تقدير): تقدير — ${deltaSentence}`,
  ].join('\n')

  return {
    reply,
    toolNumbers,
    allowedEntityNames,
    skipFourPartRequirement: false,
    structuredFacts: {
      model: 'pos.order.line',
      scope,
      cogsReadable: true,
      ...(safeCostSource ? { costSource: safeCostSource } : {}),
      itemRows: fallbackItemRows,
      suggestedItemPricing: {
        productId: matched.productId,
        name: matched.name,
        qty: Number(matched.qty),
        netKwd: Number(matched.netKwd),
        currentUnitPriceKwd: calc.currentUnitPriceKwd ? Number(calc.currentUnitPriceKwd) : null,
        unitCostKwd: Number(calc.unitCostKwd),
        ...(safeCostSource ? { costSource: safeCostSource } : {}),
        suggestedPriceKwd: Number(calc.suggestedPriceKwd),
        unitMarginKwd: Number(calc.unitMarginKwd),
        revenueDeltaKwd: calc.revenueDeltaKwd ? Number(calc.revenueDeltaKwd) : null,
      },
    },
  }
}

interface OdooCall {
  model: string
  method: string
  args: unknown[]
  kwargs: Record<string, unknown>
  timeoutMs: number
}

export type ItemPricingExecute = (call: OdooCall) => Promise<unknown>

/** Item pricing never writes and never reads standard_price. */
export function assertItemPricingReadOnly(call: Pick<OdooCall, 'method' | 'args' | 'kwargs'>): void {
  if (!READ_ONLY_METHODS.has(call.method)) {
    logger.warn('feryal.item_pricing', { code: 'write_refused' })
    throw new Error('READ_ONLY')
  }
  const fields = JSON.stringify(call.args) + JSON.stringify(call.kwargs)
  if (fields.includes('standard_price')) {
    logger.warn('feryal.item_pricing', { code: 'standard_price_refused' })
    throw new Error('STANDARD_PRICE_UNAVAILABLE')
  }
}

async function executeReadOnly(execute: ItemPricingExecute, call: OdooCall): Promise<unknown> {
  assertItemPricingReadOnly(call)
  return execute(call)
}

interface RawGroup {
  product_id?: [number, string] | false
  price_subtotal?: number
  qty?: number
}

function isChunkTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: string }).name ?? ''
  const message = (error as { message?: string }).message ?? ''
  return name === 'AbortError' || name === 'TimeoutError' || /timeout|aborted/i.test(message)
}

function asCategories(payload: unknown): PosCategoryRecord[] {
  if (!Array.isArray(payload)) return []
  const rows: PosCategoryRecord[] = []
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as { id?: unknown; name?: unknown; parent_id?: unknown }
    if (typeof record.id !== 'number') continue
    const parent = Array.isArray(record.parent_id) ? record.parent_id[0] : null
    rows.push({
      id: record.id,
      name: typeof record.name === 'string' ? record.name : '',
      parentId: typeof parent === 'number' ? parent : null,
    })
  }
  return rows
}

function addCanonical(left: string, right: number | undefined): string {
  const base = Decimal.parse(left) ?? Decimal.fromParts(0n, 0)
  const extra = Decimal.parse(String(right ?? 0)) ?? Decimal.fromParts(0n, 0)
  return base.add(extra).canonical()
}

async function readGroups(
  execute: ItemPricingExecute,
  fromIso: string,
  toIso: string,
  configIds: readonly number[],
  categoryIds: readonly number[] | null,
  depth: number,
): Promise<RawGroup[] | null> {
  const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
  const domain = buildItemLineDomain({
    fromUtc: bounds.fromUtc,
    toExclusiveUtc: bounds.toExclusiveUtc,
    configIds,
    categoryIds,
  })
  try {
    const payload = await executeReadOnly(execute, {
      model: 'pos.order.line',
      method: 'read_group',
      args: [domain, ['price_subtotal:sum', 'qty:sum'], ['product_id']],
      kwargs: { lazy: false, context: { tz: 'Asia/Kuwait' } },
      timeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
    })
    return Array.isArray(payload) ? (payload as RawGroup[]) : []
  } catch (error) {
    if (!isChunkTimeout(error) || depth >= 2 || fromIso === toIso) {
      logger.warn('feryal.item_pricing', { code: depth >= 2 ? 'chunk_failed' : 'read_failed' })
      return null
    }
    const chunks = chunkInclusiveIsoDates(fromIso, toIso, Math.max(1, Math.ceil(daySpan(fromIso, toIso) / 2)))
    if (chunks.length < 2) return null
    const parts: RawGroup[] = []
    for (const chunk of chunks) {
      const rows = await readGroups(execute, chunk.from, chunk.to, configIds, categoryIds, depth + 1)
      if (!rows) return null
      parts.push(...rows)
    }
    return parts
  }
}

function daySpan(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map((part) => Number(part))
  const [ty, tm, td] = toIso.split('-').map((part) => Number(part))
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)
  return Math.round(ms / 86_400_000) + 1
}

export async function readItemPricingLines(input: {
  fromIso: string
  toIso: string
  branchLocation: string | null
  posRoot: string | null
  execute: ItemPricingExecute
}): Promise<ItemPricingRead | null> {
  const configIds = itemPricingRegisterIds(input.branchLocation)
  if (configIds.length === 0) return null
  let categories: PosCategoryRecord[] = []
  try {
    const payload = await executeReadOnly(input.execute, {
      model: 'pos.category',
      method: 'search_read',
      args: [[]],
      kwargs: { fields: ['id', 'name', 'parent_id'], limit: 500 },
      timeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
    })
    categories = asCategories(payload)
  } catch (error) {
    if (!isChunkTimeout(error)) logger.warn('feryal.item_pricing', { code: 'category_read_failed' })
    return null
  }
  const categoryIds = input.posRoot
    ? categoryIdsForPosRoot(categories, input.posRoot)
    : nonExcludedCategoryIds(categories)
  if (input.posRoot && categoryIds.length === 0) {
    return { rows: [], domain: [], groupby: ['product_id'], chunks: 0, configIds }
  }
  const chunks = chunkInclusiveIsoDates(input.fromIso, input.toIso)
  const merged = new Map<number, { name: string; qty: string; net: string }>()
  for (const chunk of chunks) {
    const groups = await readGroups(input.execute, chunk.from, chunk.to, configIds, categoryIds, 0)
    if (!groups) return null
    for (const group of groups) {
      if (!Array.isArray(group.product_id) || typeof group.product_id[0] !== 'number') continue
      const productId = group.product_id[0]
      const name = String(group.product_id[1] ?? '').trim()
      if (!name || isExcludedOdooEntity(name)) continue
      const prev = merged.get(productId) ?? { name, qty: '0', net: '0' }
      prev.qty = addCanonical(prev.qty, group.qty)
      prev.net = addCanonical(prev.net, group.price_subtotal)
      merged.set(productId, prev)
    }
  }
  const scopedBrandId = input.posRoot ? brandIdForPosRoot(input.posRoot) : null
  const productCategoryById = new Map<number, number>()
  const productBrandById = new Map<number, CanonicalFeryalBrandId>()

  if (!input.posRoot && merged.size > 0) {
    const catBrandMap = categoryBrandByIdMap(categories)
    const productIds = [...merged.keys()]
    try {
      const prodPayload = await executeReadOnly(input.execute, {
        model: 'product.product',
        method: 'search_read',
        args: [[['id', 'in', productIds]]],
        kwargs: { fields: ['id', 'pos_categ_id'], limit: productIds.length },
        timeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
      })
      if (Array.isArray(prodPayload)) {
        for (const entry of prodPayload) {
          if (!entry || typeof entry !== 'object') continue
          const rec = entry as { id?: unknown; pos_categ_id?: unknown }
          if (typeof rec.id !== 'number') continue
          let catId: number | null = null
          let catName = ''
          if (Array.isArray(rec.pos_categ_id) && typeof rec.pos_categ_id[0] === 'number') {
            catId = rec.pos_categ_id[0]
            catName = typeof rec.pos_categ_id[1] === 'string' ? rec.pos_categ_id[1] : ''
          } else if (typeof rec.pos_categ_id === 'number') {
            catId = rec.pos_categ_id
          }
          if (catId == null) continue
          if (
            catId === EXCLUDED_POS_CATEGORY_ID ||
            isExcludedRecordId('pos_category', catId) ||
            (catName && isExcludedOdooEntity(catName))
          ) {
            merged.delete(rec.id)
            continue
          }
          productCategoryById.set(rec.id, catId)
          const resolvedBrand =
            catBrandMap.get(catId) ?? (catName ? resolveCanonicalBrandId(catName) : null)
          if (resolvedBrand) {
            productBrandById.set(rec.id, resolvedBrand)
          }
        }
      }
    } catch {
      logger.warn('feryal.item_pricing', { code: 'product_category_lookup_skipped' })
    }
  }

  const bounds = kuwaitDateBoundsToOdooUtc(input.fromIso, input.toIso)
  const rows: ItemPricingRow[] = [...merged.entries()]
    .map(([productId, row]) => ({
      productId,
      name: row.name,
      qty: row.qty,
      netKwd: row.net,
      unitPriceKwd: unitPriceKwd(row.net, row.qty),
      categoryId: productCategoryById.get(productId) ?? null,
      brandId:
        scopedBrandId ??
        productBrandById.get(productId) ??
        inferBrandIdFromSkuName(row.name) ??
        null,
    }))
    .sort((a, b) => {
      const left = Decimal.parse(b.netKwd)
      const right = Decimal.parse(a.netKwd)
      if (!left || !right) return 0
      return left.compare(right)
    })
  return {
    rows,
    domain: buildItemLineDomain({
      fromUtc: bounds.fromUtc,
      toExclusiveUtc: bounds.toExclusiveUtc,
      configIds,
      categoryIds,
    }),
    groupby: ['product_id'],
    chunks: chunks.length,
    configIds,
  }
}

export async function fetchItemPricingFromOdoo(input: {
  fromIso: string
  toIso: string
  branchLocation: string | null
  posRoot: string | null
}): Promise<ItemPricingRead | null> {
  try {
    const mod = await import('@/lib/odoo-live-connector')
    return await readItemPricingLines({
      ...input,
      execute: (call) => {
        assertItemPricingReadOnly(call)
        return mod.executeOdooKw(call.model, call.method, call.args, call.kwargs, { timeoutMs: call.timeoutMs })
      },
    })
  } catch {
    logger.warn('feryal.item_pricing', { code: 'odoo_unavailable' })
    return null
  }
}
