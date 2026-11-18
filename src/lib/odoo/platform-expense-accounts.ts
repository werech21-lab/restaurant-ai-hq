/**
 * Deterministic classification of Odoo `expense` GL accounts into operating-expense groups
 * based solely on `account.account` metadata (`code`, `name`, `account_type`).
 *
 * Runtime-neutral: safe for browser, server, Edge/Pages workers, and unit tests.
 */

export type PlatformExpenseClass =
  | 'ads'
  | 'bank_fees'
  | 'payment_gateway'
  | 'platform_subscription'
  | 'third_party_delivery'
  | 'platform_commission'
  | 'other'

export const PLATFORM_EXPENSE_CLASSES: readonly PlatformExpenseClass[] = [
  'platform_commission',
  'platform_subscription',
  'third_party_delivery',
  'payment_gateway',
  'bank_fees',
  'ads',
  'other',
] as const

export const PLATFORM_EXPENSE_CLASS_LABELS: Record<
  PlatformExpenseClass,
  { ar: string; en: string }
> = {
  ads: {
    ar: 'الدعاية والإعلان',
    en: 'Advertising & Marketing',
  },
  bank_fees: {
    ar: 'الرسوم والعمولات البنكية',
    en: 'Bank Fees & Commissions',
  },
  payment_gateway: {
    ar: 'رسوم بوابات الدفع الإلكتروني',
    en: 'Payment Gateway Fees',
  },
  platform_subscription: {
    ar: 'اشتراكات منصات التوصيل',
    en: 'Platform Subscriptions',
  },
  third_party_delivery: {
    ar: 'خدمات توصيل طرف ثالث',
    en: 'Third-Party Delivery Services',
  },
  platform_commission: {
    ar: 'عمولات منصات التوصيل',
    en: 'Delivery Platform Commissions',
  },
  other: {
    ar: 'مصروفات تشغيلية أخرى',
    en: 'Other Operating Expenses',
  },
}

/**
 * Word-safe delivery platform matcher (`\bcari\b` / `\bcary\b` prevent false positives on words
 * like "Carriage" for `cari`, while `carriage|كاريدج` explicitly matches Carriage itself).
 */
export const PLATFORM_TOKEN_RE =
  /talabat|طلبات|deliveroo|delivero|ديليفرو|keeta|كيتا|كييتا|jahez|جاهز|snoonu|سنونو|\bcari\b|\bcary\b|كاري|bilbayt|bibayt|بالبيت|zida|زيدا|zatat|زيتات|craves|كريفز|jeebley|جيبلي|carriage|كاريدج/i

const ADS_RE = /advertis|دعاية|دعايه|إعلان|اعلان/i
const BANK_FEES_RE = /bank|بنك/i
const PAYMENT_GATEWAY_RE = /hesabe|حسابي|\btap\b|تاب كوم|myfatoorah|knet|كي ?نت/i
const SUBSCRIPTION_RE = /subscri|اشتراك/i
const DELIVERY_SERVICE_RE = /delivery service|خدمة توصيل/i
const COMMISSION_RE = /commission|عمول/i
const EMPLOYEE_DELIVERY_RE = /موظف|employee/i

/**
 * Deterministic first-match classification for an Odoo GL account.
 * Only `accountType === 'expense'` is classified; all other account types return `'other'`.
 */
export function classifyPlatformExpenseAccount(
  code: string,
  name: string,
  accountType: string,
): PlatformExpenseClass {
  void code
  if (accountType !== 'expense') return 'other'
  const n = (name || '').trim()
  if (ADS_RE.test(n)) return 'ads'
  if (BANK_FEES_RE.test(n)) return 'bank_fees'
  if (PAYMENT_GATEWAY_RE.test(n)) return 'payment_gateway'
  if (SUBSCRIPTION_RE.test(n) && PLATFORM_TOKEN_RE.test(n)) return 'platform_subscription'
  if (
    DELIVERY_SERVICE_RE.test(n) &&
    !COMMISSION_RE.test(n) &&
    !EMPLOYEE_DELIVERY_RE.test(n)
  ) {
    return 'third_party_delivery'
  }
  if (COMMISSION_RE.test(n) && PLATFORM_TOKEN_RE.test(n)) return 'platform_commission'
  return 'other'
}

