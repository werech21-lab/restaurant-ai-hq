import { DomainError } from '@/lib/domain-error'
import { CurrencyMismatchError, type Currency, type Money } from '@/lib/money'
import type { InvoiceStatus } from '@/modules/finance/domain/types'

/** `INV` and 42 become `INV-000042`. Numbers come from a per-tenant sequence and are never reused, even after a void. */
export function formatInvoiceNumber(prefix: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new DomainError('invalid_sequence', 'An invoice sequence number must be a positive whole number.')
  }
  return `${prefix}-${String(sequence).padStart(6, '0')}`
}

/** An invoice needs approval only when its total is strictly above the tenant's threshold. */
export function requiresApproval(totalMinor: number, thresholdMinor: number): boolean {
  return totalMinor > thresholdMinor
}

export function assertEditable(invoice: { status: InvoiceStatus }): void {
  if (invoice.status !== 'draft') {
    throw new DomainError('not_editable', 'Only a draft invoice can be edited.')
  }
}

export type SubmitResult = { status: 'pending_approval' | 'issued'; requiresApproval: boolean }

/** Draft to issued when the total is within the threshold, otherwise draft to pending approval. */
export function submit(
  invoice: { status: InvoiceStatus; totalMinor: number; lineCount: number },
  thresholdMinor: number
): SubmitResult {
  if (invoice.status !== 'draft') {
    throw new DomainError('invalid_transition', 'Only a draft invoice can be submitted.')
  }
  if (invoice.lineCount < 1) {
    throw new DomainError('empty_invoice', 'An invoice needs at least one line.')
  }
  if (invoice.totalMinor <= 0) {
    throw new DomainError('zero_total', 'An invoice total must be greater than zero.')
  }
  const needsApproval = requiresApproval(invoice.totalMinor, thresholdMinor)
  return { status: needsApproval ? 'pending_approval' : 'issued', requiresApproval: needsApproval }
}

export function approve(invoice: { status: InvoiceStatus }): { status: 'issued' } {
  if (invoice.status !== 'pending_approval') {
    throw new DomainError('invalid_transition', 'Only an invoice pending approval can be approved.')
  }
  return { status: 'issued' }
}

/** Void is final. It is refused once any payment exists because this version has no payment reversal or credit note. */
export function voidInvoice(invoice: { status: InvoiceStatus; paidMinor: number }, reason: string): { status: 'void' } {
  if (invoice.status === 'void') {
    throw new DomainError('invalid_transition', 'The invoice is already void.')
  }
  if (invoice.paidMinor > 0 || invoice.status === 'partially_paid' || invoice.status === 'paid') {
    throw new DomainError('cannot_void', 'An invoice with payments cannot be voided.')
  }
  if (reason.trim().length === 0) {
    throw new DomainError('reason_required', 'A reason is required to void an invoice.')
  }
  return { status: 'void' }
}

export type PaymentResult = { paidMinor: number; status: 'partially_paid' | 'paid'; balanceMinor: number }

/** Applies a payment. The amount must be positive, in the invoice currency and no more than the balance. */
export function applyPayment(
  invoice: { status: InvoiceStatus; totalMinor: number; paidMinor: number; currency: Currency },
  payment: Money
): PaymentResult {
  if (payment.currency !== invoice.currency) {
    throw new CurrencyMismatchError(invoice.currency, payment.currency)
  }
  if (invoice.status !== 'issued' && invoice.status !== 'partially_paid') {
    throw new DomainError('invalid_transition', 'Payments can only be recorded on an issued invoice with a balance.')
  }
  if (!Number.isSafeInteger(payment.amountMinor) || payment.amountMinor <= 0) {
    throw new DomainError('payment_not_positive', 'The payment amount must be greater than zero.')
  }
  const balance = invoice.totalMinor - invoice.paidMinor
  if (payment.amountMinor > balance) {
    throw new DomainError('payment_exceeds_balance', 'The payment is larger than the remaining balance.')
  }
  const paidMinor = invoice.paidMinor + payment.amountMinor
  const balanceMinor = invoice.totalMinor - paidMinor
  return { paidMinor, balanceMinor, status: balanceMinor === 0 ? 'paid' : 'partially_paid' }
}
