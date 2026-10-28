import { DomainError } from '@/lib/domain-error'
import type { InvoiceTotals, JournalLineInput } from '@/modules/finance/client'
import type { AccountingBasis } from '@/modules/procurement/domain/types'

/**
 * The journal lines every procurement document posts. Pure and balanced by construction: each builder returns lines whose
 * debits equal their credits, and the database checks the posted entry against the document again at commit.
 *
 *   goods receipt (receipt basis)     Dr inventory        value (quantity x order price)    Cr GRNI              value
 *   purchase return (receipt basis)   Dr GRNI             value                              Cr inventory         value
 *   supplier invoice, invoice basis   Dr inventory        net     Dr input tax  tax          Cr payable           total
 *   supplier invoice, receipt basis   Dr GRNI             order net   Dr/Cr price variance   Dr input tax  tax    Cr payable  total
 *   receipt-basis variance still on hand is moved from the variance account to inventory on that new invoice only
 *   credit note, invoice basis        Dr payable          total                              Cr inventory net     Cr input tax  tax
 *   credit note, receipt basis        Dr payable          total   Dr/Cr price variance       Cr GRNI order net    Cr input tax  tax
 *   supplier payment                  Dr payable          amount                             Cr paying account    amount
 *
 * Price variance is billed net minus order net: a debit when the supplier billed more, a credit when less. A document with no
 * tax posts no tax line, and a zero variance posts no variance line.
 */

export type LedgerAccounts = {
  inventoryAccountId: string | null
  payableAccountId: string | null
  inputTaxAccountId: string | null
  grniAccountId: string | null
  ppvAccountId: string | null
}

const MAX_LINE_MINOR = 1_000_000_000_000

const debit = (accountId: string, amountMinor: number, description: string): JournalLineInput => ({ accountId, debitMinor: amountMinor, creditMinor: 0, description })
const credit = (accountId: string, amountMinor: number, description: string): JournalLineInput => ({ accountId, debitMinor: 0, creditMinor: amountMinor, description })

function needAccount(id: string | null, message: string): string {
  if (!id) throw new DomainError('accounts_not_configured', message)
  return id
}

function needAmount(amountMinor: number, what: string): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new DomainError('zero_amount', `${what} needs an amount above zero.`)
  if (amountMinor > MAX_LINE_MINOR) throw new DomainError('amount_too_large', `${what} exceeds the maximum allowed amount.`)
}

/** Debit (positive) or credit (negative) of the price variance, as the line it needs. Nothing for zero. */
function varianceLine(accounts: LedgerAccounts, varianceMinor: number, memo: string, side: 'invoice' | 'credit'): JournalLineInput[] {
  if (varianceMinor === 0) return []
  const ppv = needAccount(accounts.ppvAccountId, 'Choose the purchase price variance account before booking a price variance.')
  const debitSide = side === 'invoice' ? varianceMinor > 0 : varianceMinor < 0
  const amount = Math.abs(varianceMinor)
  return [debitSide ? debit(ppv, amount, memo) : credit(ppv, amount, memo)]
}

/** The part of a price variance that is still in stock. Invoice debits inventory when positive; a credit note credits it. */
function reclassLine(inventory: string, reclassMinor: number, memo: string, side: 'invoice' | 'credit'): JournalLineInput[] {
  if (reclassMinor === 0) return []
  const amount = Math.abs(reclassMinor)
  const debitInventory = side === 'invoice' ? reclassMinor > 0 : reclassMinor < 0
  return [debitInventory ? debit(inventory, amount, memo) : credit(inventory, amount, memo)]
}

function assertReclass(variance: number, reclassMinor: number): void {
  if (reclassMinor === 0) return
  if (variance === 0 || Math.sign(reclassMinor) !== Math.sign(variance) || Math.abs(reclassMinor) > Math.abs(variance)) {
    throw new DomainError('cost_exceeds_stock', 'The inventory reclass is not a portion of this document price variance.')
  }
}

export function buildReceiptLines(valueMinor: number, accounts: LedgerAccounts, memo: string): JournalLineInput[] {
  needAmount(valueMinor, 'A goods receipt')
  const inventory = needAccount(accounts.inventoryAccountId, 'Choose the inventory account before receiving goods on the receipt basis.')
  const grni = needAccount(accounts.grniAccountId, 'Choose the GRNI account before receiving goods on the receipt basis.')
  return [debit(inventory, valueMinor, memo), credit(grni, valueMinor, memo)]
}

