import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { buildConsumptionLines, findAccountsWithin, postSourcedEntryWithin, publishFinanceEvents, type FinanceEvent } from '@/modules/finance'
import { consumeStockWithin, publishInventoryEvents, readCostingWithin, type InventoryEvent, type IssuedCost } from '@/modules/inventory'
import type { ConsumptionResult, KitchenProduction, KitchenWaste, Recipe, RecipeLine } from '@/modules/kitchen/domain/types'
import { publishKitchenEvents, type KitchenEvent } from '@/modules/kitchen/events'
import * as repository from '@/modules/kitchen/repositories/kitchen-repository'
import type { ListQuery, RecordProductionInput, RecordWasteInput } from '@/modules/kitchen/schemas/kitchen'

const WASTE_SCOPE = 'kitchen.waste.create'
const PRODUCTION_SCOPE = 'kitchen.production.create'

function eventBase(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

function scale(quantity: number, batches: number): number {
  const value = BigInt(quantity) * BigInt(batches)
  if (value < 1n || value > 1_000_000n) throw new DomainError('invalid_quantity', 'The recipe quantity for this run is outside the allowed range.')
  return Number(value)
}

async function postConsumption(
  tx: Queryable,
  auth: AuthContext,
  sourceId: string,
  entryDate: string,
  memo: string,
  costs: readonly IssuedCost[],
  events: FinanceEvent[]
): Promise<{ costMinor: number; journalEntryId: string }> {
  const total = costs.reduce((sum, cost) => sum + cost.amountMinor, 0)
  if (!Number.isSafeInteger(total) || total <= 0) throw new DomainError('zero_amount', 'The materials have no cost to post.')
  const policy = await readCostingWithin(tx, auth.tenantId)
  if (!policy.cogsAccountId || !policy.inventoryAccountId) {
    throw new DomainError('accounts_not_configured', 'Choose the inventory and COGS accounts before recording kitchen consumption.')
  }
  const found = await findAccountsWithin(tx, auth.tenantId, [policy.cogsAccountId, policy.inventoryAccountId])
  const byId = new Map(found.map((account) => [account.id, account]))
  const cost = byId.get(policy.cogsAccountId)
  const inventory = byId.get(policy.inventoryAccountId)
  if (!cost || !inventory || cost.type !== 'expense' || inventory.type !== 'asset') {
    throw new DomainError('accounts_not_configured', 'Kitchen consumption needs an expense cost account and an asset inventory account.')
  }
  const entry = await postSourcedEntryWithin(
    tx,
    auth,
    { entryDate, memo, sourceType: 'kitchen_issue', sourceId, lines: buildConsumptionLines(total, cost.id, inventory.id, memo) },
    events
  )
  return { costMinor: total, journalEntryId: entry.id }
}

async function issue(
  tx: Queryable,
  auth: AuthContext,
  referenceId: string,
  entryDate: string,
  memo: string,
  note: string,
  lines: readonly { itemId: string; warehouseId: string; quantity: number }[],
  financeEvents: FinanceEvent[],
  stockEvents: InventoryEvent[]
): Promise<{ costMinor: number; journalEntryId: string }> {
  const costs = await consumeStockWithin(tx, auth, { referenceId, note: note.slice(0, 200), lines }, stockEvents)
  return postConsumption(tx, auth, referenceId, entryDate, memo, costs, financeEvents)
}

export function listRecipes(auth: AuthContext): Promise<Recipe[]> {
  return repository.listRecipes(db, auth.tenantId)
}

export function listWaste(auth: AuthContext, query: ListQuery): Promise<Page<KitchenWaste>> {
  return repository.listWaste(db, auth.tenantId, query)
}

export function listProductions(auth: AuthContext, query: ListQuery): Promise<Page<KitchenProduction>> {
  return repository.listProductions(db, auth.tenantId, query)
}

export function listWasteQuantitiesWithin(tx: Queryable, tenantId: string): Promise<Array<{ itemId: string; quantity: number }>> {
  return repository.listWasteQuantities(tx, tenantId)
}

export async function recordWaste(auth: AuthContext, idempotencyKey: string, input: RecordWasteInput): Promise<IdempotentResult<{ data: KitchenWaste & ConsumptionResult }>> {
  const financeEvents: FinanceEvent[] = []
  const stockEvents: InventoryEvent[] = []
  const kitchenEvents: KitchenEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<{ data: KitchenWaste & ConsumptionResult }>(
      tx,
      { tenantId: auth.tenantId, scope: WASTE_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const row = await repository.insertWaste(tx, auth.tenantId, auth.userId, input)
        const posted = await issue(tx, auth, row.id, input.wastedOn, `Kitchen waste ${row.id.slice(0, 8)}`, input.reason, [input], financeEvents, stockEvents)
        await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'kitchen_waste', entityId: row.id, action: 'create', before: null, after: { ...row, ...posted } })
        kitchenEvents.push({ ...eventBase(auth), name: 'kitchen.waste.recorded', payload: { wasteId: row.id, itemId: row.itemId, quantity: row.quantity, costMinor: posted.costMinor, journalEntryId: posted.journalEntryId, recordedBy: auth.userId } })
        return { status: 201, body: { data: { ...row, ...posted } } }
      }
    )
  )
  if (!outcome.replayed) {
    await publishInventoryEvents(stockEvents)
    await publishFinanceEvents(financeEvents)
    await publishKitchenEvents(kitchenEvents)
  }
  return outcome
}