const LEGACY_DELIVERY_COMMISSION_ACCOUNT_CODES = new Set([
  '40224',
  '40225',
  '40228',
  '40229',
  '40230',
  '40232',
  '40233',
  '40705',
  '40706',
  '40811',
  '40918',
  '41030',
  '41031',
  '41032',
])

/**
 * Legacy pre-refactor commission classifier preserved solely for migration diff tests.
 */
export function legacyIsDeliveryCommissionGlAccount(code: string, name: string): boolean {
  const c = (code || '').trim()
  if (LEGACY_DELIVERY_COMMISSION_ACCOUNT_CODES.has(c)) return true
  return /commission|عمول|talabat|طلبات|deliveroo|ديليفرو|keeta|كيتا|كييتا|jahez|جاهز|snoonu|سنونو|cari|كاري|bilbayt|بالبيت|aggregator/i.test(
    name || '',
  )
}

export interface PlatformExpenseAccountInput {
  accountId?: number
  code: string
  name: string
  accountType: string
  amountKwd: number
  debitKwd?: number
  creditKwd?: number
  balanceKwd?: number
  lineCount?: number
}

export interface ClassifiedPlatformExpenseAccount {
  accountId?: number
  code: string
  name: string
  accountType: string
  amountKwd: number
  debitKwd?: number
  creditKwd?: number
  balanceKwd?: number
  lineCount: number
  expenseClass: PlatformExpenseClass
}

export interface PlatformExpenseClassBucket {
  totalKwd: number
  linesCount: number
  accounts: ClassifiedPlatformExpenseAccount[]
}

export type PlatformExpenseBreakdown = Record<PlatformExpenseClass, PlatformExpenseClassBucket>

const r3 = (n: number): number => Math.round((Number(n) || 0) * 1000) / 1000

/**
 * Groups GL expense rows into all 7 deterministic classes with totals, line counts,
 * and sorted per-account details.
 */
export function summarizePlatformExpenses(
  rows: readonly PlatformExpenseAccountInput[],
): PlatformExpenseBreakdown {
  const rawSums: Record<PlatformExpenseClass, number> = {
    ads: 0,
    bank_fees: 0,
    payment_gateway: 0,
    platform_subscription: 0,
    third_party_delivery: 0,
    platform_commission: 0,
    other: 0,
  }
  const out: PlatformExpenseBreakdown = {
    ads: { totalKwd: 0, linesCount: 0, accounts: [] },
    bank_fees: { totalKwd: 0, linesCount: 0, accounts: [] },
    payment_gateway: { totalKwd: 0, linesCount: 0, accounts: [] },
    platform_subscription: { totalKwd: 0, linesCount: 0, accounts: [] },
    third_party_delivery: { totalKwd: 0, linesCount: 0, accounts: [] },
    platform_commission: { totalKwd: 0, linesCount: 0, accounts: [] },
    other: { totalKwd: 0, linesCount: 0, accounts: [] },
  }

  for (const row of rows) {
    const expenseClass = classifyPlatformExpenseAccount(row.code, row.name, row.accountType)
    const rawAmount = Number(row.amountKwd) || 0
    const lineCount = Math.max(0, Math.round(Number(row.lineCount) || 0))
    rawSums[expenseClass] += rawAmount
    out[expenseClass].linesCount += lineCount
    out[expenseClass].accounts.push({
      ...(row.accountId !== undefined ? { accountId: row.accountId } : {}),
      code: row.code,
      name: row.name,
      accountType: row.accountType,
      amountKwd: r3(rawAmount),
      ...(row.debitKwd !== undefined ? { debitKwd: r3(row.debitKwd) } : {}),
      ...(row.creditKwd !== undefined ? { creditKwd: r3(row.creditKwd) } : {}),
      ...(row.balanceKwd !== undefined ? { balanceKwd: r3(row.balanceKwd) } : {}),
      lineCount,
      expenseClass,
    })
  }

  for (const cls of PLATFORM_EXPENSE_CLASSES) {
    out[cls].totalKwd = r3(rawSums[cls])
    out[cls].accounts.sort(
      (a, b) => Math.abs(b.amountKwd) - Math.abs(a.amountKwd) || a.code.localeCompare(b.code),
    )
  }

  return out
}
