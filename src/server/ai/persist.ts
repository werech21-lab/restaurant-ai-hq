import 'server-only'
import { Pool } from 'pg'
import { prisma } from '@/lib/db'
import { sslOptions, type SslMode } from '@/lib/db-ssl'
import { logger, errorFields } from '@/lib/logger'

export type AiRunStatus = 'ok' | 'error' | 'guard_rejected'

export interface AiRunDraft {
  id: string
  userId: string
  questionHash: string
  provider: string
  modelId: string
  latencyMs: number
  tokensIn: number | null
  tokensOut: number | null
  estCostMicroUsd: number | null
  status: AiRunStatus
  errorCode: string | null
}

export interface AiDailyBriefDraft {
  id: string
  questionHash: string
  status: string
  reply: string
  agreedModels: string
}

export interface ListedAiRun extends AiRunDraft {
  createdAt: Date
}

export interface ListedDailyBrief extends AiDailyBriefDraft {
  createdAt: Date
}

export interface AiSqlClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[]; rowCount?: number | null }>
  release(): void
}

export interface AiSqlQueryable {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: R[]; rowCount?: number | null }>
  connect?(): Promise<AiSqlClient>
}

const PG_UNDEFINED_TABLE_CODE = '42P01'

const CREATE_RUNS_SQLITE = `
CREATE TABLE IF NOT EXISTS "ai_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "questionHash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "tokensIn" INTEGER,
  "tokensOut" INTEGER,
  "estCostMicroUsd" INTEGER,
  "status" TEXT NOT NULL,
  "errorCode" TEXT
)`

const CREATE_RUNS_INDEX_SQLITE = `CREATE INDEX IF NOT EXISTS "ai_runs_createdAt_idx" ON "ai_runs"("createdAt")`

const CREATE_BRIEFS_SQLITE = `
CREATE TABLE IF NOT EXISTS "ai_daily_briefs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "questionHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reply" TEXT NOT NULL,
  "agreedModels" TEXT NOT NULL
)`

const CREATE_BRIEFS_INDEX_SQLITE = `CREATE INDEX IF NOT EXISTS "ai_daily_briefs_createdAt_idx" ON "ai_daily_briefs"("createdAt")`

const CREATE_RUNS_POSTGRES = `
CREATE TABLE IF NOT EXISTS public.ai_runs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "userId" TEXT NOT NULL,
  "questionHash" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "tokensIn" INTEGER,
  "tokensOut" INTEGER,
  "estCostMicroUsd" INTEGER,
  status TEXT NOT NULL,
  "errorCode" TEXT
)`

const CREATE_RUNS_INDEX_POSTGRES = `CREATE INDEX IF NOT EXISTS ai_runs_created_at_idx ON public.ai_runs ("createdAt")`

const CREATE_BRIEFS_POSTGRES = `
CREATE TABLE IF NOT EXISTS public.ai_daily_briefs (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "questionHash" TEXT NOT NULL,
  status TEXT NOT NULL,
  reply TEXT NOT NULL,
  "agreedModels" TEXT NOT NULL
)`

const CREATE_BRIEFS_INDEX_POSTGRES = `CREATE INDEX IF NOT EXISTS ai_daily_briefs_created_at_idx ON public.ai_daily_briefs ("createdAt")`

let sqliteTablesReady: Promise<void> | null = null
let pgPool: Pool | null | undefined
let pgPoolUrl: string | undefined
let customAiQueryable: AiSqlQueryable | null | undefined

const initializedPgQueryables = new WeakSet<AiSqlQueryable>()
const initializingPgQueryables = new WeakMap<AiSqlQueryable, Promise<void>>()

export function isPostgresUrl(rawUrl = process.env.DATABASE_URL): boolean {
  const dbUrl = (rawUrl ?? '').trim()
  return dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')
}

export function configureAiPersistQueryable(
  queryable: AiSqlQueryable | null | undefined,
): void {
  customAiQueryable = queryable
}

function postgresPool(): AiSqlQueryable | null {
  if (customAiQueryable !== undefined) {
    return customAiQueryable
  }
  const dbUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!isPostgresUrl(dbUrl)) {
    return null
  }
  if (pgPool && pgPoolUrl === dbUrl) {
    return pgPool as unknown as AiSqlQueryable
  }
  const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
  const sslMode: SslMode = rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
  pgPool = new Pool({
    connectionString: dbUrl,
    ssl: sslOptions(sslMode, process.env.DATABASE_SSL_CA),
    max: 2,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10_000,
  })
  pgPoolUrl = dbUrl
  pgPool.on('error', () => {
    logger.error('ai run postgres pool failed', { errorCode: 'AI_RUN_POOL' })
  })
  return pgPool as unknown as AiSqlQueryable
}

function pgErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'AI_RUN_PERSIST'
}

function isUndefinedTableError(error: unknown): boolean {
  if (pgErrorCode(error) === PG_UNDEFINED_TABLE_CODE) {
    return true
  }
  if (error instanceof Error) {
    return /\b42P01\b|relation\s+["']?(?:public\.)?(?:ai_daily_briefs|ai_runs|ai_manual_run_lock)["']?\s+does\s+not\s+exist/i.test(
      error.message,
    )
  }
  return false
}

export async function ensureAiTablesPostgres(
  explicitDb?: AiSqlQueryable | null,
): Promise<void> {
  const db = explicitDb ?? postgresPool()
  if (!db) return
  if (initializedPgQueryables.has(db)) {
    return
  }
  const pending = initializingPgQueryables.get(db)
  if (pending) {
    await pending
    return
  }
  const initPromise = (async () => {
    let hasRuns = false
    let hasBriefs = false
    try {
      const check = await db.query<{
        runs_reg: string | null
        briefs_reg: string | null
      }>(
        `SELECT to_regclass('public.ai_runs')::text AS runs_reg,
                to_regclass('public.ai_daily_briefs')::text AS briefs_reg`,
      )
      const row = check.rows[0]
      hasRuns = Boolean(row?.runs_reg)
      hasBriefs = Boolean(row?.briefs_reg)
    } catch {
      // Minimal queryable test doubles may not support to_regclass; proceed with CREATE TABLE IF NOT EXISTS.
    }

    if (!hasRuns) {
      await db.query(CREATE_RUNS_POSTGRES)
      await db.query(CREATE_RUNS_INDEX_POSTGRES)
      try {
        await db.query(`ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY`)
      } catch {
        // Best-effort RLS enablement when running under restricted non-owner roles.
      }
      try {
        await db.query(`REVOKE ALL ON TABLE public.ai_runs FROM PUBLIC, anon, authenticated`)
      } catch {
        // Best-effort revocation when Supabase client roles exist.
      }
    }

    if (!hasBriefs) {
      await db.query(CREATE_BRIEFS_POSTGRES)
      await db.query(CREATE_BRIEFS_INDEX_POSTGRES)
      try {
        await db.query(`ALTER TABLE public.ai_daily_briefs ENABLE ROW LEVEL SECURITY`)
      } catch {
        // Best-effort RLS enablement when running under restricted non-owner roles.
      }
      try {
        await db.query(
          `REVOKE ALL ON TABLE public.ai_daily_briefs FROM PUBLIC, anon, authenticated`,
        )
      } catch {
        // Best-effort revocation when Supabase client roles exist.
      }
    }

    initializedPgQueryables.add(db)
  })()
  initializingPgQueryables.set(db, initPromise)
  try {
    await initPromise
  } finally {
    initializingPgQueryables.delete(db)
  }
}

async function runWithLazyAiTablesPostgres<T>(
  db: AiSqlQueryable,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isUndefinedTableError(error)) {
      throw error
    }
    initializedPgQueryables.delete(db)
    await ensureAiTablesPostgres(db)
    return await operation()
  }
}

const LOCK_STALE_SECONDS = 90

