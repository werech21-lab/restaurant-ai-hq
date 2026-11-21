/**
 * Odoo account.account id of cashier clearing (dump account id 35).
 * Every other posted asset_receivable account stays in the open balance.
 * Isolation is strictly by verified positive integer Odoo accountId (zero account-code fallback).
 */
export const POS_CLEARING_ACCOUNT_ID = 35

export function isVerifiedReceivableAccountId(accountId: unknown): accountId is number {
  return typeof accountId === 'number' && Number.isInteger(accountId) && accountId > 0
}

export function isExplicitPosClearingAccountId(accountId: number): boolean {
  return accountId === POS_CLEARING_ACCOUNT_ID
}

/**
 * Cashier clearing is Odoo account id 35 only.
 * A row whose account code is 10552 but whose account id is anything else is not clearing.
 * A missing or invalid account id is not clearing; callers keep their own fail-closed checks.
 */
export function isPosClearingRow(row: { accountId?: number | null }): boolean {
  return isVerifiedReceivableAccountId(row.accountId) && row.accountId === POS_CLEARING_ACCOUNT_ID
}

export function buildOpenReceivableClauses(): unknown[][] {
  return [
    ['parent_state', '=', 'posted'],
    ['reconciled', '=', false],
    ['account_id.account_type', '=', 'asset_receivable'],
    ['account_id', '!=', POS_CLEARING_ACCOUNT_ID],
  ]
}

export function openReceivableLineIncluded(line: {
  accountCode?: string
  accountId?: number | null
  accountType: string
  moveType: string
  parentState: string
  reconciled: boolean
}): boolean {
  void line.moveType
  void line.accountCode
  if (line.parentState !== 'posted' || line.reconciled) return false
  if (line.accountType !== 'asset_receivable') return false
  if (line.accountId !== undefined && !isVerifiedReceivableAccountId(line.accountId)) return false
  if (line.accountId === POS_CLEARING_ACCOUNT_ID) return false
  return true
}
