import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export type CommandCenterMetrics = {
  scoped: boolean
  revenueMinor: number
  expenseMinor: number
  pendingApprovals: number
  stockOnHand: number
  stockAlerts: number
  postedJournals: number
  recipes: number
  wasteQuantity: number
  deliveryOrders: number
  commissionMinor: number
}

const empty: CommandCenterMetrics = {
  scoped: false,
  revenueMinor: 0,
  expenseMinor: 0,
  pendingApprovals: 0,
  stockOnHand: 0,
  stockAlerts: 0,
  postedJournals: 0,
  recipes: 0,
  wasteQuantity: 0,
  deliveryOrders: 0,
  commissionMinor: 0,
}

/**
 * Live figures for the executive room. One active company is shown. Zero rows stay zero.
 * More than one company is not combined on this public page: the signed-in ERP screens stay tenant-scoped.
 */
export async function loadCommandCenter(): Promise<CommandCenterMetrics> {
  try {
    const tenants = await db.query<{ id: string }>("select id from tenants where status = 'active' order by created_at")
    if (tenants.rows.length !== 1) return empty
    const tenantId = tenants.rows[0].id
    const result = await db.query<{
      revenue: number
      expense: number
      pending: number
      stock: number
      on_hand: number
      journals: number
      recipes: number
      waste: number
      deliveries: number
      commission: number
    }>(
      `select
         (select coalesce(sum(amount_minor), 0)::bigint from payments where tenant_id = $1) as revenue,
         (select coalesce(sum(total_minor), 0)::bigint from supplier_invoices where tenant_id = $1 and status = 'posted') as expense,
         (
           (select count(*) from invoices where tenant_id = $1 and status = 'pending_approval')
           + (select count(*) from purchase_orders where tenant_id = $1 and status = 'pending_approval')
           + (select count(*) from purchase_requests where tenant_id = $1 and status = 'submitted')
         )::int as pending,
         (select count(*) from items where tenant_id = $1 and is_active and reorder_level > 0 and current_stock <= reorder_level)::int as stock,
         (select coalesce(sum(current_stock), 0)::int from items where tenant_id = $1 and is_active) as on_hand,
         (select count(*) from journal_entries where tenant_id = $1 and status = 'posted')::int as journals,
         (select count(*) from recipes where tenant_id = $1)::int as recipes,
         (select coalesce(sum(quantity), 0)::int from kitchen_waste where tenant_id = $1) as waste,
         (select count(*) from delivery_orders where tenant_id = $1 and status = 'recorded')::int as deliveries,
         (select coalesce(sum(commission_minor), 0)::bigint from delivery_orders where tenant_id = $1 and status = 'recorded') as commission`,
      [tenantId]
    )
    const row = result.rows[0]
    return {
      scoped: true,
      revenueMinor: row?.revenue ?? 0,
      expenseMinor: row?.expense ?? 0,
      pendingApprovals: row?.pending ?? 0,
      stockOnHand: row?.on_hand ?? 0,
      stockAlerts: row?.stock ?? 0,
      postedJournals: row?.journals ?? 0,
      recipes: row?.recipes ?? 0,
      wasteQuantity: row?.waste ?? 0,
      deliveryOrders: row?.deliveries ?? 0,
      commissionMinor: row?.commission ?? 0,
    }
  } catch (error) {
    logger.error('Command center query failed', { name: error instanceof Error ? error.name : 'unknown' })
    return empty
  }
}
