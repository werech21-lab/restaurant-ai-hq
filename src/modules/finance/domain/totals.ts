import { DomainError } from '@/lib/domain-error'

/** Largest invoice total the system accepts: 1,000,000,000.000 KWD. Keeps every sum inside a safe integer. */
export const MAX_INVOICE_MINOR = 1_000_000_000_000

const BPS_DENOMINATOR = 10_000n
const HALF = 5_000n

export type LineInput = {
  quantity: number
  unitPriceMinor: number
  taxRateBps: number
}

export type InvoiceTotals = {
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
}

function assertLine(line: LineInput): void {
  const { quantity, unitPriceMinor, taxRateBps } = line
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
    throw new DomainError('invalid_line', 'Quantity must be a whole number from 1 to 1,000,000.')
  }
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0 || unitPriceMinor > 1_000_000_000) {
    throw new DomainError('invalid_line', 'Unit price must be a whole number of fils from 0 to 1,000,000,000.')
  }
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10_000) {
    throw new DomainError('invalid_line', 'Tax rate must be a whole number of basis points from 0 to 10,000.')
  }
}

export function lineNetMinor(line: Pick<LineInput, 'quantity' | 'unitPriceMinor'>): number {
  return Number(BigInt(line.quantity) * BigInt(line.unitPriceMinor))
}

/**
 * Subtotal is the sum of line nets. Tax is per line: each line's tax is net x rate. The unrounded line taxes are
 * summed and rounded half up ONCE for the invoice. All arithmetic is BigInt, so there is no float error.
 */
export function computeTotals(lines: readonly LineInput[]): InvoiceTotals {
  let subtotal = 0n
  let taxNumerator = 0n
  for (const line of lines) {
    assertLine(line)
    const net = BigInt(line.quantity) * BigInt(line.unitPriceMinor)
    subtotal += net
    taxNumerator += net * BigInt(line.taxRateBps)
  }
  const tax = (taxNumerator + HALF) / BPS_DENOMINATOR
  const total = subtotal + tax
  if (total > BigInt(MAX_INVOICE_MINOR)) {
    throw new DomainError('amount_too_large', 'The invoice total exceeds the maximum allowed amount.')
  }
  return { subtotalMinor: Number(subtotal), taxMinor: Number(tax), totalMinor: Number(total) }
}
