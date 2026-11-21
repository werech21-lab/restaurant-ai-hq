import { Pool } from 'pg'
import { prisma } from '@/lib/db'
import { sslOptions } from '@/lib/db-ssl'
import { errorFields, logger } from '@/lib/logger'

export interface PosTerminalMapRow {
  terminalId: number
  branchId: string
  updatedAt: string
  updatedBy: string
}

const TABLE = 'pos_terminal_branch_map'

const LOCAL_SQLITE_TEST_DDL = `CREATE TABLE IF NOT EXISTS ${TABLE} (
  terminal_id INTEGER PRIMARY KEY,
  branch_id TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT
)`

function postgresUrl(): string | null {
  const url = (process.env.DATABASE_URL ?? '').trim()
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return url
  return null
}

const globalPool = globalThis as unknown as { posTerminalMapPool?: Pool }

function postgresPool(url: string): Pool {
  if (globalPool.posTerminalMapPool) return globalPool.posTerminalMapPool
  const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
  const sslMode: 'require' | 'verify' | 'disable' =
    rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
  const pool = new Pool({
    connectionString: url,
    ssl: sslOptions(sslMode, process.env.DATABASE_SSL_CA),
    max: 1,
    connectionTimeoutMillis: 4000,
    idleTimeoutMillis: 10_000,
  })
  pool.on('error', (error) => {
    logger.error('POS terminal mapping pool error', errorFields(error))
  })
  globalPool.posTerminalMapPool = pool
  return pool
}

/**
 * Production and Postgres schemas are owned exclusively by migration files (0051_pos_terminal_branch_map.sql).
 * Never run CREATE TABLE at runtime in production or against Postgres.
 */
async function ensureLocalSqliteTestTableOnly(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return
  if (postgresUrl()) return
  await prisma.$executeRawUnsafe(LOCAL_SQLITE_TEST_DDL)
}

export async function readPosTerminalMap(): Promise<PosTerminalMapRow[]> {
  const url = postgresUrl()
  if (url) {
    const result = await postgresPool(url).query<{
      terminal_id: number
      branch_id: string | null
      updated_at: string
      updated_by: string | null
    }>(`SELECT terminal_id, branch_id, updated_at, updated_by FROM ${TABLE}`)
    return result.rows
      .filter((row) => typeof row.branch_id === 'string' && row.branch_id.length > 0)
      .map((row) => ({
        terminalId: Number(row.terminal_id),
        branchId: String(row.branch_id),
        updatedAt: String(row.updated_at),
        updatedBy: row.updated_by ? String(row.updated_by) : 'admin',
      }))
  }
  await ensureLocalSqliteTestTableOnly()
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      terminal_id: number
      branch_id: string | null
      updated_at: string
      updated_by: string | null
    }>
  >(`SELECT terminal_id, branch_id, updated_at, updated_by FROM ${TABLE}`)
  return rows
    .filter((row) => typeof row.branch_id === 'string' && row.branch_id.length > 0)
    .map((row) => ({
      terminalId: Number(row.terminal_id),
      branchId: String(row.branch_id),
      updatedAt: String(row.updated_at),
      updatedBy: row.updated_by ? String(row.updated_by) : 'admin',
    }))
}

export async function writePosTerminalMap(row: PosTerminalMapRow): Promise<void> {
  const url = postgresUrl()
  if (url) {
    await postgresPool(url).query(
      `INSERT INTO ${TABLE} (terminal_id, branch_id, updated_at, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (terminal_id) DO UPDATE SET
         branch_id = EXCLUDED.branch_id,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
      [row.terminalId, row.branchId, row.updatedAt, row.updatedBy],
    )
    return
  }
  await ensureLocalSqliteTestTableOnly()
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${TABLE} (terminal_id, branch_id, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(terminal_id) DO UPDATE SET
       branch_id = excluded.branch_id,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
    row.terminalId,
    row.branchId,
    row.updatedAt,
    row.updatedBy,
  )
}

export async function deletePosTerminalMap(terminalId: number): Promise<void> {
  const url = postgresUrl()
  if (url) {
    await postgresPool(url).query(`DELETE FROM ${TABLE} WHERE terminal_id = $1`, [terminalId])
    return
  }
  await ensureLocalSqliteTestTableOnly()
  await prisma.$executeRawUnsafe(`DELETE FROM ${TABLE} WHERE terminal_id = ?`, terminalId)
}

export async function clearPosTerminalMap(): Promise<void> {
  const url = postgresUrl()
  if (url) {
    await postgresPool(url).query(`DELETE FROM ${TABLE}`)
    return
  }
  await ensureLocalSqliteTestTableOnly()
  await prisma.$executeRawUnsafe(`DELETE FROM ${TABLE}`)
}
