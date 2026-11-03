import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { logger } from '@/lib/logger'
import {
  processSmartDropzoneBatch,
  SMART_DROPZONE_DEPARTMENTS,
  type RouterFileInput,
  type SmartDropzoneDepartment,
} from '@/services/universal-ai-router.service'

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

function parseDept(value: unknown): SmartDropzoneDepartment | undefined {
  const s = asString(value)
  return (SMART_DROPZONE_DEPARTMENTS as readonly string[]).includes(s)
    ? (s as SmartDropzoneDepartment)
    : undefined
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated', message: 'Sign in required.' } }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json', message: 'JSON body required.' } }, { status: 400 })
  }

  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const batchId = asString(body.batchId).slice(0, 120) || undefined
  const list = Array.isArray(body.files) ? body.files : []
  const files: RouterFileInput[] = []

  for (const item of list.slice(0, 24)) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const fileName = safeName(asString(row.fileName || row.name, 'file').slice(0, 500) || 'file')
    const relativePath = asString(row.relativePath || row.path || fileName, fileName).slice(0, 2000) || fileName
    if (isHiddenSystemPath(relativePath) || isHiddenSystemPath(fileName)) continue
    let contentBase64 = asString(row.contentBase64 || row.content || row.data) || undefined
    if (contentBase64) {
      contentBase64 = contentBase64.replace(/^data:[^;]+;base64,/, '')
      if (contentBase64.length > 1_400_000) contentBase64 = undefined
    }
    files.push({
      relativePath,
      fileName,
      mimeType: asString(row.mimeType || row.type, 'application/octet-stream').slice(0, 200),
      sizeBytes: asNumber(row.sizeBytes ?? row.size),
      contentBase64,
      textHint: asString(row.textHint || row.text || row.extractedText).slice(0, 40_000) || undefined,
      sha256: asString(row.sha256 || row.fingerprint).slice(0, 128) || undefined,
      source: asString(row.source).slice(0, 64) || undefined,
      forceDepartment: parseDept(row.forceDepartment || row.department),
    })
  }

  if (files.length === 0) {
    return NextResponse.json({
      data: {
        batchId: batchId || `sdz_${Date.now()}`,
        processed: 0,
        counters: Object.fromEntries(
          SMART_DROPZONE_DEPARTMENTS.map((d) => [d, 0]),
        ),
        rows: [],
      },
    })
  }

  try {
    const result = await processSmartDropzoneBatch({
      actorId: user.id,
      batchId,
      files,
    })
    return NextResponse.json({ data: result })
  } catch (error) {
    logger.error('smart_dropzone_process_failed', {
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: { code: 'process_failed', message: 'Smart dropzone processing failed.' } },
      { status: 500 },
    )
  }
}

function safeName(name: string): string {
  return name.replace(/[<>:"|?*\u0000-\u001f]/g, '_').trim() || 'file'
}

function isHiddenSystemPath(pathValue: string): boolean {
  const parts = pathValue.split(/[/\\]/).filter(Boolean)
  return parts.some(
    (part) =>
      part === '.' ||
      part === '..' ||
      part.startsWith('.') ||
      /^~\$/.test(part) ||
      /^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(part),
  )
}
