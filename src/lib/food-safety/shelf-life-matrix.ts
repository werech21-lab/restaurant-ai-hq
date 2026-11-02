/**
 * Venture Foods HACCP & Kuwait Municipality standard shelf-life matrix.
 * Codes aligned to Odoo product.template (PP03* preps, RW01* raw).
 *
 * STRICT brand ownership: each prep SKU has exactly one commercial owner brand.
 * CENTRAL-KITCHEN may appear as a production site flag but NEVER as a filter bypass
 * that leaks Farm Brown / Frank's items into China Garden (or vice versa).
 */

export const STORAGE_MODES = ['freezer', 'chiller', 'line_prep', 'thawed_chiller', 'grill_skewer'] as const
export type StorageMode = (typeof STORAGE_MODES)[number]

export const SHELF_CATEGORIES = [
  'meat_poultry_seafood',
  'dim_sum_dough_noodles',
  'salads_veg_dairy',
  'sauces_dressings',
] as const
export type ShelfCategory = (typeof SHELF_CATEGORIES)[number]

export type BrandScope =
  | 'FARM-BROWN'
  | 'KARAK-CAFETERIA'
  | 'CHINA-GARDEN'
  | 'THE-NOODLE-BAR'
  | 'FRANKS-STEAK'
  | 'SHAWARMA-TAHINA'
  | 'CENTRAL-KITCHEN'
  | 'SHARED'

export type ShelfLifeRule = {
  code: string
  nameEn: string
  nameAr: string
  category: ShelfCategory
  /** Exclusive commercial owner (never CENTRAL-KITCHEN / SHARED for branded preps). */
  ownerBrand: BrandScope
  /** Ownership + optional CK production flag. Filter uses ownerBrand strictly. */
  brands: readonly BrandScope[]
  unitCostMinor: number
  /** Hours by storage mode. Missing mode = not permitted. */
  hours: Partial<Record<StorageMode, number>>
  /** Early FEFO warning window in hours (default 6). */
  fefoWarnHours: number
  keepTempEn: string
  keepTempAr: string
  notesEn?: string
  notesAr?: string
}

const FEFO_DEFAULT = 6

const OPERATING_BRANDS: readonly BrandScope[] = [
  'FARM-BROWN',
  'KARAK-CAFETERIA',
  'CHINA-GARDEN',
  'THE-NOODLE-BAR',
  'FRANKS-STEAK',
  'SHAWARMA-TAHINA',
]

function rule(
  code: string,
  nameEn: string,
  nameAr: string,
  category: ShelfCategory,
  ownerBrand: BrandScope,
  hours: Partial<Record<StorageMode, number>>,
  keepTempEn: string,
  keepTempAr: string,
  unitCostMinor: number,
  extra?: Partial<Pick<ShelfLifeRule, 'fefoWarnHours' | 'notesEn' | 'notesAr'>> & {
    /** When true, CK may produce this SKU (does NOT grant other brands ownership). */
    ckProduced?: boolean
  },
): ShelfLifeRule {
  const brands: BrandScope[] =
    ownerBrand === 'SHARED'
      ? ['SHARED', ...(extra?.ckProduced === false ? [] : (['CENTRAL-KITCHEN'] as BrandScope[]))]
      : [ownerBrand, ...(extra?.ckProduced === false ? [] : (['CENTRAL-KITCHEN'] as BrandScope[]))]
  return {
    code,
    nameEn,
    nameAr,
    category,
    ownerBrand,
    brands,
    hours,
    fefoWarnHours: extra?.fefoWarnHours ?? FEFO_DEFAULT,
    keepTempEn,
    keepTempAr,
    unitCostMinor,
    notesEn: extra?.notesEn,
    notesAr: extra?.notesAr,
  }
}

const CHILL = 'Keep Chilled: 1°C – 4°C'
const CHILL_AR = 'احفظ مبرّداً: 1°م – 4°م'
const FREEZE = 'Keep Frozen: −18°C'
const FREEZE_AR = 'احفظ مجمّداً: −18°م'

