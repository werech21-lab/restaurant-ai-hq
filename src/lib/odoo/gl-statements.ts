/**
 * Pure general-ledger statement builders. Amounts are whatever the caller passes
 * (live Odoo rows, or rows assembled in a test). This file does not fetch.
 */

export interface GlAccountLine {
  code: string
  name: string
  accountType: string
  debit: number
  credit: number
  balance: number
  lineCount: number
}

const PNL_TYPES = new Set([
  'income',
  'income_other',
  'expense_direct_cost',
  'expense',
  'expense_depreciation',
])

function isAsset(type: string): boolean {
  return type.startsWith('asset')
}
function isLiability(type: string): boolean {
  return type.startsWith('liability')
}
function isEquity(type: string): boolean {
  return type.startsWith('equity')
}
function isPnl(type: string): boolean {
  return PNL_TYPES.has(type)
}

export function sumBalance(lines: readonly GlAccountLine[], pred: (type: string) => boolean): number {
  return lines.reduce((sum, line) => (pred(line.accountType) ? sum + line.balance : sum), 0)
}

/**
 * Odoo `balance` is debit − credit. Assets are normally positive; liabilities,
 * equity and income are normally negative. Presented liabilities and equity are
 * sign-flipped, and current-year earnings = −Σ(P&L balances), so
 * assets = liabilities + equity when the rows balance.
 */
export function balanceSheetTotals(lines: readonly GlAccountLine[]): {
  assets: number
  liabilities: number
  equity: number
  currentYearEarnings: number
} {
  const currentYearEarnings = -sumBalance(lines, isPnl)
  return {
    assets: sumBalance(lines, isAsset),
    liabilities: -sumBalance(lines, isLiability),
    equity: -sumBalance(lines, isEquity) + currentYearEarnings,
    currentYearEarnings,
  }
}
