import { DomainError } from '@/lib/domain-error'
import { permissions, type Permission } from '@/lib/auth/permissions'
import type { ActionType, ApprovalStatus } from '@/modules/ai/domain/types'

const DAY_MS = 86_400_000

/** pending to approved, rejected or executed. approved to executed. rejected and executed are final. */
export function canTransition(from: ApprovalStatus, to: ApprovalStatus): boolean {
  if (from === 'pending') return to === 'approved' || to === 'rejected' || to === 'executed'
  if (from === 'approved') return to === 'executed'
  return false
}

export function assertCanDecide(status: ApprovalStatus): void {
  if (status !== 'pending') {
    throw new DomainError('invalid_transition', `A request that is ${status} can no longer be decided.`)
  }
}

/**
 * The underlying domain permission an approver also needs. An executive who may approve AI requests but may not adjust stock
 * cannot use an AI request to adjust stock. A reminder or a follow-up changes no record, but it re-reads the invoice or the lead first, so it needs the right to read it.
 */
export function underlyingPermissions(actionType: ActionType): Permission[] {
  switch (actionType) {
    case 'auto_reorder':
      return [permissions.inventoryStockAdjust]
    case 'credit_hold':
      return [permissions.crmCustomerUpdate, permissions.financeInvoiceRead]
    case 'price_adjustment':
      return [permissions.inventoryItemUpdate]
    case 'discount_approval':
      return [permissions.crmQuotationUpdate]
    case 'payment_reminder':
      return [permissions.financeInvoiceRead]
    case 'lead_followup':
      return [permissions.crmLeadRead]
    case 'scenario_choice':
      return [permissions.inventoryItemRead]
  }
}

export function missingPermissions(actionType: ActionType, granted: ReadonlySet<string>): Permission[] {
  return underlyingPermissions(actionType).filter((permission) => !granted.has(permission))
}

/** True while a person's decision on a finding is recent enough that the same finding is not proposed again. */
export function inCooldown(decidedAt: Date, cooldownDays: number, now: Date): boolean {
  return decidedAt.getTime() + cooldownDays * DAY_MS > now.getTime()
}

/** A restock is stale once the stock has reached the level the restock was meant to bring it to. */
export function isRestockStale(currentStock: number, targetStock: number): boolean {
  return currentStock >= targetStock
}
