import type { Queryable } from '@/lib/db'

/** Returns the next number of a per-tenant sequence. Run it inside the same transaction as the record that uses it. */
export async function nextSequenceValue(tx: Queryable, tenantId: string, name: string): Promise<number> {
  const result = await tx.query<{ value: number }>(
    `insert into tenant_sequences (tenant_id, name, last_value)
     values ($1, $2, 1)
     on conflict (tenant_id, name) do update set last_value = tenant_sequences.last_value + 1
     returning last_value as value`,
    [tenantId, name]
  )
  return result.rows[0].value
}
