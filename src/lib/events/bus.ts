import { errorFields, logger } from '@/lib/logger'

/** Every event has a name `<module>.<entity>.<past-tense-verb>`, a schema version and a typed payload. */
export type BusEvent = {
  name: string
  version: number
  occurredAt: string
  tenantId: string
  payload: unknown
}

export type EventHandler = (event: BusEvent) => Promise<void> | void

const globalForBus = globalThis as unknown as { erpHandlers?: Map<string, Set<EventHandler>> }

function registry(): Map<string, Set<EventHandler>> {
  if (!globalForBus.erpHandlers) globalForBus.erpHandlers = new Map()
  return globalForBus.erpHandlers
}

/** Registers a handler. Handlers must be idempotent: an event can be delivered more than once. Returns an unsubscribe function. */
export function subscribe(name: string, handler: EventHandler): () => void {
  const handlers = registry().get(name) ?? new Set<EventHandler>()
  handlers.add(handler)
  registry().set(name, handlers)
  return () => {
    handlers.delete(handler)
  }
}

/**
 * Delivers an event to its handlers. Call it only after the database transaction has committed.
 * A failing handler is logged and never reaches the emitter.
 */
export async function emit(event: BusEvent): Promise<void> {
  const handlers = Array.from(registry().get(event.name) ?? [])
  const results = await Promise.allSettled(handlers.map(async (handler) => handler(event)))
  results.forEach((result) => {
    if (result.status === 'rejected') {
      logger.error('Event handler failed', { event: event.name, tenantId: event.tenantId, ...errorFields(result.reason) })
    }
  })
}
