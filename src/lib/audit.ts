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

/**
 * A state that does not exist is stored as SQL NULL, not as the JSON value `null`, so `before is null` on a create and
 * `after is null` on a delete mean what they say.
 */
const state = (value: unknown): string | null => (value === null || value === undefined ? null : JSON.stringify(value))

/** Writes one audit row (who, what, when, before, after) inside the caller's transaction. */
export async function writeAudit(tx: Queryable, entry: AuditEntry): Promise<void> {
  await tx.query(
    `insert into audit_log (tenant_id, actor_id, entity, entity_id, action, before, after)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [entry.tenantId, entry.actorId, entry.entity, entry.entityId, entry.action, state(entry.before), state(entry.after)]
  )
}
