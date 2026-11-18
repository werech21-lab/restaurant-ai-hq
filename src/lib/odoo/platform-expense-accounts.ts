/**
 * Deterministic class for Odoo expense accounts that look like delivery-platform cost.
 * Only `account_type === 'expense'` is considered. First match wins.
 * Names and codes come from the Odoo chart; this file does not store amounts.
 */

export type PlatformExpenseClass =
  | 'ads'
  | 'bank_fees'
  | 'payment_gateway'
  | 'platform_subscription'
  | 'third_party_delivery'
  | 'platform_commission'
  | 'other'

const ADS = /advertis|دعاية|دعايه|إعلان|اعلان/i
const BANK = /bank|بنك/i
const GATEWAY = /hesabe|حسابي|\btap\b|تاب كوم|myfatoorah|knet|كي ?نت/i
const SUBSCRIPTION = /subscri|اشتراك/i
const DELIVERY_SERVICE = /delivery service|خدمة توصيل/i
const COMMISSION = /commission|عمول/i
const EMPLOYEE = /موظف|employee/i

/**
 * Platform names. `\bcari\b` does not match the leading letters of "Carriage".
 * "carriage" / "كاريدج" are their own tokens.
 */
const PLATFORM_TOKEN =
  /talabat|طلبات|deliveroo|delivero|ديليفرو|keeta|كيتا|كييتا|jahez|جاهز|snoonu|سنونو|\bcari\b|cary|كاري|bilbayt|bibayt|بالبيت|zida|زيدا|zatat|زيتات|craves|كريفز|jeebley|جيبلي|carriage|كاريدج/i

export function hasPlatformToken(name: string): boolean {
  return PLATFORM_TOKEN.test(name || '')
}

export function classifyPlatformExpenseAccount(
  code: string,
  name: string,
  accountType: string,
): PlatformExpenseClass {
  if (accountType !== 'expense') return 'other'
  const label = `${code || ''} ${name || ''}`
  if (ADS.test(label)) return 'ads'
  if (BANK.test(label)) return 'bank_fees'
  if (GATEWAY.test(label)) return 'payment_gateway'
  const platform = hasPlatformToken(name || '')
  if (SUBSCRIPTION.test(label) && platform) return 'platform_subscription'
  if (DELIVERY_SERVICE.test(label) && !COMMISSION.test(label) && !EMPLOYEE.test(label)) {
    return 'third_party_delivery'
  }
  if (COMMISSION.test(label) && platform) return 'platform_commission'
  return 'other'
}
