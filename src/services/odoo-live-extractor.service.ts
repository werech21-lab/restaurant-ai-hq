import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooModels, type OdooModel, type OdooPayload } from '@/modules/odoo/domain/odoo'
import { fetchOdooModels, fetchOdooSession, liveOdooTransport, liveWebTransport } from '@/modules/odoo/domain/rpc'
import { importOdooFile, pullOdoo } from '@/modules/odoo/services/odoo-service'

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
 * Full live pull from venturefoods.walnutss.com:
 * writes an eternal dump under backups/odoo-full-dump/ then stages/applies via odoo-service.
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
  writeFileSync(path.join(backupDir(), 'venturefoods_odoo_cids1_dump.json'), json, 'utf8')

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

export function listLocalOdooDumpSummary(): {
  path: string
  exists: boolean
  bytes: number
  counts: Record<string, number>
  exportedAt: string | null
} {
  const relative = 'backups/odoo-full-dump/venturefoods_odoo_cids1_dump.json'
  const file = path.join(process.cwd(), relative)
  try {
    if (!existsSync(file)) {
      return { path: relative, exists: false, bytes: 0, counts: {}, exportedAt: null }
    }
    const raw = readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as { exportedAt?: string; models?: Record<string, unknown[]> }
    const counts: Record<string, number> = {}
    for (const [model, rows] of Object.entries(parsed.models ?? {})) {
      counts[model] = Array.isArray(rows) ? rows.length : 0
    }
    return {
      path: relative,
      exists: true,
      bytes: Buffer.byteLength(raw),
      counts,
      exportedAt: parsed.exportedAt ?? null,
    }
  } catch {
    return { path: relative, exists: false, bytes: 0, counts: {}, exportedAt: null }
  }
}
