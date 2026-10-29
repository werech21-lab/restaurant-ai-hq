import { DomainError } from '@/lib/domain-error'
import type { JournalLineInput } from '@/modules/finance/schemas/ledger'

const MAX_LINE_MINOR = 1_000_000_000_000

function needAmount(amountMinor: number, what: string): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new DomainError('zero_amount', `${what} needs an amount above zero.`)
  if (amountMinor > MAX_LINE_MINOR) throw new DomainError('amount_too_large', `${what} exceeds the maximum allowed amount.`)
}

/** Debit accounts receivable, credit sales revenue. The two lines are equal by construction. */
export function buildRevenueLines(amountMinor: number, receivableAccountId: string, revenueAccountId: string, memo: string): JournalLineInput[] {
  needAmount(amountMinor, 'A sales invoice')
  return [
    { accountId: receivableAccountId, debitMinor: amountMinor, creditMinor: 0, description: memo },
    { accountId: revenueAccountId, debitMinor: 0, creditMinor: amountMinor, description: memo },
  ]
}

/** Debit cash, credit accounts receivable. The two lines are equal by construction. */
export function buildCollectionLines(amountMinor: number, cashAccountId: string, receivableAccountId: string, memo: string): JournalLineInput[] {
  needAmount(amountMinor, 'A customer collection')
  return [
    { accountId: cashAccountId, debitMinor: amountMinor, creditMinor: 0, description: memo },
    { accountId: receivableAccountId, debitMinor: 0, creditMinor: amountMinor, description: memo },
  ]
}

/** Debit the cost account, credit inventory. The two lines are equal by construction. */
export function buildConsumptionLines(amountMinor: number, costAccountId: string, inventoryAccountId: string, memo: string): JournalLineInput[] {
  needAmount(amountMinor, 'A kitchen issue')
  return [
    { accountId: costAccountId, debitMinor: amountMinor, creditMinor: 0, description: memo },
    { accountId: inventoryAccountId, debitMinor: 0, creditMinor: amountMinor, description: memo },
  ]
}

/** Debit commission expense, credit cash. The two lines are equal by construction. */
export function buildCommissionLines(amountMinor: number, expenseAccountId: string, cashAccountId: string, memo: string): JournalLineInput[] {
  needAmount(amountMinor, 'A delivery commission')
  return [
    { accountId: expenseAccountId, debitMinor: amountMinor, creditMinor: 0, description: memo },
    { accountId: cashAccountId, debitMinor: 0, creditMinor: amountMinor, description: memo },
  ]
}

function buildAccruedExpenseLines(amountMinor: number, expenseAccountId: string, payableAccountId: string, memo: string, what: string): JournalLineInput[] {
  needAmount(amountMinor, what)
  return [
    { accountId: expenseAccountId, debitMinor: amountMinor, creditMinor: 0, description: memo },
    { accountId: payableAccountId, debitMinor: 0, creditMinor: amountMinor, description: memo },
  ]
}

/** Debit salaries expense, credit accrued salaries. The two lines are equal by construction. */
export function buildPayrollLines(amountMinor: number, expenseAccountId: string, payableAccountId: string, memo: string): JournalLineInput[] {
  return buildAccruedExpenseLines(amountMinor, expenseAccountId, payableAccountId, memo, 'A payroll run')
}

/** Debit salaries expense, credit accrued salaries, for an approved employee claim. */
export function buildEmployeeExpenseLines(amountMinor: number, expenseAccountId: string, payableAccountId: string, memo: string): JournalLineInput[] {
  return buildAccruedExpenseLines(amountMinor, expenseAccountId, payableAccountId, memo, 'An employee expense')
}
