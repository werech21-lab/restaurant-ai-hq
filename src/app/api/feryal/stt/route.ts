import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { getOpenAIApiKey } from '@/lib/openai-key'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_AUDIO_BYTES = 15 * 1024 * 1024
const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
])

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`stt:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as Blob | null
    const lang = (formData.get('lang') as string) || 'ar'

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'Audio file is required' },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Audio payload exceeds 15MB limit' },
        { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const baseMime = (file.type || 'audio/webm').split(';')[0]?.trim().toLowerCase() || 'audio/webm'
    if (!ALLOWED_AUDIO_MIMES.has(baseMime)) {
      return NextResponse.json(
        { ok: false, error: 'Unsupported audio format' },
        { status: 415, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const apiKey = getOpenAIApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: 'OpenAI API key unavailable' },
        { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const whisperPrompt =
      lang === 'en'
        ? "Feryal, Venture Foods, Odoo ERP, Keeta, Talabat, Tgo, TMP, China Garden, Frank's, Tahina, KWD"
        : 'فريال، فنتشر فودز، أودو، كيتا، طلبات، شاينا جاردن، فرانكس، طحينة، دينار كويتي، السالمية، الكوت'

    const openAiFormData = new FormData()
    const rawName = file instanceof File ? file.name : ''
    const safeName = rawName.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64) || 'recording.webm'
    openAiFormData.append('file', file, safeName)
    openAiFormData.append('model', 'whisper-1')
    openAiFormData.append('language', lang === 'en' ? 'en' : 'ar')
    openAiFormData.append('prompt', whisperPrompt)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiFormData,
    })

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `Whisper API error (${response.status})` },
        { status: response.status, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const result = (await response.json()) as { text?: string }
    return NextResponse.json(
      {
        ok: true,
        transcript: result.text || '',
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Speech transcription failed' },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}

async function disallowSttMethod(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function PUT(req: NextRequest) {
  return disallowSttMethod(req)
}

export async function PATCH(req: NextRequest) {
  return disallowSttMethod(req)
}

export async function DELETE(req: NextRequest) {
  return disallowSttMethod(req)
}
