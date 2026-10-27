import { emit } from '@/lib/events/bus'

type EventBase<N extends string, P> = {
  name: N
  version: 1
  occurredAt: string
  tenantId: string
  payload: P
}

export type BrandCreatedEvent = EventBase<'org.brand.created', { brandId: string; code: string; createdBy: string }>
export type BrandUpdatedEvent = EventBase<'org.brand.updated', { brandId: string; code: string; status: string; updatedBy: string }>
export type BranchCreatedEvent = EventBase<'org.branch.created', { branchId: string; brandId: string; code: string; createdBy: string }>
export type BranchUpdatedEvent = EventBase<'org.branch.updated', { branchId: string; brandId: string; code: string; status: string; updatedBy: string }>

export type OrgEvent = BrandCreatedEvent | BrandUpdatedEvent | BranchCreatedEvent | BranchUpdatedEvent

/** Call only after the transaction that wrote the data has committed. Handler failures never reach the caller. */
export async function publishOrgEvents(events: readonly OrgEvent[]): Promise<void> {
  for (const event of events) await emit(event)
}