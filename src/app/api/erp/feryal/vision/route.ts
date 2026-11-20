import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  runFeryalVisionAnalysis,
  type FeryalVisionFramePayload,
  type FeryalVisionMediaItemPayload,
  type FeryalVisionRequestPayload,
} from '@/lib/feryal-multimodal'
import { errorFields, logger } from '@/lib/logger'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { readCouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels } from '@/server/ai/models'
import { persistAiRuns } from '@/server/ai/persist'
import { estimateCostMicroUsd } from '@/server/ai/providers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_VISION_BODY_CHARS = 6_200_000
const MAX_MEDIA_ITEMS = 4
const MAX_FRAMES_PER_VIDEO = 6

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ALLOWED_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function cleanShortString(value: unknown, maxLen = 160): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || isExcludedOdooEntity(trimmed)) return undefined
  return trimmed.slice(0, maxLen)
}

function cleanBase64(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const commaIdx = trimmed.indexOf(',')
  const raw = commaIdx >= 0 ? trimmed.slice(commaIdx + 1).trim() : trimmed
  return raw.length > 0 ? raw : undefined
}

function parseMediaItems(
  body: Record<string, unknown>,
): { ok: true; items: FeryalVisionMediaItemPayload[] } | { ok: false; status: number; error: string } {
  const rawItems = Array.isArray(body.mediaItems)
    ? body.mediaItems
    : Array.isArray(body.mediaParts)
      ? body.mediaParts
      : []

  if (rawItems.length === 0) {
    return { ok: false, status: 400, error: 'MEDIA_REQUIRED' }
  }

  const items: FeryalVisionMediaItemPayload[] = []

  for (let idx = 0; idx < Math.min(rawItems.length, MAX_MEDIA_ITEMS); idx++) {
    const rec = asRecord(rawItems[idx])
    if (!rec) continue

    const rawMime = typeof rec.mimeType === 'string' ? rec.mimeType.split(';')[0].trim().toLowerCase() : ''
    const rawKind = typeof rec.kind === 'string' ? rec.kind.toLowerCase() : ''
    const name = cleanShortString(rec.name, 140) ?? `media-${idx + 1}`

    const isVideo =
      rawKind === 'video' ||
      ALLOWED_VIDEO_MIMES.has(rawMime) ||
      Array.isArray(rec.extractedFrames) ||
      typeof rec.nativeVideoBase64 === 'string'

    if (!isVideo) {
      if (rawMime && !ALLOWED_IMAGE_MIMES.has(rawMime)) {
        return { ok: false, status: 415, error: 'UNSUPPORTED_MEDIA_TYPE' }
      }
      const b64 = cleanBase64(rec.base64Data ?? rec.data)
      if (!b64) continue
      items.push({
        id: cleanShortString(rec.id, 80) ?? `img-${idx + 1}`,
        kind: 'image',
        name,
        mimeType: ALLOWED_IMAGE_MIMES.has(rawMime) ? rawMime : 'image/jpeg',
        width: typeof rec.width === 'number' && Number.isFinite(rec.width) ? rec.width : undefined,
        height: typeof rec.height === 'number' && Number.isFinite(rec.height) ? rec.height : undefined,
        base64Data: b64,
      })
      continue
    }

    const videoMime = rawMime || 'video/mp4'
    if (!ALLOWED_VIDEO_MIMES.has(videoMime)) {
      return { ok: false, status: 415, error: 'UNSUPPORTED_MEDIA_TYPE' }
    }

    const extractedFrames: FeryalVisionFramePayload[] = []
    if (Array.isArray(rec.extractedFrames)) {
      for (let fIdx = 0; fIdx < Math.min(rec.extractedFrames.length, MAX_FRAMES_PER_VIDEO); fIdx++) {
        const fRec = asRecord(rec.extractedFrames[fIdx])
        if (!fRec) continue
        const frameB64 = cleanBase64(fRec.base64Data ?? fRec.data)
        if (!frameB64) continue
        extractedFrames.push({
          index:
            typeof fRec.index === 'number' && Number.isFinite(fRec.index)
              ? Math.round(fRec.index)
              : fIdx + 1,
          timestampSec:
            typeof fRec.timestampSec === 'number' && Number.isFinite(fRec.timestampSec)
              ? Number(fRec.timestampSec)
              : fIdx,
          timestampLabel: cleanShortString(fRec.timestampLabel, 24) ?? `00:0${fIdx}`,
          mimeType: 'image/jpeg',
          base64Data: frameB64,
        })
      }
    }

    const nativeVideoBase64 = cleanBase64(rec.nativeVideoBase64 ?? rec.data)
    const nativeVideoMimeRaw =
      typeof rec.nativeVideoMimeType === 'string'
        ? rec.nativeVideoMimeType.split(';')[0].trim().toLowerCase()
        : videoMime
    const nativeVideoMimeType = ALLOWED_VIDEO_MIMES.has(nativeVideoMimeRaw)
      ? nativeVideoMimeRaw
      : videoMime

    if (extractedFrames.length === 0 && !nativeVideoBase64) {
      continue
    }

    items.push({
      id: cleanShortString(rec.id, 80) ?? `vid-${idx + 1}`,
      kind: 'video',
      name,
      mimeType: videoMime,
      durationSec:
        typeof rec.durationSec === 'number' && Number.isFinite(rec.durationSec)
          ? rec.durationSec
          : undefined,
      extractedFrames,
      ...(nativeVideoBase64 ? { nativeVideoBase64, nativeVideoMimeType } : {}),
    })
  }

  if (items.length === 0) {
    return { ok: false, status: 400, error: 'MEDIA_REQUIRED' }
  }

  return { ok: true, items }
}

