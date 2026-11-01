import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { toErrorResponse } from '@/lib/api/route'
import {
  assignHrDocument,
  ingestHrFolderBatch,
  listEmployeeDossier,
  listReviewQueue,
  type IngestFileInput,
} from '@/services/hr-folder-ingestor.service'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Keep well under Vercel body limits when base64 is present. */
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

/** Lenient sanitizer — never throws Zod validation_failed for HR folder payloads. */
function sanitizeIngestFiles(raw: unknown): { batchId?: string; files: IngestFileInput[] } {
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
      // Hard cap ~1.1MB base64 chars ≈ ~825KB binary — stays under Vercel 4.5MB with JSON overhead
      if (contentBase64.length > 1_100_000) contentBase64 = undefined
    }
    const textHint = asString(row.textHint || row.text).slice(0, 40_000) || undefined
    const mimeType = asString(row.mimeType || row.type, 'application/octet-stream').slice(0, 200)
    const sizeBytes = asNumber(row.sizeBytes ?? row.size)
    files.push({
      relativePath,
      fileName,
      mimeType,
      sizeBytes: sizeBytes != null && sizeBytes >= 0 ? Math.min(sizeBytes, 50_000_000) : undefined,
      contentBase64,
      textHint,
    })
  }
  return { batchId, files }
}

async function requireHrEditor() {
  const user = await getCurrentUser()
  if (!user) return { error: NextResponse.json({ error: { code: 'unauthorized', message: 'Login required' } }, { status: 401 }) }
  if (!can(user, 'hr', 'create') && !can(user, 'hr', 'edit') && !user.role.isAdmin) {
    return { error: NextResponse.json({ error: { code: 'forbidden', message: 'HR permission required' } }, { status: 403 }) }
  }
  return { user }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireHrEditor()
    if ('error' in auth && auth.error) return auth.error
    const url = request.nextUrl
    const employeeId = url.searchParams.get('employeeId')
    if (employeeId) {
      return NextResponse.json({ data: { dossier: await listEmployeeDossier(employeeId) } })
    }
    if (url.searchParams.get('review') === '1') {
      const queue = await listReviewQueue()
      return NextResponse.json({
        data: {
          review: queue.map((row) => ({
            id: row.id,
            fileName: row.fileName,
            relativePath: row.relativePath,
            category: row.category,
            matchScore: row.matchScore,
            suggestedEmployeeId: row.employeeId,
            suggestedEmployeeName: row.employee?.name ?? null,
          })),
        },
      })
    }
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true, department: true },
      orderBy: { name: 'asc' },
      take: 500,
    })
    return NextResponse.json({ data: { employees } })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}

function softSkipPayload(batchId: string | undefined, files: IngestFileInput[]) {
  return {
    data: {
      batchId: batchId || `batch_${Date.now()}`,
      processed: files.length,
      matched: 0,
      review: 0,
      appliedRows: 0,
      rows: files.map((file, index) => ({
        id: `skip_${Date.now()}_${index}`,
        fileName: file.fileName,
        relativePath: file.relativePath,
        category: 'other' as const,
        categoryLabelAr: 'مستند عام',
        categoryLabelEn: 'Other document',
        employeeId: null,
        employeeName: null,
        employeeCode: null,
        matchScore: 0,
        status: 'SKIPPED' as const,
        updates: ['server_soft_skip'],
        expiryDate: null,
        civilId: null,
      })),
    },
  }
}

export async function POST(request: NextRequest) {
  // Never surface Zod/AppError "The request did not pass validation" to the upload pool.
  let files: IngestFileInput[] = []
  let batchId: string | undefined
  try {
    const auth = await requireHrEditor()
    if ('error' in auth && auth.error) return auth.error
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(softSkipPayload(undefined, [{ relativePath: 'invalid.json', fileName: 'invalid.json' }]))
    }

    if (typeof body === 'object' && body && 'documentId' in body && 'employeeId' in body && !('files' in body)) {
      try {
        const documentId = asString((body as { documentId?: unknown }).documentId)
        const employeeId = asString((body as { employeeId?: unknown }).employeeId)
        if (!documentId || !employeeId) {
          return NextResponse.json({ error: { code: 'missing_fields', message: 'documentId and employeeId required' } }, { status: 400 })
        }
        const row = await assignHrDocument({ documentId, employeeId, actorId: auth.user!.id })
        return NextResponse.json({ data: row })
      } catch (error) {
        return toErrorResponse(error, request)
      }
    }

    ;({ batchId, files } = sanitizeIngestFiles(body))
    if (files.length === 0) {
      return NextResponse.json(softSkipPayload(batchId, []))
    }

    const result = await ingestHrFolderBatch({
      actorId: auth.user!.id,
      batchId,
      files,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    logger.warn('hr_ingest_batch_soft_fail', {
      errorMessage: error instanceof Error ? error.message : String(error),
      fileCount: files.length,
    })
    return NextResponse.json(softSkipPayload(batchId, files.length ? files : [{ relativePath: 'unknown', fileName: 'unknown' }]))
  }
}
