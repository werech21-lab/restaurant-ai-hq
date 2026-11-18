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
  /** True when the account is outside the sales scope. It stays on the full ledger. */
  salesScopeExcluded?: boolean
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
export function trialBalanceTotals(lines: readonly GlAccountLine[]): {
  debit: number
  credit: number
  balance: number
} {
  return lines.reduce(
    (totals, line) => ({
      debit: totals.debit + line.debit,
      credit: totals.credit + line.credit,
      balance: totals.balance + line.balance,
    }),
    { debit: 0, credit: 0, balance: 0 },
  )
}

export interface BalanceSheetGroup {
  key: 'asset' | 'liability' | 'equity' | 'excluded'
  labelAr: string
  labelEn: string
  lines: (GlAccountLine & { presented: number })[]
  total: number
}

/** Liabilities and equity are shown sign-flipped. Current earnings is −Σ P&L balances. */
export function balanceSheetView(lines: readonly GlAccountLine[]): {
  groups: BalanceSheetGroup[]
  totals: ReturnType<typeof balanceSheetTotals>
  balanced: boolean
  currentEarningsLabelAr: string
  currentEarningsLabelEn: string
} {
  const totals = balanceSheetTotals(lines)
  const gap = Math.abs(totals.assets - (totals.liabilities + totals.equity))
  const inScope = lines.filter((line) => !line.salesScopeExcluded)
  const present = (source: readonly GlAccountLine[], match: (type: string) => boolean, sign: number) => {
    const grouped = source
      .filter((line) => match(line.accountType))
      .map((line) => ({ ...line, presented: sign * line.balance }))
    const total = grouped.reduce((sum, line) => sum + line.presented, 0)
    return { lines: grouped, total }
  }
  const asset = present(inScope, isAsset, 1)
  const liability = present(inScope, isLiability, -1)
  const equity = present(inScope, isEquity, -1)
  const excludedLines = lines
    .filter(
      (line) =>
        line.salesScopeExcluded &&
        (isAsset(line.accountType) || isLiability(line.accountType) || isEquity(line.accountType)),
    )
    .map((line) => ({
      ...line,
      presented: isAsset(line.accountType) ? line.balance : -line.balance,
    }))
  const excludedTotal = excludedLines.reduce((sum, line) => sum + line.presented, 0)
  return {
    groups: [
      { key: 'asset', labelAr: 'الأصول', labelEn: 'Assets', ...asset },
      { key: 'liability', labelAr: 'الالتزامات', labelEn: 'Liabilities', ...liability },
      { key: 'equity', labelAr: 'حقوق الملكية', labelEn: 'Equity', ...equity },
      {
        key: 'excluded',
        labelAr: 'حسابات مستبعدة من نطاق المبيعات',
        labelEn: 'Accounts excluded from the sales scope',
        lines: excludedLines,
        total: excludedTotal,
      },
    ],
    totals,
    balanced: gap <= 0.001,
    currentEarningsLabelAr: 'النتيجة غير الموزعة التراكمية حتى هذا التاريخ',
    currentEarningsLabelEn: 'Cumulative unallocated result to this date',
  }
}

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
