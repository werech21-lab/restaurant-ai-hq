import 'server-only'
/**
 * Council snapshots and the seasons calendar.
 *
 * Postgres schema is owned by database/migrations/0052_council_reports_and_seasons.sql and
 * 0053_council_decisions.sql, and is
 * never created at runtime. Outside production, without a Postgres URL, a local SQLite table is
 * created for development and tests only.
 */
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { prisma } from '@/lib/db'
import { sslOptions } from '@/lib/db-ssl'
import { errorFields, logger } from '@/lib/logger'
import { SEASON_KINDS, type SeasonEvent, type SeasonKind } from '@/lib/council/advisors/seasons'
import type { DecisionOutcome, DecisionRecord } from '@/lib/council/decisions'
import type { CouncilSnapshot } from '@/lib/council/types'

const SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS council_reports (
    id TEXT PRIMARY KEY, scope TEXT NOT NULL, kuwait_day TEXT NOT NULL, generated_at TEXT,
    saved_at TEXT NOT NULL, payload TEXT NOT NULL, shown_fingerprints TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS season_events (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name_ar TEXT NOT NULL, name_en TEXT NOT NULL,
    starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, recurrence TEXT NOT NULL, approximate INTEGER NOT NULL DEFAULT 1,
    previous_starts_on TEXT, previous_ends_on TEXT, notes TEXT, updated_at TEXT NOT NULL, updated_by TEXT)`,
  `CREATE TABLE IF NOT EXISTS council_decisions (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, advisor_id TEXT NOT NULL, kind TEXT NOT NULL, branch_id TEXT,
    title_ar TEXT NOT NULL, title_en TEXT NOT NULL, status TEXT NOT NULL, note TEXT, decided_by TEXT NOT NULL,
    decided_at TEXT NOT NULL, decided_day TEXT NOT NULL, expected_weekly_kwd REAL, outcome TEXT, outcome_at TEXT)`,
]

function postgresUrl(): string | null {
  const url = (process.env.DATABASE_URL ?? '').trim()
  return url.startsWith('postgres://') || url.startsWith('postgresql://') ? url : null
}

const g = globalThis as unknown as { councilPool?: Pool; councilSqliteReady?: Promise<void> | null }

function pool(url: string): Pool {
  if (g.councilPool) return g.councilPool
  const raw = (process.env.DATABASE_SSL ?? 'require').trim()
  const mode: 'require' | 'verify' | 'disable' = raw === 'disable' || raw === 'verify' ? raw : 'require'
  const p = new Pool({ connectionString: url, ssl: sslOptions(mode, process.env.DATABASE_SSL_CA), max: 2, connectionTimeoutMillis: 4000 })
  p.on('error', (error) => logger.error('council store pool error', errorFields(error)))
  g.councilPool = p
  return p
}

async function ensureSqlite(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false
  if (!g.councilSqliteReady) {
    g.councilSqliteReady = (async () => {
      for (const ddl of SQLITE_DDL) await prisma.$executeRawUnsafe(ddl)
    })().catch((error: unknown) => {
      g.councilSqliteReady = null
      throw error
    })
  }
  await g.councilSqliteReady
  return true
}

async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const url = postgresUrl()
  if (url) return (await pool(url).query(sql, params)).rows as T[]
  if (!(await ensureSqlite())) return []
  // SQLite placeholders: $1 … → ?
  return prisma.$queryRawUnsafe<T[]>(sql.replace(/\$\d+/g, '?'), ...params)
}

async function exec(sql: string, params: unknown[]): Promise<void> {
  const url = postgresUrl()
  if (url) {
    await pool(url).query(sql, params)
    return
  }
  if (!(await ensureSqlite())) return
  await prisma.$executeRawUnsafe(sql.replace(/\$\d+/g, '?'), ...params)
}

/* ------------------------------------------------------------------ council snapshots */

export async function saveCouncilSnapshot(input: { scope: 'hourly' | 'nightly'; kuwaitDay: string; snapshot: CouncilSnapshot }): Promise<void> {
  const shown = input.snapshot.discoveries.map((d) => d.finding.fingerprint)
  await exec(
    `INSERT INTO council_reports (id, scope, kuwait_day, generated_at, saved_at, payload, shown_fingerprints) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), input.scope, input.kuwaitDay, input.snapshot.generatedAt, new Date().toISOString(), JSON.stringify(input.snapshot), JSON.stringify(shown)],
  )
}

