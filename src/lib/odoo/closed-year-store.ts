import 'server-only'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import { sslOptions, type SslMode } from '@/lib/db-ssl'
import { logger } from '@/lib/logger'
import type {
  YearClosedCacheEntry,
  YearClosedPersistentStore,
} from '@/lib/odoo/pos-order-query'

export const CLOSED_YEAR_CACHE_KEY_PREFIX = 'odoo_closed_year_cache_v1:'
export const CLOSED_YEAR_CACHE_TABLE = 'public.vf_odoo_closed_year_cache'
const PG_HEALTH_COOLDOWN_MS = 30_000

export interface ClosedYearSqlQueryable {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[] }>
}

interface ClosedYearPgGlobalState {
  __vfClosedYearCachePgPool?: Pool | null
  __vfClosedYearCachePgHealthy?: boolean
  __vfClosedYearCachePgCheckedAt?: number
  __vfClosedYearDefaultStore?: YearClosedPersistentStore
}

const globalForClosedYearPg = globalThis as unknown as ClosedYearPgGlobalState
const initializedQueryables = new WeakSet<ClosedYearSqlQueryable>()
const initializingQueryables = new WeakMap<ClosedYearSqlQueryable, Promise<void>>()

export function buildClosedYearStorageKey(cacheKey: string): string {
  const digest = createHash('sha256').update(cacheKey).digest('hex')
  return `${CLOSED_YEAR_CACHE_KEY_PREFIX}${digest}`
}

