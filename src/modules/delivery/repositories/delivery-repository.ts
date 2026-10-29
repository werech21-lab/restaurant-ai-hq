import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { DeliveryOrder, DeliveryPartner, DeliverySettlement } from '@/modules/delivery/domain/types'
import type { CreateOrderInput, CreatePartnerInput, ListQuery } from '@/modules/delivery/schemas/delivery'

type OrderRow = Omit<DeliveryOrder, 'createdAt' | 'orderedOn' | 'grossMinor' | 'commissionMinor'> & {
  createdAt: Date
  orderedOn: string
  grossMinor: number
  commissionMinor: number
}

function order(row: OrderRow): DeliveryOrder {
  return {
    ...row,
    orderedOn: String(row.orderedOn).slice(0, 10),
    grossMinor: Number(row.grossMinor),
    commissionMinor: Number(row.commissionMinor),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function insertPartner(tx: Queryable, tenantId: string, userId: string, input: CreatePartnerInput): Promise<DeliveryPartner> {
  const result = await tx.query<DeliveryPartner>(
    `insert into delivery_partners (tenant_id, code, name, commission_bps, created_by)
     values ($1, $2, $3, $4, $5)
     returning id, code, name, commission_bps as "commissionBps"`,
    [tenantId, input.code, input.name, input.commissionBps, userId]
  )
  return result.rows[0]
}

export async function listPartners(tx: Queryable, tenantId: string): Promise<DeliveryPartner[]> {
  const result = await tx.query<DeliveryPartner>(
    `select id, code, name, commission_bps as "commissionBps" from delivery_partners where tenant_id = $1 order by code, id`,
    [tenantId]
  )
  return result.rows
}

export async function insertOrder(tx: Queryable, tenantId: string, userId: string, input: CreateOrderInput): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into delivery_orders (tenant_id, partner_id, ordered_on, gross_minor, commission_minor, status, created_by)
     values ($1, $2, $3::date, $4, $5, 'recorded', $6) returning id`,
    [tenantId, input.partnerId, input.orderedOn, input.grossMinor, input.commissionMinor, userId]
  )
  return result.rows[0].id
}

export async function findOrder(tx: Queryable, tenantId: string, id: string): Promise<DeliveryOrder | null> {
  const result = await tx.query<OrderRow>(
    `select o.id, o.partner_id as "partnerId", p.name as "partnerName", o.ordered_on::text as "orderedOn",
            o.gross_minor as "grossMinor", o.commission_minor as "commissionMinor", o.status,
            exists(select 1 from delivery_settlements s where s.tenant_id = o.tenant_id and s.order_id = o.id) as settled,
            o.created_at as "createdAt"
     from delivery_orders o
     join delivery_partners p on p.tenant_id = o.tenant_id and p.id = o.partner_id
     where o.tenant_id = $1 and o.id = $2
     for update of o`,
    [tenantId, id]
  )
  return result.rows[0] ? order(result.rows[0]) : null
}

export async function listOrders(tx: Queryable, tenantId: string, query: ListQuery): Promise<Page<DeliveryOrder>> {
  const params: unknown[] = [tenantId]
  const keyset = keysetClauses({ sortKey: 'createdAt', column: { sql: '"createdAt"', cast: 'timestamptz' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<OrderRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select o.id, o.partner_id as "partnerId", p.name as "partnerName", o.ordered_on::text as "orderedOn",
              o.gross_minor as "grossMinor", o.commission_minor as "commissionMinor", o.status,
              exists(select 1 from delivery_settlements s where s.tenant_id = o.tenant_id and s.order_id = o.id) as settled,
              o.created_at as "createdAt"
       from delivery_orders o
       join delivery_partners p on p.tenant_id = o.tenant_id and p.id = o.partner_id
       where o.tenant_id = $1
     ) x where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'createdAt', 'desc')
  return { data: page.data.map((row) => order(row)), nextCursor: page.nextCursor }
}

export async function insertSettlement(
  tx: Queryable,
  tenantId: string,
  userId: string,
  orderId: string,
  settledOn: string,
  commissionMinor: number
): Promise<DeliverySettlement> {
  const result = await tx.query<{ id: string; settledOn: string }>(
    `insert into delivery_settlements (tenant_id, order_id, settled_on, commission_minor, created_by)
     values ($1, $2, $3::date, $4, $5)
     returning id, settled_on::text as "settledOn"`,
    [tenantId, orderId, settledOn, commissionMinor, userId]
  )
  return { id: result.rows[0].id, orderId, settledOn: String(result.rows[0].settledOn).slice(0, 10), commissionMinor, journalEntryId: null }
}

export async function listOpenCommission(tx: Queryable, tenantId: string): Promise<{ commissionMinor: number; orderCount: number }> {
  const result = await tx.query<{ commissionMinor: number; orderCount: number }>(
    `select coalesce(sum(o.commission_minor), 0)::bigint as "commissionMinor", count(*)::int as "orderCount"
     from delivery_orders o
     where o.tenant_id = $1 and o.status = 'recorded'
       and not exists (select 1 from delivery_settlements s where s.tenant_id = o.tenant_id and s.order_id = o.id)`,
    [tenantId]
  )
  return { commissionMinor: Number(result.rows[0]?.commissionMinor ?? 0), orderCount: Number(result.rows[0]?.orderCount ?? 0) }
}
