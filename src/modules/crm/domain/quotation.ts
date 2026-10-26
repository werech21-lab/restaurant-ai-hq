import { DomainError } from '@/lib/domain-error'
import type { InvoiceLineInput } from '@/modules/finance/client'
import type { QuotationLine, QuotationStatus } from '@/modules/crm/domain/types'

/** Quotation numbers are `QT-000042`, from a per-tenant sequence. Numbers are never reused. */
export const QUOTE_PREFIX = 'QT'

/** The invoice made from a quotation is due this many days after its issue date. */
export const INVOICE_DUE_DAYS = 30

export function formatQuoteNumber(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new DomainError('invalid_sequence', 'A quotation sequence number must be a positive whole number.')
  }
  return `${QUOTE_PREFIX}-${String(sequence).padStart(6, '0')}`
}

const allowed: Record<QuotationStatus, readonly QuotationStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: ['converted'],
  rejected: [],
  expired: [],
  converted: [],
}

export function canTransition(from: QuotationStatus, to: QuotationStatus): boolean {
  return allowed[from].includes(to)
}

export function assertTransition(from: QuotationStatus, to: QuotationStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('invalid_transition', `A ${from} quotation cannot become ${to}.`)
  }
}

export function assertEditable(quotation: { status: QuotationStatus }): void {
  if (quotation.status !== 'draft') {
    throw new DomainError('not_editable', 'Only a draft quotation can be edited.')
  }
}

/** `YYYY-MM-DD` of an instant in UTC. */
export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return utcDate(date)
}

/** A quotation is valid through its `validUntil` day. It is past validity from the next day. */
export function isPastValidity(validUntil: string, today: string): boolean {
  return validUntil < today
}

/**
 * The status to show. Nothing flips a sent quotation to expired by itself (there is no scheduler), so a sent quotation
 * that is past its date is shown as expired and can no longer be accepted.
 */
export function effectiveStatus(quotation: { status: QuotationStatus; validUntil: string }, today: string): QuotationStatus {
  return quotation.status === 'sent' && isPastValidity(quotation.validUntil, today) ? 'expired' : quotation.status
}

export function assertValidUntil(validUntil: string, today: string): void {
  if (isPastValidity(validUntil, today)) {
    throw new DomainError('invalid_valid_until', 'The valid-until date cannot be in the past.')
  }
}

export function assertCanSend(quotation: { status: QuotationStatus; validUntil: string }, today: string): void {
  assertTransition(quotation.status, 'sent')
  assertValidUntil(quotation.validUntil, today)
}

/** The customer can only accept a sent quotation that is still valid. */
export function assertCanAccept(quotation: { status: QuotationStatus; validUntil: string }, today: string): void {
  assertTransition(quotation.status, 'accepted')
  if (isPastValidity(quotation.validUntil, today)) {
    throw new DomainError('quote_expired', 'The quotation is past its valid-until date and cannot be accepted.')
  }
}

/** Marking expired is only for a sent quotation that really is past its date. */
export function assertCanExpire(quotation: { status: QuotationStatus; validUntil: string }, today: string): void {
  assertTransition(quotation.status, 'expired')
  if (!isPastValidity(quotation.validUntil, today)) {
    throw new DomainError('invalid_transition', 'The quotation is still valid, so it cannot be marked expired.')
  }
}

export function assertCanConvert(quotation: { status: QuotationStatus }): void {
  assertTransition(quotation.status, 'converted')
}

/** Invoice lines for a quotation, in order. Item and warehouse carry over so the invoice takes the stock. */
export function toInvoiceLines(lines: readonly QuotationLine[]): InvoiceLineInput[] {
  return [...lines]
    .sort((a, b) => a.position - b.position)
    .map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      taxRateBps: line.taxRateBps,
      itemId: line.itemId,
      warehouseId: line.warehouseId,
    }))
}

export function invoiceDates(today: string): { issueDate: string; dueDate: string } {
  return { issueDate: today, dueDate: addDays(today, INVOICE_DUE_DAYS) }
}

/**
 * Credit check for a conversion. A null limit means no limit. Otherwise the open balance plus the new invoice total
 * may not exceed the limit (equal is allowed).
 */
export function assertWithinCreditLimit(args: {
  creditLimitMinor: number | null
  openBalanceMinor: number
  newTotalMinor: number
}): void {
  if (args.creditLimitMinor === null) return
  const exposure = args.openBalanceMinor + args.newTotalMinor
  if (exposure > args.creditLimitMinor) {
    throw new DomainError(
      'credit_limit_exceeded',
      `The customer's credit limit would be exceeded: open balance plus this invoice is ${exposure} fils against a limit of ${args.creditLimitMinor} fils.`
    )
  }
}
