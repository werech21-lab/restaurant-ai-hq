import { NextResponse, type NextRequest } from 'next/server'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute, toErrorResponse, type RouteArgs } from '@/lib/api/route'
import { assignHrDocument, ingestHrFolderBatch, listEmployeeDossier, type IngestFileInput } from '@/services/hr-folder-ingestor.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function sanitize(raw: unknown): { batchId?: string; files: IngestFileInput[] } {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const batchId = asString(body.batchId).slice(0, 120) || undefined
  const list = Array.isArray(body.files) ? body.files : []
  const files: IngestFileInput[] = []
  for (const item of list.slice(0, 4)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const fileName = asString(row.fileName, 'file').slice(0, 500) || 'file'
    const relativePath = asString(row.relativePath, fileName).slice(0, 2000) || fileName
    let contentBase64 = asString(row.contentBase64) || undefined
    if (contentBase64) {
      contentBase64 = contentBase64.replace(/^data:[^;]+;base64,/, '')
      if (contentBase64.length > 1_100_000) contentBase64 = undefined
    }
    files.push({
      relativePath,
      fileName,
      mimeType: asString(row.mimeType, 'application/octet-stream').slice(0, 200),
      sizeBytes: typeof row.sizeBytes === 'number' ? row.sizeBytes : undefined,
      contentBase64,
      textHint: asString(row.textHint).slice(0, 40_000) || undefined,
    })
  }
  return { batchId, files }
}

async function postHandler({ request, auth }: RouteArgs) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.documentId && body.employeeId && !body.files) {
    const data = await assignHrDocument({
      documentId: asString(body.documentId),
      employeeId: asString(body.employeeId),
      actorId: auth.userId,
    })
    return NextResponse.json({ data })
  }
  const { batchId, files } = sanitize(body)
  if (!files.length) {
    return NextResponse.json({ error: { code: 'empty_batch', message: 'No files' } }, { status: 400 })
  }
  try {
    const data = await ingestHrFolderBatch({ actorId: auth.userId, batchId, files })
    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({
      data: {
        batchId: batchId || `batch_${Date.now()}`,
        processed: files.length,
        matched: 0,
        review: 0,
        appliedRows: 0,
        rows: [],
      },
    })
  }
}

async function getHandler({ request }: RouteArgs) {
  const employeeId = request.nextUrl.searchParams.get('employeeId')
  if (!employeeId) {
    return NextResponse.json({ error: { code: 'validation_failed', message: 'employeeId required' } }, { status: 422 })
  }
  return NextResponse.json({ data: { dossier: await listEmployeeDossier(employeeId) } })
}

export const POST = protectedRoute(permissions.hrEmployeeManage, postHandler)
export const GET = protectedRoute(permissions.hrEmployeeRead, getHandler)
