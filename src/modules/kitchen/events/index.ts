import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = { name: N; version: 1; occurredAt: string; tenantId: string; payload: P }

export type KitchenWasteRecorded = EventBase<'kitchen.waste.recorded', { wasteId: string; itemId: string; quantity: number; costMinor: number; journalEntryId: string; recordedBy: string }>
export type KitchenProductionRecorded = EventBase<'kitchen.production.recorded', { productionId: string; recipeId: string; batches: number; costMinor: number; journalEntryId: string; recordedBy: string }>
export type KitchenEvent = KitchenWasteRecorded | KitchenProductionRecorded

export async function publishKitchenEvents(events: readonly KitchenEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}
