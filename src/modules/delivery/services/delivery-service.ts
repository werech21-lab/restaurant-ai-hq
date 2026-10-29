import type { Page } from '@/lib/api/cursor'
import { AppError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit'
import type { AuthContext } from '@/lib/auth/context'
import { isUniqueViolation } from '@/lib/auth/require'
import { db, withTransaction, type Queryable } from '@/lib/db'
import { DomainError } from '@/lib/domain-error'
import { hashRequest, runIdempotent, type IdempotentResult } from '@/lib/idempotency'
import { buildCommissionLines, findAccountsWithin, getOperationalAccountsWithin, postSourcedEntryWithin, publishFinanceEvents, type FinanceEvent } from '@/modules/finance'
import type { DeliveryOrder, DeliveryPartner, DeliverySettlement } from '@/modules/delivery/domain/types'
import { publishDeliveryEvents, type DeliveryEvent } from '@/modules/delivery/events'
import * as repository from '@/modules/delivery/repositories/delivery-repository'
import type { CreateOrderInput, CreatePartnerInput, ListQuery, SettleOrderInput } from '@/modules/delivery/schemas/delivery'

const PARTNER_SCOPE = 'delivery.partner.create'
const ORDER_SCOPE = 'delivery.order.create'
const SETTLE_SCOPE = 'delivery.settlement.create'

function base(auth: AuthContext) {
  return { version: 1 as const, occurredAt: new Date().toISOString(), tenantId: auth.tenantId }
}

export function listPartners(auth: AuthContext): Promise<DeliveryPartner[]> {
  return repository.listPartners(db, auth.tenantId)
}

export function listOrders(auth: AuthContext, query: ListQuery): Promise<Page<DeliveryOrder>> {
  return repository.listOrders(db, auth.tenantId, query)
}

export function listOpenCommissionWithin(tx: Queryable, tenantId: string): Promise<{ commissionMinor: number; orderCount: number }> {
  return repository.listOpenCommission(tx, tenantId)
}

export async function createPartner(auth: AuthContext, key: string, input: CreatePartnerInput): Promise<IdempotentResult<{ data: DeliveryPartner }>> {
  return withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: PARTNER_SCOPE, key, requestHash: hashRequest(input) }, async () => {
      const partner = await repository.insertPartner(tx, auth.tenantId, auth.userId, input)
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'delivery_partner', entityId: partner.id, action: 'create', before: null, after: partner })
      return { status: 201 as const, body: { data: partner } }
    })
  )
}

export async function createOrder(auth: AuthContext, key: string, input: CreateOrderInput): Promise<IdempotentResult<{ data: DeliveryOrder }>> {
  const events: DeliveryEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: ORDER_SCOPE, key, requestHash: hashRequest(input) }, async () => {
      let id: string
      id = await repository.insertOrder(tx, auth.tenantId, auth.userId, input)
      const order = await repository.findOrder(tx, auth.tenantId, id)
      if (!order) throw new AppError(404, 'not_found', 'The delivery order was not found.')
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'delivery_order', entityId: order.id, action: 'create', before: null, after: order })
      events.push({ ...base(auth), name: 'delivery.order.recorded', payload: { orderId: order.id, partnerId: order.partnerId, commissionMinor: order.commissionMinor, recordedBy: auth.userId } })
      return { status: 201 as const, body: { data: order } }
    })
  )
  if (!outcome.replayed) await publishDeliveryEvents(events)
  return outcome
}

export async function settleOrder(auth: AuthContext, key: string, input: SettleOrderInput): Promise<IdempotentResult<{ data: DeliverySettlement }>> {
  const financeEvents: FinanceEvent[] = []
  const deliveryEvents: DeliveryEvent[] = []
  const outcome = await withTransaction((tx) =>
    runIdempotent(tx, { tenantId: auth.tenantId, scope: SETTLE_SCOPE, key, requestHash: hashRequest(input) }, async () => {
      const order = await repository.findOrder(tx, auth.tenantId, input.orderId)
      if (!order) throw new AppError(404, 'not_found', 'The delivery order was not found.')
      if (order.status !== 'recorded' || order.settled) throw new DomainError('invalid_transition', 'This delivery order cannot be settled.')
      let settlement: DeliverySettlement
      try {
        settlement = await repository.insertSettlement(tx, auth.tenantId, auth.userId, order.id, input.settledOn, order.commissionMinor)
      } catch (error) {
        if (isUniqueViolation(error)) throw new DomainError('invalid_transition', 'This delivery order cannot be settled.')
        throw error
      }
      if (order.commissionMinor > 0) {
        const saved = await getOperationalAccountsWithin(tx, auth.tenantId)
        const cashId = saved?.collectionAccountId ?? null
        const expenseId = saved?.commissionAccountId ?? null
        if (!cashId || !expenseId) throw new DomainError('accounts_not_configured', 'Choose the cash and commission accounts before settling a delivery order.')
        const found = await findAccountsWithin(tx, auth.tenantId, [cashId, expenseId])
        const byId = new Map(found.map((account) => [account.id, account]))
        const cash = byId.get(cashId)
        const expense = byId.get(expenseId)
        if (!cash || !expense || cash.type !== 'asset' || expense.type !== 'expense') {
          throw new DomainError('accounts_not_configured', 'Settlement needs an asset cash account and an expense commission account.')
        }
        const memo = `Delivery commission ${order.id.slice(0, 8)}`
        const entry = await postSourcedEntryWithin(
          tx,
          auth,
          {
            entryDate: input.settledOn,
            memo,
            sourceType: 'delivery_commission',
            sourceId: settlement.id,
            lines: buildCommissionLines(order.commissionMinor, expense.id, cash.id, memo),
          },
          financeEvents
        )
        settlement = { ...settlement, journalEntryId: entry.id }
      }
      await writeAudit(tx, { tenantId: auth.tenantId, actorId: auth.userId, entity: 'delivery_settlement', entityId: settlement.id, action: 'create', before: null, after: settlement })
      deliveryEvents.push({
        ...base(auth),
        name: 'delivery.order.settled',
        payload: { settlementId: settlement.id, orderId: order.id, commissionMinor: settlement.commissionMinor, journalEntryId: settlement.journalEntryId, settledBy: auth.userId },
      })
      return { status: 201 as const, body: { data: settlement } }
    })
  )
  if (!outcome.replayed) {
    await publishFinanceEvents(financeEvents)
    await publishDeliveryEvents(deliveryEvents)
  }
  return outcome
}