export async function tryAcquireManualRunLock(holder: string): Promise<'acquired' | 'busy' | 'unavailable'> {
  const pool = postgresPool()
  if (pool) {
    const attemptLock = async (): Promise<'acquired' | 'busy'> => {
      await pool.query(
        `INSERT INTO ai_manual_run_lock (id, status, holder, acquired_at)
         VALUES ('manual', 'idle', '', NOW())
         ON CONFLICT (id) DO NOTHING`,
      )
      const updated = await pool.query(
        `UPDATE ai_manual_run_lock
         SET status = 'running', holder = $1, acquired_at = NOW()
         WHERE id = 'manual'
           AND (status <> 'running' OR acquired_at < NOW() - ($2::int * INTERVAL '1 second'))
         RETURNING id`,
        [holder, LOCK_STALE_SECONDS],
      )
      const matched = updated.rowCount ?? updated.rows.length
      return matched === 1 ? 'acquired' : 'busy'
    }
    try {
      try {
        return await attemptLock()
      } catch (error) {
        if (!isUndefinedTableError(error)) {
          throw error
        }
        await pool.query(`
          CREATE TABLE IF NOT EXISTS ai_manual_run_lock (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            holder TEXT NOT NULL,
            acquired_at TIMESTAMPTZ NOT NULL
          )
        `)
        try {
          await pool.query(`ALTER TABLE ai_manual_run_lock ENABLE ROW LEVEL SECURITY`)
        } catch {
          // Best-effort RLS enablement.
        }
        try {
          await pool.query(`REVOKE ALL ON TABLE ai_manual_run_lock FROM PUBLIC, anon, authenticated`)
        } catch {
          // Best-effort privilege revocation.
        }
        return await attemptLock()
      }
    } catch (error) {
      logger.error('manual run lock failed', { ...errorFields(error), errorCode: 'MANUAL_RUN_LOCK' })
      return 'unavailable'
    }
  }
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ai_manual_run_lock (
        id TEXT NOT NULL PRIMARY KEY,
        status TEXT NOT NULL,
        holder TEXT NOT NULL,
        acquired_at TEXT NOT NULL
      )
    `)
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO ai_manual_run_lock (id, status, holder, acquired_at) VALUES ('manual', 'idle', '', datetime('now'))`,
    )
    const changed = await prisma.$executeRaw`
      UPDATE ai_manual_run_lock
      SET status = 'running', holder = ${holder}, acquired_at = datetime('now')
      WHERE id = 'manual'
        AND (status <> 'running' OR acquired_at < datetime('now', ${`-${LOCK_STALE_SECONDS} seconds`}))
    `
    return Number(changed) === 1 ? 'acquired' : 'busy'
  } catch (error) {
    logger.error('manual run lock failed', { ...errorFields(error), errorCode: 'MANUAL_RUN_LOCK' })
    return 'unavailable'
  }
}

export async function releaseManualRunLock(holder: string): Promise<void> {
  const pool = postgresPool()
  try {
    if (pool) {
      await pool.query(
        `UPDATE ai_manual_run_lock SET status = 'idle', holder = '' WHERE id = 'manual' AND holder = $1`,
        [holder],
      )
      return
    }
    await prisma.$executeRaw`
      UPDATE ai_manual_run_lock SET status = 'idle', holder = '' WHERE id = 'manual' AND holder = ${holder}
    `
  } catch (error) {
    logger.error('manual run unlock failed', { ...errorFields(error), errorCode: 'MANUAL_RUN_LOCK' })
  }
}

function ensureAiTablesSqlite(): Promise<void> {
  if (!sqliteTablesReady) {
    sqliteTablesReady = (async () => {
      await prisma.$executeRawUnsafe(CREATE_RUNS_SQLITE)
      await prisma.$executeRawUnsafe(CREATE_RUNS_INDEX_SQLITE)
      await prisma.$executeRawUnsafe(CREATE_BRIEFS_SQLITE)
      await prisma.$executeRawUnsafe(CREATE_BRIEFS_INDEX_SQLITE)
    })().catch((error: unknown) => {
      sqliteTablesReady = null
      throw error
    })
  }
  return sqliteTablesReady
}

export function ensureAiTables(): Promise<void> {
  const pgDb = postgresPool()
  if (pgDb) {
    return ensureAiTablesPostgres(pgDb)
  }
  return ensureAiTablesSqlite()
}

async function executeInsertRunsBatch(
  db: AiSqlQueryable,
  rows: readonly AiRunDraft[],
): Promise<void> {
  const insertSql = `INSERT INTO public.ai_runs
    (id, "createdAt", "userId", "questionHash", provider, "modelId", "latencyMs", "tokensIn", "tokensOut", "estCostMicroUsd", status, "errorCode")
   VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
   ON CONFLICT (id) DO NOTHING`

  if (db.connect) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      for (const row of rows) {
        await client.query(insertSql, [
          row.id,
          row.userId,
          row.questionHash,
          row.provider,
          row.modelId,
          row.latencyMs,
          row.tokensIn,
          row.tokensOut,
          row.estCostMicroUsd,
          row.status,
          row.errorCode,
        ])
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
    return
  }

  for (const row of rows) {
    await db.query(insertSql, [
      row.id,
      row.userId,
      row.questionHash,
      row.provider,
      row.modelId,
      row.latencyMs,
      row.tokensIn,
      row.tokensOut,
      row.estCostMicroUsd,
      row.status,
      row.errorCode,
    ])
  }
}

