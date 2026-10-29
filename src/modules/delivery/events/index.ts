import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = { name: N; version: 1; occurredAt: string; tenantId: string; payload: P }

export type DeliveryOrderRecorded = EventBase<'delivery.order.recorded', { orderId: string; partnerId: string; commissionMinor: number; recordedBy: string }>
export type DeliveryOrderSettled = EventBase<'delivery.order.settled', { settlementId: string; orderId: string; commissionMinor: number; journalEntryId: string | null; settledBy: string }>
export type DeliveryEvent = DeliveryOrderRecorded | DeliveryOrderSettled

export async function publishDeliveryEvents(events: readonly DeliveryEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
