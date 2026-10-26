import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { AppError } from '@/lib/api/errors'
import type { Queryable } from '@/lib/db'

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/

/** Reads the Idempotency-Key header that every financial or inventory create requires. */
export function requireIdempotencyKey(request: NextRequest): string {
  const key = request.headers.get('idempotency-key')
  if (!key) {
    throw new AppError(400, 'idempotency_key_required', 'The Idempotency-Key header is required.')
  }
  if (!KEY_PATTERN.test(key)) {
    throw new AppError(400, 'idempotency_key_invalid', 'The Idempotency-Key header must be 8 to 128 URL-safe characters.')
  }
  return key
}

export function hashRequest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export type IdempotentResult<T> = { replayed: boolean; status: 200 | 201; body: T }

type Stored = { request_hash: string; response_status: 200 | 201; response_body: unknown }

/**
 * Runs `run` once per (tenant, scope, key). A repeat with the same key and the same request returns the stored
 * response. A repeat with a different request is rejected with 422. The key row and the work commit together, so a
 * concurrent duplicate waits on the unique index and then replays the committed response.
 */
export async function runIdempotent<T>(
  tx: Queryable,
  args: { tenantId: string; scope: string; key: string; requestHash: string },
  run: () => Promise<{ status: 200 | 201; body: T }>
): Promise<IdempotentResult<T>> {
  const inserted = await tx.query(
    `insert into idempotency_keys (tenant_id, scope, key, request_hash)
     values ($1, $2, $3, $4)
     on conflict (tenant_id, scope, key) do nothing
     returning key`,
    [args.tenantId, args.scope, args.key, args.requestHash]
  )

  if (inserted.rowCount === 0) {
    const existing = await tx.query<Stored>(
      `select request_hash, response_status, response_body
       from idempotency_keys
       where tenant_id = $1 and scope = $2 and key = $3`,
      [args.tenantId, args.scope, args.key]
    )
    const row = existing.rows[0]
    if (!row || row.response_status === null) {
      throw new AppError(409, 'idempotency_in_progress', 'A request with this Idempotency-Key is still being processed.')
    }
    if (row.request_hash !== args.requestHash) {
      throw new AppError(422, 'idempotency_key_reused', 'This Idempotency-Key was already used with a different request.')
    }
    return { replayed: true, status: row.response_status, body: row.response_body as T }
  }

  const result = await run()
  await tx.query(
    `update idempotency_keys set response_status = $4, response_body = $5::jsonb
     where tenant_id = $1 and scope = $2 and key = $3`,
    [args.tenantId, args.scope, args.key, result.status, JSON.stringify(result.body)]
  )
  return { replayed: false, status: result.status, body: result.body }
}
