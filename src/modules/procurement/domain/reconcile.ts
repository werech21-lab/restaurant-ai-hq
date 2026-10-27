import type { AccountingBasis, ReconciliationCheck, ReconciliationReport } from '@/modules/procurement/domain/types'

/**
 * The procurement documents say what the ledger must hold. The ledger says what it holds. The difference is the finding.
 *
 *   inventory, receipt basis   sum over order lines of order price x (received - returned)
 *   inventory, invoice basis   billed net of posted invoices minus the net of posted credit notes
 *   GRNI (receipt basis)       sum of order price x ((received - returned) - (invoiced - credited)), credit-positive. It is
 *                              negative while goods went back that the supplier has not yet credited.
 *   payable                    the open balance (total - paid - credited) of every posted supplier invoice
 *
 * A difference is real money that is booked in one place and not the other, or an entry made outside these documents (a manual
 * journal on the same account). Nothing here corrects it: it only reports.
 */

export type ReconciliationFigures = {
  /** Sum of order price x (received - returned). */
  heldValueMinor: number
  /** Sum of order price x ((received - returned) - (invoiced - credited)). */
  unbilledValueMinor: number
  /** Net of posted invoices minus the net of posted credit notes. */
  billedNetMinor: number
  /** Sum of the open balances of posted invoices. */
  openPayableMinor: number
}

export type LedgerTotals = { debitMinor: number; creditMinor: number } | null

function check(key: ReconciliationCheck['key'], actualMinor: number, expectedMinor: number): ReconciliationCheck {
  const differenceMinor = actualMinor - expectedMinor
  return { key, actualMinor, expectedMinor, differenceMinor, ok: differenceMinor === 0 }
}

const debitBalance = (totals: LedgerTotals) => (totals ? totals.debitMinor - totals.creditMinor : 0)
const creditBalance = (totals: LedgerTotals) => (totals ? totals.creditMinor - totals.debitMinor : 0)

export function buildReconciliation(
  basis: AccountingBasis,
  figures: ReconciliationFigures,
  ledger: { inventory: LedgerTotals; grni: LedgerTotals; payable: LedgerTotals }
): ReconciliationReport {
  const checks: ReconciliationCheck[] = [
    check('inventory', debitBalance(ledger.inventory), basis === 'receipt_basis' ? figures.heldValueMinor : figures.billedNetMinor),
  ]
  if (basis === 'receipt_basis') checks.push(check('grni', creditBalance(ledger.grni), figures.unbilledValueMinor))
  checks.push(check('payable', creditBalance(ledger.payable), figures.openPayableMinor))
  return { basis, currency: 'KWD', checks, ok: checks.every((entry) => entry.ok) }
}
