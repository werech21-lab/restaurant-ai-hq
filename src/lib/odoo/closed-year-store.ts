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
const PG_PIN_MARKER = 'odoo-closed-year-cache-v1'
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

export function buildClosedYearStorageKey(cacheKey: string): string {
  const digest = createHash('sha256').update(cacheKey).digest('hex')
  return `${CLOSED_YEAR_CACHE_KEY_PREFIX}${digest}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
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
        const storageKey = buildClosedYearStorageKey(cacheKey)
        const res = await db.query<{ payload: unknown }>(
          `SELECT payload FROM public.vf_executive_governance_sync WHERE id = $1`,
          [storageKey],
        )
        hooks?.onSuccess?.()
        if (res.rows.length === 0) return undefined
        const rawPayload = res.rows[0]?.payload
        const parsed: unknown =
          typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
        const rec = asRecord(parsed)
        if (
          !rec ||
          rec.v !== 1 ||
          rec.cacheKey !== cacheKey ||
          typeof rec.at !== 'number' ||
          !Number.isFinite(rec.at) ||
          !Array.isArray(rec.rows)
        ) {
          return undefined
        }
        return { rows: rec.rows, at: rec.at }
      } catch (error) {
        hooks?.onFailure?.(error)
        return undefined
      }
    },

    async set(cacheKey: string, entry: YearClosedCacheEntry): Promise<void> {
      const db = resolveQueryable()
      if (!db) return
      try {
        const storageKey = buildClosedYearStorageKey(cacheKey)
        const serialized = JSON.stringify({
          v: 1,
          cacheKey,
          at: entry.at,
          rows: entry.rows,
        })
        await db.query(
          `INSERT INTO public.vf_executive_governance_sync (id, payload, pin_hash, updated_at)
           VALUES ($1, $2::jsonb, $3, NOW())
           ON CONFLICT (id)
           DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
          [storageKey, serialized, PG_PIN_MARKER],
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
        await db.query(
          `DELETE FROM public.vf_executive_governance_sync WHERE id LIKE $1`,
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
