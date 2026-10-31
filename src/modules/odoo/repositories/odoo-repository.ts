import type { Queryable } from '@/lib/db'
import type { ApplyTarget, OdooModel, OdooPayload } from '@/modules/odoo/domain/odoo'

export type OdooJob = {
  id: string
  source: 'jsonrpc' | 'file' | 'web'
  databaseName: string | null
  loginName: string | null
  status: 'completed' | 'failed'
  recordsPulled: number
  recordsApplied: number
  errorMessage: string | null
  createdAt: string
}

export type StagingRow = {
  id: string
  odooModel: OdooModel
  externalId: string
  displayName: string
  applyStatus: 'staged' | 'applied' | 'skipped'
  targetTable: ApplyTarget | null
}

function whole(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function insertJob(
  tx: Queryable,
  tenantId: string,
  actorId: string,
  input: { source: 'jsonrpc' | 'file' | 'web'; databaseName: string | null; loginName: string | null; models: readonly string[] },
): Promise<string> {
  const result = await tx.query<{ id: string }>(
    `insert into odoo_sync_jobs (
      tenant_id, source, odoo_base_url, database_name, login_name, status, models_requested, created_by
    ) values ($1, $2, 'https://venturefoods.walnutss.com', $3, $4, 'completed', $5::text[], $6)
    returning id`,
    [tenantId, input.source, input.databaseName, input.loginName, input.models, actorId],
  )
  return result.rows[0]?.id ?? ''
}

export async function finishJob(tx: Queryable, tenantId: string, jobId: string, pulled: number, applied: number, errorMessage: string | null): Promise<void> {
  await tx.query(
    `update odoo_sync_jobs
     set records_pulled = $3, records_applied = $4, error_message = $5, status = $6, version = version + 1
     where tenant_id = $1 and id = $2`,
    [tenantId, jobId, pulled, applied, errorMessage, errorMessage ? 'failed' : 'completed'],
  )
}

export async function upsertStaging(
  tx: Queryable,
  tenantId: string,
  jobId: string,
  row: { model: OdooModel; externalId: string; displayName: string; payload: OdooPayload; applyStatus: StagingRow['applyStatus']; targetTable: ApplyTarget | null },
): Promise<void> {
  await tx.query(
    `insert into odoo_imported_staging_records (
      tenant_id, job_id, odoo_model, external_id, display_name, payload, apply_status, target_table
    ) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    on conflict (tenant_id, odoo_model, external_id) do update
      set job_id = excluded.job_id, display_name = excluded.display_name, payload = excluded.payload,
          apply_status = excluded.apply_status, target_table = excluded.target_table, updated_at = now()`,
    [tenantId, jobId, row.model, row.externalId, row.displayName, JSON.stringify(row.payload), row.applyStatus, row.targetTable],
  )
}

export async function listJobs(tx: Queryable, tenantId: string): Promise<OdooJob[]> {
  const result = await tx.query<OdooJob>(
    `select id, source, database_name as "databaseName", login_name as "loginName", status,
            records_pulled as "recordsPulled", records_applied as "recordsApplied",
            error_message as "errorMessage",
            to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt"
     from odoo_sync_jobs where tenant_id = $1 order by created_at desc limit 20`,
    [tenantId],
  )
  return result.rows.map((row) => ({ ...row, recordsPulled: whole(row.recordsPulled), recordsApplied: whole(row.recordsApplied) }))
}

export async function listRecords(tx: Queryable, tenantId: string): Promise<StagingRow[]> {
  const result = await tx.query<StagingRow>(
    `select id, odoo_model as "odooModel", external_id as "externalId", display_name as "displayName",
            apply_status as "applyStatus", target_table as "targetTable"
     from odoo_imported_staging_records where tenant_id = $1 order by created_at desc limit 100`,
    [tenantId],
  )
  return result.rows
}
