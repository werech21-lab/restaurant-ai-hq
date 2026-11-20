import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'

export const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000

export type ApprovedFeryalBranchId =
  | '360-mall'
  | 'salmiya'
  | 'al-kout'
  | 'ardiya'
  | 'promenade'
  | 'avenues'
  | 'assima'
  | 'school-canteens'
  | 'exhibitions'

export type ApprovedFeryalBrandId =
  | 'china-garden'
  | 'franks'
  | 'tahina'
  | 'farm-brown'
  | 'noodle-bar'
  | 'karak-cafeteria'

export type ApprovedFeryalChannelId =
  | 'dine-in'
  | 'takeaway-direct'
  | 'talabat-tgo'
  | 'talabat-tmp'
  /** Talabat TGO + TMP combined (what "طلبات" means in Gulf usage). */
  | 'talabat'
  | 'keeta'
  | 'deliveroo'
  | 'jahez'
  | 'snoonu'

export type ApprovedFeryalPeriodId = 'today' | 'week' | 'month' | 'year' | 'custom'

export interface FeryalBranchMeta {
  id: ApprovedFeryalBranchId
  nameAr: string
  nameEn: string
  aliases: readonly string[]
}

export interface FeryalBrandMeta {
  id: ApprovedFeryalBrandId
  nameAr: string
  nameEn: string
  aliases: readonly string[]
}

export interface FeryalChannelMeta {
  id: ApprovedFeryalChannelId
  nameAr: string
  nameEn: string
  aliases: readonly string[]
}

export interface FeryalContextDefaults {
  period?: string | null
  customFrom?: string | null
  customTo?: string | null
  branch?: string | null
  brand?: string | null
  channel?: string | null
}

export interface ValidatedFeryalContextDefaults {
  period: ApprovedFeryalPeriodId | null
  customFrom: string | null
  customTo: string | null
  branchId: ApprovedFeryalBranchId | null
  brandId: ApprovedFeryalBrandId | null
  channelId: ApprovedFeryalChannelId | null
}

export const APPROVED_FERYAL_BRANCHES: readonly FeryalBranchMeta[] = [
  {
    id: '360-mall',
    nameAr: 'مول 360',
    nameEn: '360 Mall',
    aliases: ['مول 360', '360 مول', '360 mall', '360-mall', 'فرع 360', 'مجمع 360', '360'],
  },
  {
    id: 'salmiya',
    nameAr: 'السالمية',
    nameEn: 'Salmiya',
    aliases: ['السالمية', 'سالمية', 'السالميه', 'سالميه', 'salmiya'],
  },
  {
    id: 'al-kout',
    nameAr: 'الكوت',
    nameEn: 'Al-Kout',
    aliases: ['الكوت', 'كوت', 'al-kout', 'alkout', 'al kout', 'kout'],
  },
  {
    id: 'ardiya',
    nameAr: 'العارضية',
    nameEn: 'Ardiya',
    aliases: ['العارضية', 'عارضية', 'العارضيه', 'عارضيه', 'ardiya', 'ardhiya'],
  },
  {
    id: 'promenade',
    nameAr: 'بروميناد',
    nameEn: 'Promenade',
    aliases: ['بروميناد', 'البروميناد', 'promenade'],
  },
  {
    id: 'avenues',
    nameAr: 'الأفنيوز',
    nameEn: 'Avenues',
    aliases: ['الأفنيوز', 'الافنيوز', 'أفنيوز', 'افنيوز', 'avenues', 'the avenues'],
  },
  {
    id: 'assima',
    nameAr: 'العاصمة',
    nameEn: 'Assima',
    aliases: ['العاصمة', 'العاصمه', 'عاصمة مول', 'assima', 'al-assima'],
  },
] as const

export const SCHOOL_CANTEEN_FERYAL_BRANCH: FeryalBranchMeta = {
  id: 'school-canteens',
  nameAr: 'مقاصف المدارس',
  nameEn: 'School canteens',
  aliases: [
    'مقاصف المدارس',
    'المقاصف المدرسية',
    'مقصف المدارس',
    'school-canteens',
    'school canteens',
  ],
}

/** Exhibition booths — counted in company totals as their own group (owner decision 2026-11-18). */
export const EXHIBITION_FERYAL_BRANCH: FeryalBranchMeta = {
  id: 'exhibitions',
  nameAr: 'بوثات المعارض',
  nameEn: 'Exhibition Booths',
  aliases: [
    'بوثات المعارض',
    'البوثات',
    'بوثات',
    'البوث',
    'المعارض',
    'معارض',
    'اكشاك المعارض',
    'exhibition booths',
    'exhibitions',
    'exhibition',
    'booths',
  ],
}

export const ALL_FERYAL_BRANCHES: readonly FeryalBranchMeta[] = [
  ...APPROVED_FERYAL_BRANCHES,
  SCHOOL_CANTEEN_FERYAL_BRANCH,
  EXHIBITION_FERYAL_BRANCH,
]

export const APPROVED_FERYAL_BRANDS: Readonly<Record<ApprovedFeryalBrandId, string>> = {
  'china-garden': 'تشاينا جاردن',
  franks: 'فرانكس',
  tahina: 'طحينة',
  'farm-brown': 'فارم براون',
  'noodle-bar': 'ذا نودل بار',
  'karak-cafeteria': 'كافيتيريا كرك',
}

export const APPROVED_FERYAL_BRAND_LIST: readonly FeryalBrandMeta[] = [
  {
    id: 'china-garden',
    nameAr: 'تشاينا جاردن',
    nameEn: 'China Garden',
    aliases: ['تشاينا جاردن', 'تشاينا غاردن', 'شينا جاردن', 'china garden', 'china-garden'],
  },
  {
    id: 'franks',
    nameAr: 'فرانكس',
    nameEn: "Frank's",
    aliases: ['فرانكس', "frank's", 'franks'],
  },
  {
    id: 'tahina',
    nameAr: 'طحينة',
    nameEn: 'Tahina',
    aliases: ['طحينة', 'طحينه', 'شاورما طحينة', 'شاورما طحينه', 'tahina'],
  },
  {
    id: 'farm-brown',
    nameAr: 'فارم براون',
    nameEn: 'Farm Brown',
    aliases: ['فارم براون', 'farm brown', 'farm-brown'],
  },
  {
    id: 'noodle-bar',
    nameAr: 'ذا نودل بار',
    nameEn: 'The Noodle Bar',
    aliases: ['ذا نودل بار', 'نودل بار', 'the noodle bar', 'noodle bar', 'noodle-bar'],
  },
  {
    id: 'karak-cafeteria',
    nameAr: 'كافيتيريا كرك',
    nameEn: 'Karak Cafeteria',
    aliases: [
      'كافيتيريا كرك',
      'كرك كافيتيريا',
      'كرك كافتيريا',
      'شاي كرك',
      'karak cafeteria',
      'karak-cafeteria',
    ],
  },
] as const

export const APPROVED_FERYAL_CHANNEL_LIST: readonly FeryalChannelMeta[] = [
  {
    id: 'dine-in',
    nameAr: 'الصالة',
    nameEn: 'Dine-in',
    aliases: ['الصالة', 'صالة', 'dine-in', 'dine in'],
  },
  {
    id: 'takeaway-direct',
    nameAr: 'سفري ومباشر',
    nameEn: 'Takeaway/Direct',
    aliases: ['سفري ومباشر', 'سفري', 'takeaway-direct', 'takeaway'],
  },
  {
    id: 'talabat-tgo',
    nameAr: 'طلبات أسطول المنصة',
    nameEn: 'Talabat Tgo',
    aliases: ['talabat-tgo', 'talabat tgo'],
  },
  {
    id: 'talabat-tmp',
    nameAr: 'طلبات سائقي الشركة',
    nameEn: 'Talabat TMP',
    aliases: ['talabat-tmp', 'talabat tmp'],
  },
  {
    // Detected by `detectTargetChannelFromQuestion` (bare "طلبات"/"talabat" with a sales word, or
    // TGO + TMP together); no generic aliases so "الطلبات" (orders) never matches.
    id: 'talabat',
    nameAr: 'طلبات (TGO + TMP)',
    nameEn: 'Talabat (TGO + TMP)',
    aliases: [],
  },
  {
    id: 'keeta',
    nameAr: 'كيتا',
    nameEn: 'Keeta',
    aliases: ['كيتا', 'keeta'],
  },
  {
    id: 'deliveroo',
    nameAr: 'ديليفرو',
    nameEn: 'Deliveroo',
    aliases: ['ديليفرو', 'دليفرو', 'deliveroo'],
  },
  {
    id: 'jahez',
    nameAr: 'جاهز',
    nameEn: 'Jahez',
    aliases: ['جاهز', 'jahez'],
  },
  {
    id: 'snoonu',
    nameAr: 'سنونو',
    nameEn: 'Snoonu',
    aliases: ['سنونو', 'snoonu'],
  },
] as const

