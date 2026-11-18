import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { balanceSheetTotals, balanceSheetView, type GlAccountLine } from '@/lib/odoo/gl-statements'
import { glReadDomains } from '@/lib/odoo/gl-statements-live'
import { isDecommissionedWarehouseRecord } from '@/lib/odoo-live-connector'

describe('GL statement domains', () => {
  it('scopes both statements to the company and keeps every account', () => {
    const companyId = 1
    const domains = glReadDomains(companyId, '2026-11-01', '2026-11-17')
    expect(domains.trialBalance).toContainEqual(['company_id', '=', companyId])
    expect(domains.balanceSheet).toContainEqual(['company_id', '=', companyId])
    expect(domains.trialBalance.some((clause) => clause[0] === 'account_id')).toBe(false)
    expect(domains.balanceSheet.some((clause) => clause[0] === 'account_id')).toBe(false)
  })
})

describe('excluded chart accounts stay on the full ledger', () => {
  it('groups real chart names that are outside the sales scope', () => {
    const dump = JSON.parse(
      readFileSync(
        path.join(process.cwd(), 'database/seeds/venturefoods_odoo_cids1_dump.json'),
        'utf8',
      ),
    ) as { models: { 'account.account': { code: string; name: string; account_type: string }[] } }
    const chart = dump.models['account.account']
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
    const isBalanceSheetType = (accountType: string) =>
      accountType.startsWith('asset') ||
      accountType.startsWith('liability') ||
      accountType.startsWith('equity')
    const excludedNames = lines
      .filter((line) => line.salesScopeExcluded && isBalanceSheetType(line.accountType))
      .map((line) => line.name)
      .sort()
    expect(excludedNames).toContain('Qurain Cash suspense')
    expect(excludedNames).toContain('Jahra Cash suspens')
    const view = balanceSheetView(lines)
    const grouped = view.groups.find((group) => group.key === 'excluded')
    expect(grouped?.lines.map((line) => line.name).sort()).toEqual(excludedNames)
    expect(grouped?.lines.some((line) => line.accountType.startsWith('income') || line.accountType.startsWith('expense'))).toBe(
      false,
    )
    expect(grouped?.labelAr).toBe('حسابات مستبعدة من نطاق المبيعات')
    expect(grouped?.total).toBe(0)
    const totals = balanceSheetTotals(lines)
    expect(view.totals).toEqual(totals)
    expect(view.balanced).toBe(Math.abs(totals.assets - (totals.liabilities + totals.equity)) <= 0.001)
    expect(view.groups.find((group) => group.key === 'asset')?.lines.some((line) => line.salesScopeExcluded)).toBe(
      false,
    )
  })
})
