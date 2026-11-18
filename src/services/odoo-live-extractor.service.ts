import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import {
  ODOO_COMPANY_ID,
  ODOO_ORIGIN,
  fetchOdooModels,
  fetchOdooSession,
  importOdooFile,
  liveOdooTransport,
  liveWebTransport,
  odooModels,
  pullOdoo,
  type OdooModel,
  type OdooPayload,
} from '@/modules/odoo'

export type LiveExtractInput =
  | { mode: 'password'; database: string; login: string; secret: string }
  | { mode: 'session'; sessionId: string }

export type LiveExtractReport = {
  origin: string
  companyId: number
  exportedAt: string
  backupPath: string
  counts: Record<string, number>
  pulled: number
  applied: number
  staged: number
  skipped: number
  jobId: string
}

function backupDir(): string {
  const dir = path.join(process.cwd(), 'backups', 'odoo-full-dump')
  mkdirSync(dir, { recursive: true })
  return dir
}

async function pullGroups(input: LiveExtractInput): Promise<{ model: OdooModel; rows: OdooPayload[] }[]> {
  if (input.mode === 'session') {
    return fetchOdooSession(liveWebTransport, input.sessionId, odooModels)
  }
  return fetchOdooModels(liveOdooTransport, input.database, input.login, input.secret, odooModels)
}

/**
 * Full live pull from Odoo 17:
 * writes a timestamped live backup under backups/odoo-full-dump/ then stages/applies via odoo-service.
 * Static seed dumps are never written or read on production paths.
 */
export async function extractAndBackupOdooLive(
  auth: AuthContext,
  idempotencyKey: string,
  input: LiveExtractInput,
): Promise<LiveExtractReport> {
  const groups = await pullGroups(input)
  const models: Record<string, OdooPayload[]> = {}
  const counts: Record<string, number> = {}
  let pulled = 0
  for (const group of groups) {
    models[group.model] = group.rows
    counts[group.model] = group.rows.length
    pulled += group.rows.length
  }
  if (pulled === 0) {
    throw new AppError(422, 'odoo_empty', 'Odoo returned no rows. Check credentials or company access.')
  }

  const exportedAt = new Date().toISOString()
  const stamp = exportedAt.replace(/[:.]/g, '-')
  const dump = {
    source: ODOO_ORIGIN,
    companyId: ODOO_COMPANY_ID,
    exportedAt,
    models,
  }
  const fileName = `venturefoods-live-${stamp}.json`
  const backupPath = path.join(backupDir(), fileName)
  const json = JSON.stringify(dump)
  writeFileSync(backupPath, json, 'utf8')

  const bytes = new TextEncoder().encode(json)
  const outcome = await importOdooFile(auth, idempotencyKey, fileName, bytes)
  const body = outcome.body as {
    data?: { jobId?: string; pulled?: number; applied?: number; staged?: number; skipped?: number }
  }
  const data = body.data ?? {}

  if (input.mode === 'password') {
    await pullOdoo(auth, `${idempotencyKey}-rpc`, {
      database: input.database,
      login: input.login,
      secret: input.secret,
    }).catch(() => null)
  } else {
    await pullOdoo(auth, `${idempotencyKey}-session`, { sessionId: input.sessionId }).catch(() => null)
  }

  return {
    origin: ODOO_ORIGIN,
    companyId: ODOO_COMPANY_ID,
    exportedAt,
    backupPath: path.relative(process.cwd(), backupPath).replace(/\\/g, '/'),
    counts,
    pulled: data.pulled ?? pulled,
    applied: data.applied ?? 0,
    staged: data.staged ?? 0,
    skipped: data.skipped ?? 0,
    jobId: data.jobId ?? '',
  }
}

/**
 * Calm unavailable state for local static dumps in production:
 * the stale 31 Oct 2026 1,000-row sample is never read on production paths; live Odoo reads only.
 */
export function listLocalOdooDumpSummary(): {
  path: string
  exists: boolean
  bytes: number
  counts: Record<string, number>
  exportedAt: string | null
} {
  return { path: '', exists: false, bytes: 0, counts: {}, exportedAt: null }
}
