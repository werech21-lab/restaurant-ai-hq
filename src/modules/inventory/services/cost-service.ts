import type { AuthContext } from '@/lib/auth/context'
import type { Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { applyIssueCost, applyReceiptCost, applyReturnCost, applyVarianceCost } from '@/modules/inventory/domain/valuation'
import * as costRepository from '@/modules/inventory/repositories/cost-repository'
import type { CostingPolicy } from '@/modules/inventory/repositories/cost-repository'
import * as repository from '@/modules/inventory/repositories/inventory-repository'

export type IssuedCost = { itemId: string; quantity: number; unitCostMinor: number; amountMinor: number }

type PricedLine = { itemId: string; quantity: number; unitCostMinor?: number }

/** The costing policy the sales invoice reads. No row means order price, which posts no COGS. */
export async function readCostingWithin(tx: Queryable, tenantId: string): Promise<CostingPolicy> {
  return costRepository.findPolicy(tx, tenantId)
}

/** Written in the same transaction as the procurement accounting settings. */
export async function setCostingPolicyWithin(tx: Queryable, auth: AuthContext, policy: CostingPolicy): Promise<void> {
  if (policy.method === 'moving_weighted_average' && (!policy.cogsAccountId || !policy.inventoryAccountId)) {
    throw new DomainError('accounts_not_configured', 'Moving weighted average needs an inventory account and a COGS account.')
  }
  await costRepository.upsertPolicy(tx, auth.tenantId, auth.userId, policy)
}

async function movingAverage(tx: Queryable, tenantId: string): Promise<boolean> {
  return (await costRepository.findPolicy(tx, tenantId)).method === 'moving_weighted_average'
}

function positions(lines: readonly PricedLine[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const line of lines) totals.set(line.itemId, (totals.get(line.itemId) ?? 0) + line.quantity)
  return totals
}

/**
 * The stock trigger has already added the receipt. `currentStock` is therefore the quantity after it, and the average
 * is rebuilt forward from the quantity before this receipt. Lines of the same item run in document order.
 */
export async function recordReceiptCosts(tx: Queryable, auth: AuthContext, referenceId: string, lines: readonly PricedLine[]): Promise<void> {
  if (!(await movingAverage(tx, auth.tenantId)) || lines.length === 0) return
  if (lines.some((line) => line.unitCostMinor === undefined)) {
    throw new DomainError('cost_required', 'A receipt under moving weighted average needs the unit cost of every line.')
  }
  const ids = [...new Set(lines.map((line) => line.itemId))].sort()
  const locked = await repository.lockItems(tx, auth.tenantId, ids)
  const incoming = positions(lines)
  const qty = new Map<string, number>()
  const average = new Map<string, number>()
  for (const item of locked) {
    const before = item.currentStock - (incoming.get(item.id) ?? 0)
    if (before < 0) throw new DomainError('cost_exceeds_stock', 'The receipt cost cannot be applied because the stock position is inconsistent.')
    qty.set(item.id, before)
    average.set(item.id, item.unitCostMinor)
  }
  for (const line of lines) {
    const snapshot = applyReceiptCost(qty.get(line.itemId) ?? 0, average.get(line.itemId) ?? 0, line.quantity, line.unitCostMinor ?? 0)
    qty.set(line.itemId, snapshot.qtyAfter)
    average.set(line.itemId, snapshot.averageAfterMinor)
    await costRepository.insertCostEvent(tx, auth.tenantId, auth.userId, {
      ...snapshot,
      itemId: line.itemId,
      kind: 'receipt',
      referenceType: 'purchase_receipt',
      referenceId,
    })
  }
  for (const item of locked) {
    const next = average.get(item.id)
    if (next !== undefined && next !== item.unitCostMinor) await costRepository.updateAverage(tx, auth.tenantId, item.id, next)
  }
}

/** Issues at the average already stored. The average does not change, and the returned amounts are the COGS of this issue. */
export async function recordIssueCosts(
  tx: Queryable,
  auth: AuthContext,
  referenceId: string,
  lines: readonly PricedLine[],
  referenceType = 'invoice'
): Promise<IssuedCost[]> {
  if (!(await movingAverage(tx, auth.tenantId)) || lines.length === 0) return []
  const ids = [...new Set(lines.map((line) => line.itemId))].sort()
  const locked = await repository.lockItems(tx, auth.tenantId, ids)
  const outgoing = positions(lines)
  const qty = new Map<string, number>()
  const average = new Map<string, number>()
  for (const item of locked) {
    qty.set(item.id, item.currentStock + (outgoing.get(item.id) ?? 0))
    average.set(item.id, item.unitCostMinor)
  }
  const issued: IssuedCost[] = []
  for (const line of lines) {
    const before = qty.get(line.itemId) ?? 0
    const avg = average.get(line.itemId) ?? 0
    const snapshot = applyIssueCost(before, avg, line.quantity)
    qty.set(line.itemId, snapshot.qtyAfter)
    await costRepository.insertCostEvent(tx, auth.tenantId, auth.userId, {
      ...snapshot,
      itemId: line.itemId,
      kind: 'issue',
      referenceType,
      referenceId,
    })
    issued.push({ itemId: line.itemId, quantity: line.quantity, unitCostMinor: avg, amountMinor: -snapshot.valueDeltaMinor })
  }
  return issued
}

/** Removes stock at the order price that entered, then recomputes the average. The receipt journal is left as it was. */
export async function recordReturnCosts(tx: Queryable, auth: AuthContext, referenceId: string, lines: readonly PricedLine[]): Promise<void> {
  if (!(await movingAverage(tx, auth.tenantId)) || lines.length === 0) return
  if (lines.some((line) => line.unitCostMinor === undefined)) {
    throw new DomainError('cost_required', 'A purchase return under moving weighted average needs the unit cost of every line.')
  }
  const ids = [...new Set(lines.map((line) => line.itemId))].sort()
  const locked = await repository.lockItems(tx, auth.tenantId, ids)
  const outgoing = positions(lines)
  const qty = new Map<string, number>()
  const average = new Map<string, number>()
  for (const item of locked) {
    qty.set(item.id, item.currentStock + (outgoing.get(item.id) ?? 0))
    average.set(item.id, item.unitCostMinor)
  }
  for (const line of lines) {
    const snapshot = applyReturnCost(qty.get(line.itemId) ?? 0, average.get(line.itemId) ?? 0, line.quantity, line.unitCostMinor ?? 0)
    qty.set(line.itemId, snapshot.qtyAfter)
    average.set(line.itemId, snapshot.averageAfterMinor)
    await costRepository.insertCostEvent(tx, auth.tenantId, auth.userId, {
      ...snapshot,
      itemId: line.itemId,
      kind: 'purchase_return',
      referenceType: 'purchase_return',
      referenceId,
    })
  }
  for (const item of locked) {
    const next = average.get(item.id)
    if (next !== undefined && next !== item.unitCostMinor) await costRepository.updateAverage(tx, auth.tenantId, item.id, next)
  }
}

/**
 * Puts the issued quantity back at the unit cost recorded on the issue. A receipt that happened in between is blended
 * forward. The original COGS entry is not edited; finance reverses it with a new entry.
 */
export async function recordRestoreCosts(tx: Queryable, auth: AuthContext, invoiceId: string): Promise<void> {
  if (!(await movingAverage(tx, auth.tenantId))) return
  const issues = await costRepository.listCostEvents(tx, auth.tenantId, 'invoice', invoiceId, 'issue')
  if (issues.length === 0) return
  const ids = [...new Set(issues.map((event) => event.itemId))].sort()
  const locked = await repository.lockItems(tx, auth.tenantId, ids)
  const restored = positions(issues.map((event) => ({ itemId: event.itemId, quantity: -event.qtyDelta })))
  const qty = new Map<string, number>()
  const average = new Map<string, number>()
  for (const item of locked) {
    const before = item.currentStock - (restored.get(item.id) ?? 0)
    if (before < 0) throw new DomainError('cost_exceeds_stock', 'The void cannot restore a cost because the stock position is inconsistent.')
    qty.set(item.id, before)
    average.set(item.id, item.unitCostMinor)
  }
  for (const event of issues) {
    const snapshot = applyReceiptCost(qty.get(event.itemId) ?? 0, average.get(event.itemId) ?? 0, -event.qtyDelta, event.unitCostMinor)
    qty.set(event.itemId, snapshot.qtyAfter)
    average.set(event.itemId, snapshot.averageAfterMinor)
    await costRepository.insertCostEvent(tx, auth.tenantId, auth.userId, {
      ...snapshot,
      itemId: event.itemId,
      kind: 'restore',
      referenceType: 'invoice',
      referenceId: invoiceId,
    })
  }
  for (const item of locked) {
    const next = average.get(item.id)
    if (next !== undefined && next !== item.unitCostMinor) await costRepository.updateAverage(tx, auth.tenantId, item.id, next)
  }
}

/**
 * Revalues only the quantity of each line that is still on hand, in document order, so the same unit is not adjusted twice.
 * Returns the signed pool change. The caller posts that amount on the new supplier document and does not edit the receipt.
 */
export async function applyPriceVarianceWithin(
  tx: Queryable,
  auth: AuthContext,
  referenceType: 'supplier_invoice' | 'supplier_credit_note',
  referenceId: string,
  lines: readonly { itemId: string; quantity: number; unitVarianceMinor: number }[]
): Promise<number> {
  if (!(await movingAverage(tx, auth.tenantId))) return 0
  const active = lines.filter((line) => line.unitVarianceMinor !== 0 && line.quantity > 0)
  if (active.length === 0) return 0
  const ids = [...new Set(active.map((line) => line.itemId))].sort()
  const locked = await repository.lockItems(tx, auth.tenantId, ids)
  const physical = new Map<string, number>()
  const unallocated = new Map<string, number>()
  const average = new Map<string, number>()
  for (const item of locked) {
    physical.set(item.id, item.currentStock)
    unallocated.set(item.id, item.currentStock)
    average.set(item.id, item.unitCostMinor)
  }
  let pool = 0
  for (const line of active) {
    const onHand = physical.get(line.itemId) ?? 0
    const left = unallocated.get(line.itemId) ?? 0
    const adjust = Math.min(line.quantity, left)
    unallocated.set(line.itemId, left - adjust)
    if (adjust === 0 || onHand === 0) continue
    const snapshot = applyVarianceCost(onHand, average.get(line.itemId) ?? 0, adjust, line.unitVarianceMinor)
    average.set(line.itemId, snapshot.averageAfterMinor)
    pool += snapshot.valueDeltaMinor
    await costRepository.insertCostEvent(tx, auth.tenantId, auth.userId, {
      ...snapshot,
      itemId: line.itemId,
      kind: 'invoice_variance',
      referenceType,
      referenceId,
    })
  }
  for (const item of locked) {
    const next = average.get(item.id) ?? item.unitCostMinor
    if (next !== item.unitCostMinor) await costRepository.updateAverage(tx, auth.tenantId, item.id, next)
  }
  return pool
}
