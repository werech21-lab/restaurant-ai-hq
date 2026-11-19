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

/** Chart codes from the Odoo expense export. A name never changes the class. */
export const ACCOUNT_CLASS_BY_CODE: Record<string, PlatformExpenseClass> = {
  '40224': 'platform_subscription',
  '40225': 'platform_subscription',
  '40226': 'platform_subscription',
  '40228': 'platform_subscription',
  '40229': 'platform_commission',
  '40230': 'platform_commission',
  '40231': 'third_party_delivery',
  '40232': 'third_party_delivery',
  '40233': 'third_party_delivery',
  '40234': 'third_party_delivery',
  '40235': 'third_party_delivery',
  '40236': 'third_party_delivery',
  '40237': 'third_party_delivery',
  '40239': 'third_party_delivery',
  '40240': 'third_party_delivery',
  '40241': 'other',
  '40242': 'other',
  '40702': 'platform_commission',
  '40703': 'platform_commission',
  '40704': 'platform_commission',
  '40705': 'platform_commission',
  '40706': 'payment_gateway',
  '40756': 'bank_fees',
  '40757': 'bank_fees',
  '40758': 'bank_fees',
  '40759': 'bank_fees',
  '40378': 'other',
  '40761': 'other',
  '40127': 'ads',
  '40128': 'ads',
  '40129': 'ads',
  '40130': 'ads',
  '40131': 'ads',
  '40132': 'ads',
  '40133': 'ads',
  '40134': 'ads',
  '40984': 'ads',
  '40811': 'platform_commission',
  '40812': 'platform_commission',
  '40813': 'platform_commission',
  '40814': 'platform_commission',
  '40815': 'platform_commission',
  '40816': 'platform_commission',
  '40866': 'platform_commission',
  '40867': 'platform_commission',
  '40868': 'platform_commission',
  '40918': 'platform_commission',
  '40919': 'platform_commission',
  '40920': 'platform_commission',
  '40921': 'platform_commission',
  '40922': 'platform_commission',
  '40923': 'platform_commission',
  '40973': 'platform_commission',
  '40974': 'platform_commission',
  '40975': 'platform_commission',
  '40976': 'platform_commission',
  '40977': 'platform_commission',
  '40978': 'platform_commission',
  '41028': 'platform_commission',
  '41029': 'platform_commission',
  '41030': 'platform_commission',
  '41031': 'platform_commission',
  '41032': 'platform_commission',
  '41033': 'platform_commission',
}

export function classifyPlatformExpenseAccount(
  code: string,
  _name: string,
  accountType: string,
): PlatformExpenseClass {
  if (accountType !== 'expense') return 'other'
  return ACCOUNT_CLASS_BY_CODE[code] ?? 'other'
}
