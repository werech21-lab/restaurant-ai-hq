import { z } from 'zod'
import { subscribe, type BusEvent } from '@/lib/events/bus'
import { permissions } from '@/lib/auth/permissions'
import type { AuthContext } from '@/lib/auth/context'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { REORDER_TRIGGER } from '@/modules/ai/domain/types'
import * as repository from '@/modules/ai/repositories/ai-repository'
import { runScan } from '@/modules/ai/services/scan-service'

const itemEventPayload = z.object({ itemId: z.string().uuid() })

/**
 * An event has no signed-in person behind it, so the processor acts as the tenant's creator, with read access to stock only.
 * That is all the rules bound to inventory events need. Rows it writes carry the creator as their author.
 */
async function systemAuth(tenantId: string): Promise<AuthContext | null> {
  const creator = await repository.findTenantCreator(db, tenantId)
  if (creator === null) return null
  return {
    userId: creator,
    tenantId,
    permissions: new Set<string>([permissions.inventoryStockRead, permissions.inventoryItemRead]),
  }
}

/**
 * Runs the rules bound to the reorder trigger for the one item the event is about. A scan keys every finding by
 * fingerprint, so a second delivery of the same event changes nothing: the handler is idempotent.
 */
export async function handleInventoryEvent(event: BusEvent): Promise<void> {
  const payload = itemEventPayload.safeParse(event.payload)
  if (!payload.success) {
    logger.warn('AI event ignored: the payload has no item id', { event: event.name, tenantId: event.tenantId })
    return
  }
  const auth = await systemAuth(event.tenantId)
  if (auth === null) {
    logger.warn('AI event ignored: the tenant has no active creator', { event: event.name, tenantId: event.tenantId })
    return
  }
  await runScan(auth, { trigger: REORDER_TRIGGER, itemIds: [payload.data.itemId] })
}

const globalForAi = globalThis as unknown as { aiHandlersRegistered?: boolean }

/** Subscribes the AI module to inventory events. Calling it again does nothing. */
export function registerAiEventHandlers(): void {
  if (globalForAi.aiHandlersRegistered) return
  globalForAi.aiHandlersRegistered = true
  subscribe('inventory.item.reorder_level_reached', handleInventoryEvent)
  subscribe('inventory.stock.depleted', handleInventoryEvent)
}