async function insertRunsPostgres(rows: readonly AiRunDraft[]): Promise<boolean> {
  const pool = postgresPool()
  if (!pool) return false
  try {
    await runWithLazyAiTablesPostgres(pool, () => executeInsertRunsBatch(pool, rows))
    return true
  } catch (error) {
    logger.error('ai run postgres insert failed', { errorCode: pgErrorCode(error) })
    return false
  }
}

async function insertRunsSqlite(rows: readonly AiRunDraft[]): Promise<void> {
  await ensureAiTablesSqlite()
  await prisma.aiRun.createMany({
    data: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      questionHash: row.questionHash,
      provider: row.provider,
      modelId: row.modelId,
      latencyMs: row.latencyMs,
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      estCostMicroUsd: row.estCostMicroUsd,
      status: row.status,
      errorCode: row.errorCode,
    })),
  })
}

export async function persistAiRuns(rows: readonly AiRunDraft[]): Promise<void> {
  if (rows.length === 0) return
  if (await insertRunsPostgres(rows)) return
  await insertRunsSqlite(rows)
}

async function insertBriefPostgres(brief: AiDailyBriefDraft): Promise<boolean> {
  const pool = postgresPool()
  if (!pool) return false
  try {
    await runWithLazyAiTablesPostgres(pool, () =>
      pool.query(
        `INSERT INTO public.ai_daily_briefs
          (id, "createdAt", "questionHash", status, reply, "agreedModels")
         VALUES ($1, NOW(), $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           "questionHash" = EXCLUDED."questionHash",
           status = EXCLUDED.status,
           reply = EXCLUDED.reply,
           "agreedModels" = EXCLUDED."agreedModels"`,
        [brief.id, brief.questionHash, brief.status, brief.reply, brief.agreedModels],
      ),
    )
    return true
  } catch (error) {
    logger.error('ai brief postgres insert failed', { errorCode: pgErrorCode(error) })
    return false
  }
}

export async function persistDailyBrief(brief: AiDailyBriefDraft): Promise<void> {
  if (await insertBriefPostgres(brief)) return
  await ensureAiTablesSqlite()
  await prisma.aiDailyBrief.create({
    data: {
      id: brief.id,
      questionHash: brief.questionHash,
      status: brief.status,
      reply: brief.reply,
      agreedModels: brief.agreedModels,
    },
  })
}

function asRunStatus(value: unknown): AiRunStatus {
  return value === 'ok' || value === 'guard_rejected' ? value : 'error'
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value
  const parsed = new Date(typeof value === 'string' ? value : '')
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed
}

function asInt(value: unknown): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed) : null
}

function mapRun(row: {
  id: string
  createdAt: unknown
  userId: string
  questionHash: string
  provider: string
  modelId: string
  latencyMs: unknown
  tokensIn: unknown
  tokensOut: unknown
  estCostMicroUsd: unknown
  status: unknown
  errorCode: string | null
}): ListedAiRun {
  return {
    id: row.id,
    createdAt: asDate(row.createdAt),
    userId: row.userId,
    questionHash: row.questionHash,
    provider: row.provider,
    modelId: row.modelId,
    latencyMs: asInt(row.latencyMs) ?? 0,
    tokensIn: asInt(row.tokensIn),
    tokensOut: asInt(row.tokensOut),
    estCostMicroUsd: asInt(row.estCostMicroUsd),
    status: asRunStatus(row.status),
    errorCode: row.errorCode,
  }
}

async function listRunsPostgres(limit: number): Promise<ListedAiRun[] | null> {
  const pool = postgresPool()
  if (!pool) return null
  try {
    const result = await runWithLazyAiTablesPostgres(pool, () =>
      pool.query<{
        id: string
        createdAt: Date
        userId: string
        questionHash: string
        provider: string
        modelId: string
        latencyMs: number
        tokensIn: number | null
        tokensOut: number | null
        estCostMicroUsd: number | null
        status: string
        errorCode: string | null
      }>(
        `SELECT id, "createdAt", "userId", "questionHash", provider, "modelId", "latencyMs", "tokensIn", "tokensOut", "estCostMicroUsd", status, "errorCode"
         FROM public.ai_runs
         ORDER BY "createdAt" DESC
         LIMIT $1`,
        [limit],
      ),
    )
    return result.rows.map((row) => mapRun(row))
  } catch (error) {
    logger.error('ai run postgres list failed', { errorCode: pgErrorCode(error) })
    return null
  }
}

