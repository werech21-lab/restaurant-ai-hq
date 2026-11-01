import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import { isSmartIngestModule, metaForModule, permissionModulesFor } from '@/lib/smart-ingest-modules'
import {
  ingestUniversalBatch,
  type IngestFileInput,
} from '@/services/universal-folder-ingestor.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function sanitizeFiles(raw: unknown): { batchId?: string; files: IngestFileInput[] } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const batchId = asString(body.batchId).slice(0, 120) || undefined
  const list = Array.isArray(body.files) ? body.files : body.file ? [body.file] : []
  const files: IngestFileInput[] = []
  for (const item of list.slice(0, 4)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const fileName = asString(row.fileName || row.name, 'file').slice(0, 500) || 'file'
    const relativePath = asString(row.relativePath || row.path || fileName, fileName).slice(0, 2000) || fileName
    let contentBase64 = asString(row.contentBase64 || row.content || row.data) || undefined
    if (contentBase64) {
      contentBase64 = contentBase64.replace(/^data:[^;]+;base64,/, '')
      if (contentBase64.length > 1_100_000) contentBase64 = undefined
    }
    files.push({
      relativePath,
      fileName,
      mimeType: asString(row.mimeType || row.type, 'application/octet-stream').slice(0, 200),
      sizeBytes: asNumber(row.sizeBytes ?? row.size),
      contentBase64,
      textHint: asString(row.textHint || row.text).slice(0, 40_000) || undefined,
    })
  }
  return { batchId, files }
}

function softSkip(module: string, batchId: string | undefined, files: IngestFileInput[]) {
  return {
    data: {
      batchId: batchId || `batch_${Date.now()}`,
      module,
      processed: files.length,
      matched: 0,
      review: 0,
      appliedRows: 0,
      rows: files.map((file, index) => ({
        id: `skip_${Date.now()}_${index}`,
        module,
        fileName: file.fileName,
        relativePath: file.relativePath,
        category: 'other',
        categoryLabelAr: 'تم التخطي',
        categoryLabelEn: 'Skipped',
        entityKey: null,
        entityLabel: null,
        branchCode: null,
        brandCode: null,
        amountKwd: null,
        matchScore: 0,
        status: 'SKIPPED' as const,
        updates: ['server_soft_skip'],
        expiryDate: null,
        fileUrl: null,
      })),
    },
  }
}

type Ctx = { params: Promise<{ module: string }> }

export async function GET(_request: NextRequest, context: Ctx) {
  const { module: raw } = await context.params
  const meta = metaForModule(raw)
  if (!meta) {
    return NextResponse.json({ error: { code: 'unknown_module', message: 'Unknown module' } }, { status: 404 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 })
  const allowedView = permissionModulesFor(meta).some((m) => can(user, m, 'view'))
  if (!allowedView && !user.role.isAdmin) {
    return NextResponse.json({ error: { code: 'forbidden', message: 'Permission required' } }, { status: 403 })
  }
  return NextResponse.json({
    data: {
      module: meta.key,
      titleAr: meta.titleAr,
      titleEn: meta.titleEn,
      acceptsAr: meta.acceptsAr,
      acceptsEn: meta.acceptsEn,
    },
  })
}

export async function POST(request: NextRequest, context: Ctx) {
  let files: IngestFileInput[] = []
  let batchId: string | undefined
  let moduleKey = 'accounting'
  try {
    const { module: raw } = await context.params
    if (!isSmartIngestModule(raw)) {
      return NextResponse.json(softSkip(raw, undefined, []))
    }
    moduleKey = raw
    const meta = metaForModule(raw)!
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 })
    const allowedWrite = permissionModulesFor(meta).some(
      (m) => can(user, m, 'create') || can(user, m, 'edit'),
    )
    if (!allowedWrite && !user.role.isAdmin) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'Permission required' } }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(softSkip(moduleKey, undefined, [{ relativePath: 'invalid.json', fileName: 'invalid.json' }]))
    }

    ;({ batchId, files } = sanitizeFiles(body))
    if (!files.length) return NextResponse.json(softSkip(moduleKey, batchId, []))

    const result = await ingestUniversalBatch({
      module: moduleKey,
      actorId: user.id,
      batchId,
      files,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    logger.warn('universal_ingest_api_soft_fail', {
      errorMessage: error instanceof Error ? error.message : String(error),
      module: moduleKey,
    })
    return NextResponse.json(
      softSkip(moduleKey, batchId, files.length ? files : [{ relativePath: 'unknown', fileName: 'unknown' }]),
    )
  }
}