/** Master HACCP shelf-life reference — exclusive brand ownership. */
export const SHELF_LIFE_MATRIX: readonly ShelfLifeRule[] = [
  // —— Farm Brown (exclusive) ——
  rule('PP03192', 'Chicken Brined FB Prod', 'دجاج فارم براون المتبل بالمحلول', 'meat_poultry_seafood', 'FARM-BROWN', { chiller: 48 }, CHILL, CHILL_AR, 1850),
  rule('PP03252', 'Chicken Marinated HB Prod', 'دجاج متبل هاوس براند', 'meat_poultry_seafood', 'FARM-BROWN', { chiller: 48 }, CHILL, CHILL_AR, 1720),
  rule('PP03254', 'Chicken FB Fillet Patty', 'باتي فيليه دجاج فارم براون', 'meat_poultry_seafood', 'FARM-BROWN', { chiller: 48 }, CHILL, CHILL_AR, 1680),
  rule('PP03255', 'Chicken FB Strip', 'شرائح دجاج فارم براون', 'meat_poultry_seafood', 'FARM-BROWN', { chiller: 48 }, CHILL, CHILL_AR, 1650),
  rule(
    'PP03205',
    'Coleslaw Salad FB Prod',
    'سلطة كولسلو فارم براون (مع صوص)',
    'salads_veg_dairy',
    'FARM-BROWN',
    { chiller: 24 },
    CHILL,
    CHILL_AR,
    420,
    { notesEn: 'Highly sensitive to acidity / fermentation after dressing.', notesAr: 'حساس جداً للحموضة والتخمر بعد خلط الصوص.' },
  ),
  rule('PP03189', 'Asian Coleslaw FB Prod', 'كولسلو آسيوي فارم براون', 'salads_veg_dairy', 'FARM-BROWN', { chiller: 24 }, CHILL, CHILL_AR, 440),
  rule('PP03183', 'Base Mix Coleslaw FB Prod', 'خلطة كولسلو جافة بدون صوص', 'salads_veg_dairy', 'FARM-BROWN', { chiller: 48 }, CHILL, CHILL_AR, 320),
  rule('PP03174', 'Ranch Dressing Prod', 'صلصة رانش', 'sauces_dressings', 'FARM-BROWN', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 360),

  // —— Frank's Steak (exclusive) ——
  rule(
    'PP03199',
    'Beef Franks Sliced Prod',
    'شرائح ستيك فرانكس',
    'meat_poultry_seafood',
    'FRANKS-STEAK',
    { chiller: 48, line_prep: 8 },
    CHILL,
    CHILL_AR,
    2200,
    { notesEn: 'After opening on prep line: 8 hours.', notesAr: 'بعد الفتح على خط التحضير: 8 ساعات.' },
  ),
  rule('PP03187', "Frank's Sauce Prod", 'صلصة فرانكس', 'sauces_dressings', 'FRANKS-STEAK', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 400),
  rule('PP03171', 'No.7 Sauce Prod', 'صلصة رقم 7', 'sauces_dressings', 'FRANKS-STEAK', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 390),
  rule('PP03179', 'Truffle Mayo Sauce Prod', 'مايونيز ترافل', 'sauces_dressings', 'FRANKS-STEAK', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 450),

  // —— China Garden (exclusive) ——
  rule('PP03159', 'Par-Cooked Chicken Sliced', 'دجاج شرائح نصف مطهو', 'meat_poultry_seafood', 'CHINA-GARDEN', { chiller: 72, line_prep: 6 }, CHILL, CHILL_AR, 1800),
  rule('PP03157', 'Par-Cooked Beef Sliced', 'لحم بقري مقطع نصف مطهو', 'meat_poultry_seafood', 'CHINA-GARDEN', { chiller: 72, line_prep: 6 }, CHILL, CHILL_AR, 2400),
  rule('PP03158', 'Par-Cooked Chicken Diced', 'دجاج مكعبات نصف مطهو', 'meat_poultry_seafood', 'CHINA-GARDEN', { chiller: 72, line_prep: 6 }, CHILL, CHILL_AR, 1800),
  rule('PP03156', 'Boiled Shrimp for Rice Prod', 'روبيان مسلوق للأرز', 'meat_poultry_seafood', 'CHINA-GARDEN', { chiller: 72, line_prep: 6 }, CHILL, CHILL_AR, 2600),
  rule('PP03140', 'Boiled Half Duck Prod', 'نصف بطة مسلوقة', 'meat_poultry_seafood', 'CHINA-GARDEN', { chiller: 72, line_prep: 6 }, CHILL, CHILL_AR, 3200),
  rule('PP03123', 'Steamed Noodles Prod', 'نودلز مطهو بالبخار', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { chiller: 36, line_prep: 4 }, CHILL, CHILL_AR, 290),
  rule('PP03110', 'Flour Dough Prod', 'عجينة دقيق', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { chiller: 24, line_prep: 4 }, CHILL, CHILL_AR, 150),
  rule('PP03111', 'Egg Dough Prod', 'عجينة بيض', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { chiller: 24, line_prep: 4 }, CHILL, CHILL_AR, 160),
  rule('PP03126', 'Chicken Dumpling Prod', 'دامبلنغ دجاج', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { freezer: 720, thawed_chiller: 24 }, FREEZE, FREEZE_AR, 640),
  rule('PP03127', 'Shrimp Dumpling Prod', 'دامبلنغ روبيان', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { freezer: 720, thawed_chiller: 24 }, FREEZE, FREEZE_AR, 720),
  rule('PP03128', 'Veg Spring Roll Prod', 'سبرينج رول خضار', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { freezer: 720, thawed_chiller: 24 }, FREEZE, FREEZE_AR, 480),
  rule('PP03129', 'Chicken Spring Roll Prod', 'سبرينج رول دجاج', 'dim_sum_dough_noodles', 'CHINA-GARDEN', { freezer: 720, thawed_chiller: 24 }, FREEZE, FREEZE_AR, 520),
  rule('PP03117', 'Dynamite Sauce Prod', 'صلصة دايناميت', 'sauces_dressings', 'CHINA-GARDEN', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 380, {
    notesEn: 'Mayo/egg-based — squeeze bottle on line: 12h.',
    notesAr: 'يحتوي مايونيز/بيض — علبة ضغط على الخط: 12 ساعة.',
  }),
  rule('PP03200', 'Mongolian Sauce Prod', 'صلصة مونغوليان', 'sauces_dressings', 'CHINA-GARDEN', { chiller: 120 }, CHILL, CHILL_AR, 420),
  rule('PP03115', 'Sweet & Sour Sauce Prod', 'صلصة حامض حلو', 'sauces_dressings', 'CHINA-GARDEN', { chiller: 120 }, CHILL, CHILL_AR, 350),
  rule('PP03202', 'General Tso Sauce Prod', 'صلصة جنرال تسو', 'sauces_dressings', 'CHINA-GARDEN', { chiller: 120 }, CHILL, CHILL_AR, 410),
  rule('PP03195', 'Chilli Paste Dry Prod', 'معجون فلفل جاف', 'sauces_dressings', 'CHINA-GARDEN', { chiller: 120 }, CHILL, CHILL_AR, 300),

  // —— The Noodle Bar (exclusive) ——
  rule('PP03167', 'Boiled Noodles TNB Prod', 'نودلز مسلوق (ذا نودل بار)', 'dim_sum_dough_noodles', 'THE-NOODLE-BAR', { chiller: 36, line_prep: 4 }, CHILL, CHILL_AR, 280),
  rule('PP03135', 'Crab Rangoon Prod', 'كراب رانجون', 'dim_sum_dough_noodles', 'THE-NOODLE-BAR', { freezer: 720, thawed_chiller: 24 }, FREEZE, FREEZE_AR, 590),
  rule('PP03141', 'Buffalo Wonton Prod', 'ونتون بافالو', 'dim_sum_dough_noodles', 'THE-NOODLE-BAR', { freezer: 720, thawed_chiller: 24 }, FREEZE, FREEZE_AR, 610),
  rule('PP03170', 'Kimchi Garlic Sauce Prod', 'صلصة كيمتشي بالثوم', 'sauces_dressings', 'THE-NOODLE-BAR', { chiller: 120 }, CHILL, CHILL_AR, 380),

  // —— Karak Cafeteria (exclusive) ——
  rule('PP03190', 'Chapati KC Prod', 'عجينة شباتي كرك', 'dim_sum_dough_noodles', 'KARAK-CAFETERIA', { chiller: 24, line_prep: 4 }, CHILL, CHILL_AR, 180),
  rule('PP03191', 'Karak Tea Mix Prod', 'خلطة شاي الكرك', 'sauces_dressings', 'KARAK-CAFETERIA', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 220),
  rule('PP03193', 'Chapati Filling Mix KC', 'حشوة شباتي كرك', 'salads_veg_dairy', 'KARAK-CAFETERIA', { chiller: 24, line_prep: 4 }, CHILL, CHILL_AR, 260),

  // —— Shawarma Tahina (exclusive) ——
  rule(
    'PP03279',
    'Chicken Shawarma Skewer Frozen Prod',
    'سيخ شاورما دجاج متبل',
    'meat_poultry_seafood',
    'SHAWARMA-TAHINA',
    { freezer: 720, thawed_chiller: 24, grill_skewer: 12 },
    FREEZE,
    FREEZE_AR,
    1950,
    { notesEn: 'After thaw in chiller: 24h. On thermal grill skewer: max 12h.', notesAr: 'بعد الفك في البراد: 24 ساعة. على سيخ الشوي: 12 ساعة كحد أقصى.' },
  ),
  rule(
    'PP03273',
    'Beef Shawarma Skewer Frozen Prod',
    'سيخ شاورما لحم متبل',
    'meat_poultry_seafood',
    'SHAWARMA-TAHINA',
    { freezer: 720, thawed_chiller: 24, grill_skewer: 12 },
    FREEZE,
    FREEZE_AR,
    2100,
    { notesEn: 'After thaw in chiller: 24h. On thermal grill skewer: max 12h.', notesAr: 'بعد الفك في البراد: 24 ساعة. على سيخ الشوي: 12 ساعة كحد أقصى.' },
  ),
  rule('PP03226', 'Hummous Prepared Fresh', 'حمص طحينة طازج', 'salads_veg_dairy', 'SHAWARMA-TAHINA', { chiller: 48 }, CHILL, CHILL_AR, 380),
  rule('RW01348', 'Hummous Prepared Fresh (RW)', 'حمص طحينة طازج (مادة خام)', 'salads_veg_dairy', 'SHAWARMA-TAHINA', { chiller: 48 }, CHILL, CHILL_AR, 360),
  rule('PP03222', 'Garlic Sauce TAH Condiment', 'صوص ثوم طحينة', 'sauces_dressings', 'SHAWARMA-TAHINA', { chiller: 72, line_prep: 12 }, CHILL, CHILL_AR, 340),

  // —— Shared cut veg (all brands) ——
  rule('RW01156', 'Iceberg Lettuce Cut', 'خس آيسبرغ مقطع', 'salads_veg_dairy', 'SHARED', { chiller: 24 }, CHILL, CHILL_AR, 220),
  rule('RW01149', 'Spring Onion Cut', 'بصل أخضر مقطع', 'salads_veg_dairy', 'SHARED', { chiller: 24 }, CHILL, CHILL_AR, 180),
  rule('RW01310', 'Coriander Cut', 'كزبرة مقطعة', 'salads_veg_dairy', 'SHARED', { chiller: 24 }, CHILL, CHILL_AR, 160),
  rule('RW01144', 'Parsley Cut', 'بقدونس مقطع', 'salads_veg_dairy', 'SHARED', { chiller: 24 }, CHILL, CHILL_AR, 160),
  rule('RW-TOMATO-SL', 'Tomato Sliced', 'طماطم شرائح', 'salads_veg_dairy', 'SHARED', { chiller: 24 }, CHILL, CHILL_AR, 200),
]

