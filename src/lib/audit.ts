import type { Queryable } from '@/lib/db'

export type AuditEntry = {
  tenantId: string
  actorId: string
  entity: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  before: unknown
  after: unknown
}

/** Writes one audit row (who, what, when, before, after) inside the caller's transaction. */
export async function writeAudit(tx: Queryable, entry: AuditEntry): Promise<void> {
  await tx.query(
    `insert into audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      entry.tenantId,
      entry.actorId,
      entry.entity,
      entry.entityId,
      entry.action,
      JSON.stringify(entry.before ?? null),
      JSON.stringify(entry.after ?? null),
    ]
  )
}
