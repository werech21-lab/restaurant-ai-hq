import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isWindowWithinClosedMonths } from '@/lib/aether/closed-month-policy'
import { balanceSheetTotals, type GlAccountLine } from '@/lib/odoo/gl-statements'
import {
  classifyPlatformExpenseAccount,
  type PlatformExpenseClass,
} from '@/lib/odoo/platform-expense-accounts'
import { PER_CUSTOMER_DUE_DATE_AGING_VERIFIED, canShowReceivableAmounts } from '@/lib/aether/receivables-status'
import { ODOO_EXCLUSION_RULES } from '@/lib/odoo/excluded-entities'

const chart = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/odoo/__tests__/fixtures/platform-expense-accounts.json'), 'utf8'),
) as { code: string; name: string; account_type: string }[]

const statementAccounts = JSON.parse(
  readFileSync(path.join(process.cwd(), 'src/lib/odoo/__tests__/fixtures/statement-account-types.json'), 'utf8'),
) as { code: string; name: string; account_type: string }[]

const EXPECTED: Record<string, PlatformExpenseClass> = {
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

const OLD_CODES = new Set([
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

function oldRule(code: string, name: string): boolean {
  if (OLD_CODES.has(code)) return true
  return /commission|عمول|talabat|طلبات|deliveroo|ديليفرو|keeta|كيتا|كييتا|jahez|جاهز|snoonu|سنونو|cari|كاري|bilbayt|بالبيت|aggregator/i.test(
    name,
  )
}

describe('platform expense classes from the Odoo chart export', () => {
  it('classifies every exported expense account in the owner list', () => {
    expect(chart.length).toBe(Object.keys(EXPECTED).length)
    for (const row of chart) {
      expect(classifyPlatformExpenseAccount(row.code, row.name, row.account_type)).toBe(EXPECTED[row.code])
    }
  })

  it('does not treat Carriage as Cari', () => {
    const carriage = chart.find((row) => row.code === '40866')
    expect(carriage?.name.toLowerCase().includes('carriage')).toBe(true)
    expect(classifyPlatformExpenseAccount('40866', carriage?.name ?? '', 'expense')).toBe('platform_commission')
    expect(classifyPlatformExpenseAccount('1', 'Carriage fee', 'expense')).toBe('other')
  })

  it('lists accounts whose class changed versus the old code-or-name rule', () => {
    const changed = chart
      .filter((row) => {
        const next = classifyPlatformExpenseAccount(row.code, row.name, row.account_type)
        const wasCommission = oldRule(row.code, row.name)
        return wasCommission !== (next === 'platform_commission')
      })
      .map((row) => row.code)
      .sort()
    expect(changed).toContain('40224')
    expect(changed).toContain('40706')
    expect(changed).not.toContain('40229')
  })
})

describe('balance sheet equation on exported account types', () => {
  it('assets equal liabilities plus equity after current-year earnings', () => {
    const lines: GlAccountLine[] = statementAccounts.map((row) => ({
      code: row.code,
      name: row.name,
      accountType: row.account_type,
      debit: 0,
      credit: 0,
      balance: 0,
      lineCount: 0,
    }))
    const income = lines.find((line) => line.accountType === 'asset_receivable')
    const payable = lines.find((line) => line.accountType === 'liability_payable')
    expect(income && payable).toBeTruthy()
    if (income && payable) {
      income.balance = 1
      payable.balance = -1
    }
    const totals = balanceSheetTotals(lines)
    expect(totals.assets).toBe(totals.liabilities + totals.equity)
  })
})

describe('profit lock and receivables flag', () => {
  it('withholds profit unless the window ends on or before the lock date', () => {
    expect(isWindowWithinClosedMonths('2026-10-31', '2026-10-31')).toBe(true)
    expect(isWindowWithinClosedMonths('2026-11-17', '2026-10-31')).toBe(false)
    expect(isWindowWithinClosedMonths('2026-10-31', null)).toBe(false)
  })

  it('keeps receivable amounts hidden while the verification flag is false', () => {
    expect(PER_CUSTOMER_DUE_DATE_AGING_VERIFIED).toBe(false)
    expect(
      canShowReceivableAmounts({ unavailable: false }, false),
    ).toBe(false)
  })

})

describe('excluded POS configs stay excluded', () => {
  it('keeps ids 24, 25, 39 and 40 out of the included set', () => {
    const ids = ODOO_EXCLUSION_RULES.find((rule) => rule.kind === 'pos_config')?.ids ?? []
    expect([...ids].sort((a, b) => a - b)).toEqual([24, 25, 39, 40])
  })
})

describe('income statement page has no budget wording', () => {
  it('does not promise a budget on the P&L route, sidebar, or studio', () => {
    const files = [
      'src/lib/aether/route-titles.ts',
      'src/components/erp-sidebar.tsx',
      'src/components/erp/ExecutivePnlStudio.tsx',
      'src/app/erp/executive-pnl/page.tsx',
    ]
    for (const rel of files) {
      const src = readFileSync(path.join(process.cwd(), rel), 'utf8')
      expect(src).not.toMatch(/موازنة|Budget Variance|budget variance/i)
    }
  })
})