export async function recordProduction(
  auth: AuthContext,
  idempotencyKey: string,
  input: RecordProductionInput
): Promise<IdempotentResult<{ data: KitchenProduction & ConsumptionResult }>> {
  const financeEvents: FinanceEvent[] = []
  const stockEvents: InventoryEvent[] = []
  const kitchenEvents: KitchenEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent<{ data: KitchenProduction & ConsumptionResult }>(
      tx,
      { tenantId: auth.tenantId, scope: PRODUCTION_SCOPE, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => {
        const recipeLines = await repository.findRecipeLines(tx, auth.tenantId, input.recipeId)
        if (recipeLines === null) throw new AppError(404, 'not_found', 'The recipe was not found.')
        if (recipeLines.length === 0) throw new DomainError('invalid_quantity', 'The recipe has no materials.')
        const lines = combine(recipeLines.map((line: RecipeLine) => ({ itemId: line.itemId, warehouseId: input.warehouseId, quantity: scale(line.quantity, input.batches) })))
        const row = await repository.insertProduction(tx, auth.tenantId, auth.userId, input)
        const posted = await issue(tx, auth, row.id, input.producedOn, `Kitchen production ${row.id.slice(0, 8)}`, 'Kitchen production', lines, financeEvents, stockEvents)
        await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'kitchen_production', entityId: row.id, action: 'create', before: null, after: { ...row, ...posted } })
        kitchenEvents.push({
          ...eventBase(auth),
          name: 'kitchen.production.recorded',
          payload: { productionId: row.id, recipeId: row.recipeId, batches: row.batches, costMinor: posted.costMinor, journalEntryId: posted.journalEntryId, recordedBy: auth.userId },
        })
        return { status: 201, body: { data: { ...row, ...posted } } }
      }
    )
  )
  if (!outcome.replayed) {
    await publishInventoryEvents(stockEvents)
    await publishFinanceEvents(financeEvents)
    await publishKitchenEvents(kitchenEvents)
  }
  return outcome
}

function combine(lines: readonly { itemId: string; warehouseId: string; quantity: number }[]): { itemId: string; warehouseId: string; quantity: number }[] {
  const totals = new Map<string, { itemId: string; warehouseId: string; quantity: number }>()
  for (const line of lines) {
    const key = `${line.itemId}:${line.warehouseId}`
    const current = totals.get(key)
    if (!current) totals.set(key, { ...line })
    else {
      const quantity = current.quantity + line.quantity
      if (quantity > 1_000_000) throw new DomainError('invalid_quantity', 'The recipe quantity for this run is outside the allowed range.')
      current.quantity = quantity
    }
  }
  return [...totals.values()]
}
