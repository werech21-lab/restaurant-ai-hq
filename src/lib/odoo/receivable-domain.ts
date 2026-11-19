import { POS_CLEARING_ACCOUNT_CODE } from '@/lib/odoo/live-sync-core'

/**
 * Odoo account.account id of cashier clearing 10552 (dump account id 35).
 * Every other posted asset_receivable account stays in the open balance.
 */
export const POS_CLEARING_ACCOUNT_ID = 35

export function buildOpenReceivableClauses(): unknown[][] {
  return [
    ['parent_state', '=', 'posted'],
    ['reconciled', '=', false],
    ['account_id.account_type', '=', 'asset_receivable'],
    ['account_id', '!=', POS_CLEARING_ACCOUNT_ID],
  ]
}

export function openReceivableLineIncluded(line: {
  accountCode: string
  accountId?: number | null
  accountType: string
  moveType: string
  parentState: string
  reconciled: boolean
}): boolean {
  void line.moveType
  if (line.parentState !== 'posted' || line.reconciled) return false
  if (line.accountType !== 'asset_receivable') return false
  if (line.accountId === POS_CLEARING_ACCOUNT_ID) return false
  if (line.accountCode === POS_CLEARING_ACCOUNT_CODE) return false
  return true
}