const byCode = new Map(SHELF_LIFE_MATRIX.map((r) => [r.code, r]))

export function getShelfLifeRule(code: string): ShelfLifeRule | undefined {
  return byCode.get(code)
}

/** Commercial owner only — never CENTRAL-KITCHEN as a fake owner. */
export function primaryOwnerBrand(rule: ShelfLifeRule): BrandScope {
  if (rule.ownerBrand) return rule.ownerBrand
  const owner = rule.brands.find((b) => b !== 'CENTRAL-KITCHEN' && b !== 'SHARED')
  return owner ?? (rule.brands.includes('SHARED') ? 'SHARED' : 'CENTRAL-KITCHEN')
}

/**
 * Strict brand filter. Selecting China Garden must NOT show Farm Brown / Frank's
 * just because those rows also list CENTRAL-KITCHEN as a production site.
 */
export function ruleMatchesBrandFilter(
  rule: ShelfLifeRule,
  brand: BrandScope | string | null | undefined,
): boolean {
  if (!brand || brand === 'SHARED' || brand === '') return true
  const b = brand as BrandScope
  if (b === 'CENTRAL-KITCHEN') {
    return rule.brands.includes('CENTRAL-KITCHEN') || rule.ownerBrand === 'SHARED'
  }
  if (rule.ownerBrand === 'SHARED' || rule.brands.includes('SHARED')) return true
  return primaryOwnerBrand(rule) === b
}