async function ensureClosedYearTableInitialized(
  db: ClosedYearSqlQueryable,
): Promise<void> {
  if (initializedQueryables.has(db)) {
    return
  }
  const pending = initializingQueryables.get(db)
  if (pending) {
    await pending
    return
  }
  const initPromise = (async () => {
    await db.query(
      `CREATE TABLE IF NOT EXISTS ${CLOSED_YEAR_CACHE_TABLE} (
        cache_key TEXT PRIMARY KEY,
        raw_key TEXT NOT NULL,
        rows_json JSONB NOT NULL,
        cached_at_ms BIGINT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    )
    try {
      await db.query(
        `ALTER TABLE ${CLOSED_YEAR_CACHE_TABLE} ENABLE ROW LEVEL SECURITY`,
      )
    } catch {
      // Best-effort RLS enablement for restricted runtime DB roles or minimal queryable doubles.
    }
    initializedQueryables.add(db)
  })()
  initializingQueryables.set(db, initPromise)
  try {
    await initPromise
  } finally {
    initializingQueryables.delete(db)
  }
}

export function createPostgresYearClosedStore(
  resolveQueryable: () => ClosedYearSqlQueryable | null,
  hooks?: {
    onSuccess?: () => void
    onFailure?: (error: unknown) => void
  },
): YearClosedPersistentStore {
  return {
    async get(cacheKey: string): Promise<YearClosedCacheEntry | undefined> {
      const db = resolveQueryable()
      if (!db) return undefined
      try {
        await ensureClosedYearTableInitialized(db)
        const storageKey = buildClosedYearStorageKey(cacheKey)
        const res = await db.query<{
          raw_key: unknown
          rows_json: unknown
          cached_at_ms: unknown
        }>(
          `SELECT raw_key, rows_json, cached_at_ms FROM ${CLOSED_YEAR_CACHE_TABLE} WHERE cache_key = $1`,
          [storageKey],
        )
        hooks?.onSuccess?.()
        if (res.rows.length === 0) return undefined
        const row = res.rows[0]
        if (!row || row.raw_key !== cacheKey) return undefined
        const rawCachedAt = row.cached_at_ms
        if (
          (typeof rawCachedAt !== 'number' && typeof rawCachedAt !== 'string') ||
          (typeof rawCachedAt === 'string' && rawCachedAt.trim() === '')
        ) {
          return undefined
        }
        const cachedAtMs = Number(rawCachedAt)
        if (!Number.isFinite(cachedAtMs)) return undefined
        const rawRows = row.rows_json
        const parsedRows: unknown =
          typeof rawRows === 'string' ? JSON.parse(rawRows) : rawRows
        if (!Array.isArray(parsedRows)) return undefined
        return { rows: parsedRows, at: cachedAtMs }
      } catch (error) {
        hooks?.onFailure?.(error)
        return undefined
      }
    },

    async set(cacheKey: string, entry: YearClosedCacheEntry): Promise<void> {
      const db = resolveQueryable()
      if (!db) return
      if (!Number.isFinite(entry.at) || !Array.isArray(entry.rows)) return
      try {
        await ensureClosedYearTableInitialized(db)
        const storageKey = buildClosedYearStorageKey(cacheKey)
        const serializedRows = JSON.stringify(entry.rows)
        const cachedAtMs = Math.trunc(entry.at)
        await db.query(
          `INSERT INTO ${CLOSED_YEAR_CACHE_TABLE} (cache_key, raw_key, rows_json, cached_at_ms, updated_at) VALUES ($1, $2, $3::jsonb, $4, NOW()) ON CONFLICT (cache_key) DO UPDATE SET raw_key = EXCLUDED.raw_key, rows_json = EXCLUDED.rows_json, cached_at_ms = EXCLUDED.cached_at_ms, updated_at = NOW()`,
          [storageKey, cacheKey, serializedRows, cachedAtMs],
        )
        hooks?.onSuccess?.()
      } catch (error) {
        hooks?.onFailure?.(error)
      }
    },

    async clear(): Promise<void> {
      const db = resolveQueryable()
      if (!db) return
      try {
        await ensureClosedYearTableInitialized(db)
        await db.query(
          `DELETE FROM ${CLOSED_YEAR_CACHE_TABLE} WHERE cache_key LIKE $1`,
          [`${CLOSED_YEAR_CACHE_KEY_PREFIX}%`],
        )
        hooks?.onSuccess?.()
      } catch (error) {
        hooks?.onFailure?.(error)
      }
    },
  }
}

function getClosedYearPgPool(): Pool | null {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return null
  }
  const dbUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    return null
  }
  if (
    globalForClosedYearPg.__vfClosedYearCachePgHealthy === false &&
    globalForClosedYearPg.__vfClosedYearCachePgCheckedAt &&
    Date.now() - globalForClosedYearPg.__vfClosedYearCachePgCheckedAt < PG_HEALTH_COOLDOWN_MS
  ) {
    return null
  }
  if (globalForClosedYearPg.__vfClosedYearCachePgPool) {
    return globalForClosedYearPg.__vfClosedYearCachePgPool
  }
  try {
    const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
    const sslMode: SslMode =
      rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: sslOptions(sslMode, process.env.DATABASE_SSL_CA),
      max: 2,
      connectionTimeoutMillis: 1_500,
      idleTimeoutMillis: 10_000,
    })
    pool.on('error', (error) => {
      globalForClosedYearPg.__vfClosedYearCachePgHealthy = false
      globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = Date.now()
      logger.warn('Closed-year L2 Postgres pool error', {
        errorName: error instanceof Error ? error.name : 'PoolError',
      })
    })
    globalForClosedYearPg.__vfClosedYearCachePgPool = pool
    return pool
  } catch (error) {
    globalForClosedYearPg.__vfClosedYearCachePgHealthy = false
    globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = Date.now()
    logger.warn('Closed-year L2 Postgres pool initialization skipped', {
      errorName: error instanceof Error ? error.name : 'InitError',
    })
    return null
  }
}

export function getDefaultPostgresYearClosedStore(): YearClosedPersistentStore {
  if (!globalForClosedYearPg.__vfClosedYearDefaultStore) {
    globalForClosedYearPg.__vfClosedYearDefaultStore = createPostgresYearClosedStore(
      () => getClosedYearPgPool(),
      {
        onSuccess: () => {
          globalForClosedYearPg.__vfClosedYearCachePgHealthy = true
          globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = Date.now()
        },
        onFailure: (error) => {
          globalForClosedYearPg.__vfClosedYearCachePgHealthy = false
          globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = Date.now()
          logger.warn('Closed-year L2 cache operation fell back to L1 memory', {
            errorName: error instanceof Error ? error.name : 'QueryError',
          })
        },
      },
    )
  }
  return globalForClosedYearPg.__vfClosedYearDefaultStore
}