export async function POST(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response

  if (guard.session.role === 'auditor') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Read-only auditor session',
        errorAr: 'حساب مراجعة للقراءة فقط — الفحص البصري التفاعلي غير متاح.',
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (executiveAiBurstLimiter && typeof executiveAiBurstLimiter.check === 'function') {
    const burst = executiveAiBurstLimiter.check(`feryal-vision:${guard.session.sub}`)
    if (!burst.allowed) {
      return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
    }
  }

  let rawText = ''
  try {
    rawText = await request.text()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_BODY' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (!rawText || rawText.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: 'MEDIA_REQUIRED' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (rawText.length > MAX_VISION_BODY_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Attached media payload exceeds the maximum allowed request size.',
      },
      { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const body = asRecord(parsedJson)
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const mediaParsed = parseMediaItems(body)
  if (!mediaParsed.ok) {
    return NextResponse.json(
      { ok: false, error: mediaParsed.error },
      { status: mediaParsed.status, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const locale: 'ar' | 'en' = body.locale === 'en' || body.lang === 'en' ? 'en' : 'ar'
  const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 2000) : ''

  const visionPayload: FeryalVisionRequestPayload = {
    prompt: rawPrompt,
    locale,
    brand: cleanShortString(body.brand, 64),
    branch: cleanShortString(body.branch, 64),
    period: cleanShortString(body.period, 32),
    workspaceContext: cleanShortString(body.workspaceContext, 240),
    mediaItems: mediaParsed.items,
  }

  const keys = readCouncilKeys()
  const models = resolveCouncilModels()

  try {
    const outcome = await runFeryalVisionAnalysis(visionPayload, {
      fetchImpl: globalThis.fetch,
      keys: {
        google: keys.google,
        anthropic: keys.anthropic,
      },
      models: {
        google: models.google,
        anthropic: models.anthropic,
      },
    })

    if (outcome.telemetry) {
      const t = outcome.telemetry
      const qHash = createHash('sha256')
        .update(`vision:${rawPrompt || 'default'}:${mediaParsed.items.length}`)
        .digest('hex')
      try {
        await persistAiRuns([
          {
            id: randomUUID(),
            userId: guard.session.sub || 'executive',
            questionHash: qHash,
            provider: t.provider,
            modelId: t.modelId,
            latencyMs: t.latencyMs,
            tokensIn: t.tokensIn,
            tokensOut: t.tokensOut,
            estCostMicroUsd: estimateCostMicroUsd(t.provider, t.tokensIn, t.tokensOut),
            status: t.status,
            errorCode: t.errorCode,
          },
        ])
      } catch (persistErr) {
        logger.error('feryal vision run persist failed', errorFields(persistErr))
      }
    }

    if (outcome.response.ok && isExcludedOdooEntity(outcome.response.reply)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'EXCLUDED_ENTITY_REJECTED',
          reply:
            locale === 'ar'
              ? 'تعذّر عرض هذا التحليل لاحتوائه على إشارة خارج نطاق الفروع المعتمدة.'
              : 'Visual output was withheld due to out-of-scope entity reference.',
          complianceTier: 'yellow',
          complianceBadgeAr: outcome.response.complianceBadgeAr,
          complianceBadgeEn: outcome.response.complianceBadgeEn,
          provider: outcome.response.provider,
          model: outcome.response.model,
          engineLabelAr: outcome.response.engineLabelAr,
          engineLabelEn: outcome.response.engineLabelEn,
        },
        { status: 422, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    return NextResponse.json(
      {
        ...outcome.response,
        mediaCount: mediaParsed.items.length,
        timestamp: new Date().toISOString(),
      },
      { status: outcome.httpStatus, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('feryal vision route failed', errorFields(error))
    return NextResponse.json(
      {
        ok: false,
        error: 'VISION_INTERNAL_ERROR',
        reply:
          locale === 'ar'
            ? 'حدث خطأ غير متوقع أثناء الفحص البصري — أعد المحاولة.'
            : 'An unexpected error occurred during visual inspection — please retry.',
      },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}

async function methodNotAllowed(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response
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

export function GET(request: NextRequest) {
  return methodNotAllowed(request)
}

export function PUT(request: NextRequest) {
  return methodNotAllowed(request)
}

export function PATCH(request: NextRequest) {
  return methodNotAllowed(request)
}

export function DELETE(request: NextRequest) {
  return methodNotAllowed(request)
}
