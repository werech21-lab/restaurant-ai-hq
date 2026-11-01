import { performance } from 'node:perf_hooks'
import type { AuthContext } from '@/lib/auth/context'
import { coverageReport, mapOdooProduct, type MappedProduct } from '@/lib/odoo-mapper'
import { db } from '@/lib/pg'
import { isOdooModel, type OdooModel, type OdooPayload } from '@/modules/odoo/domain/odoo'

export type OdooDataCenterReport = {
  tenantId: string
  counts: Record<string, number>
  indexes: { name: string; present: boolean }[]
  querySpeedMs: number
  fieldCoverage: {
    model: OdooModel
    samples: number
    averagePercent: number
    missingFields: string[]
  }[]
  brands: number
  branches: number
  sampleProduct: MappedProduct | null
}

const INDEX_NAMES = [
  'invoices_tenant_issue_date_desc_idx',
  'invoices_tenant_created_desc_idx',
  'invoices_tenant_status_created_idx',
  'invoices_tenant_customer_created_idx',
  'items_tenant_sku_lower_idx',
  'items_tenant_name_lower_idx',
  'customers_tenant_name_lower_idx',
  'customers_tenant_phone_idx',
  'stock_movements_tenant_created_desc_idx',
  'stock_movements_tenant_type_created_idx',
  'journal_entries_tenant_date_desc_idx',
  'odoo_staging_tenant_model_idx',
  'odoo_staging_tenant_apply_created_idx',
  'suite_records_brand_idx',
  'suite_records_branch_idx',
  'hr_employees_tenant_status_code_idx',
] as const

export async function getOdooDataCenterReport(auth: AuthContext): Promise<{ data: OdooDataCenterReport }> {
  const tenantId = auth.tenantId
  const started = performance.now()
  const countsResult = await db.query<{
    products: number
    invoices: number
    customers: number
    journals: number
    movements: number
    staging: number
    brands: number
    branches: number
    suppliers: number
  }>(
    `select
       (select count(*)::int from items where tenant_id = $1) as products,
       (select count(*)::int from invoices where tenant_id = $1) as invoices,
       (select count(*)::int from customers where tenant_id = $1) as customers,
       (select count(*)::int from journal_entries where tenant_id = $1) as journals,
       (select count(*)::int from stock_movements where tenant_id = $1) as movements,
       (select count(*)::int from odoo_imported_staging_records where tenant_id = $1) as staging,
       (select count(*)::int from brands where tenant_id = $1) as brands,
       (select count(*)::int from branches where tenant_id = $1) as branches,
       (select count(*)::int from suppliers where tenant_id = $1) as suppliers`,
    [tenantId]
  )
  // Force planner to use date indexes — timed sample for the data-center UI.
  await db.query(
    `select id from invoices
     where tenant_id = $1 and issue_date >= (current_date - 90)
     order by issue_date desc, id desc
     limit 25`,
    [tenantId]
  )
  const querySpeedMs = Math.round(performance.now() - started)

  const indexRows = await db.query<{ name: string }>(
    `select c.relname as name
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'i' and n.nspname = 'public' and c.relname = any($1::text[])`,
    [[...INDEX_NAMES]]
  )
  const present = new Set(indexRows.rows.map((row) => row.name))

  const samples = await db.query<{ odooModel: string; payload: OdooPayload }>(
    `select odoo_model as "odooModel", payload
     from odoo_imported_staging_records
     where tenant_id = $1
     order by created_at desc
     limit 40`,
    [tenantId]
  )
  const byModel = new Map<OdooModel, ReturnType<typeof coverageReport>[]>()
  for (const row of samples.rows) {
    if (!isOdooModel(row.odooModel)) continue
    const report = coverageReport(row.odooModel, row.payload ?? {})
    const list = byModel.get(row.odooModel) ?? []
    list.push(report)
    byModel.set(row.odooModel, list)
  }
  const fieldCoverage = [...byModel.entries()].map(([model, reports]) => {
    const averagePercent = Math.round(reports.reduce((sum, row) => sum + row.percent, 0) / reports.length)
    const missingFields = [...new Set(reports.flatMap((row) => row.missing))].slice(0, 20)
    return { model, samples: reports.length, averagePercent, missingFields }
  })

  const productSample = samples.rows.find((row) => row.odooModel === 'product.template')
  const row = countsResult.rows[0]
  return {
    data: {
      tenantId,
      counts: {
        products: row?.products ?? 0,
        invoices: row?.invoices ?? 0,
        customers: row?.customers ?? 0,
        journals: row?.journals ?? 0,
        movements: row?.movements ?? 0,
        staging: row?.staging ?? 0,
        suppliers: row?.suppliers ?? 0,
      },
      indexes: INDEX_NAMES.map((name) => ({ name, present: present.has(name) })),
      querySpeedMs,
      fieldCoverage,
      brands: row?.brands ?? 0,
      branches: row?.branches ?? 0,
      sampleProduct: productSample?.payload ? mapOdooProduct(productSample.payload) : null,
    },
  }
}