export function buildReturnLines(valueMinor: number, accounts: LedgerAccounts, memo: string): JournalLineInput[] {
  needAmount(valueMinor, 'A purchase return')
  const inventory = needAccount(accounts.inventoryAccountId, 'Choose the inventory account before returning goods on the receipt basis.')
  const grni = needAccount(accounts.grniAccountId, 'Choose the GRNI account before returning goods on the receipt basis.')
  return [debit(grni, valueMinor, memo), credit(inventory, valueMinor, memo)]
}

/**
 * `poNetMinor` is the invoiced quantities at the order's prices. It is only used on the receipt basis.
 * `inventoryReclassMinor` is the portion of the price variance still on hand. It is posted on this document only.
 */
export function buildInvoiceLines(
  basis: AccountingBasis,
  totals: InvoiceTotals,
  poNetMinor: number,
  accounts: LedgerAccounts,
  memo: string,
  inventoryReclassMinor = 0
): JournalLineInput[] {
  const payable = needAccount(accounts.payableAccountId, 'Choose the inventory and payable accounts before booking supplier invoices.')
  const inventory = needAccount(accounts.inventoryAccountId, 'Choose the inventory and payable accounts before booking supplier invoices.')
  if (totals.totalMinor <= 0 || totals.subtotalMinor <= 0) {
    throw new DomainError('zero_invoice', 'A supplier invoice needs a total above zero.')
  }
  const lines: JournalLineInput[] = []
  if (basis === 'receipt_basis') {
    const grni = needAccount(accounts.grniAccountId, 'Choose the GRNI account before booking supplier invoices on the receipt basis.')
    const variance = totals.subtotalMinor - poNetMinor
    assertReclass(variance, inventoryReclassMinor)
    if (poNetMinor > 0) lines.push(debit(grni, poNetMinor, memo))
    lines.push(...varianceLine(accounts, variance - inventoryReclassMinor, memo, 'invoice'))
    lines.push(...reclassLine(inventory, inventoryReclassMinor, memo, 'invoice'))
  } else {
    lines.push(debit(inventory, totals.subtotalMinor, memo))
  }
  if (totals.taxMinor > 0) {
    lines.push(debit(needAccount(accounts.inputTaxAccountId, 'This invoice has tax. Choose the input tax account before booking it.'), totals.taxMinor, memo))
  }
  lines.push(credit(payable, totals.totalMinor, memo))
  return lines
}

export function buildCreditNoteLines(
  basis: AccountingBasis,
  totals: InvoiceTotals,
  poNetMinor: number,
  accounts: LedgerAccounts,
  memo: string,
  inventoryReclassMinor = 0
): JournalLineInput[] {
  const payable = needAccount(accounts.payableAccountId, 'Choose the inventory and payable accounts before booking credit notes.')
  const inventory = needAccount(accounts.inventoryAccountId, 'Choose the inventory and payable accounts before booking credit notes.')
  if (totals.totalMinor <= 0 || totals.subtotalMinor <= 0) {
    throw new DomainError('zero_invoice', 'A credit note needs a total above zero.')
  }
  const lines: JournalLineInput[] = [debit(payable, totals.totalMinor, memo)]
  if (basis === 'receipt_basis') {
    const grni = needAccount(accounts.grniAccountId, 'Choose the GRNI account before booking credit notes on the receipt basis.')
    const variance = totals.subtotalMinor - poNetMinor
    assertReclass(variance, inventoryReclassMinor)
    if (poNetMinor > 0) lines.push(credit(grni, poNetMinor, memo))
    lines.push(...varianceLine(accounts, variance - inventoryReclassMinor, memo, 'credit'))
    lines.push(...reclassLine(inventory, inventoryReclassMinor, memo, 'credit'))
  } else {
    lines.push(credit(inventory, totals.subtotalMinor, memo))
  }
  if (totals.taxMinor > 0) {
    lines.push(credit(needAccount(accounts.inputTaxAccountId, 'This credit note has tax. Choose the input tax account before booking it.'), totals.taxMinor, memo))
  }
  return lines
}

export function buildPaymentLines(amountMinor: number, paidFromAccountId: string, accounts: LedgerAccounts, memo: string): JournalLineInput[] {
  needAmount(amountMinor, 'A supplier payment')
  const payable = needAccount(accounts.payableAccountId, 'Choose the payable account before paying suppliers.')
  return [debit(payable, amountMinor, memo), credit(paidFromAccountId, amountMinor, memo)]
}
