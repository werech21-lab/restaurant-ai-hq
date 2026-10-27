import type { InsightCategory, InsightSeverity, InsightStatus } from '@/modules/ai/domain/types'

// The Copilot bar. It reads Arabic (or English) phrases with fixed keyword lists. It is not a language model: the same
// text always gives the same result, and a word it does not know becomes a search term for invoices, items and customers.

export type ParsedCommand = {
  /** Run the full system scan. */
  scan: boolean
  category: InsightCategory | null
  severity: InsightSeverity | null
  status: InsightStatus | null
  /** What is left after the known words are removed. Searched in invoices, items, customers and insight text. */
  text: string
}

/**
 * Makes Arabic spellings comparable: removes diacritics and tatweel, folds the alef, yeh, teh marbuta, waw and yeh
 * hamza variants, turns Arabic-Indic digits into Latin digits and lower-cases Latin letters.
 */
export function normalizeArabic(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .toLowerCase()
    .trim()
}

/** Drops the Arabic definite article and its common prefixes, so «الفواتير» and «فواتير» match the same word. */
function bare(token: string): string {
  const stripped = token.replace(/^(وال|بال|لل|ال)/, '')
  return stripped.length >= 2 ? stripped : token
}

const SCAN_WORDS = new Set(['فحص', 'افحص', 'scan', 'health', 'checkup'])

const CATEGORY_WORDS: ReadonlyArray<readonly [InsightCategory, ReadonlySet<string>]> = [
  [
    'finance',
    new Set(['مالي', 'ماليه', 'فواتير', 'فاتوره', 'تحصيل', 'ذمم', 'سداد', 'مديونيه', 'مستحقات', 'finance', 'financial', 'invoices', 'invoice']),
  ],
  [
    'inventory',
    new Set(['مخزون', 'مخازن', 'منتجات', 'منتج', 'اصناف', 'صنف', 'مستودع', 'مستودعات', 'inventory', 'stock', 'items']),
  ],
  ['crm', new Set(['عملاء', 'عميل', 'مبيعات', 'فرص', 'فرصه', 'صفقات', 'صفقه', 'crm', 'leads', 'lead', 'sales', 'deals'])],
]

const SEVERITY_WORDS: ReadonlyArray<readonly [InsightSeverity, ReadonlySet<string>]> = [
  ['critical', new Set(['حرج', 'حرجه', 'حرجين', 'عاجل', 'عاجله', 'critical', 'urgent'])],
  ['warning', new Set(['تحذير', 'تحذيرات', 'تحذيريه', 'warning', 'warnings'])],
  ['opportunity', new Set(['اقتراح', 'اقتراحات', 'opportunity', 'opportunities'])],
]

const STATUS_WORDS: ReadonlyArray<readonly [InsightStatus, ReadonlySet<string>]> = [
  ['open', new Set(['مفتوح', 'مفتوحه', 'open'])],
  ['acknowledged', new Set(['مقروء', 'مقروءه', 'acknowledged'])],
  ['resolved', new Set(['محلول', 'محلوله', 'منتهي', 'منتهيه', 'مغلق', 'مغلقه', 'resolved'])],
]

const STOP_WORDS = new Set([
  'اعرض', 'عرض', 'اظهر', 'ابحث', 'بحث', 'جميع', 'كل', 'لي', 'من', 'في', 'عن', 'الي', 'الى', 'علي', 'مع', 'و',
  'تنبيهات', 'تنبيه', 'انذارات', 'انذار', 'قرارات', 'اذهب', 'افتح', 'ذكي', 'شامل', 'للنظام', 'نظام', 'show', 'all', 'find',
  'search', 'go', 'to', 'open', 'the', 'of', 'for', 'smart', 'full', 'system', 'alert', 'alerts', 'decisions',
])

function lookup<T>(table: ReadonlyArray<readonly [T, ReadonlySet<string>]>, token: string): T | null {
  for (const [value, words] of table) {
    if (words.has(token)) return value
  }
  return null
}

/**
 * Splits the text into words and takes out the ones it knows. «open» is both a status word and a stop word in the lists, so
 * the status wins. Words it does not know are kept in their original spelling as the search text.
 */
export function parseCommand(input: string): ParsedCommand {
  const parsed: ParsedCommand = { scan: false, category: null, severity: null, status: null, text: '' }
  const rest: string[] = []
  for (const original of input.trim().split(/\s+/)) {
    if (original === '') continue
    const normalized = normalizeArabic(original)
    const token = bare(normalized)
    if (SCAN_WORDS.has(token)) {
      parsed.scan = true
      continue
    }
    const status = lookup(STATUS_WORDS, token)
    if (status !== null) {
      parsed.status = status
      continue
    }
    const severity = lookup(SEVERITY_WORDS, token)
    if (severity !== null) {
      parsed.severity = severity
      continue
    }
    const category = lookup(CATEGORY_WORDS, token)
    if (category !== null) {
      parsed.category = category
      continue
    }
    if (STOP_WORDS.has(token) || STOP_WORDS.has(normalized)) continue
    rest.push(original)
  }
  parsed.text = rest.join(' ')
  return parsed
}