const APPROVED_PERIOD_SET = new Set<ApprovedFeryalPeriodId>([
  'today',
  'week',
  'month',
  'year',
  'custom',
])
const APPROVED_BRANCH_ID_SET = new Set<ApprovedFeryalBranchId>(
  ALL_FERYAL_BRANCHES.map((b) => b.id),
)
const APPROVED_BRAND_ID_SET = new Set<ApprovedFeryalBrandId>(
  APPROVED_FERYAL_BRAND_LIST.map((b) => b.id),
)
const APPROVED_CHANNEL_ID_SET = new Set<ApprovedFeryalChannelId>(
  APPROVED_FERYAL_CHANNEL_LIST.map((c) => c.id),
)

export function normalizeDigits(text: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  const extendedArabic = '۰۱۲۳۴۵۶۷۸۹'
  let out = ''
  for (const ch of text) {
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
    out += ch
  }
  return out
}

const AR_WORD_END = '(?=[\\s؟?.,!؛:()«»"\'-]|$)'
const AR_WORD_START = '(^|[\\s(«"\'-])'

/**
 * Phase 5 · Item 3 — Gulf / Kuwaiti dialect canonicalisation, applied after base normalisation so
 * every downstream matcher (periods, channels, intents) understands colloquial phrasing.
 */
const GULF_DIALECT_RULES: readonly [RegExp, string][] = [
  // yesterday: امبارح / إمبارح / البارح / بارح → امس
  [new RegExp(`${AR_WORD_START}(امبارح|امبارحه|البارح|بارح)${AR_WORD_END}`, 'g'), '$1امس'],
  // "this <period>": هالشهر / هالاسبوع / هالسنه / هاليوم
  [new RegExp(`${AR_WORD_START}هالشهر${AR_WORD_END}`, 'g'), '$1هذا الشهر'],
  [new RegExp(`${AR_WORD_START}هالاسبوع${AR_WORD_END}`, 'g'), '$1هذا الاسبوع'],
  [new RegExp(`${AR_WORD_START}(هالسنه|هالعام)${AR_WORD_END}`, 'g'), '$1هذه السنه'],
  [new RegExp(`${AR_WORD_START}هاليوم${AR_WORD_END}`, 'g'), '$1اليوم'],
  // Talabat fleet codes typed bare (TGO / TMP) or as "طلبات TGO"
  [/(^|[^a-z-])(?:طلبات\s+)?tgo\b/g, '$1talabat tgo'],
  [/(^|[^a-z-])(?:طلبات\s+)?tmp\b/g, '$1talabat tmp'],
  [/talabat talabat/g, 'talabat'],
  // Keeta spelling variants
  [new RegExp(`${AR_WORD_START}(كييتا|كيته)${AR_WORD_END}`, 'g'), '$1كيتا'],
]

export function normalizeGulfDialect(normalized: string): string {
  let out = normalized
  for (const [re, rep] of GULF_DIALECT_RULES) out = out.replace(re, rep)
  return out.replace(/\s+/g, ' ').trim()
}

