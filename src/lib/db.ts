import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'
import { getEnv } from '@/lib/env'
import { errorFields, logger } from '@/lib/logger'

// bigint columns hold integer minor units. They fit in a JS safe integer for every amount this app allows.
types.setTypeParser(types.builtins.INT8, (value) => {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError('Database integer is outside the safe range')
  }
  return parsed
})
// date columns are calendar dates. Keep them as YYYY-MM-DD strings instead of local-time Date objects.
types.setTypeParser(types.builtins.DATE, (value) => value)

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<R>>
}

const globalForPool = globalThis as unknown as { erpPool?: Pool }

function getPool(): Pool {
  if (globalForPool.erpPool) return globalForPool.erpPool
  const env = getEnv()
  const ssl = env.DATABASE_SSL === 'disable' ? false : env.DATABASE_SSL === 'verify' ? true : { rejectUnauthorized: false }
  const pool = new Pool({ connectionString: env.DATABASE_URL, ssl, max: 5 })
  pool.on('error', (error) => logger.error('Idle database client error', errorFields(error)))
  globalForPool.erpPool = pool
  return pool
}

export const db: Queryable = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => getPool().query<R>(text, params),
}

function wrap(client: PoolClient): Queryable {
  return {
    query: <R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => client.query<R>(text, params),
  }
}

/** Runs fn inside one database transaction. Commits when fn resolves and rolls back when it throws. */
export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await fn(wrap(client))
    await client.query('commit')
    return result
  } catch (error) {
    try {
      await client.query('rollback')
    } catch (rollbackError) {
      logger.error('Rollback failed', errorFields(rollbackError))
    }
    throw error
  } finally {
    client.release()
  }
}
