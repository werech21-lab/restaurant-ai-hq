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

const CREATE_RUNS = `
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

const CREATE_RUNS_INDEX = `CREATE INDEX IF NOT EXISTS "ai_runs_createdAt_idx" ON "ai_runs"("createdAt")`

const CREATE_BRIEFS = `
CREATE TABLE IF NOT EXISTS "ai_daily_briefs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "questionHash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reply" TEXT NOT NULL,
  "agreedModels" TEXT NOT NULL
)`

const CREATE_BRIEFS_INDEX = `CREATE INDEX IF NOT EXISTS "ai_daily_briefs_createdAt_idx" ON "ai_daily_briefs"("createdAt")`

let tablesReady: Promise<void> | null = null
let pgPool: Pool | null | undefined

function postgresPool(): Pool | null {
  if (pgPool !== undefined) return pgPool
  const dbUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    pgPool = null
    return null
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
  pgPool.on('error', () => {
    logger.error('ai run postgres pool failed', { errorCode: 'AI_RUN_POOL' })
  })
  return pgPool
}

function pgErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return 'AI_RUN_PERSIST'
}

export function ensureAiTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await prisma.$executeRawUnsafe(CREATE_RUNS)
      await prisma.$executeRawUnsafe(CREATE_RUNS_INDEX)
      await prisma.$executeRawUnsafe(CREATE_BRIEFS)
      await prisma.$executeRawUnsafe(CREATE_BRIEFS_INDEX)
    })().catch((error: unknown) => {
      tablesReady = null
      throw error
    })
  }
  return tablesReady
}

async function insertRunsPostgres(rows: readonly AiRunDraft[]): Promise<boolean> {
  const pool = postgresPool()
  if (!pool) return false
  let client
  try {
    client = await pool.connect()
  } catch (error) {
    logger.error('ai run postgres insert failed', { errorCode: pgErrorCode(error) })
    return false
  }
  try {
    await client.query('BEGIN')
    for (const row of rows) {
      await client.query(
        `INSERT INTO public.ai_runs
          (id, "createdAt", "userId", "questionHash", provider, "modelId", "latencyMs", "tokensIn", "tokensOut", "estCostMicroUsd", status, "errorCode")
         VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
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
        ],
      )
    }
    await client.query('COMMIT')
    return true
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    logger.error('ai run postgres insert failed', { errorCode: pgErrorCode(error) })
    return false
  } finally {
    client.release()
  }
}

async function insertRunsSqlite(rows: readonly AiRunDraft[]): Promise<void> {
  await ensureAiTables()
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
    await pool.query(
      `INSERT INTO public.ai_daily_briefs
        (id, "createdAt", "questionHash", status, reply, "agreedModels")
       VALUES ($1, NOW(), $2, $3, $4, $5)`,
      [brief.id, brief.questionHash, brief.status, brief.reply, brief.agreedModels],
    )
    return true
  } catch (error) {
    logger.error('ai brief postgres insert failed', { errorCode: pgErrorCode(error) })
    return false
  }
}

export async function persistDailyBrief(brief: AiDailyBriefDraft): Promise<void> {
  if (await insertBriefPostgres(brief)) return
  await ensureAiTables()
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
    const result = await pool.query<{
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
    const result = await pool.query<{
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
  await ensureAiTables()
  const rows = await prisma.aiRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  })
  return rows.map((row) => mapRun(row))
}

export async function listLatestDailyBrief(): Promise<ListedDailyBrief | null> {
  const fromPostgres = await listBriefPostgres()
  if (fromPostgres !== undefined) return fromPostgres
  await ensureAiTables()
  const row = await prisma.aiDailyBrief.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!row) return null
  return row
}

async function listBriefsPostgres(limit: number): Promise<ListedDailyBrief[] | null> {
  const pool = postgresPool()
  if (!pool) return null
  try {
    const result = await pool.query<{
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
  await ensureAiTables()
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