export function normalizeArabicText(text: string): string {
  return normalizeGulfDialect(
    normalizeDigits(text)
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function validateFeryalContextDefaults(
  raw: FeryalContextDefaults | null | undefined,
): ValidatedFeryalContextDefaults {
  if (!raw || typeof raw !== 'object') {
    return {
      period: null,
      customFrom: null,
      customTo: null,
      branchId: null,
      brandId: null,
      channelId: null,
    }
  }

  const rawPeriod = typeof raw.period === 'string' ? raw.period.trim().toLowerCase() : ''
  const period = APPROVED_PERIOD_SET.has(rawPeriod as ApprovedFeryalPeriodId)
    ? (rawPeriod as ApprovedFeryalPeriodId)
    : null

  const rawFrom = typeof raw.customFrom === 'string' ? raw.customFrom.trim() : ''
  const rawTo = typeof raw.customTo === 'string' ? raw.customTo.trim() : ''
  const isoRe = /^\d{4}-\d{2}-\d{2}$/
  let customFrom = isoRe.test(rawFrom) ? rawFrom : null
  let customTo = isoRe.test(rawTo) ? rawTo : null
  if (customFrom && customTo && customFrom > customTo) {
    const tmp = customFrom
    customFrom = customTo
    customTo = tmp
  }

  const rawBranch = typeof raw.branch === 'string' ? raw.branch.trim().toLowerCase() : ''
  const branchId =
    rawBranch &&
    rawBranch !== 'all' &&
    !isExcludedOdooEntity(rawBranch) &&
    APPROVED_BRANCH_ID_SET.has(rawBranch as ApprovedFeryalBranchId)
      ? (rawBranch as ApprovedFeryalBranchId)
      : null

  const rawBrand = typeof raw.brand === 'string' ? raw.brand.trim().toLowerCase() : ''
  const brandId =
    rawBrand &&
    rawBrand !== 'all' &&
    !isExcludedOdooEntity(rawBrand) &&
    APPROVED_BRAND_ID_SET.has(rawBrand as ApprovedFeryalBrandId)
      ? (rawBrand as ApprovedFeryalBrandId)
      : null

  const rawChannel = typeof raw.channel === 'string' ? raw.channel.trim().toLowerCase() : ''
  const channelId =
    rawChannel &&
    rawChannel !== 'all' &&
    APPROVED_CHANNEL_ID_SET.has(rawChannel as ApprovedFeryalChannelId)
      ? (rawChannel as ApprovedFeryalChannelId)
      : null

  return { period, customFrom, customTo, branchId, brandId, channelId }
}

/**
 * Detects whether the question is asking to rank or identify the top/lowest branch
 * (e.g. "أي فرع", "مين الفرع", "شو أعلى فرع", "أعلى فرع", "أكثر فرع", "which branch",
 * "top branch", "best branch").
 */
export function isBranchRankingQuestion(question: string): boolean {
  const normAr = normalizeArabicText(question)
  if (!normAr) return false

  const arRankingRe =
    /(?:^|\s)(?:اي فرع|مين الفرع|من الفرع|منو الفرع|شنو الفرع|شو الفرع|ايش الفرع|وش الفرع|شو اعلي فرع|شنو اعلي فرع|ما اعلي فرع|ما هو اعلي فرع|اعلي فرع|اكثر فرع|افضل فرع|احسن فرع|اقل فرع|اضعف فرع|اسوا فرع|الفرع الاعلي|الفرع الاكثر|الفرع الافضل|الفرع الاقل|الفرع الاسوا|ترتيب الفروع|تصنيف الفروع)(?=[\s؟?.,!؛:()«»"']|$)/i
  if (arRankingRe.test(normAr)) return true

  if (
    /(?:الاعلي مبيعا|الاكثر مبيعا|الافضل مبيعا|الاقل مبيعا)/.test(normAr) &&
    /(?:فرع|الفرع|الفروع)/.test(normAr)
  ) {
    return true
  }

  const enRankingRe =
    /\b(?:which branch|what branch|top branch|best branch|highest branch|lowest branch|worst branch|top[- ]selling branch|best[- ]selling branch|branch ranking|rank branches)\b/i
  return enRankingRe.test(normAr)
}

/**
 * Normalized Arabic & English stems that may appear right after "فرع" / "branch" in ordinary
 * questions (verbs, comparatives, adjectives, metrics, time words, pronouns, prepositions) and
 * are NEVER proper nouns naming an unknown branch.
 */
const NON_PROPER_BRANCH_STEMS = new Set<string>([
  // Comparatives & superlatives
  'اعلي',
  'اكثر',
  'اقل',
  'افضل',
  'احسن',
  'اسوا',
  'اضعف',
  'اكبر',
  'اصغر',
  'اول',
  'اخير',
  'ثاني',
  'ثالث',
  'متصدر',
  'اقوي',
  // Verbs (standard + Gulf/Levantine dialect)
  'حقق',
  'حققت',
  'يحقق',
  'كان',
  'كانت',
  'يكون',
  'باع',
  'باعت',
  'يبيع',
  'عمل',
  'عملت',
  'يعمل',
  'سجل',
  'سجلت',
  'يسجل',
  'جاب',
  'جابت',
  'يجيب',
  'تصدر',
  'تصدرت',
  'يتصدر',
  'تفوق',
  'تراجع',
  'انخفض',
  'ارتفع',
  'زاد',
  'نزل',
  'وصل',
  'طلع',
  'دخل',
  'فتح',
  'اغلق',
  'سكر',
  'تجاوز',
  'شغال',
  'يعاني',
  'يحتاج',
  // Metrics, tamyiz & operational nouns
  'مبيعا',
  'مبيعات',
  'بيع',
  'مبيع',
  'طلبا',
  'طلبات',
  'طلب',
  'ايرادا',
  'ايرادات',
  'ايراد',
  'ربحا',
  'ربح',
  'ربحيه',
  'ارباح',
  'خساره',
  'خسائر',
  'اداء',
  'نموا',
  'نمو',
  'سله',
  'متوسط',
  'خصما',
  'خصم',
  'خصومات',
  'توصيل',
  'صاله',
  'سفري',
  'قناه',
  'قنوات',
  'علامه',
  'علامات',
  'براند',
  'شركه',
  'مطعم',
  'مطاعم',
  'نقاط',
  'كاشير',
  'صندوق',
  'صناديق',
  'موظف',
  'موظفين',
  'مخزن',
  'مشتريات',
  'هدر',
  'تالف',
  'حركه',
  'حركات',
  'نسبه',
  'قيمه',
  'مبلغ',
  'حصه',
  'ترتيب',
  'مقارنه',
  'توزيع',
  'اجمالي',
  'صافي',
  // Time words
  'مؤخرا',
  'موخرا',
  'مؤخر',
  'موخر',
  'اخيرا',
  'اليوم',
  'امس',
  'بارحه',
  'غدا',
  'الان',
  'حاليا',
  'اسبوع',
  'شهر',
  'سنه',
  'عام',
  'فتره',
  'يوم',
  'ايام',
  'صباحا',
  'مساء',
  'ليلا',
  'ماضي',
  'سابق',
  'حالي',
  'قادم',
  'جديد',
  'قديم',
  // Pronouns, particles, quantifiers & generic adjectives
  'معين',
  'محدد',
  'واحد',
  'اي',
  'كل',
  'جميع',
  'بعض',
  'باقي',
  'بقيه',
  'اخر',
  'اخري',
  'ثانيه',
  'غير',
  'بدون',
  'سوي',
  'فقط',
  'بس',
  'اللي',
  'الذي',
  'التي',
  'يلي',
  'الي',
  'هذا',
  'هذه',
  'ذاك',
  'ذلك',
  'هنا',
  'هناك',
  'في',
  'من',
  'عن',
  'علي',
  'مع',
  'عند',
  'عنده',
  'لديه',
  'لدينا',
  'عندنا',
  'فيه',
  'فيها',
  'فيهم',
  'منه',
  'منهم',
  'له',
  'لها',
  'به',
  'بها',
  'او',
  'هل',
  'كم',
  'كيف',
  'متي',
  'ليش',
  'لماذا',
  'وين',
  'اين',
  'ممتاز',
  'جيد',
  'ضعيف',
  'مرتفع',
  'منخفض',
  'كبير',
  'صغير',
  'نشط',
  'فعال',
  'معتمد',
  'مربوط',
  'مفتوح',
  'مغلق',
  'رئيسي',
  'مركزي',
  'تشغيلي',
  'فعلي',
  'كامل',
  'شامل',
  'فنتشر',
  'كويت',
  // English non-proper words
  'had',
  'has',
  'have',
  'did',
  'does',
  'was',
  'were',
  'is',
  'are',
  'with',
  'in',
  'on',
  'at',
  'for',
  'of',
  'by',
  'to',
  'from',
  'that',
  'which',
  'who',
  'sales',
  'sold',
  'orders',
  'revenue',
  'performance',
  'growth',
  'profit',
  'today',
  'yesterday',
  'recently',
  'lately',
  'week',
  'month',
  'year',
  'top',
  'best',
  'highest',
  'lowest',
  'worst',
  'ranking',
  'all',
  'any',
  'each',
  'every',
  'one',
  'specific',
  'certain',
])

function candidateStemVariants(normToken: string): string[] {
  const variants = new Set<string>([normToken])
  if (normToken.startsWith('ال') && normToken.length > 3) {
    variants.add(normToken.slice(2))
  }
  for (const clitic of ['بال', 'لل', 'كال', 'وال', 'فال']) {
    if (normToken.startsWith(clitic) && normToken.length > clitic.length + 1) {
      const bare = normToken.slice(clitic.length)
      variants.add(bare)
      variants.add(`ال${bare}`)
    }
  }
  for (const shortPrep of ['ب', 'ل', 'ك', 'ف', 'و']) {
    if (normToken.startsWith(shortPrep) && normToken.length > 2) {
      const rest = normToken.slice(1)
      variants.add(rest)
      if (rest.startsWith('ال') && rest.length > 3) {
        variants.add(rest.slice(2))
      }
    }
  }
  return [...variants]
}

/**
 * Returns true ONLY when the token following "فرع" / "branch" is a plausible place/branch
 * proper noun (including excluded districts) rather than a verb, comparative, adjective,
 * metric noun, preposition-prefixed noun, or time word.
 */
export function isPlausibleUnknownBranchProperNoun(rawToken: string): boolean {
  const cleaned = normalizeArabicText(rawToken).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  if (!cleaned || cleaned.length < 2) return false
  if (/\d/.test(cleaned)) return false

  if (isExcludedOdooEntity(cleaned)) return true

  for (const variant of candidateStemVariants(cleaned)) {
    if (NON_PROPER_BRANCH_STEMS.has(variant)) return false
  }

  return /^[\p{L}-]{2,}$/u.test(cleaned)
}

export interface BranchDetectionResult {
  branchId: ApprovedFeryalBranchId | null
  unknownBranchRequested: boolean
  isBranchRanking: boolean
  asksByBranchBreakdown: boolean
}

export function detectTargetBranchFromQuestion(question: string): BranchDetectionResult {
  const normAr = normalizeArabicText(question)
  const asksByBranchBreakdown =
    /(حسب الفرع|حسب الفروع|لكل فرع|جميع الفروع|كل الفروع|مقارنه الفروع|توزيع الفروع|\bby branch\b|\ball branches\b)/i.test(
      normAr,
    )
  const isBranchRanking = isBranchRankingQuestion(question)

  const matchedIds: ApprovedFeryalBranchId[] = []
  for (const branch of ALL_FERYAL_BRANCHES) {
    for (const rawAlias of branch.aliases) {
      const aliasNorm = normalizeArabicText(rawAlias)
      if (!aliasNorm) continue
      if (aliasNorm === '360') {
        if (/(^|[^\d])360([^\d]|$)/.test(normAr)) {
          matchedIds.push(branch.id)
          break
        }
      } else if (normAr.includes(aliasNorm)) {
        matchedIds.push(branch.id)
        break
      }
    }
  }

  if (matchedIds.length === 1 && !asksByBranchBreakdown && !isBranchRanking) {
    return {
      branchId: matchedIds[0],
      unknownBranchRequested: false,
      isBranchRanking,
      asksByBranchBreakdown,
    }
  }
  if (matchedIds.length > 1) {
    return {
      branchId: null,
      unknownBranchRequested: false,
      isBranchRanking,
      asksByBranchBreakdown,
    }
  }

  if (!asksByBranchBreakdown && !isBranchRanking) {
    if (matchedIds.length === 0 && isExcludedOdooEntity(question)) {
      return {
        branchId: null,
        unknownBranchRequested: true,
        isBranchRanking: false,
        asksByBranchBreakdown: false,
      }
    }

    const arMatches = normAr.matchAll(/(?:^|\s)(?:([^\s،؟?.,!؛:()«»"']+)\s+)?فرع\s+([^\s،؟?.,!؛:()«»"']+)/g)
    const arGovernors = new Set([
      'اي',
      'اعلي',
      'اكثر',
      'اقل',
      'افضل',
      'احسن',
      'اسوا',
      'اضعف',
      'كم',
      'كل',
      'لكل',
      'ما',
      'شو',
      'شنو',
      'وش',
      'ايش',
    ])
    for (const m of arMatches) {
      const prevWord = m[1] ?? ''
      const candidateToken = m[2] ?? ''
      if (prevWord && arGovernors.has(prevWord)) continue
      if (isPlausibleUnknownBranchProperNoun(candidateToken)) {
        return {
          branchId: null,
          unknownBranchRequested: true,
          isBranchRanking: false,
          asksByBranchBreakdown: false,
        }
      }
    }

    const enMatches = normAr.matchAll(/(?:^|\s)(?:([a-z]+)\s+)?branch\s+([a-z][a-z-]{1,24})(?=\s|[؟?.,!]|$)/gi)
    const enGovernors = new Set([
      'which',
      'what',
      'top',
      'best',
      'highest',
      'lowest',
      'worst',
      'every',
      'each',
      'any',
      'by',
      'per',
    ])
    for (const m of enMatches) {
      const prevWord = (m[1] ?? '').toLowerCase()
      const candidateToken = m[2] ?? ''
      if (prevWord && enGovernors.has(prevWord)) continue
      if (isPlausibleUnknownBranchProperNoun(candidateToken)) {
        return {
          branchId: null,
          unknownBranchRequested: true,
          isBranchRanking: false,
          asksByBranchBreakdown: false,
        }
      }
    }
  }

  return {
    branchId: null,
    unknownBranchRequested: false,
    isBranchRanking,
    asksByBranchBreakdown,
  }
}

export function detectTargetBrandFromQuestion(question: string): {
  brandId: ApprovedFeryalBrandId | null
  asksByBrandBreakdown: boolean
} {
  const normAr = normalizeArabicText(question)
  const asksByBrandBreakdown =
    /(حسب العلامه|حسب العلامات|لكل علامه|العلامات التجاريه|العلامات الست|العلامات السته|جميع العلامات|كل العلامات|حسب البراند|البراندات|لكل براند|مبيعات العلامات|\bby brand\b|\ball brands\b|\bbrands\b)/i.test(
      normAr,
    )

  const matched: ApprovedFeryalBrandId[] = []
  for (const b of APPROVED_FERYAL_BRAND_LIST) {
    for (const alias of b.aliases) {
      const aNorm = normalizeArabicText(alias)
      if (aNorm && normAr.includes(aNorm)) {
        matched.push(b.id)
        break
      }
    }
  }

  if (matched.length === 1 && !asksByBrandBreakdown) {
    return { brandId: matched[0], asksByBrandBreakdown: false }
  }
  return { brandId: null, asksByBrandBreakdown }
}

export function detectTargetChannelFromQuestion(question: string): {
  channelId: ApprovedFeryalChannelId | null
  asksByChannelBreakdown: boolean
} {
  const normAr = normalizeArabicText(question)
  const asksByChannelBreakdown =
    /(حسب القناه|حسب القنوات|لكل قناه|جميع القنوات|كل القنوات|\bby channel\b|\ball channels\b)/i.test(
      normAr,
    )

  const matched: ApprovedFeryalChannelId[] = []
  for (const ch of APPROVED_FERYAL_CHANNEL_LIST) {
    for (const alias of ch.aliases) {
      const aNorm = normalizeArabicText(alias)
      if (aNorm && normAr.includes(aNorm)) {
        matched.push(ch.id)
        break
      }
    }
  }

  // Phase 5 · Item 3: TGO + TMP together, or a bare "طلبات"/"talabat" with a sales/delivery word,
  // mean the whole Talabat channel.
  const hasTgo = matched.includes('talabat-tgo')
  const hasTmp = matched.includes('talabat-tmp')
  if (!asksByChannelBreakdown && hasTgo && hasTmp) {
    return { channelId: 'talabat', asksByChannelBreakdown: false }
  }
  if (
    !asksByChannelBreakdown &&
    matched.length === 0 &&
    (/(^|\s)talabat(?=\s|$)/.test(normAr) ||
      (/(^|\s)طلبات(?=[\s؟?.,!؛:]|$)/.test(normAr) && TALABAT_CONTEXT_RE.test(normAr)))
  ) {
    return { channelId: 'talabat', asksByChannelBreakdown: false }
  }

  if (matched.length === 1 && !asksByChannelBreakdown) {
    return { channelId: matched[0], asksByChannelBreakdown: false }
  }
  return { channelId: null, asksByChannelBreakdown }
}

const TALABAT_CONTEXT_RE =
  /(مبيعات|مبيع|بيع|توصيل|دخل|ايراد|\bsales\b|\bdelivery\b|(^|\s)(بال|ب|في |فرع )?[^\s]*(كوت|سالميه|عارضيه|بروميناد|افنيوز|عاصمه|360))/

/** Aggregator channels count payouts/batches (دفعات), never orders. */
export const AGGREGATOR_CHANNEL_IDS: ReadonlySet<ApprovedFeryalChannelId> = new Set([
  'talabat',
  'talabat-tgo',
  'talabat-tmp',
  'keeta',
  'deliveroo',
  'jahez',
  'snoonu',
])

/** Underlying cube channels for a (possibly combined) Feryal channel. */
export function underlyingChannelIds(id: ApprovedFeryalChannelId): ApprovedFeryalChannelId[] {
  return id === 'talabat' ? ['talabat-tgo', 'talabat-tmp'] : [id]
}

/** "Weakest / lowest / worst branch" questions headline the LOWEST restaurant branch. */
export function isLowestBranchQuestion(question: string): boolean {
  const normAr = normalizeArabicText(question)
  return (
    /(اضعف|اقل|اسوا|ادني|اخر) (فرع|الفروع)|الفرع (الاضعف|الاقل|الاسوا)|الاقل مبيعا/.test(normAr) ||
    /\b(weakest|lowest|worst)\b/i.test(normAr)
  )
}

const FINANCE_STEM_RE =
  /(^|\s)(و|ف)?(ب|ل|ك)?(ال|لل)?(مصاريف|مصروف|مصروفات|صرف|صرفنا|صرفت|رواتب|راتب|عموله|عمولات|ذمم|كاش|بنك|البنك)(?=[\s؟?.,!؛:]|$)|\b(expenses?|salar(y|ies)|commissions?|payroll)\b/i
const INVENTORY_STEM_RE =
  /(^|\s)(و|ف)?(ب|ل|ك)?(ال|لل)?(مخزون|مخزن|جرد)(?=[\s؟?.,!؛:]|$)|\b(inventory|stock on hand|stock)\b/i
const TOP_PRODUCT_RE =
  /(اكثر|افضل|اعلي|احسن|اكبر) (صنف|منتج|طبق|وجبه|اكله|ايتم)|(الصنف|المنتج|الطبق|الوجبه) (الاكثر|الافضل|الاعلي)|\b(best[- ]?sellers?|top (selling )?(item|product)s?|most sold (item|product))\b/i

/** Detects executive pricing simulations, Pareto/ABC menu velocity, or SKU menu-engineering strategy prompts. */
export function isExecutivePricingOrMenuStrategyQuestion(question: string): boolean {
  const norm = normalizeArabicText(question)
  if (!norm) return false
  if (
    /\b(?:pareto|abc\s+(?:tier|tiers|analysis|classification|matrix|velocity|menu)|menu\s+(?:engineering|velocity|strategy|optimization|pricing|simulation|playbook)|price\s+(?:simulation|scenarios?|elasticity|sheet|proposal|options?|playbook)|pricing\s+(?:strategy|scenarios?|playbook|options?|simulation|impact|review)|executive\s+(?:pricing|menu|sku))\b/i.test(
      norm,
    )
  ) {
    return true
  }
  if (
    /(?:باريتو|تصنيف\s*abc|تحليل\s*abc|فئات\s*abc|هندسه\s*(?:المنيو|القائمه|الاصناف)|مرونه\s*(?:السعر|الاسعار)|محاكاه\s*(?:الاسعار|التسعير)|سيناريوهات\s*(?:التسعير|الاسعار)|جدول\s*(?:الاسعار|تسعير)|اسعار\s*مقترحه|خيارات\s*التسعير|استراتيجيه\s*التسعير|خطه\s*تسعير|رفع\s*اسعار\s*(?:المنيو|الاصناف|القائمه)|تعديل\s*اسعار\s*(?:المنيو|الاصناف))/.test(
      norm,
    )
  ) {
    return true
  }
  return false
}

const SHEET_FOLLOW_UP_OVERLAP_RE =
  /\b(?:price|prices|pricing|increase|increases|hike|hikes|cap|capped|capping|hold|approve|approved|option|options|ch|ae|suggested|proposal|proposals|proposed|sheet|table|menu|sku|skus|item|items|dish|dishes|platter|rice|chicken|beef|shrimp|noodle|noodles|combo|agree|disagree|opinion|recommend|recommended|recommendation|recommendations|feryal|rec|justify|justification|rationale|verdict|why|explain|summarize|summary|board|brief|playbook|scenario|scenarios|base|conservative|stress|elasticity|tier|tiers|abc|pareto|dine[- ]in|takeaway|talabat|deliveroo|keeta|jahez|snoonu|aggregator|aggregators|channel|channels|commission|commissions|kwd|kd|fils|margin|margins|cogs|food\s+cost)\b|(?:سعر|اسعار|الاسعار|تسعير|التسعير|زياده|زيادات|الزياده|الزيادات|رفع|سقف|توافق|توافقين|موافق|موافقه|تتفق|تتفقين|راي|رايج|رايك|الراي|توصيه|توصيات|توصيتك|توصيتج|موصي|الموصي|تنصح|تنصحين|مقترح|مقترحه|المقترح|المقترحه|مبرر|مبررات|المبررات|تبرير|فقره|ملخص|لخص|لخصي|اختصر|اختصري|مجلس|الاداره|ليش|لماذا|شلون|كيف|شنو\s+راي|شو\s+راي|وش\s+راي|خيار|خيارات|الخيار|الخيارات|جدول|الجدول|منيو|المنيو|قائمه|القائمه|صنف|اصناف|الاصناف|طبق|اطباق|صاله|الصاله|سفري|توصيل|طلبات|كيتا|ديليفرو|جاهز|سنونو|منصات|المنصات|عموله|عمولات|مرونه|المرونه|سيناريو|سيناريوهات|ضغط|متحفظ|فريال|دينار|فلس|هامش|تكلفه)/iu

const UNRELATED_OPERATIONAL_DOMAIN_RE =
  /(?:hr\.employee|عدد الموظفين|اجمالي الموظفين|كم موظف|الموظفين|موظفي|الموظفون|الكادر الوظيفي|القوي العامله|الموارد البشريه|الحضور والانصراف|بصمه الحضور|تاخير البصمه|العمل الاضافي|ساعات العمل|اوفر تايم|مسير الرواتب|مسيرات الرواتب|قسائم الرواتب|انتهاء الاقامات|نهايه الخدمه|\bemployees?\b|\bheadcount\b|\bworkforce\b|\battendance\b|\bovertime\b|\bpayroll\b|\bpayslips?\b|\bbiometric\b|stock\.move|stock\.scrap|stock\.quant|التحويل المخزني|التحويلات المخزنيه|تحويل مخزني|تحويلات المخزن|حركات المخزن|حركه المخزون|سلسله المخزن|جرد المخزن|المخزون الحالي|رصيد المخزن|الهدر بالمخزن|التالف بالمخزن|\bwarehouse\s+transfer\b|\bstock\s+move\b|\bstock\s+on\s+hand\b|\binventory\s+count\b|\bscrap\b|purchase\.order|امر شراء|اوامر الشراء|اوامر شراء|فواتير الموردين|ذمم الموردين|تكاليف الموردين|\bpurchase\s+orders?\b|\bvendor\s+bills?\b|\bsupplier\s+invoices?\b|account\.move\.line|دفتر الاستاذ|القيود المحاسبيه|قيود اليوميه|رصيد البنك|كشف البنك|الذمم المدينه المفتوحه|\bgeneral\s+ledger\b|\bjournal\s+entries\b|\bbank\s+balance\b|\bopen\s+receivables\b)/iu

/**
 * Determines whether a follow-up prompt in a thread with an active `ConfirmedPriceSheet`
 * should stay locked onto the Executive Pricing Advisor path.
 * Returns `true` for ANY question UNLESS the user is clearly asking an unrelated operational
 * domain query with zero pricing/menu/sheet/opinion overlap (such as pure HR attendance/payroll
 * or pure warehouse stock/scrap).
 */
export function isConfirmedSheetFollowUpQuestion(question: string): boolean {
  const trimmed = (question ?? '').trim()
  if (!trimmed) return true
  const norm = normalizeArabicText(trimmed)
  if (!norm) return true
  if (SHEET_FOLLOW_UP_OVERLAP_RE.test(norm) || SHEET_FOLLOW_UP_OVERLAP_RE.test(trimmed)) {
    return true
  }
  if (UNRELATED_OPERATIONAL_DOMAIN_RE.test(norm) || UNRELATED_OPERATIONAL_DOMAIN_RE.test(trimmed)) {
    return false
  }
  return true
}

/** Detects predominant prompt language ('ar' if Arabic script letters are present, else 'en'). */
export function detectFeryalPromptLocale(question: string): 'ar' | 'en' {
  const arMatches = question.match(/[\u0600-\u06FF]/g)?.length ?? 0
  const enMatches = question.match(/[A-Za-z]/g)?.length ?? 0
  if (arMatches === 0 && enMatches > 0) return 'en'
  if (arMatches >= enMatches) return 'ar'
  return arMatches >= 4 ? 'ar' : 'en'
}

/** Item-level POS pricing, distinct from a brand total. */
export function isItemLevelPosQuestion(question: string): boolean {
  if (isExecutivePricingOrMenuStrategyQuestion(question)) {
    return true
  }
  const norm = normalizeArabicText(question)
  if (
    /(menu items|item-level|item level|per[- ]sku|\bskus?\b|pricing impact|proposed price|price impact|quantities sold|price_subtotal|pos\.order\.line|top selling menu)/i.test(
      norm,
    )
  ) {
    return true
  }
  if (/(سعر مقترح|اسعار الاصناف|تسعير الصنف|اثر السعر|تاثير السعر|لو صار السعر|لو رفعنا السعر)/.test(norm)) {
    return true
  }
  return /what[- ]if/i.test(norm) && /\d/.test(norm) && /(price|سعر|kwd)/i.test(norm)
}

export function isFinanceQuestion(question: string): boolean {
  return FINANCE_STEM_RE.test(normalizeArabicText(question))
}
export function isInventoryOnHandQuestion(question: string): boolean {
  return INVENTORY_STEM_RE.test(normalizeArabicText(question))
}

export function getKuwaitCalendarParts(nowMs = Date.now()): {
  year: number
  month: number
  day: number
  iso: string
} {
  const kwDate = new Date(nowMs + KUWAIT_OFFSET_MS)
  const year = kwDate.getUTCFullYear()
  const month = kwDate.getUTCMonth() + 1
  const day = kwDate.getUTCDate()
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { year, month, day, iso }
}

export function shiftIsoDateDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map((x) => Number(x))
  const utcMs = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000
  const dt = new Date(utcMs)
  return `${String(dt.getUTCFullYear()).padStart(4, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }
  const dt = new Date(Date.UTC(year, month - 1, day))
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() + 1 === month &&
    dt.getUTCDate() === day
  )
}

export function buildAllowedDateStrings(fromIso: string, toIso: string): string[] {
  const out = new Set<string>()
  for (const iso of [fromIso, toIso]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue
    out.add(iso)
    const [yyyy, mm, dd] = iso.split('-')
    const dNum = Number(dd)
    const mNum = Number(mm)
    out.add(`${dd}/${mm}/${yyyy}`)
    out.add(`${dNum}/${mNum}/${yyyy}`)
    out.add(`${dd}/${mm}`)
    out.add(`${dNum}/${mNum}`)
  }
  return [...out]
}

export interface ResolvedFeryalPeriod {
  from: string
  to: string
  periodLabelAr: string
  allowedDateStrings: string[]
  hasExplicitPeriod: boolean
  isRecentCompleted7Days?: boolean
}

export interface ResolvedFeryalComparisonPeriods {
  periodA: { from: string; to: string; periodLabelAr: string }
  periodB: { from: string; to: string; periodLabelAr: string }
  allowedDateStrings: string[]
}

function formatIsoYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatRangeLabelAr(from: string, to: string): string {
  return from === to ? from : `${from} إلى ${to}`
}

function makeResolvedPeriod(
  from: string,
  to: string,
  hasExplicitPeriod: boolean,
  overrides?: { periodLabelAr?: string; isRecentCompleted7Days?: boolean },
): ResolvedFeryalPeriod {
  return {
    from,
    to,
    periodLabelAr: overrides?.periodLabelAr ?? formatRangeLabelAr(from, to),
    allowedDateStrings: buildAllowedDateStrings(from, to),
    hasExplicitPeriod,
    ...(overrides?.isRecentCompleted7Days ? { isRecentCompleted7Days: true } : {}),
  }
}

function makeComparisonPeriods(
  aFrom: string,
  aTo: string,
  bFrom: string,
  bTo: string,
): ResolvedFeryalComparisonPeriods {
  return {
    periodA: { from: aFrom, to: aTo, periodLabelAr: formatRangeLabelAr(aFrom, aTo) },
    periodB: { from: bFrom, to: bTo, periodLabelAr: formatRangeLabelAr(bFrom, bTo) },
    allowedDateStrings: [
      ...new Set([
        ...buildAllowedDateStrings(aFrom, aTo),
        ...buildAllowedDateStrings(bFrom, bTo),
      ]),
    ],
  }
}

function parseExplicitIsoDates(normDigits: string): string[] {
  const isoMatches = [
    ...normDigits.matchAll(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/g),
  ]
  const parsed: string[] = []
  for (const m of isoMatches) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (isValidCalendarDate(y, mo, d)) {
      parsed.push(formatIsoYmd(y, mo, d))
    }
  }
  return parsed
}

function parseExplicitSlashDates(
  normDigits: string,
  kwToday: { year: number; iso: string },
): string[] {
  const slashMatches = [
    ...normDigits.matchAll(
      /(?:^|[^\d])(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])(?:\/(20\d{2}))?(?=[^\d]|$)/g,
    ),
  ]
  const parsed: string[] = []
  for (const m of slashMatches) {
    const day = Number(m[1])
    const month = Number(m[2])
    let year = m[3] ? Number(m[3]) : kwToday.year
    if (!m[3] && formatIsoYmd(year, month, day) > kwToday.iso) {
      year -= 1
    }
    if (isValidCalendarDate(year, month, day)) {
      parsed.push(formatIsoYmd(year, month, day))
    }
  }
  return parsed
}

function computePreviousMonthWindow(kwToday: { year: number; month: number }): {
  from: string
  to: string
} {
  const prevMonthYear = kwToday.month === 1 ? kwToday.year - 1 : kwToday.year
  const prevMonth = kwToday.month === 1 ? 12 : kwToday.month - 1
  const lastDay = new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate()
  return {
    from: formatIsoYmd(prevMonthYear, prevMonth, 1),
    to: formatIsoYmd(prevMonthYear, prevMonth, lastDay),
  }
}

function computeStandardPeriodWindow(
  period: Exclude<ApprovedFeryalPeriodId, 'custom'>,
  kwToday: { year: number; month: number; iso: string },
): { from: string; to: string } {
  switch (period) {
    case 'today':
      return { from: kwToday.iso, to: kwToday.iso }
    case 'week':
      return { from: shiftIsoDateDays(kwToday.iso, -6), to: kwToday.iso }
    case 'month':
      return { from: formatIsoYmd(kwToday.year, kwToday.month, 1), to: kwToday.iso }
    case 'year':
      return { from: formatIsoYmd(kwToday.year, 1, 1), to: kwToday.iso }
  }
}

export function resolveFeryalComparisonPeriods(
  question: string,
  referenceNowMs = Date.now(),
): ResolvedFeryalComparisonPeriods | null {
  const normDigits = normalizeDigits(question)
  const normAr = normalizeArabicText(question)
  const hasComparisonCue =
    /(قارن|مقارنه|بالمقارنه|مقابل|ضد|الفرق بين|\bvs\.?\b|\bversus\b|\bcompare\b)/i.test(normAr)
  if (!hasComparisonCue) return null

  const kwToday = getKuwaitCalendarParts(referenceNowMs)

  // 1. Two distinct explicit ISO dates
  const distinctIsos = [...new Set(parseExplicitIsoDates(normDigits))]
  if (distinctIsos.length >= 2) {
    return makeComparisonPeriods(distinctIsos[0], distinctIsos[0], distinctIsos[1], distinctIsos[1])
  }

  // 2. Two distinct explicit DD/MM or DD/MM/YYYY dates
  const distinctSlashIsos = [...new Set(parseExplicitSlashDates(normDigits, kwToday))]
  if (distinctSlashIsos.length >= 2) {
    return makeComparisonPeriods(
      distinctSlashIsos[0],
      distinctSlashIsos[0],
      distinctSlashIsos[1],
      distinctSlashIsos[1],
    )
  }

  // 3. Relative day/period pairs
  if (
    /(اول امس|قبل امس|\bday before yesterday\b)/i.test(normAr) &&
    /(امس|الامس|\byesterday\b)/i.test(normAr)
  ) {
    const a = shiftIsoDateDays(kwToday.iso, -1)
    const b = shiftIsoDateDays(kwToday.iso, -2)
    return makeComparisonPeriods(a, a, b, b)
  }

  if (
    /(^|\s)(اليوم|\btoday\b)(?=[\s؟?.,!؛:()«»"']|$)/i.test(normAr) &&
    /(^|\s)(امس|الامس|\byesterday\b)(?=[\s؟?.,!؛:()«»"']|$)/i.test(normAr)
  ) {
    const a = kwToday.iso
    const b = shiftIsoDateDays(kwToday.iso, -1)
    return makeComparisonPeriods(a, a, b, b)
  }

  if (
    /(هذا الاسبوع|الاسبوع الحالي|\bthis week\b)/i.test(normAr) &&
    /(الاسبوع الماضي|الاسبوع السابق|\blast week\b)/i.test(normAr)
  ) {
    const weekA = computeStandardPeriodWindow('week', kwToday)
    const bFrom = shiftIsoDateDays(kwToday.iso, -13)
    const bTo = shiftIsoDateDays(kwToday.iso, -7)
    return makeComparisonPeriods(weekA.from, weekA.to, bFrom, bTo)
  }

  if (
    /(هذا الشهر|الشهر الحالي|\bthis month\b)/i.test(normAr) &&
    /(الشهر الماضي|الشهر السابق|\blast month\b)/i.test(normAr)
  ) {
    const monthA = computeStandardPeriodWindow('month', kwToday)
    const monthB = computePreviousMonthWindow(kwToday)
    return makeComparisonPeriods(monthA.from, monthA.to, monthB.from, monthB.to)
  }

  return null
}

export function resolveFeryalQuestionPeriod(
  question: string,
  referenceNowMs = Date.now(),
  defaults?: Pick<ValidatedFeryalContextDefaults, 'period' | 'customFrom' | 'customTo'> | null,
): ResolvedFeryalPeriod {
  const normDigits = normalizeDigits(question)
  const normAr = normalizeArabicText(question)
  const kwToday = getKuwaitCalendarParts(referenceNowMs)

  // 1. Explicit ISO YYYY-MM-DD dates
  const parsedIsos = parseExplicitIsoDates(normDigits)
  if (parsedIsos.length >= 2) {
    const sorted = [...parsedIsos].sort()
    return makeResolvedPeriod(sorted[0], sorted[sorted.length - 1], true)
  }
  if (parsedIsos.length === 1) {
    return makeResolvedPeriod(parsedIsos[0], parsedIsos[0], true)
  }

  // 2. Explicit DD/MM/YYYY or DD/MM dates (e.g. `14/11/2026` or `14/11`)
  const parsedSlashIsos = parseExplicitSlashDates(normDigits, kwToday)
  if (parsedSlashIsos.length >= 2) {
    const sorted = [...parsedSlashIsos].sort()
    return makeResolvedPeriod(sorted[0], sorted[sorted.length - 1], true)
  }
  if (parsedSlashIsos.length === 1) {
    return makeResolvedPeriod(parsedSlashIsos[0], parsedSlashIsos[0], true)
  }

  // 3. Relative day / range keywords in Kuwait timezone
  if (/\b(day before yesterday)\b/i.test(normDigits) || /(اول امس|قبل امس)/.test(normAr)) {
    const d = shiftIsoDateDays(kwToday.iso, -2)
    return makeResolvedPeriod(d, d, true)
  }

  if (
    /\b(yesterday)\b/i.test(normDigits) ||
    /(^|\s)(امس|الامس|البارحه)(?=[\s؟?.,!؛:()«»"']|$)/.test(normAr)
  ) {
    const d = shiftIsoDateDays(kwToday.iso, -1)
    return makeResolvedPeriod(d, d, true)
  }

  if (
    /\b(today)\b/i.test(normDigits) ||
    /(^|\s)(اليوم|نهار اليوم)(?=[\s؟?.,!؛:()«»"']|$)/.test(normAr)
  ) {
    const win = computeStandardPeriodWindow('today', kwToday)
    return makeResolvedPeriod(win.from, win.to, true)
  }

  // "مؤخراً / أخيراً / recently" -> last 7 completed days (yesterday - 6 through yesterday)
  if (
    /\b(recently|lately)\b/i.test(normDigits) ||
    /(^|\s)(مؤخرا|موخرا|اخيرا|بالفتره الاخيره|في الفتره الاخيره|خلال الفتره الاخيره|الايام الاخيره)(?=[\s؟?.,!؛:()«»"']|$)/.test(
      normAr,
    )
  ) {
    const from = shiftIsoDateDays(kwToday.iso, -7)
    const to = shiftIsoDateDays(kwToday.iso, -1)
    return makeResolvedPeriod(from, to, true, {
      periodLabelAr: `آخر سبعة أيام مكتملة (${from} إلى ${to})`,
      isRecentCompleted7Days: true,
    })
  }

  if (/\b(last week)\b/i.test(normDigits) || /(الاسبوع الماضي|الاسبوع السابق)/.test(normAr)) {
    return makeResolvedPeriod(shiftIsoDateDays(kwToday.iso, -7), shiftIsoDateDays(kwToday.iso, -1), true)
  }

  if (
    /\b(this week|week)\b/i.test(normDigits) ||
    /(هذا الاسبوع|الاسبوع الحالي|اخر اسبوع|الاسبوع)/.test(normAr)
  ) {
    const win = computeStandardPeriodWindow('week', kwToday)
    return makeResolvedPeriod(win.from, win.to, true)
  }

  if (/\b(last month)\b/i.test(normDigits) || /(الشهر الماضي|الشهر السابق)/.test(normAr)) {
    const win = computePreviousMonthWindow(kwToday)
    return makeResolvedPeriod(win.from, win.to, true)
  }

  if (
    /\b(this year|year|ytd|year to date)\b/i.test(normDigits) ||
    /(هذه السنه|هذا العام|السنه الحاليه|من بدايه السنه|العام)/.test(normAr)
  ) {
    const win = computeStandardPeriodWindow('year', kwToday)
    return makeResolvedPeriod(win.from, win.to, true)
  }

  if (
    /\b(last 30 days|30 days)\b/i.test(normDigits) ||
    /(اخر 30 يوم|اخر 30 يوما|خلال 30 يوم|ثلاثين يوم)/.test(normAr)
  ) {
    return makeResolvedPeriod(shiftIsoDateDays(kwToday.iso, -29), kwToday.iso, true)
  }

  if (
    /\b(this month|month)\b/i.test(normDigits) ||
    /(هذا الشهر|الشهر الحالي|من بدايه الشهر|الشهر)/.test(normAr)
  ) {
    const win = computeStandardPeriodWindow('month', kwToday)
    return makeResolvedPeriod(win.from, win.to, true)
  }

  // 4. Context filter default when the question did not name an explicit period
  if (defaults?.period) {
    if (defaults.period === 'custom') {
      if (defaults.customFrom && defaults.customTo) {
        const to = defaults.customTo > kwToday.iso ? kwToday.iso : defaults.customTo
        const safeFrom = defaults.customFrom > to ? to : defaults.customFrom
        return makeResolvedPeriod(safeFrom, to, false)
      }
    } else {
      const win = computeStandardPeriodWindow(defaults.period, kwToday)
      return makeResolvedPeriod(win.from, win.to, false)
    }
  }

  // 5. Fallback active 30-day window up to Kuwait today
  return makeResolvedPeriod(shiftIsoDateDays(kwToday.iso, -29), kwToday.iso, false)
}

export type DetectedOdooToolKind =
  | 'pos_comparison'
  | 'pos_brands'
  | 'pos_orders'
  | 'pos_order_lines'
  | 'account_move_lines'
  | 'purchase_orders'
  | 'stock_moves'
  | 'hr_employees'
  /** Stock on hand (`stock.quant`) is not linked — answered as «غير متاح», never with sales. */
  | 'inventory_on_hand'
  | 'unknown'

export function detectOdooToolKind(
  question: string,
  targetBranchId: ApprovedFeryalBranchId | null,
  brandDetection: { brandId: ApprovedFeryalBrandId | null; asksByBrandBreakdown: boolean },
  hasComparisonPeriods: boolean,
  isBranchRanking = false,
): DetectedOdooToolKind {
  const normAr = normalizeArabicText(question)

  // 0. HR Employees (`hr.employee`)
  if (
    /(hr\.employee|عدد الموظفين|اجمالي الموظفين|كم موظف|الموظفين|موظفي|الموظفون|الكادر الوظيفي|القوي العامله|الموارد البشريه|\bemployees?\b|\bheadcount\b|\bworkforce\b)/i.test(
      normAr,
    )
  ) {
    return 'hr_employees'
  }

  // 1. Purchase orders / supplier costs (`purchase.order` / `purchase.order.line`)
  if (
    /(purchase\.order|امر شراء|اوامر الشراء|اوامر شراء|مشتريات|تكلفه مورد|تكلفه المورد|تكاليف الموردين|مورد|المورد|موردين|الموردين|فاتوره مورد|\bsupplier\b|\bsuppliers\b|\bvendor\b|\bvendors\b|\bprocurement\b)/i.test(
      normAr,
    )
  ) {
    return 'purchase_orders'
  }

  // 2. Warehouse transfers / stock moves / scrap (`stock.move` / `stock.scrap`)
  if (
    /(stock\.move|stock\.scrap|التحويل المخزني|التحويلات المخزنيه|تحويل مخزني|تحويلات المخزن|حركات المخزن|حركه المخزون|سلسله المخزن|الهدر|تالف|التالف|اتلاف|\bwarehouse transfer\b|\bstock move\b|\bscrap\b|\bwaste\b)/i.test(
      normAr,
    )
  ) {
    return 'stock_moves'
  }

  // 2b. Stock on hand / inventory level — never answered from POS sales.
  if (INVENTORY_STEM_RE.test(normAr)) {
    return 'inventory_on_hand'
  }

  // 3a. Expense / payroll / commission / receivable / cash / bank wording — GL, never POS sales.
  if (FINANCE_STEM_RE.test(normAr)) {
    return 'account_move_lines'
  }

  // 3. General Ledger / accounting / receivables (`account.move.line`)
  if (
    /(account\.move\.line|دفتر الاستاذ|القيود المحاسبيه|قيود اليوميه|الذمم المدينه|ذمم المنصات|مستحقات المنصات|صافي الربح|الارباح والخسائر|المصروفات|المصاريف|تكلفه البضاعه|\bledger\b|\breceivables\b|\bnet profit\b|\bexpenses\b)/i.test(
      normAr,
    )
  ) {
    return 'account_move_lines'
  }

  // 4. Two-period POS comparison (`pos.order`)
  if (hasComparisonPeriods) {
    return 'pos_comparison'
  }

  // 5. Top selling products / POS line items / item discounts (`pos.order.line`)
  const asksItemLines =
    isItemLevelPosQuestion(question) ||
    TOP_PRODUCT_RE.test(normAr) ||
    /(pos\.order\.line|اعلي \d+ اصناف|اعلي اصناف|اعلي الاصناف|افضل الاصناف|افضل \d+ اصناف|الاصناف الاكثر|مبيعات الاصناف|الاصناف|الاطباق|المنتجات|الخصومات|نسبه الخصم|خصومات الاصناف|\btop \d* ?items\b|\btop \d* ?products\b|\bdiscounts\b)/i.test(
      normAr,
    ) ||
    (!isBranchRanking && /\bbest selling\b/i.test(normAr) && !/\bbranch(?:es)?\b/i.test(normAr))
  if (asksItemLines) {
    return 'pos_order_lines'
  }

  // 6. Brand sales breakdown or single brand (`pos.order.line` + `pos.order`)
  if (!isBranchRanking && (brandDetection.asksByBrandBreakdown || brandDetection.brandId !== null)) {
    return 'pos_brands'
  }

  // 7. POS sales / orders / branch ranking / dialect sales & recent intents (`pos.order`)
  const hasPosSalesOrBranchIntent =
    isBranchRanking ||
    targetBranchId !== null ||
    detectTargetChannelFromQuestion(question).channelId !== null ||
    /(pos\.order|اي فرع|مين الفرع|اعلي فرع|اكثر فرع|افضل فرع|اقل فرع|اسوا فرع|الاعلي مبيعا|الاكثر مبيعا|مبيعات|المبيعات|بالمبيعات|للمبيعات|مبيعا|مبيع|باع|باعت|يبيع|بيع|البيع|ايرادات|الايرادات|ايراد|الطلبات|عدد الطلبات|متوسط السله|الفروع|الفرع|حسب الفرع|غير منسوب|مؤخرا|موخرا|اخيرا|\bsales\b|\bsold\b|\borders\b|\brevenue\b|\bbranches\b|\bbranch\b|\bwhich branch\b|\btop branch\b|\bbest branch\b|\brecently\b)/i.test(
      normAr,
    )

  if (hasPosSalesOrBranchIntent) {
    return 'pos_orders'
  }

  return 'unknown'
}

export const FERYAL_CONNECTION_ERROR_AR = 'تعذّر الاتصال — أعد المحاولة' as const
export const FERYAL_CONNECTION_ERROR_EN =
  'Connection failed — please retry (تعذّر الاتصال — أعد المحاولة)' as const

export interface FeryalFrozenScope {
  periodKey: string
  periodLabel: string
  dateFrom: string
  dateTo: string
  brandScope: string
  branchScope: string
  channelScope: string
}

export interface ActivePriceSheetResponseSummary {
  fileName: string
  draftId: string
  matchedRows: number
  totalRows: number
  brandScope: string
  dateFrom: string
  dateTo: string
}

export function buildFeryalFrozenScope(input: {
  dateFrom: string
  dateTo: string
  validatedPeriod?: ApprovedFeryalPeriodId | null
  rawPeriodKey?: string | null
  requestedPeriodLabel?: string | null
  hasExplicitPeriod?: boolean
  brandId?: ApprovedFeryalBrandId | string | null
  branchId?: ApprovedFeryalBranchId | string | null
  channelId?: ApprovedFeryalChannelId | string | null
  referenceNowMs?: number
}): FeryalFrozenScope {
  const kwTodayIso = getKuwaitCalendarParts(input.referenceNowMs).iso
  const dateFrom = input.dateFrom
  const dateTo = input.dateTo
  const rangeText = dateFrom === dateTo ? dateFrom : `${dateFrom} -> ${dateTo}`

  let periodKey: string
  if (input.hasExplicitPeriod) {
    periodKey = dateFrom === dateTo && dateFrom === kwTodayIso ? 'today' : 'custom'
  } else if (input.validatedPeriod) {
    periodKey = input.validatedPeriod
  } else if (typeof input.rawPeriodKey === 'string' && input.rawPeriodKey.trim()) {
    periodKey = input.rawPeriodKey.trim()
  } else {
    periodKey = '30d'
  }

  let periodLabel: string
  const customLabel =
    !input.hasExplicitPeriod && typeof input.requestedPeriodLabel === 'string'
      ? input.requestedPeriodLabel.trim()
      : ''
  if (customLabel) {
    periodLabel = customLabel.includes(dateFrom) ? customLabel : `${customLabel} (${rangeText})`
  } else if (input.hasExplicitPeriod) {
    periodLabel =
      dateFrom === dateTo && dateFrom === kwTodayIso ? `Today (${dateFrom})` : rangeText
  } else {
    switch (input.validatedPeriod) {
      case 'today':
        periodLabel = `Today (${dateFrom})`
        break
      case 'week':
        periodLabel = `Last 7 Days (${rangeText})`
        break
      case 'month':
        periodLabel = `Month to Date (${rangeText})`
        break
      case 'year':
        periodLabel = `Year to Date (${rangeText})`
        break
      case 'custom':
        periodLabel = `Custom Range (${rangeText})`
        break
      default:
        periodLabel = `Last 30 Days (${rangeText})`
        break
    }
  }

  const brandMeta = input.brandId
    ? APPROVED_FERYAL_BRAND_LIST.find((b) => b.id === input.brandId)
    : undefined
  const branchMeta = input.branchId
    ? ALL_FERYAL_BRANCHES.find((b) => b.id === input.branchId)
    : undefined
  const channelMeta = input.channelId
    ? APPROVED_FERYAL_CHANNEL_LIST.find((c) => c.id === input.channelId)
    : undefined

  return {
    periodKey,
    periodLabel,
    dateFrom,
    dateTo,
    brandScope: brandMeta?.nameEn ?? 'All Brands',
    branchScope: branchMeta?.nameEn ?? 'All Branches',
    channelScope: channelMeta?.nameEn ?? 'All Channels',
  }
}

export interface FeryalChatRequestPayload {
  question: string
  period: string
  branch: string
  brand: string
  channel: string
  customFrom?: string
  customTo?: string
  confirmedPriceSheet?: unknown
  isFollowUpOnConfirmedSheet?: boolean
  activePriceSheetSummary?: string | null
  periodLabel?: string | null
}

export function buildFeryalChatRequestPayload(
  question: string,
  filters: {
    period: string
    branch: string
    brand: string
    channel: string
    customFrom?: string
    customTo?: string
  },
  urlSearch?: string,
  confirmedPriceSheet?: unknown,
  followUpOptions?: {
    isFollowUpOnConfirmedSheet?: boolean
    activePriceSheetSummary?: string | null
    periodLabel?: string | null
  },
): FeryalChatRequestPayload {
  let period = filters.period || 'month'
  let branch = filters.branch || 'all'
  let brand = filters.brand || 'all'
  let channel = filters.channel || 'all'
  let customFrom = filters.customFrom
  let customTo = filters.customTo

  if (urlSearch) {
    const sp = new URLSearchParams(urlSearch)
    const urlDefaults = validateFeryalContextDefaults({
      period: sp.get('period'),
      customFrom: sp.get('from'),
      customTo: sp.get('to'),
      branch: sp.get('branch'),
      brand: sp.get('brand'),
      channel: sp.get('channel'),
    })
    if (period === 'month' && urlDefaults.period) period = urlDefaults.period
    if (branch === 'all' && urlDefaults.branchId) branch = urlDefaults.branchId
    if (brand === 'all' && urlDefaults.brandId) brand = urlDefaults.brandId
    if (channel === 'all' && urlDefaults.channelId) channel = urlDefaults.channelId
    if (period === 'custom') {
      if (!customFrom && urlDefaults.customFrom) customFrom = urlDefaults.customFrom
      if (!customTo && urlDefaults.customTo) customTo = urlDefaults.customTo
    }
  }

  return {
    question,
    period,
    branch,
    brand,
    channel,
    ...(period === 'custom' && customFrom && customTo ? { customFrom, customTo } : {}),
    ...(confirmedPriceSheet !== undefined ? { confirmedPriceSheet } : {}),
    ...(followUpOptions?.isFollowUpOnConfirmedSheet !== undefined
      ? { isFollowUpOnConfirmedSheet: followUpOptions.isFollowUpOnConfirmedSheet }
      : {}),
    ...(followUpOptions?.activePriceSheetSummary !== undefined
      ? { activePriceSheetSummary: followUpOptions.activePriceSheetSummary }
      : {}),
    ...(followUpOptions?.periodLabel !== undefined
      ? { periodLabel: followUpOptions.periodLabel }
      : {}),
  }
}

export function buildFeryalConnectionErrorOutcome(isAr: boolean): {
  replyText: string
  modelBadge: string
  replyStatus: 'connection_error'
} {
  return {
    replyText: isAr ? FERYAL_CONNECTION_ERROR_AR : FERYAL_CONNECTION_ERROR_EN,
    modelBadge: isAr ? 'تعذّر الاتصال' : 'Connection error',
    replyStatus: 'connection_error',
  }
}

export interface ParsedFeryalChatTurnOutcome<
  TQuery = unknown,
  TVerifier = unknown,
  TCouncil extends { provider: string; modelId: string; status: string } = {
    provider: string
    modelId: string
    status: string
  },
  TAgreed extends { provider: string; modelId: string } = {
    provider: string
    modelId: string
  },
> {
  replyText: string
  modelBadge: string
  replyStatus: string
  executedQueries: TQuery[]
  verifier?: TVerifier
  council?: TCouncil[]
  agreedList?: TAgreed[]
  frozenScope?: FeryalFrozenScope
  activePriceSheetSummary?: ActivePriceSheetResponseSummary | null
  diagnostics?: unknown
}

export async function parseFeryalChatHttpResponse<
  TQuery = unknown,
  TVerifier = unknown,
  TCouncil extends { provider: string; modelId: string; status: string } = {
    provider: string
    modelId: string
    status: string
  },
  TAgreed extends { provider: string; modelId: string } = {
    provider: string
    modelId: string
  },
>(
  res: { ok: boolean; json: () => Promise<unknown> },
  isAr: boolean,
): Promise<ParsedFeryalChatTurnOutcome<TQuery, TVerifier, TCouncil, TAgreed>> {
  const connectionError = buildFeryalConnectionErrorOutcome(isAr)
  if (!res.ok) {
    return {
      replyText: connectionError.replyText,
      modelBadge: connectionError.modelBadge,
      replyStatus: connectionError.replyStatus,
      executedQueries: [],
    }
  }

  let raw: unknown
  try {
    raw = await res.json()
  } catch {
    return {
      replyText: connectionError.replyText,
      modelBadge: connectionError.modelBadge,
      replyStatus: connectionError.replyStatus,
      executedQueries: [],
    }
  }

  const payload =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as {
          ok?: boolean
          reply?: string
          status?: string
          model?: string
          executedQueries?: TQuery[]
          verifier?: TVerifier
          participants?: TCouncil[]
          agreed?: TAgreed[]
          frozenScope?: FeryalFrozenScope
          activePriceSheetSummary?: ActivePriceSheetResponseSummary | null
          diagnostics?: unknown
        })
      : null

  if (!payload || !payload.ok || typeof payload.reply !== 'string' || !payload.reply.trim()) {
    return {
      replyText: connectionError.replyText,
      modelBadge: connectionError.modelBadge,
      replyStatus: connectionError.replyStatus,
      executedQueries: [],
    }
  }

  const replyStatus = payload.status || 'answered'
  const council = Array.isArray(payload.participants) ? payload.participants : undefined
  const agreedList = Array.isArray(payload.agreed)
    ? payload.agreed
    : ((council ?? [])
        .filter((item) => item.status === 'ok' && item.modelId)
        .map((item) => ({ provider: item.provider, modelId: item.modelId })) as TAgreed[])
  const modelBadge =
    agreedList.length > 0
      ? agreedList.map((item) => `${item.provider}/${item.modelId}`).join(' · ')
      : payload.status === 'council_failed'
        ? isAr
          ? 'تعذّر التحليل'
          : 'Analysis failed'
        : payload.model || 'Odoo'

  return {
    replyText: payload.reply,
    modelBadge,
    replyStatus,
    executedQueries: Array.isArray(payload.executedQueries) ? payload.executedQueries : [],
    verifier: payload.verifier,
    council,
    agreedList,
    ...(payload.frozenScope ? { frozenScope: payload.frozenScope } : {}),
    ...(payload.activePriceSheetSummary !== undefined
      ? { activePriceSheetSummary: payload.activePriceSheetSummary }
      : {}),
    ...(payload.diagnostics !== undefined ? { diagnostics: payload.diagnostics } : {}),
  }
}