async function listBriefPostgres(): Promise<ListedDailyBrief | null | undefined> {
  const pool = postgresPool()
  if (!pool) return undefined
  try {
    const result = await runWithLazyAiTablesPostgres(pool, () =>
      pool.query<{
        id: string
        createdAt: Date
        questionHash: string
        status: string
        reply: string
        agreedModels: string
      }>(
        `SELECT id, "createdAt", "questionHash", status, reply, "agreedModels"
         FROM public.ai_daily_briefs
         ORDER BY "createdAt" DESC
         LIMIT 1`,
      ),
    )
    const row = result.rows[0]
    if (!row) return null
    return { ...row, createdAt: asDate(row.createdAt) }
  } catch (error) {
    logger.error('ai brief postgres list failed', { errorCode: pgErrorCode(error) })
    return undefined
  }
}

export async function listAiRuns(limit: number): Promise<ListedAiRun[]> {
  const safeLimit = Math.max(1, Math.min(200, limit))
  const fromPostgres = await listRunsPostgres(safeLimit)
  if (fromPostgres) return fromPostgres
  await ensureAiTablesSqlite()
  const rows = await prisma.aiRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  })
  return rows.map((row) => mapRun(row))
}

export async function listLatestDailyBrief(): Promise<ListedDailyBrief | null> {
  const fromPostgres = await listBriefPostgres()
  if (fromPostgres !== undefined) return fromPostgres
  await ensureAiTablesSqlite()
  const row = await prisma.aiDailyBrief.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!row) return null
  return row
}

async function listBriefsPostgres(limit: number): Promise<ListedDailyBrief[] | null> {
  const pool = postgresPool()
  if (!pool) return null
  try {
    const result = await runWithLazyAiTablesPostgres(pool, () =>
      pool.query<{
        id: string
        createdAt: Date
        questionHash: string
        status: string
        reply: string
        agreedModels: string
      }>(
        `SELECT id, "createdAt", "questionHash", status, reply, "agreedModels"
         FROM public.ai_daily_briefs
         ORDER BY "createdAt" DESC
         LIMIT $1`,
        [limit],
      ),
    )
    return result.rows.map((row) => ({ ...row, createdAt: asDate(row.createdAt) }))
  } catch (error) {
    logger.error('ai brief postgres list failed', { errorCode: pgErrorCode(error) })
    return null
  }
}

export async function listDailyBriefs(limit: number): Promise<ListedDailyBrief[]> {
  const safeLimit = Math.max(1, Math.min(30, limit))
  const fromPostgres = await listBriefsPostgres(safeLimit)
  if (fromPostgres !== null) return fromPostgres
  await ensureAiTablesSqlite()
  return prisma.aiDailyBrief.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  })
}

export async function safeListDailyBriefs(limit: number): Promise<{ briefs: ListedDailyBrief[]; error: boolean }> {
  try {
    return { briefs: await listDailyBriefs(limit), error: false }
  } catch (error) {
    logger.error('ai brief list failed', errorFields(error))
    return { briefs: [], error: true }
  }
}

export type AiRunStore = 'postgres' | 'panel'

export async function safeListAiRuns(limit: number): Promise<{
  runs: ListedAiRun[]
  brief: ListedDailyBrief | null
  error: boolean
  source: AiRunStore | null
}> {
  try {
    const postgresRuns = await listRunsPostgres(Math.max(1, Math.min(200, limit)))
    if (postgresRuns) {
      const brief = await listBriefPostgres()
      return { runs: postgresRuns, brief: brief ?? null, error: false, source: 'postgres' }
    }
    const [runs, brief] = await Promise.all([listAiRuns(limit), listLatestDailyBrief()])
    return { runs, brief, error: false, source: 'panel' }
  } catch (error) {
    logger.error('ai run list failed', errorFields(error))
    return { runs: [], brief: null, error: true, source: null }
  }
}
