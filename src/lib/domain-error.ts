/** Thrown by domain code when a business rule rejects an operation. Pure: no framework imports. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

/** Domain codes that mean "the record is in the wrong state" and map to HTTP 409. Everything else maps to 422. */
export const conflictDomainCodes: ReadonlySet<string> = new Set([
  'invalid_transition',
  'not_editable',
  'cannot_void',
  'insufficient_stock',
  'credit_limit_exceeded',
  'customer_not_active',
  'quote_expired',
  'proposal_stale',
  'customer_already_blocked',
])
