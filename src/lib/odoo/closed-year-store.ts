import 'server-only'
import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { Pool } from 'pg'
import { sslOptions, type SslMode } from '@/lib/db-ssl'
import { logger } from '@/lib/logger'
import {
  registerDefaultYearClosedAfterScheduler,
  type YearClosedAfterScheduler,
  type YearClosedCacheEntry,
  type YearClosedPersistentStore,
} from '@/lib/odoo/pos-order-query'

const scheduleAfterInServerScope: YearClosedAfterScheduler = (task) => {
  after(task)
}

registerDefaultYearClosedAfterScheduler(scheduleAfterInServerScope)

export const CLOSED_YEAR_CACHE_KEY_PREFIX = 'odoo_closed_year_cache_v1:'
export const CLOSED_YEAR_CACHE_TABLE = 'public.vf_odoo_closed_year_cache'
export const CLOSED_YEAR_PG_CONNECT_TIMEOUT_MS = 5_000
export const CLOSED_YEAR_PG_READ_COOLDOWN_MS = 30_000
const PG_UNDEFINED_TABLE_CODE = '42P01'
const MAX_REASON_LENGTH = 200

export type ClosedYearStoreOperation = 'get' | 'set' | 'clear'

export interface ClosedYearStoreFailureEvent {
  operation: ClosedYearStoreOperation
  durationMs: number
  error: unknown
}

export interface ClosedYearStoreSuccessEvent {
  operation: ClosedYearStoreOperation
  durationMs: number
}

export interface ClosedYearHealthState {
  healthy?: boolean
  checkedAt?: number
}

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

export function extractSafePgErrorCode(error: unknown): string | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,32}$/i.test(error.code)
  ) {
    return error.code
  }
  return undefined
}

