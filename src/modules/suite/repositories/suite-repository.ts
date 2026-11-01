import type { Queryable } from '@/lib/pg'
import { PAGE_SIZE, clampPage, clampPageSize } from '@/lib/query-limits'
import type { SuiteApp } from '@/modules/suite/domain/apps'
import type { SuiteFacet, SuiteRecord } from '@/modules/suite/domain/types'
import type { CreateSuiteRecordInput, UpdateSuiteRecordInput } from '@/modules/suite/schemas/suite'

const columns = `id, app_key as "appKey", title, stage, brand_name as "brandName", branch_name as "branchName",
  department, assignee, amount_minor as "amountMinor", starts_on as "startsOn", ends_on as "endsOn",
  sort_order as "sortOrder", version, created_at as "createdAt", updated_at as "updatedAt"`

export type SuiteListFilter = {
  page?: number
  pageSize?: number
  facetKind?: 'department' | 'location' | 'brand'
  facetValue?: string
}

function facetClause(
  filter: SuiteListFilter,
  startParam: number
): { sql: string; params: string[] } {
  if (!filter.facetKind || !filter.facetValue?.trim()) return { sql: '', params: [] }
  const column =
    filter.facetKind === 'department' ? 'department' : filter.facetKind === 'location' ? 'branch_name' : 'brand_name'
  return { sql: ` and ${column} = $${startParam}`, params: [filter.facetValue.trim()] }
}

export async function listRecords(
  tx: Queryable,
  tenantId: string,
  app: SuiteApp,
  filter: SuiteListFilter = {}
): Promise<{ rows: SuiteRecord[]; total: number; page: number; pageSize: number }> {
  const page = clampPage(filter.page)
  const pageSize = clampPageSize(filter.pageSize ?? PAGE_SIZE)
  const facet = facetClause(filter, 3)
  const params: unknown[] = [tenantId, app, ...facet.params]
  const count = await tx.query<{ total: number }>(
    `select count(*)::int as total from suite_records
     where tenant_id = $1 and app_key = $2${facet.sql}`,
    params
  )
  const offset = (page - 1) * pageSize
  const limitParam = params.length + 1
  const offsetParam = params.length + 2
  const result = await tx.query<SuiteRecord>(
    `select ${columns} from suite_records
     where tenant_id = $1 and app_key = $2${facet.sql}
     order by sort_order, created_at desc
     limit $${limitParam} offset $${offsetParam}`,
    [...params, pageSize, offset]
  )
  return { rows: result.rows, total: count.rows[0]?.total ?? 0, page, pageSize }
}

export async function listFacets(
  tx: Queryable,
  tenantId: string,
  app: SuiteApp
): Promise<{ department: SuiteFacet[]; location: SuiteFacet[]; brand: SuiteFacet[]; stages: SuiteFacet[] }> {
  const [department, location, brand, stages] = await Promise.all([
    tx.query<{ label: string; count: number }>(
      `select department as label, count(*)::int as count from suite_records
       where tenant_id = $1 and app_key = $2 and trim(department) <> ''
       group by department order by count desc, department limit 50`,
      [tenantId, app]
    ),
    tx.query<{ label: string; count: number }>(
      `select branch_name as label, count(*)::int as count from suite_records
       where tenant_id = $1 and app_key = $2 and trim(branch_name) <> ''
       group by branch_name order by count desc, branch_name limit 50`,
      [tenantId, app]
    ),
    tx.query<{ label: string; count: number }>(
      `select brand_name as label, count(*)::int as count from suite_records
       where tenant_id = $1 and app_key = $2 and trim(brand_name) <> ''
       group by brand_name order by count desc, brand_name limit 50`,
      [tenantId, app]
    ),
    tx.query<{ label: string; count: number }>(
      `select stage as label, count(*)::int as count from suite_records
       where tenant_id = $1 and app_key = $2
       group by stage order by count desc, stage`,
      [tenantId, app]
    ),
  ])
  const toFacet = (rows: { label: string; count: number }[]): SuiteFacet[] =>
    rows.map((row) => ({ key: row.label, label: row.label, count: row.count }))
  return {
    department: toFacet(department.rows),
    location: toFacet(location.rows),
    brand: toFacet(brand.rows),
    stages: toFacet(stages.rows),
  }
}

/** Brand × branch totals computed in SQL — never ship raw analytic ledgers to the browser. */
export async function listAnalyticMatrixRows(
  tx: Queryable,
  tenantId: string
): Promise<SuiteRecord[]> {
  const result = await tx.query<SuiteRecord>(
    `select
       md5(tenant_id::text || brand_name || branch_name) as id,
       'analytic'::text as "appKey",
       (brand_name || ' / ' || branch_name) as title,
       'posted'::text as stage,
       brand_name as "brandName",
       branch_name as "branchName",
       ''::text as department,
       ''::text as assignee,
       coalesce(sum(amount_minor), 0)::bigint as "amountMinor",
       null::date as "startsOn",
       null::date as "endsOn",
       0::int as "sortOrder",
       1::int as version,
       min(created_at) as "createdAt",
       max(updated_at) as "updatedAt"
     from suite_records
     where tenant_id = $1 and app_key = 'analytic'
     group by tenant_id, brand_name, branch_name
     order by brand_name, branch_name
     limit 120`,
    [tenantId]
  )
  return result.rows
}

export async function findRecord(
  tx: Queryable,
  tenantId: string,
  app: SuiteApp,
  id: string
): Promise<SuiteRecord | null> {
  const result = await tx.query<SuiteRecord>(
    `select ${columns} from suite_records where tenant_id = $1 and app_key = $2 and id = $3`,
    [tenantId, app, id]
  )
  return result.rows[0] ?? null
}

export async function insertRecord(
  tx: Queryable,
  tenantId: string,
  userId: string,
  app: SuiteApp,
  input: CreateSuiteRecordInput
): Promise<SuiteRecord> {
  const result = await tx.query<SuiteRecord>(
    `insert into suite_records (
       tenant_id, app_key, title, stage, brand_name, branch_name, department, assignee,
       amount_minor, starts_on, ends_on, created_by
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning ${columns}`,
    [
      tenantId,
      app,
      input.title,
      input.stage,
      input.brandName,
      input.branchName,
      input.department,
      input.assignee,
      input.amountMinor,
      input.startsOn ?? null,
      input.endsOn ?? null,
      userId,
    ]
  )
  return result.rows[0]
}

export async function updateRecord(
  tx: Queryable,
  tenantId: string,
  app: SuiteApp,
  id: string,
  input: UpdateSuiteRecordInput
): Promise<SuiteRecord | null> {
  const result = await tx.query<SuiteRecord>(
    `update suite_records set
       title = $4, stage = $5, brand_name = $6, branch_name = $7, department = $8, assignee = $9,
       amount_minor = $10, starts_on = $11, ends_on = $12, version = version + 1
     where tenant_id = $1 and app_key = $2 and id = $3 and version = $13
     returning ${columns}`,
    [
      tenantId,
      app,
      id,
      input.title,
      input.stage,
      input.brandName,
      input.branchName,
      input.department,
      input.assignee,
      input.amountMinor,
      input.startsOn,
      input.endsOn,
      input.version,
    ]
  )
  return result.rows[0] ?? null
}
