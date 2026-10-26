import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

type InvoiceRef = { invoiceId: string; number: string; customerId: string; totalMinor: number; currency: 'KWD' }

export type InvoiceCreatedEvent = EventBase<'finance.invoice.created', InvoiceRef & { createdBy: string }>
export type InvoiceUpdatedEvent = EventBase<'finance.invoice.updated', InvoiceRef & { updatedBy: string }>
export type InvoiceSubmittedEvent = EventBase<
  'finance.invoice.submitted',
  InvoiceRef & { requiresApproval: boolean; submittedBy: string }
>
export type InvoiceApprovedEvent = EventBase<'finance.invoice.approved', InvoiceRef & { approvedBy: string }>
export type InvoiceIssuedEvent = EventBase<'finance.invoice.issued', InvoiceRef>
export type InvoiceVoidedEvent = EventBase<'finance.invoice.voided', InvoiceRef & { voidedBy: string; reason: string }>
export type InvoicePaidEvent = EventBase<'finance.invoice.paid', InvoiceRef>
export type PaymentRecordedEvent = EventBase<
  'finance.payment.recorded',
  InvoiceRef & { paymentId: string; amountMinor: number; paidMinor: number; recordedBy: string }
>

export type FinanceEvent =
  | InvoiceCreatedEvent
  | InvoiceUpdatedEvent
  | InvoiceSubmittedEvent
  | InvoiceApprovedEvent
  | InvoiceIssuedEvent
  | InvoiceVoidedEvent
  | InvoicePaidEvent
  | PaymentRecordedEvent

/** Call only after the transaction that wrote the data has committed. Handler failures never reach the caller. */
export async function publishFinanceEvents(events: readonly FinanceEvent[]): Promise<void> {
  for (const event of events) {
    await emit(event)
  }
}