/** Can this SKU physically sit at a site of the given brand (or CK)? */
export function ruleAllowedAtSiteBrand(
  rule: ShelfLifeRule,
  siteBrandId: string | null | undefined,
): boolean {
  if (!siteBrandId) return true // Central Kitchen / shared warehouse
  if (rule.ownerBrand === 'SHARED' || rule.brands.includes('SHARED')) return true
  return primaryOwnerBrand(rule) === siteBrandId
}

export function listShelfLifeRules(filter?: {
  brand?: BrandScope | string | null
  category?: ShelfCategory | null
  query?: string | null
}): ShelfLifeRule[] {
  const q = filter?.query?.trim().toLowerCase() ?? ''
  return SHELF_LIFE_MATRIX.filter((r) => {
    if (filter?.category && r.category !== filter.category) return false
    if (!ruleMatchesBrandFilter(r, filter?.brand)) return false
    if (!q) return true
    return (
      r.code.toLowerCase().includes(q) ||
      r.nameEn.toLowerCase().includes(q) ||
      r.nameAr.includes(q)
    )
  })
}

export function defaultStorageMode(rule: ShelfLifeRule): StorageMode {
  if (rule.hours.chiller != null) return 'chiller'
  if (rule.hours.freezer != null) return 'freezer'
  if (rule.hours.thawed_chiller != null) return 'thawed_chiller'
  if (rule.hours.line_prep != null) return 'line_prep'
  return 'grill_skewer'
}

