import { POS_CLEARING_ACCOUNT_CODE } from '@/lib/odoo/live-sync-core'

/**
 * Posted receivable accounts other than cashier clearing 10552.
 * These codes are the account ids. Platform accounts 10501–10509 are journal
 * entries, so the domain does not mention move_type.
 */
export const RECEIVABLE_ACCOUNT_CODES = [
  '10501',
  '10502',
  '10503',
  '10504',
  '10505',
  '10507',
  '10508',
  '10509',
  '121000',
] as const

export function buildOpenReceivableClauses(): unknown[][] {
  return [
    ['parent_state', '=', 'posted'],
    ['reconciled', '=', false],
    ['account_id.account_type', '=', 'asset_receivable'],
    ['account_id.code', 'in', [...RECEIVABLE_ACCOUNT_CODES]],
  ]
}

export function openReceivableLineIncluded(line: {
  accountCode: string
  accountType: string
  moveType: string
  parentState: string
  reconciled: boolean
}): boolean {
  void line.moveType
  void line.accountType
  if (line.parentState !== 'posted' || line.reconciled) return false
  if (line.accountCode === POS_CLEARING_ACCOUNT_CODE) return false
  return (RECEIVABLE_ACCOUNT_CODES as readonly string[]).includes(line.accountCode)
}
