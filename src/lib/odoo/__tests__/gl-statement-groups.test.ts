import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { accountsForPnlGroup } from '@/components/accounting/GlStatementsPanel'
import { classifyPlatformExpenseAccount } from '@/lib/odoo/platform-expense-accounts'
import type { GlAccountLine } from '@/lib/odoo/gl-statements'
import { isDecommissionedWarehouseRecord } from '@/lib/odoo-live-connector'
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

  it('leaves Heisenberg, Qurain, and Jahra chart accounts out of the P&L groups', () => {
    const dump = JSON.parse(
      readFileSync(
        path.join(process.cwd(), 'database/seeds/venturefoods_odoo_cids1_dump.json'),
        'utf8',
      ),
    ) as { models: { 'account.account': { code: string; name: string; account_type: string }[] } }
    const chart = dump.models['account.account']
    const watched = ['9950473', '40097', '50406']
    const lines: GlAccountLine[] = chart.map((account) => ({
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      debit: 0,
      credit: 0,
      balance: 0,
      lineCount: 0,
      salesScopeExcluded: isDecommissionedWarehouseRecord(`${account.code} ${account.name}`),
    }))
    for (const code of watched) {
      const account = lines.find((line) => line.code === code)
      expect(account?.salesScopeExcluded).toBe(true)
      expect(account?.name.length).toBeGreaterThan(0)
    }
    for (const group of ['income', 'expense_direct_cost', 'expense'] as const) {
      const grouped = accountsForPnlGroup(lines, group, [])
      expect(grouped.some((line) => watched.includes(line.code))).toBe(false)
      expect(grouped.some((line) => line.salesScopeExcluded)).toBe(false)
    }
  })
})
