import 'server-only'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import { prisma } from '@/lib/db'
import { sslOptions, type SslMode } from '@/lib/db-ssl'
import { logger, errorFields } from '@/lib/logger'
import { ACTIVE_VENTURE_BRANCH_IDS } from '@/lib/odoo-terminal-mappings'
import { extractCanonicalDecimals } from './number-guard'
import { getProviderAttemptTelemetry } from './providers'
import {
  comparisonMatchesFacts,
  comparisonSchema,
  type ComparableFact,
} from './structured-claim'

export const AI_PG_CONNECT_TIMEOUT_MS = 5_000
export const COUNCIL_DECISION_BRIEF_TAG = 'council-decision'
export const COUNCIL_DECISION_HASH_PREFIX = 'decision-room:'

export type AiRunStatus = 'ok' | 'error' | 'guard_rejected'
export type GuardRejectionReason = 'PARSE_FAIL' | 'SCHEMA_FAIL' | 'FACT_MISMATCH'

export interface AiRunDraft {
  id: string
  userId: string
  questionHash: string
  provider: string
  modelId: string
  requestedModel?: string
  rawResponseText?: string
  factsJson?: string | null
  facts?: readonly ComparableFact[]
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

export interface ListedAiRun {
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
  status: AiRunStatus
  errorCode: string | null
}

export interface ListedDailyBrief extends AiDailyBriefDraft {
  createdAt: Date
}

export interface DiagnoseGuardRejectedInput {
  text: string
  factsJson?: string | null
  facts?: readonly ComparableFact[]
  requestedModel?: string
}

export interface GuardRejectionDiagnosis {
  reason: GuardRejectionReason
  requestedModel: string
  /** Numbers left in the model text after date parts and cited fact-id numbers are removed. Not a guard verdict. */
  numbersInText: string[]
  /** Numbers removed because they occurred only inside a cited fact id, after period date parts were already dropped. */
  factIdNumbers: string[]
  errorCode: string
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
let customAiQueryable: AiSqlQueryable | null | undefined

interface AiPersistPgGlobal {
  __vfAiPersistPgPool?: Pool
  __vfAiPersistPgPoolUrl?: string
}

const globalForAiPersistPg = globalThis as unknown as AiPersistPgGlobal

const initializedPgQueryables = new WeakSet<AiSqlQueryable>()
const initializingPgQueryables = new WeakMap<AiSqlQueryable, Promise<void>>()

export function isPostgresUrl(rawUrl = process.env.DATABASE_URL): boolean {
  const dbUrl = (rawUrl ?? '').trim()
  return dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')
}

/**
 * Returns true whenever PostgreSQL is configured or running in production.
 * In Postgres/production mode, SQLite (`prisma.aiDailyBrief.*`, `prisma.aiRun.*`, `ensureAiTablesSqlite()`)
 * is strictly forbidden so `main.ai_daily_briefs` is never queried.
 */
export function isPostgresOnlyAiStore(envOverride?: {
  nodeEnv?: string
  vercelEnv?: string
  databaseUrl?: string
  sqliteUrl?: string
}): boolean {
  const nodeEnv = (envOverride?.nodeEnv ?? process.env.NODE_ENV ?? '').trim()
  const vercelEnv = (envOverride?.vercelEnv ?? process.env.VERCEL_ENV ?? '').trim()
  if (nodeEnv === 'production' || vercelEnv === 'production') {
    return true
  }
  const dbUrl = (envOverride?.databaseUrl ?? process.env.DATABASE_URL ?? '').trim()
  if (isPostgresUrl(dbUrl)) {
    return true
  }
  if (customAiQueryable !== undefined) {
    return true
  }
  if (dbUrl.length > 0) {
    return !dbUrl.startsWith('file:')
  }
  const sqliteUrl = (envOverride?.sqliteUrl ?? process.env.SQLITE_URL ?? '').trim()
  return !sqliteUrl.startsWith('file:')
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
  const existing = globalForAiPersistPg.__vfAiPersistPgPool
  if (existing && globalForAiPersistPg.__vfAiPersistPgPoolUrl === dbUrl) {
    return existing as unknown as AiSqlQueryable
  }
  const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
  const sslMode: SslMode = rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: sslOptions(sslMode, process.env.DATABASE_SSL_CA),
    max: 1,
    connectionTimeoutMillis: AI_PG_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: 10_000,
  })
  pool.on('error', (error) => {
    logger.error('ai run postgres pool failed', { errorCode: pgErrorCode(error) })
  })
  if (existing) {
    void existing.end().catch(() => undefined)
  }
  globalForAiPersistPg.__vfAiPersistPgPool = pool
  globalForAiPersistPg.__vfAiPersistPgPoolUrl = dbUrl
  return pool as unknown as AiSqlQueryable
}

function pgErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^[A-Z0-9_]{1,32}$/i.test(error.code)
  ) {
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
      // Minimal queryable doubles may not support to_regclass; proceed with CREATE TABLE IF NOT EXISTS.
    }

    if (!hasRuns) {
      await db.query(CREATE_RUNS_POSTGRES)
      await db.query(CREATE_RUNS_INDEX_POSTGRES)
      try {
        await db.query(`ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY`)
        await db.query(`ALTER TABLE public.ai_runs NO FORCE ROW LEVEL SECURITY`)
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
        await db.query(`ALTER TABLE public.ai_daily_briefs NO FORCE ROW LEVEL SECURITY`)
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

export async function tryAcquireManualRunLock(
  holder: string,
): Promise<'acquired' | 'busy' | 'unavailable'> {
  const pool = postgresPool()
  if (pool) {
    const attemptLock = async (): Promise<'acquired' | 'busy'> => {
      await pool.query(
        `INSERT INTO public.ai_manual_run_lock (id, status, holder, acquired_at)
         VALUES ('manual', 'idle', '', NOW())
         ON CONFLICT (id) DO NOTHING`,
      )
      const updated = await pool.query(
        `UPDATE public.ai_manual_run_lock
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
          CREATE TABLE IF NOT EXISTS public.ai_manual_run_lock (
            id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            holder TEXT NOT NULL,
            acquired_at TIMESTAMPTZ NOT NULL
          )
        `)
        try {
          await pool.query(`ALTER TABLE public.ai_manual_run_lock ENABLE ROW LEVEL SECURITY`)
          await pool.query(`ALTER TABLE public.ai_manual_run_lock NO FORCE ROW LEVEL SECURITY`)
        } catch {
          // Best-effort RLS enablement.
        }
        try {
          await pool.query(
            `REVOKE ALL ON TABLE public.ai_manual_run_lock FROM PUBLIC, anon, authenticated`,
          )
        } catch {
          // Best-effort privilege revocation.
        }
        return await attemptLock()
      }
    } catch (error) {
      logger.error('manual run lock failed', {
        ...errorFields(error),
        errorCode: 'MANUAL_RUN_LOCK',
      })
      return 'unavailable'
    }
  }
  if (isPostgresOnlyAiStore()) {
    logger.error('manual run lock postgres unavailable', {
      errorCode: 'MANUAL_RUN_LOCK_PG_UNAVAILABLE',
    })
    return 'unavailable'
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
        `UPDATE public.ai_manual_run_lock SET status = 'idle', holder = '' WHERE id = 'manual' AND holder = $1`,
        [holder],
      )
      return
    }
    if (isPostgresOnlyAiStore()) {
      return
    }
    await prisma.$executeRaw`
      UPDATE ai_manual_run_lock SET status = 'idle', holder = '' WHERE id = 'manual' AND holder = ${holder}
    `
  } catch (error) {
    logger.error('manual run unlock failed', {
      ...errorFields(error),
      errorCode: 'MANUAL_RUN_LOCK',
    })
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

export async function ensureAiTables(): Promise<void> {
  const pgDb = postgresPool()
  if (pgDb) {
    await ensureAiTablesPostgres(pgDb)
    return
  }
  if (isPostgresOnlyAiStore()) {
    logger.error('ai tables postgres pool unavailable', { errorCode: 'AI_PG_UNAVAILABLE' })
    return
  }
  await ensureAiTablesSqlite()
}

function resolveComparableFacts(
  facts?: readonly ComparableFact[],
  factsJson?: string | null,
): readonly ComparableFact[] {
  if (facts) return facts
  if (typeof factsJson !== 'string' || factsJson.trim().length === 0) return []
  try {
    const parsed: unknown = JSON.parse(factsJson)
    return Array.isArray(parsed) ? (parsed as ComparableFact[]) : []
  } catch {
    return []
  }
}

function collectPeriodDatePartsFromString(raw: string, out: Set<string>): void {
  if (!raw) return
  const ymdRe = /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g
  let match: RegExpExecArray | null
  while ((match = ymdRe.exec(raw)) !== null) {
    out.add(String(Number(match[1])))
    out.add(String(Number(match[2])))
    out.add(String(Number(match[3])))
  }
  const dmyRe = /\b(0?[1-9]|[12]\d|3[01])[-/](0?[1-9]|1[0-2])[-/](20\d{2})\b/g
  while ((match = dmyRe.exec(raw)) !== null) {
    out.add(String(Number(match[1])))
    out.add(String(Number(match[2])))
    out.add(String(Number(match[3])))
  }
}

export function extractExcludedPeriodDateNumbers(
  facts?: readonly ComparableFact[],
  factsJson?: string | null,
): Set<string> {
  const excluded = new Set<string>()
  if (typeof factsJson === 'string' && factsJson.length > 0) {
    collectPeriodDatePartsFromString(factsJson, excluded)
  }
  const resolved = resolveComparableFacts(facts, factsJson)
  for (const fact of resolved) {
    if (!fact || typeof fact !== 'object') continue
    for (const val of Object.values(fact)) {
      if (typeof val === 'string') {
        collectPeriodDatePartsFromString(val, excluded)
      }
    }
  }
  return excluded
}

export function filterPeriodDatePartsFromOffendingNumbers(
  rawText: string,
  facts?: readonly ComparableFact[],
  factsJson?: string | null,
): string[] {
  const textWithoutFullDates = rawText
    .replace(/\b20\d{2}[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b(?:0?[1-9]|[12]\d|3[01])[-/](?:0?[1-9]|1[0-2])[-/]20\d{2}\b/g, ' ')
  const extracted = extractCanonicalDecimals(textWithoutFullDates)
  if (extracted.length === 0) return []
  const excludedDateParts = extractExcludedPeriodDateNumbers(facts, factsJson)
  if (excludedDateParts.size === 0) return extracted
  return extracted.filter((num) => !excludedDateParts.has(num))
}

const MAX_LOGGED_GUARD_NUMBERS = 25

interface LoggedTextNumbers {
  numbersInText: string[]
  factIdNumbers: string[]
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function citedFactIdPattern(id: string, flags = ''): RegExp {
  return new RegExp(`(^|[^A-Za-z0-9_])${escapeForRegExp(id)}(?=$|[^A-Za-z0-9_])`, flags)
}

function citedFactIdsInText(
  rawText: string,
  facts?: readonly ComparableFact[],
  factsJson?: string | null,
): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const fact of resolveComparableFacts(facts, factsJson)) {
    const id = typeof fact?.id === 'string' ? fact.id.trim() : ''
    if (!id || seen.has(id) || !citedFactIdPattern(id).test(rawText)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids.sort((left, right) => right.length - left.length)
}

function withoutCitedFactIds(rawText: string, factIds: readonly string[]): string {
  let text = rawText
  for (const id of factIds) {
    text = text.replace(citedFactIdPattern(id, 'g'), (_match, prefix: string) => `${prefix} `)
  }
  return text
}

function countLoggedNumbers(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function splitFactIdNumbers(all: readonly string[], outsideFactIds: readonly string[]): LoggedTextNumbers {
  const remaining = countLoggedNumbers(outsideFactIds)
  const factIdNumbers: string[] = []
  for (const value of all) {
    const left = remaining.get(value) ?? 0
    if (left > 0) {
      remaining.set(value, left - 1)
      continue
    }
    factIdNumbers.push(value)
  }
  return { numbersInText: [...outsideFactIds], factIdNumbers }
}

/** Diagnostic split only. The guard still sees the original model text. */
export function classifyLoggedTextNumbers(
  rawText: string,
  facts?: readonly ComparableFact[],
  factsJson?: string | null,
): LoggedTextNumbers {
  const afterDates = filterPeriodDatePartsFromOffendingNumbers(rawText, facts, factsJson)
  const citedIds = citedFactIdsInText(rawText, facts, factsJson)
  if (citedIds.length === 0) return { numbersInText: afterDates, factIdNumbers: [] }
  const outside = filterPeriodDatePartsFromOffendingNumbers(
    withoutCitedFactIds(rawText, citedIds),
    facts,
    factsJson,
  )
  return splitFactIdNumbers(afterDates, outside)
}

function joinLoggedNumbers(values: readonly string[]): string {
  return values.slice(0, MAX_LOGGED_GUARD_NUMBERS).join(',')
}

export function formatProviderHttpErrorCode(input: {
  errorCode: string | null
  httpStatus?: number | null
  errorSummary?: string | null
}): string | null {
  const base = input.errorCode?.trim() || null
  if (typeof input.httpStatus !== 'number') {
    return base
  }
  const code = base || 'HTTP_CLIENT'
  if (code.includes(';httpStatus=')) {
    return code
  }
  const cleanSummary = input.errorSummary
    ? input.errorSummary.replace(/;/g, ',').replace(/\s+/g, ' ').trim().slice(0, 180)
    : ''
  return cleanSummary
    ? `${code};httpStatus=${input.httpStatus};errorSummary=${cleanSummary}`
    : `${code};httpStatus=${input.httpStatus}`
}

export function formatGuardRejectionErrorCode(input: {
  reason: GuardRejectionReason
  requestedModel: string
  numbersInText: readonly string[]
  factIdNumbers: readonly string[]
}): string {
  const modelPart = input.requestedModel.trim() || 'unknown'
  const numbersPart = joinLoggedNumbers(input.numbersInText)
  const factIdPart = joinLoggedNumbers(input.factIdNumbers)
  return `${input.reason};requestedModel=${modelPart};numbersInText=[${numbersPart}];factIdNumbers=[${factIdPart}]`
}

function guardRejectionDiagnosis(
  reason: GuardRejectionReason,
  requestedModel: string,
  numbers: LoggedTextNumbers,
): GuardRejectionDiagnosis {
  return {
    reason,
    requestedModel,
    numbersInText: numbers.numbersInText,
    factIdNumbers: numbers.factIdNumbers,
    errorCode: formatGuardRejectionErrorCode({
      reason,
      requestedModel,
      numbersInText: numbers.numbersInText,
      factIdNumbers: numbers.factIdNumbers,
    }),
  }
}

export function diagnoseGuardRejectedAnswer(
  input: DiagnoseGuardRejectedInput,
): GuardRejectionDiagnosis {
  const requestedModel = input.requestedModel?.trim() ?? ''
  const numbers = classifyLoggedTextNumbers(input.text, input.facts, input.factsJson)
  const trimmed = input.text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(trimmed)
  } catch {
    return guardRejectionDiagnosis('PARSE_FAIL', requestedModel, numbers)
  }

  if (!parsedJson || typeof parsedJson !== 'object') {
    return guardRejectionDiagnosis('PARSE_FAIL', requestedModel, numbers)
  }

  const record = !Array.isArray(parsedJson)
    ? (parsedJson as { comparison?: unknown })
    : null
  const candidate = record && 'comparison' in record ? record.comparison : parsedJson
  const schemaResult = comparisonSchema.safeParse(candidate)
  if (!schemaResult.success) {
    return guardRejectionDiagnosis('SCHEMA_FAIL', requestedModel, numbers)
  }

  const facts = resolveComparableFacts(input.facts, input.factsJson)
  if (
    !comparisonMatchesFacts(schemaResult.data, facts, {
      activeBranchIds: ACTIVE_VENTURE_BRANCH_IDS,
    })
  ) {
    return guardRejectionDiagnosis('FACT_MISMATCH', requestedModel, numbers)
  }

  return guardRejectionDiagnosis('FACT_MISMATCH', requestedModel, numbers)
}

function enrichAiRunDraft(row: AiRunDraft): AiRunDraft {
  const telemetry = getProviderAttemptTelemetry(row.questionHash, row.provider)
  const requestedModel =
    row.requestedModel?.trim() ||
    telemetry?.requestedModel.trim() ||
    row.modelId.trim() ||
    ''
  const effectiveModelId = row.modelId.trim() || requestedModel

  const shouldDiagnoseGuardRejection =
    row.status === 'guard_rejected' &&
    (row.errorCode === 'GUARD_REJECTED' || !row.errorCode)

  if (!shouldDiagnoseGuardRejection) {
    if (row.status === 'error' && telemetry?.httpStatus != null) {
      return {
        ...row,
        modelId: effectiveModelId,
        errorCode: formatProviderHttpErrorCode({
          errorCode: row.errorCode ?? telemetry.errorCode,
          httpStatus: telemetry.httpStatus,
          errorSummary: telemetry.errorSummary,
        }),
      }
    }
    return {
      ...row,
      modelId: effectiveModelId,
    }
  }

  const hasExplicitDiagnosisInput =
    row.rawResponseText !== undefined ||
    row.factsJson !== undefined ||
    row.facts !== undefined
  const hasCouncilTelemetry =
    telemetry !== null && telemetry.factsJson !== null && telemetry.status === 'ok'

  if (!hasExplicitDiagnosisInput && !hasCouncilTelemetry) {
    return {
      ...row,
      modelId: effectiveModelId,
    }
  }

  const diagnosis = diagnoseGuardRejectedAnswer({
    text: row.rawResponseText ?? telemetry?.text ?? '',
    factsJson: row.factsJson !== undefined ? row.factsJson : telemetry?.factsJson,
    facts: row.facts,
    requestedModel,
  })

  logger.warn('ai_run_guard_rejected', {
    questionHash: row.questionHash,
    provider: row.provider,
    requestedModel: diagnosis.requestedModel,
    modelId: effectiveModelId,
    reason: diagnosis.reason,
    numbersInText: diagnosis.numbersInText,
    factIdNumbers: diagnosis.factIdNumbers,
  })

  return {
    ...row,
    modelId: effectiveModelId,
    errorCode: diagnosis.errorCode,
  }
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
  const enrichedRows = rows.map((row) => enrichAiRunDraft(row))
  if (isPostgresOnlyAiStore()) {
    const pool = postgresPool()
    if (!pool) {
      logger.error('ai run postgres pool unavailable', { errorCode: 'AI_PG_UNAVAILABLE' })
      return
    }
    await insertRunsPostgres(enrichedRows)
    return
  }
  if (await insertRunsPostgres(enrichedRows)) return
  await insertRunsSqlite(enrichedRows)
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
  if (isPostgresOnlyAiStore()) {
    const pool = postgresPool()
    if (!pool) {
      logger.error('ai brief postgres pool unavailable', { errorCode: 'AI_PG_UNAVAILABLE' })
      return
    }
    await insertBriefPostgres(brief)
    return
  }
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

function decisionMirrorId(questionHash: string): string {
  const digest = createHash('sha256').update(questionHash).digest('hex').slice(0, 32)
  return `council-decision:${digest}`
}

export async function listCouncilDecisionMirrorBriefs(
  limit = 200,
): Promise<ListedDailyBrief[]> {
  const safeLimit = Math.max(1, Math.min(500, limit))
  const pool = postgresPool()
  if (pool) {
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
           WHERE "agreedModels" = $1
           ORDER BY "createdAt" DESC
           LIMIT $2`,
          [COUNCIL_DECISION_BRIEF_TAG, safeLimit],
        ),
      )
      return result.rows.map((row) => ({ ...row, createdAt: asDate(row.createdAt) }))
    } catch (error) {
      logger.error('ai decision mirror postgres list failed', {
        errorCode: pgErrorCode(error),
      })
      return []
    }
  }
  if (isPostgresOnlyAiStore()) {
    logger.error('ai decision mirror postgres pool unavailable', {
      errorCode: 'AI_PG_UNAVAILABLE',
    })
    return []
  }
  await ensureAiTablesSqlite()
  return prisma.aiDailyBrief.findMany({
    where: { agreedModels: COUNCIL_DECISION_BRIEF_TAG },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  })
}

export async function upsertCouncilDecisionMirrorBrief(input: {
  id?: string
  questionHash: string
  status: string
  reply: string
}): Promise<boolean> {
  const briefId = input.id?.trim() || decisionMirrorId(input.questionHash)
  const pool = postgresPool()
  if (pool) {
    try {
      await runWithLazyAiTablesPostgres(pool, async () => {
        await pool.query(
          `DELETE FROM public.ai_daily_briefs
           WHERE "questionHash" = $1 AND "agreedModels" = $2 AND id <> $3`,
          [input.questionHash, COUNCIL_DECISION_BRIEF_TAG, briefId],
        )
        await pool.query(
          `INSERT INTO public.ai_daily_briefs
            (id, "createdAt", "questionHash", status, reply, "agreedModels")
           VALUES ($1, NOW(), $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             "createdAt" = NOW(),
             "questionHash" = EXCLUDED."questionHash",
             status = EXCLUDED.status,
             reply = EXCLUDED.reply,
             "agreedModels" = EXCLUDED."agreedModels"`,
          [briefId, input.questionHash, input.status, input.reply, COUNCIL_DECISION_BRIEF_TAG],
        )
      })
      return true
    } catch (error) {
      logger.error('ai decision mirror postgres upsert failed', {
        errorCode: pgErrorCode(error),
      })
      return false
    }
  }
  if (isPostgresOnlyAiStore()) {
    logger.error('ai decision mirror postgres pool unavailable', {
      errorCode: 'AI_PG_UNAVAILABLE',
    })
    return false
  }
  try {
    await ensureAiTablesSqlite()
    await prisma.aiDailyBrief.deleteMany({
      where: { questionHash: input.questionHash, agreedModels: COUNCIL_DECISION_BRIEF_TAG },
    })
    await prisma.aiDailyBrief.create({
      data: {
        id: briefId,
        questionHash: input.questionHash,
        status: input.status,
        reply: input.reply,
        agreedModels: COUNCIL_DECISION_BRIEF_TAG,
      },
    })
    return true
  } catch (error) {
    logger.error('ai decision mirror sqlite upsert failed', errorFields(error))
    return false
  }
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

async function queryRunsPostgres(db: AiSqlQueryable, limit: number): Promise<ListedAiRun[]> {
  const result = await runWithLazyAiTablesPostgres(db, () =>
    db.query<{
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
}

async function queryLatestBriefPostgres(db: AiSqlQueryable): Promise<ListedDailyBrief | null> {
  const result = await runWithLazyAiTablesPostgres(db, () =>
    db.query<{
      id: string
      createdAt: Date
      questionHash: string
      status: string
      reply: string
      agreedModels: string
    }>(
      `SELECT id, "createdAt", "questionHash", status, reply, "agreedModels"
       FROM public.ai_daily_briefs
       WHERE "agreedModels" <> $1
       ORDER BY "createdAt" DESC
       LIMIT 1`,
      [COUNCIL_DECISION_BRIEF_TAG],
    ),
  )
  const row = result.rows[0]
  if (!row) return null
  return { ...row, createdAt: asDate(row.createdAt) }
}

async function queryBriefsPostgres(
  db: AiSqlQueryable,
  limit: number,
): Promise<ListedDailyBrief[]> {
  const result = await runWithLazyAiTablesPostgres(db, () =>
    db.query<{
      id: string
      createdAt: Date
      questionHash: string
      status: string
      reply: string
      agreedModels: string
    }>(
      `SELECT id, "createdAt", "questionHash", status, reply, "agreedModels"
       FROM public.ai_daily_briefs
       WHERE "agreedModels" <> $1
       ORDER BY "createdAt" DESC
       LIMIT $2`,
      [COUNCIL_DECISION_BRIEF_TAG, limit],
    ),
  )
  return result.rows.map((row) => ({ ...row, createdAt: asDate(row.createdAt) }))
}

export async function listAiRuns(limit: number): Promise<ListedAiRun[]> {
  const safeLimit = Math.max(1, Math.min(200, limit))
  const pool = postgresPool()
  if (isPostgresOnlyAiStore()) {
    if (!pool) {
      throw new Error('PostgreSQL pool unavailable for ai_runs')
    }
    try {
      return await queryRunsPostgres(pool, safeLimit)
    } catch (error) {
      logger.error('ai run postgres list failed', { errorCode: pgErrorCode(error) })
      throw error
    }
  }
  if (pool) {
    try {
      return await queryRunsPostgres(pool, safeLimit)
    } catch (error) {
      logger.error('ai run postgres list failed', { errorCode: pgErrorCode(error) })
    }
  }
  await ensureAiTablesSqlite()
  const rows = await prisma.aiRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  })
  return rows.map((row) => mapRun(row))
}

export async function listLatestDailyBrief(): Promise<ListedDailyBrief | null> {
  const pool = postgresPool()
  if (isPostgresOnlyAiStore()) {
    if (!pool) {
      throw new Error('PostgreSQL pool unavailable for ai_daily_briefs')
    }
    try {
      return await queryLatestBriefPostgres(pool)
    } catch (error) {
      logger.error('ai brief postgres list failed', { errorCode: pgErrorCode(error) })
      throw error
    }
  }
  if (pool) {
    try {
      return await queryLatestBriefPostgres(pool)
    } catch (error) {
      logger.error('ai brief postgres list failed', { errorCode: pgErrorCode(error) })
    }
  }
  await ensureAiTablesSqlite()
  const row = await prisma.aiDailyBrief.findFirst({
    where: { agreedModels: { not: COUNCIL_DECISION_BRIEF_TAG } },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return null
  return row
}

export async function listDailyBriefs(limit: number): Promise<ListedDailyBrief[]> {
  const safeLimit = Math.max(1, Math.min(30, limit))
  const pool = postgresPool()
  if (isPostgresOnlyAiStore()) {
    if (!pool) {
      throw new Error('PostgreSQL pool unavailable for ai_daily_briefs')
    }
    try {
      return await queryBriefsPostgres(pool, safeLimit)
    } catch (error) {
      logger.error('ai brief postgres list failed', { errorCode: pgErrorCode(error) })
      throw error
    }
  }
  if (pool) {
    try {
      return await queryBriefsPostgres(pool, safeLimit)
    } catch (error) {
      logger.error('ai brief postgres list failed', { errorCode: pgErrorCode(error) })
    }
  }
  await ensureAiTablesSqlite()
  return prisma.aiDailyBrief.findMany({
    where: { agreedModels: { not: COUNCIL_DECISION_BRIEF_TAG } },
    orderBy: { createdAt: 'desc' },
    take: safeLimit,
  })
}

export async function safeListDailyBriefs(
  limit: number,
): Promise<{ briefs: ListedDailyBrief[]; error: boolean }> {
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
  const safeLimit = Math.max(1, Math.min(200, limit))
  const postgresOnly = isPostgresOnlyAiStore()
  try {
    const pool = postgresPool()
    if (postgresOnly) {
      if (!pool) {
        throw new Error('PostgreSQL pool unavailable for ai_runs')
      }
      const [runs, brief] = await Promise.all([
        queryRunsPostgres(pool, safeLimit),
        queryLatestBriefPostgres(pool),
      ])
      return { runs, brief, error: false, source: 'postgres' }
    }
    if (pool) {
      const [runs, brief] = await Promise.all([
        queryRunsPostgres(pool, safeLimit),
        queryLatestBriefPostgres(pool),
      ])
      return { runs, brief, error: false, source: 'postgres' }
    }
    const [runs, brief] = await Promise.all([listAiRuns(safeLimit), listLatestDailyBrief()])
    return { runs, brief, error: false, source: 'panel' }
  } catch (error) {
    logger.error('ai run list failed', errorFields(error))
    return { runs: [], brief: null, error: true, source: postgresOnly ? 'postgres' : null }
  }
}