export async function loadLatestCouncilSnapshot(): Promise<{ snapshot: CouncilSnapshot; savedAt: string; kuwaitDay: string } | null> {
  try {
    const rows = await query<{ payload: string; saved_at: string; kuwait_day: string }>(`SELECT payload, saved_at, kuwait_day FROM council_reports ORDER BY saved_at DESC LIMIT 1`, [])
    if (!rows[0]) return null
    return { snapshot: JSON.parse(rows[0].payload) as CouncilSnapshot, savedAt: String(rows[0].saved_at), kuwaitDay: String(rows[0].kuwait_day) }
  } catch (error) {
    logger.error('council snapshot read failed', errorFields(error))
    return null
  }
}

/** Fingerprints shown as discoveries on the 7 Kuwait days before `kuwaitDay` (today excluded). */
export async function loadShownFingerprints(kuwaitDay: string): Promise<Set<string>> {
  const d = new Date(`${kuwaitDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 7)
  const from = d.toISOString().slice(0, 10)
  try {
    const rows = await query<{ shown_fingerprints: string }>(`SELECT shown_fingerprints FROM council_reports WHERE kuwait_day >= $1 AND kuwait_day < $2`, [from, kuwaitDay])
    const out = new Set<string>()
    for (const r of rows) for (const f of JSON.parse(String(r.shown_fingerprints)) as string[]) out.add(f)
    return out
  } catch (error) {
    logger.error('council history read failed', errorFields(error))
    return new Set()
  }
}

/* ------------------------------------------------------------------ seasons calendar */

interface SeasonRow {
  id: string
  kind: string
  name_ar: string
  name_en: string
  starts_on: string
  ends_on: string
  recurrence: string
  approximate: boolean | number
  previous_starts_on: string | null
  previous_ends_on: string | null
  notes: string | null
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function validateSeasonEvent(raw: unknown): SeasonEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (k: string, max = 120) => (typeof r[k] === 'string' ? String(r[k]).trim().slice(0, max) : '')
  const kind = str('kind') as SeasonKind
  const recurrence = str('recurrence')
  const ev: SeasonEvent = {
    id: str('id', 64) || randomUUID(),
    kind,
    nameAr: str('nameAr'),
    nameEn: str('nameEn'),
    startsOn: str('startsOn', 10),
    endsOn: str('endsOn', 10),
    recurrence: recurrence === 'monthly' || recurrence === 'none' ? recurrence : 'yearly',
    approximate: r.approximate !== false,
    previousStartsOn: ISO.test(str('previousStartsOn', 10)) ? str('previousStartsOn', 10) : null,
    previousEndsOn: ISO.test(str('previousEndsOn', 10)) ? str('previousEndsOn', 10) : null,
    notes: str('notes', 500) || null,
  }
  if (!SEASON_KINDS.includes(kind) || !ev.nameAr || !ev.nameEn || !ISO.test(ev.startsOn) || !ISO.test(ev.endsOn) || ev.endsOn < ev.startsOn) return null
  if (!/^[A-Za-z0-9_-]+$/.test(ev.id)) return null
  return ev
}

export async function listSeasonEvents(): Promise<SeasonEvent[] | null> {
  try {
    const rows = await query<SeasonRow>(`SELECT id, kind, name_ar, name_en, starts_on, ends_on, recurrence, approximate, previous_starts_on, previous_ends_on, notes FROM season_events ORDER BY starts_on`, [])
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as SeasonKind,
      nameAr: r.name_ar,
      nameEn: r.name_en,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      recurrence: (r.recurrence as SeasonEvent['recurrence']) ?? 'yearly',
      approximate: Boolean(r.approximate),
      previousStartsOn: r.previous_starts_on,
      previousEndsOn: r.previous_ends_on,
      notes: r.notes,
    }))
  } catch (error) {
    logger.error('season events read failed', errorFields(error))
    return null
  }
}

export async function upsertSeasonEvent(ev: SeasonEvent, updatedBy: string): Promise<void> {
  const now = new Date().toISOString()
  await exec(`DELETE FROM season_events WHERE id = $1`, [ev.id])
  await exec(
    `INSERT INTO season_events (id, kind, name_ar, name_en, starts_on, ends_on, recurrence, approximate, previous_starts_on, previous_ends_on, notes, updated_at, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [ev.id, ev.kind, ev.nameAr, ev.nameEn, ev.startsOn, ev.endsOn, ev.recurrence, postgresUrl() ? ev.approximate : ev.approximate ? 1 : 0, ev.previousStartsOn ?? null, ev.previousEndsOn ?? null, ev.notes ?? null, now, updatedBy],
  )
}

export async function deleteSeasonEvent(id: string): Promise<void> {
  await exec(`DELETE FROM season_events WHERE id = $1`, [id])
}

/* ------------------------------------------------------------------ decision log */

interface DecisionRow {
  id: string
  fingerprint: string
  advisor_id: string
  kind: string
  branch_id: string | null
  title_ar: string
  title_en: string
  status: string
  note: string | null
  decided_by: string
  decided_at: string
  decided_day: string
  expected_weekly_kwd: number | null
  outcome: string | null
  outcome_at: string | null
}

function decisionFromRow(r: DecisionRow): DecisionRecord {
  let outcome: DecisionOutcome | null = null
  try {
    outcome = r.outcome ? (JSON.parse(r.outcome) as DecisionOutcome) : null
  } catch {
    outcome = null
  }
  return {
    id: r.id,
    fingerprint: r.fingerprint,
    advisorId: r.advisor_id as DecisionRecord['advisorId'],
    kind: r.kind,
    branchId: r.branch_id,
    titleAr: r.title_ar,
    titleEn: r.title_en,
    status: r.status as DecisionRecord['status'],
    note: r.note,
    decidedBy: r.decided_by,
    decidedAt: String(r.decided_at),
    decidedDay: String(r.decided_day),
    expectedWeeklyKwd: r.expected_weekly_kwd === null || r.expected_weekly_kwd === undefined ? null : Number(r.expected_weekly_kwd),
    outcome,
    outcomeAt: r.outcome_at,
  }
}

const DECISION_COLUMNS = 'id, fingerprint, advisor_id, kind, branch_id, title_ar, title_en, status, note, decided_by, decided_at, decided_day, expected_weekly_kwd, outcome, outcome_at'

/** Latest decision per fingerprint, newest first (a re-decision replaces the earlier one). */
export async function listDecisions(limit = 200): Promise<DecisionRecord[]> {
  try {
    const rows = await query<DecisionRow>(`SELECT ${DECISION_COLUMNS} FROM council_decisions ORDER BY decided_at DESC LIMIT $1`, [limit])
    return rows.map(decisionFromRow)
  } catch (error) {
    logger.error('council decisions read failed', errorFields(error))
    return []
  }
}

/** One decision per finding: a new decision on the same fingerprint replaces the previous one. */
export async function saveDecision(d: DecisionRecord): Promise<void> {
  await exec(`DELETE FROM council_decisions WHERE fingerprint = $1`, [d.fingerprint])
  await exec(
    `INSERT INTO council_decisions (${DECISION_COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [d.id, d.fingerprint, d.advisorId, d.kind, d.branchId, d.titleAr, d.titleEn, d.status, d.note, d.decidedBy, d.decidedAt, d.decidedDay, d.expectedWeeklyKwd, d.outcome ? JSON.stringify(d.outcome) : null, d.outcomeAt],
  )
}

export async function saveDecisionOutcome(id: string, outcome: DecisionOutcome, at: string): Promise<void> {
  await exec(`UPDATE council_decisions SET outcome = $1, outcome_at = $2 WHERE id = $3`, [JSON.stringify(outcome), at, id])
}

/** Fingerprints already decided (any status): the council does not propose them again. */
export async function loadDecidedFingerprints(): Promise<Set<string>> {
  try {
    const rows = await query<{ fingerprint: string }>(`SELECT fingerprint FROM council_decisions`, [])
    return new Set(rows.map((r) => String(r.fingerprint)))
  } catch (error) {
    logger.error('council decided fingerprints read failed', errorFields(error))
    return new Set()
  }
}
