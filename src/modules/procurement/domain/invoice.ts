import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError } from '@/lib/money'
import type { InvoiceTotals, JournalLineInput } from '@/modules/finance/client'
import { buildInvoiceLines } from '@/modules/procurement/domain/posting'
import type { OrderStatus, SupplierInvoiceStatus } from '@/modules/procurement/domain/types'

export { invoiceableQuantity, planInvoice } from '@/modules/procurement/domain/match'
export type { MatchRequestLine as InvoiceRequestLine, PlannedInvoiceLine } from '@/modules/procurement/domain/match'

/** The ledger and every procurement document are KWD only. Any other currency is refused. */
export function assertInvoiceCurrency(currency: string): void {
  if (currency !== 'KWD') throw new CurrencyMismatchError('KWD', currency)
}

/** When the supplier's own total is given it must equal ours to the fils. A difference stops the booking. */
export function assertTotalMatches(expectedMinor: number | null | undefined, totals: InvoiceTotals): void {
  if (expectedMinor === null || expectedMinor === undefined) return
  if (expectedMinor !== totals.totalMinor) {
    throw new DomainError('total_mismatch', `The invoice total is ${totals.totalMinor} fils but ${expectedMinor} was expected.`)
  }
}

export type PostingAccounts = {
  inventoryAccountId: string | null
  payableAccountId: string | null
  inputTaxAccountId: string | null
}

/**
 * The journal lines of a supplier invoice on the invoice basis. Debit the inventory account by the net, debit the input-tax
 * account by the tax (only when there is tax), credit the payable account by the total. The receipt basis is built by
 * `buildInvoiceLines` in `posting.ts`.
 */
export function buildPostingLines(totals: InvoiceTotals, accounts: PostingAccounts, memo: string): JournalLineInput[] {
  return buildInvoiceLines('invoice_basis', totals, 0, { ...accounts, grniAccountId: null, ppvAccountId: null }, memo)
}

/** Only an order that has received goods can be invoiced. Receiving is what makes a quantity billable. */
export function canInvoiceOrder(status: OrderStatus): boolean {
  return status === 'partially_received' || status === 'received'
}

export function canVoidInvoice(status: SupplierInvoiceStatus): boolean {
  return status === 'posted'
}

/** Adds whole days to a YYYY-MM-DD date in UTC, so the result never depends on the server's time zone. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}
