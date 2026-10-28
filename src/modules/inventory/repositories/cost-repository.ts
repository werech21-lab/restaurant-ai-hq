import type { Queryable } from '@/lib/db'

export type CostingMethod = 'order_price' | 'moving_weighted_average'

export type CostingPolicy = {
  method: CostingMethod
  cogsAccountId: string | null
  inventoryAccountId: string | null
}

export type CostEventInsert = {
  itemId: string
  kind: 'receipt' | 'issue' | 'purchase_return' | 'invoice_variance' | 'restore'
  qtyBefore: number
  averageBeforeMinor: number
  qtyDelta: number
  unitCostMinor: number
  valueDeltaMinor: number
  averageAfterMinor: number
  referenceType: string
  referenceId: string
}

const NO_POLICY: CostingPolicy = { method: 'order_price', cogsAccountId: null, inventoryAccountId: null }

export async function findPolicy(tx: Queryable, tenantId: string): Promise<CostingPolicy> {
  const result = await tx.query<{ method: CostingMethod; cogsAccountId: string | null; inventoryAccountId: string | null }>(
    `select costing_method as method, cogs_account_id as "cogsAccountId", inventory_account_id as "inventoryAccountId"
       from inventory_settings where tenant_id = $1`,
    [tenantId]
  )
  return result.rows[0] ?? NO_POLICY
}

export async function upsertPolicy(
  tx: Queryable,
  tenantId: string,
  userId: string,
  policy: CostingPolicy
): Promise<void> {
  await tx.query(
    `insert into inventory_settings (tenant_id, costing_method, cogs_account_id, inventory_account_id, created_by)
     values ($1, $2, $3, $4, $5)
     on conflict (tenant_id) do update
       set costing_method = excluded.costing_method,
           cogs_account_id = excluded.cogs_account_id,
           inventory_account_id = excluded.inventory_account_id,
           version = inventory_settings.version + 1,
           updated_at = now()`,
    [tenantId, policy.method, policy.cogsAccountId, policy.inventoryAccountId, userId]
  )
}

export async function insertCostEvent(tx: Queryable, tenantId: string, userId: string, event: CostEventInsert): Promise<void> {
  await tx.query(
    `insert into item_cost_events (
       tenant_id, item_id, kind, qty_before, average_before_minor, qty_delta, unit_cost_minor, value_delta_minor,
       average_after_minor, reference_type, reference_id, created_by
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      tenantId,
      event.itemId,
      event.kind,
      event.qtyBefore,
      event.averageBeforeMinor,
      event.qtyDelta,
      event.unitCostMinor,
      event.valueDeltaMinor,
      event.averageAfterMinor,
      event.referenceType,
      event.referenceId,
      userId,
    ]
  )
}

export async function updateAverage(tx: Queryable, tenantId: string, itemId: string, averageMinor: number): Promise<void> {
  await tx.query(
    `update items set unit_cost_minor = $3, version = version + 1, updated_at = now()
      where tenant_id = $1 and id = $2`,
    [tenantId, itemId, averageMinor]
  )
}

export async function listCostEvents(
  tx: Queryable,
  tenantId: string,
  referenceType: string,
  referenceId: string,
  kind: CostEventInsert['kind']
): Promise<CostEventInsert[]> {
  const result = await tx.query<{
    itemId: string
    kind: CostEventInsert['kind']
    qtyBefore: number
    averageBeforeMinor: string
    qtyDelta: number
    unitCostMinor: string
    valueDeltaMinor: string
    averageAfterMinor: string
    referenceType: string
    referenceId: string
  }>(
    `select item_id as "itemId", kind, qty_before as "qtyBefore", average_before_minor::text as "averageBeforeMinor",
            qty_delta as "qtyDelta", unit_cost_minor::text as "unitCostMinor", value_delta_minor::text as "valueDeltaMinor",
            average_after_minor::text as "averageAfterMinor", reference_type as "referenceType", reference_id as "referenceId"
       from item_cost_events
      where tenant_id = $1 and reference_type = $2 and reference_id = $3 and kind = $4
      order by created_at, id`,
    [tenantId, referenceType, referenceId, kind]
  )
  return result.rows.map((row) => ({
    itemId: row.itemId,
    kind: row.kind,
    qtyBefore: row.qtyBefore,
    averageBeforeMinor: Number(row.averageBeforeMinor),
    qtyDelta: row.qtyDelta,
    unitCostMinor: Number(row.unitCostMinor),
    valueDeltaMinor: Number(row.valueDeltaMinor),
    averageAfterMinor: Number(row.averageAfterMinor),
    referenceType: row.referenceType,
    referenceId: row.referenceId,
  }))
}