export function resolveShelfHours(rule: ShelfLifeRule, mode: StorageMode): number | null {
  const h = rule.hours[mode]
  return h == null ? null : h
}

/** Kuwait-local wall clock helpers for exact expiry display. */
export function kuwaitParts(date: Date): {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
  ampm: string
  hour12: string
} {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: parts.year ?? '',
    month: parts.month ?? '',
    day: parts.day ?? '',
    hour: parts.hour ?? '',
    minute: parts.minute ?? '',
    second: parts.second ?? '',
    ampm: (parts.dayPeriod ?? '').toUpperCase(),
    hour12: parts.hour ?? '',
  }
}

export function formatKuwaitStamp(date: Date): string {
  const p = kuwaitParts(date)
  return `${p.day}/${p.month}/${p.year} - ${p.hour12}:${p.minute} ${p.ampm}`
}

export function computeExpiry(preparedAt: Date, hours: number): Date {
  return new Date(preparedAt.getTime() + hours * 3_600_000)
}

export function countdownParts(expiresAtIso: string, now = new Date()): {
  totalMs: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
  display: string
} {
  const totalMs = new Date(expiresAtIso).getTime() - now.getTime()
  if (totalMs <= 0) {
    return { totalMs: 0, hours: 0, minutes: 0, seconds: 0, expired: true, display: '00h : 00m : 00s' }
  }
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const seconds = Math.floor((totalMs % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    totalMs,
    hours,
    minutes,
    seconds,
    expired: false,
    display: `${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`,
  }
}

export function storageModeLabel(mode: StorageMode, en: boolean): string {
  if (mode === 'freezer') return en ? 'Freezer (−18°C)' : 'مجمد (−18°م)'
  if (mode === 'chiller') return en ? 'Chiller (1°C–4°C)' : 'براد (1°م–4°م)'
  if (mode === 'line_prep') return en ? 'Line Prep / Squeeze Bottle' : 'خط التحضير / علبة ضغط'
  if (mode === 'thawed_chiller') return en ? 'Thawed in Chiller' : 'مُذاب في البراد'
  return en ? 'Grill Skewer (max)' : 'سيخ الشوي الحراري'
}

export function categoryLabel(cat: ShelfCategory, en: boolean): string {
  if (cat === 'meat_poultry_seafood') return en ? 'Meat, Poultry & Seafood' : 'لحوم ودواجن وبحريات'
  if (cat === 'dim_sum_dough_noodles') return en ? 'Dim Sum, Rolls, Dough & Noodles' : 'دامبلنغ، رول، عجين ونودلز'
  if (cat === 'salads_veg_dairy') return en ? 'Salads, Cut Veggies & Dairy' : 'سلطات وخضار وألبان'
  return en ? 'Signature Sauces & Dressings' : 'صوصات وتتبيلات خاصة'
}

export function brandScopeLabel(brand: BrandScope, en: boolean): string {
  const map: Record<BrandScope, { en: string; ar: string }> = {
    'FARM-BROWN': { en: 'Farm Brown', ar: 'فارم براون' },
    'KARAK-CAFETERIA': { en: 'Karak Cafeteria', ar: 'كرك كافتيريا' },
    'CHINA-GARDEN': { en: 'China Garden', ar: 'تشاينا جاردن' },
    'THE-NOODLE-BAR': { en: 'The Noodle Bar', ar: 'ذا نودل بار' },
    'FRANKS-STEAK': { en: "Frank's Steak", ar: 'فرانكس ستيك' },
    'SHAWARMA-TAHINA': { en: 'Shawarma Tahina', ar: 'شاورما طحينة' },
    'CENTRAL-KITCHEN': { en: 'Central Kitchen', ar: 'المطبخ المركزي' },
    SHARED: { en: 'Shared / All brands', ar: 'مشترك / كل البراندات' },
  }
  return en ? map[brand].en : map[brand].ar
}

/** LOT-VF-{item}-{ownerSlug}-{siteId}-{stamp} e.g. LOT-VF-PP03192-FB-SALMIYA-… */
export function buildLotBarcode(itemCode: string, siteId: string, preparedAt: Date, ownerBrand?: BrandScope | null): string {
  const stamp = preparedAt.toISOString().replace(/\D/g, '').slice(0, 14)
  const ownerSlug =
    ownerBrand && OPERATING_BRANDS.includes(ownerBrand)
      ? ownerBrand
          .replace('FARM-BROWN', 'FB')
          .replace('FRANKS-STEAK', 'FRANKS')
          .replace('CHINA-GARDEN', 'CG')
          .replace('THE-NOODLE-BAR', 'TNB')
          .replace('KARAK-CAFETERIA', 'KK')
          .replace('SHAWARMA-TAHINA', 'ST')
      : null
  // Prefer site id which already encodes brand+branch (FB-SALMIYA, CG-FARWANIYA, …)
  if (siteId.includes('-') && !ownerSlug) {
    return `LOT-VF-${itemCode}-${siteId}-${stamp}`.slice(0, 64)
  }
  if (ownerSlug && siteId.startsWith(ownerSlug.split('-')[0] ?? 'XX')) {
    return `LOT-VF-${itemCode}-${siteId}-${stamp}`.slice(0, 64)
  }
  return `LOT-VF-${itemCode}-${siteId}-${stamp}`.slice(0, 64)
}

export { OPERATING_BRANDS }
