import type { Queryable } from '@/lib/db'
import type { SuiteApp } from '@/modules/suite/domain/apps'
import type { SuiteRecord } from '@/modules/suite/domain/types'
import type { CreateSuiteRecordInput, UpdateSuiteRecordInput } from '@/modules/suite/schemas/suite'

const columns = `id, app_key as "appKey", title, stage, brand_name as "brandName", branch_name as "branchName",
  department, assignee, amount_minor as "amountMinor", starts_on as "startsOn", ends_on as "endsOn",
  sort_order as "sortOrder", version, created_at as "createdAt", updated_at as "updatedAt"`

export async function listRecords(tx: Queryable, tenantId: string, app: SuiteApp): Promise<SuiteRecord[]> {
  const result = await tx.query<SuiteRecord>(
    `select ${columns} from suite_records where tenant_id = $1 and app_key = $2 order by sort_order, created_at desc limit 500`,
    [tenantId, app]
  )
  return result.rows
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
