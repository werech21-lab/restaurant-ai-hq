import { emit } from '@/lib/events/bus'
import type { LeadStage, QuotationStatus } from '@/modules/crm/domain/types'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

export type CustomerCreatedEvent = EventBase<
  'crm.customer.created',
  { customerId: string; name: string; createdBy: string }
>

export type CustomerUpdatedEvent = EventBase<
  'crm.customer.updated',
  { customerId: string; name: string; status: string; updatedBy: string }
>

export type LeadCreatedEvent = EventBase<
  'crm.lead.created',
  { leadId: string; customerId: string; stage: LeadStage; expectedRevenueMinor: number; createdBy: string }
>

export type LeadUpdatedEvent = EventBase<'crm.lead.updated', { leadId: string; customerId: string; updatedBy: string }>

export type LeadMovedEvent = EventBase<
  'crm.lead.moved',
  { leadId: string; customerId: string; fromStage: LeadStage; toStage: LeadStage; movedBy: string }
>

export type LeadWonEvent = EventBase<
  'crm.lead.won',
  { leadId: string; customerId: string; expectedRevenueMinor: number; quotationId: string | null; wonBy: string }
>

export type LeadLostEvent = EventBase<'crm.lead.lost', { leadId: string; customerId: string; lostBy: string }>

export type QuotationCreatedEvent = EventBase<
  'crm.quotation.created',
  { quotationId: string; quoteNumber: string; customerId: string; totalMinor: number; createdBy: string }
>

export type QuotationUpdatedEvent = EventBase<
  'crm.quotation.updated',
  { quotationId: string; quoteNumber: string; updatedBy: string }
>

/** One event for send, accept, reject and expire, with the status it moved to. */
export type QuotationStatusChangedEvent = EventBase<
  'crm.quotation.status_changed',
  { quotationId: string; quoteNumber: string; from: QuotationStatus; to: QuotationStatus; changedBy: string }
>

export type QuotationConvertedEvent = EventBase<
  'crm.quotation.converted',
  {
    quotationId: string
    quoteNumber: string
    customerId: string
    invoiceId: string
    invoiceNumber: string
    totalMinor: number
    convertedBy: string
  }
>

export type CrmEvent =
  | CustomerCreatedEvent
  | CustomerUpdatedEvent
  | LeadCreatedEvent
  | LeadUpdatedEvent
  | LeadMovedEvent
  | LeadWonEvent
  | LeadLostEvent
  | QuotationCreatedEvent
  | QuotationUpdatedEvent
  | QuotationStatusChangedEvent
  | QuotationConvertedEvent

/** Call only after the transaction that wrote the data has committed. */
export async function publishCrmEvent(event: CrmEvent): Promise<void> {
  await emit(event)
}

export async function publishCrmEvents(events: readonly CrmEvent[]): Promise<void> {
  for (const event of events) await publishCrmEvent(event)
}

/** Fills the fields every event shares. */
export function crmEventBase(tenantId: string): { version: 1; occurredAt: string; tenantId: string } {
  return { version: 1, occurredAt: new Date().toISOString(), tenantId }
}
