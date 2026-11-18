import { describe, expect, it } from 'vitest'
import { accountsForPnlGroup } from '@/components/accounting/GlStatementsPanel'
import { classifyPlatformExpenseAccount } from '@/lib/odoo/platform-expense-accounts'
import type { GlAccountLine } from '@/lib/odoo/gl-statements'
import accounts from './fixtures/platform-expense-accounts.json'

describe('P&L groups expand to the posted accounts', () => {
  it('puts each fixture expense account under its class', () => {
    const lines: GlAccountLine[] = accounts.map((account) => ({
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      debit: 0,
      credit: 0,
      balance: 0,
      lineCount: 0,
    }))
    const commissionCodes = accounts
      .filter(
        (account) =>
          classifyPlatformExpenseAccount(account.code, account.name, account.account_type) ===
          'platform_commission',
      )
      .map((account) => account.code)
    const grouped = accountsForPnlGroup(lines, 'platform_commission', commissionCodes)
    expect(grouped.map((line) => line.code).sort()).toEqual([...commissionCodes].sort())
    const expense = accountsForPnlGroup(lines, 'expense', commissionCodes)
    expect(expense.some((line) => commissionCodes.includes(line.code))).toBe(false)
  })
})