export function sanitizeClosedYearErrorReason(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'l2_store_error'
  const sanitized = raw
    .replace(/\bpostgres(?:ql)?:\/\/[^\s'")\],;]+/gi, '[redacted-db-url]')
    .replace(/\b[A-Za-z0-9._%+-]+:[^\s@'")\],;]+@[^\s'")\],;]+/g, '[redacted-credentials]')
    .replace(
      /\b(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;)\]]+/gi,
      '[redacted-secret]',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!sanitized) {
    return 'l2_store_error'
  }
  return sanitized.length > MAX_REASON_LENGTH
    ? `${sanitized.slice(0, MAX_REASON_LENGTH - 3)}...`
    : sanitized
}

function isUndefinedTableError(error: unknown): boolean {
  if (extractSafePgErrorCode(error) === PG_UNDEFINED_TABLE_CODE) {
    return true
  }
  if (error instanceof Error) {
    return /\b42P01\b|relation\s+["']?(?:public\.)?vf_odoo_closed_year_cache["']?\s+does\s+not\s+exist/i.test(
      error.message,
    )
  }
  return false
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
    try {
      await db.query(
        `REVOKE ALL ON TABLE ${CLOSED_YEAR_CACHE_TABLE} FROM PUBLIC, anon, authenticated`,
      )
    } catch {
      // Best-effort privilege revocation when Supabase client roles exist.
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

async function executeWithLazyClosedYearTable<T>(
  db: ClosedYearSqlQueryable,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isUndefinedTableError(error)) {
      throw error
    }
    await ensureClosedYearTableInitialized(db)
    return await operation()
  }
}

export async function getClosedYearRowsFromStore(
  db: ClosedYearSqlQueryable,
  cacheKey: string,
): Promise<YearClosedCacheEntry | undefined> {
  const storageKey = buildClosedYearStorageKey(cacheKey)
  const res = await executeWithLazyClosedYearTable(db, () =>
    db.query<{
      raw_key: unknown
      rows_json: unknown
      cached_at_ms: unknown
    }>(
      `SELECT raw_key, rows_json, cached_at_ms FROM ${CLOSED_YEAR_CACHE_TABLE} WHERE cache_key = $1`,
      [storageKey],
    ),
  )
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
}

export async function setClosedYearRowsInStore(
  db: ClosedYearSqlQueryable,
  cacheKey: string,
  entry: YearClosedCacheEntry,
): Promise<void> {
  const storageKey = buildClosedYearStorageKey(cacheKey)
  const serializedRows = JSON.stringify(entry.rows)
  const cachedAtMs = Math.trunc(entry.at)
  await executeWithLazyClosedYearTable(db, () =>
    db.query(
      `INSERT INTO ${CLOSED_YEAR_CACHE_TABLE} (cache_key, raw_key, rows_json, cached_at_ms, updated_at) VALUES ($1, $2, $3::jsonb, $4, NOW()) ON CONFLICT (cache_key) DO UPDATE SET raw_key = EXCLUDED.raw_key, rows_json = EXCLUDED.rows_json, cached_at_ms = EXCLUDED.cached_at_ms, updated_at = NOW()`,
      [storageKey, cacheKey, serializedRows, cachedAtMs],
    ),
  )
}

export interface PostgresYearClosedStoreHooks {
  now?: () => number
  logFailures?: boolean
  onSuccess?: (event: ClosedYearStoreSuccessEvent) => void
  onFailure?: (event: ClosedYearStoreFailureEvent) => void
}

export interface CooldownAwarePostgresYearClosedStoreOptions
  extends PostgresYearClosedStoreHooks {
  readCooldownMs?: number
  state?: ClosedYearHealthState
}

export function createPostgresYearClosedStore(
  resolveQueryable: () => ClosedYearSqlQueryable | null,
  hooks?: PostgresYearClosedStoreHooks,
): YearClosedPersistentStore {
  const now = hooks?.now ?? Date.now

  const reportSuccess = (operation: ClosedYearStoreOperation, startedAt: number): void => {
    const durationMs = Math.max(0, Math.round(now() - startedAt))
    hooks?.onSuccess?.({ operation, durationMs })
  }

  const reportFailure = (
    operation: ClosedYearStoreOperation,
    startedAt: number,
    error: unknown,
  ): void => {
    const durationMs = Math.max(0, Math.round(now() - startedAt))
    const event: ClosedYearStoreFailureEvent = { operation, durationMs, error }
    if (hooks?.logFailures !== false) {
      const code = extractSafePgErrorCode(error)
      logger.warn('Closed-year L2 cache operation fell back to L1 memory', {
        operation,
        durationMs,
        errorName: error instanceof Error ? error.name : 'QueryError',
        reason: sanitizeClosedYearErrorReason(error),
        ...(code ? { code } : {}),
      })
    }
    hooks?.onFailure?.(event)
  }

  return {
    async get(cacheKey: string): Promise<YearClosedCacheEntry | undefined> {
      const startedAt = now()
      try {
        const db = resolveQueryable()
        if (!db) return undefined
        const entry = await getClosedYearRowsFromStore(db, cacheKey)
        reportSuccess('get', startedAt)
        return entry
      } catch (error) {
        reportFailure('get', startedAt, error)
        return undefined
      }
    },

    async set(cacheKey: string, entry: YearClosedCacheEntry): Promise<void> {
      if (!Number.isFinite(entry.at) || !Array.isArray(entry.rows)) return
      const startedAt = now()
      try {
        const db = resolveQueryable()
        if (!db) return
        await setClosedYearRowsInStore(db, cacheKey, entry)
        reportSuccess('set', startedAt)
      } catch (error) {
        reportFailure('set', startedAt, error)
      }
    },

    async clear(): Promise<void> {
      const startedAt = now()
      try {
        const db = resolveQueryable()
        if (!db) return
        await executeWithLazyClosedYearTable(db, () =>
          db.query(
            `DELETE FROM ${CLOSED_YEAR_CACHE_TABLE} WHERE cache_key LIKE $1`,
            [`${CLOSED_YEAR_CACHE_KEY_PREFIX}%`],
          ),
        )
        reportSuccess('clear', startedAt)
      } catch (error) {
        reportFailure('clear', startedAt, error)
      }
    },

    scheduleAfter: scheduleAfterInServerScope,
  }
}

export function createCooldownAwarePostgresYearClosedStore(
  resolveQueryable: () => ClosedYearSqlQueryable | null,
  options?: CooldownAwarePostgresYearClosedStoreOptions,
): YearClosedPersistentStore {
  const readCooldownMs = options?.readCooldownMs ?? CLOSED_YEAR_PG_READ_COOLDOWN_MS
  const now = options?.now ?? Date.now
  const state: ClosedYearHealthState = options?.state ?? {}

  const baseStore = createPostgresYearClosedStore(resolveQueryable, {
    now,
    logFailures: options?.logFailures,
    onSuccess: (event) => {
      state.healthy = true
      state.checkedAt = now()
      options?.onSuccess?.(event)
    },
    onFailure: (event) => {
      state.healthy = false
      state.checkedAt = now()
      options?.onFailure?.(event)
    },
  })

  return {
    async get(cacheKey: string): Promise<YearClosedCacheEntry | undefined> {
      const currentNow = now()
      if (
        state.healthy === false &&
        typeof state.checkedAt === 'number' &&
        currentNow - state.checkedAt < readCooldownMs
      ) {
        return undefined
      }
      return baseStore.get(cacheKey)
    },

    async set(cacheKey: string, entry: YearClosedCacheEntry): Promise<void> {
      await baseStore.set(cacheKey, entry)
    },

    async clear(): Promise<void> {
      if (baseStore.clear) {
        await baseStore.clear()
      }
    },

    scheduleAfter: baseStore.scheduleAfter,
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
      connectionTimeoutMillis: CLOSED_YEAR_PG_CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: 10_000,
    })
    pool.on('error', (error) => {
      globalForClosedYearPg.__vfClosedYearCachePgHealthy = false
      globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = Date.now()
      const code = extractSafePgErrorCode(error)
      logger.warn('Closed-year L2 Postgres pool error', {
        operation: 'pool',
        errorName: error instanceof Error ? error.name : 'PoolError',
        reason: sanitizeClosedYearErrorReason(error),
        ...(code ? { code } : {}),
      })
    })
    globalForClosedYearPg.__vfClosedYearCachePgPool = pool
    return pool
  } catch (error) {
    globalForClosedYearPg.__vfClosedYearCachePgHealthy = false
    globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = Date.now()
    const code = extractSafePgErrorCode(error)
    logger.warn('Closed-year L2 Postgres pool initialization skipped', {
      operation: 'init',
      errorName: error instanceof Error ? error.name : 'InitError',
      reason: sanitizeClosedYearErrorReason(error),
      ...(code ? { code } : {}),
    })
    return null
  }
}

const defaultGlobalHealthState: ClosedYearHealthState = {
  get healthy() {
    return globalForClosedYearPg.__vfClosedYearCachePgHealthy
  },
  set healthy(value: boolean | undefined) {
    globalForClosedYearPg.__vfClosedYearCachePgHealthy = value
  },
  get checkedAt() {
    return globalForClosedYearPg.__vfClosedYearCachePgCheckedAt
  },
  set checkedAt(value: number | undefined) {
    globalForClosedYearPg.__vfClosedYearCachePgCheckedAt = value
  },
}

export function getDefaultPostgresYearClosedStore(): YearClosedPersistentStore {
  if (!globalForClosedYearPg.__vfClosedYearDefaultStore) {
    globalForClosedYearPg.__vfClosedYearDefaultStore =
      createCooldownAwarePostgresYearClosedStore(() => getClosedYearPgPool(), {
        state: defaultGlobalHealthState,
      })
  }
  return globalForClosedYearPg.__vfClosedYearDefaultStore
}
