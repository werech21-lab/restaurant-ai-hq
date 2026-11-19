import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  detectIntakeFileKind,
  DocumentIntakeError,
  ingestPricingDocument,
  MAX_DOCUMENT_INTAKE_BYTES,
} from '@/lib/feryal/document-intake'
import { errorFields, logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function readFormField(formData: FormData, key: string): string | null {
  const raw = formData.get(key)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 128) : null
}

function extractUploadedBlob(
  value: FormDataEntryValue | null,
): { blob: Blob; fileName: string } | null {
  if (value === null || typeof value === 'string') return null
  if (typeof value.arrayBuffer !== 'function' || typeof value.size !== 'number') return null
  const rawName = typeof value.name === 'string' && value.name.trim().length > 0
    ? value.name.trim().slice(0, 180)
    : 'upload'
  return { blob: value, fileName: rawName }
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`feryal-doc-intake:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_FORM_DATA' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const uploaded = extractUploadedBlob(formData.get('file'))
  if (!uploaded) {
    return NextResponse.json(
      { ok: false, error: 'FILE_REQUIRED' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const { blob: rawFile, fileName: rawFileName } = uploaded

  if (rawFile.size === 0) {
    return NextResponse.json(
      { ok: false, error: 'EMPTY_FILE' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (rawFile.size > MAX_DOCUMENT_INTAKE_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'FILE_TOO_LARGE' },
      { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const detected = detectIntakeFileKind(rawFileName, rawFile.type)
  if (!detected) {
    return NextResponse.json(
      { ok: false, error: 'UNSUPPORTED_FILE_TYPE' },
      { status: 415, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  try {
    const bytes = new Uint8Array(await rawFile.arrayBuffer())
    const draft = await ingestPricingDocument({
      fileName: rawFileName,
      mimeType: rawFile.type,
      bytes,
      period: readFormField(formData, 'period'),
      customFrom: readFormField(formData, 'customFrom'),
      customTo: readFormField(formData, 'customTo'),
      brand: readFormField(formData, 'brand'),
      branch: readFormField(formData, 'branch'),
    })

    return NextResponse.json(
      {
        ok: true,
        draft,
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    if (error instanceof DocumentIntakeError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.code,
          message: error.message,
        },
        { status: error.httpStatus, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    logger.error('feryal document intake failed', errorFields(error))
    return NextResponse.json(
      {
        ok: false,
        error: 'DOCUMENT_INTAKE_FAILED',
      },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    {
      status: 405,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        Allow: 'POST',
      },
    },
  )
}

export async function GET() {
  return methodNotAllowed()
}

export async function PUT() {
  return methodNotAllowed()
}

export async function PATCH() {
  return methodNotAllowed()
}

export async function DELETE() {
  return methodNotAllowed()
}
