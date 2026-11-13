import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { getGeminiApiKey, isValidGeminiApiKey } from '@/lib/ai-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const ZERO_QUOTA_COOLDOWN_MS = 10 * 60 * 1000

interface CachedGeminiCatalog {
  at: number
  fingerprint: string
  chain: string[]
}

let cachedCatalog: CachedGeminiCatalog | null = null
const modelCooldownUntil = new Map<string, number>()

function getDefaultFlagshipChain(): string[] {
  const envModel = process.env.GEMINI_MODEL?.trim()
  return [
    ...(envModel ? [envModel] : []),
    'gemini-3.1-pro-preview',
    'gemini-pro-latest',
    'gemma-4-26b-a4b-it',
  ]
}

function isCoolingDown(model: string): boolean {
  const until = modelCooldownUntil.get(model)
  if (!until) return false
  if (Date.now() > until) {
    modelCooldownUntil.delete(model)
    return false
  }
  return true
}

function markCooldown(model: string, ms = ZERO_QUOTA_COOLDOWN_MS) {
  modelCooldownUntil.set(model, Date.now() + ms)
}

function scoreGeminiFlagshipModel(id: string): number {
  const m = id.toLowerCase().replace(/^models\//, '')
  if (
    /flash|lite|image|tts|audio|embedding|robotics|computer-use|lyria|banana|transcribe|vision|aqa|antigravity|deep-research|1\.5|2\.0/i.test(
      m,
    )
  ) {
    return -1
  }

  if (m.includes('gemini-4') && m.includes('pro')) return 1000
  if (m.startsWith('gemini-4')) return 988
  if (m.includes('gemini-3.5') && m.includes('pro')) return 980
  if (m === 'gemini-3.1-pro-preview') return 976
  if (m.startsWith('gemini-3.1-pro')) return 968
  if (m.includes('gemini-3') && m.includes('pro')) return 962
  if (m === 'gemini-pro-latest') return 952
  if (m === 'gemma-4-26b-a4b-it') return 915
  if (m.startsWith('gemma-4-')) return 905
  if (m.includes('pro')) return 900
  return -1
}

function resolveServerGeminiKey(customApiKey?: string | null): string {
  if (isValidGeminiApiKey(customApiKey)) {
    return customApiKey!.trim()
  }
  const envKey = process.env.GEMINI_API_KEY?.trim()
  if (isValidGeminiApiKey(envKey)) {
    return envKey!
  }
  return getGeminiApiKey()
}

async function discoverFlagshipGeminiCatalog(
  apiKey: string,
  forceRefresh = false,
): Promise<{ chain: string[]; liveVerified: boolean }> {
  const fp = apiKey.slice(-8)
  if (forceRefresh) {
    modelCooldownUntil.clear()
  }
  if (
    !forceRefresh &&
    cachedCatalog &&
    cachedCatalog.fingerprint === fp &&
    Date.now() - cachedCatalog.at < SIX_HOURS_MS
  ) {
    return { chain: cachedCatalog.chain, liveVerified: true }
  }

  const defaultChain = getDefaultFlagshipChain()

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      signal: AbortSignal.timeout(8000),
      headers: {
        'x-goog-api-key': apiKey,
      },
      cache: 'no-store',
    })

    if (res.ok) {
      const data = (await res.json()) as {
        models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
      }

      const unlocked = [
        ...new Set(
          (data.models ?? [])
            .filter(
              (m) =>
                !m.supportedGenerationMethods ||
                m.supportedGenerationMethods.includes('generateContent'),
            )
            .map((m) => (m.name ?? '').replace(/^models\//, ''))
            .filter((id) => scoreGeminiFlagshipModel(id) > 0),
        ),
      ].sort((a, b) => scoreGeminiFlagshipModel(b) - scoreGeminiFlagshipModel(a))

      const chain =
        unlocked.length > 0
          ? [...new Set([...unlocked, ...defaultChain])].slice(0, 7)
          : defaultChain

      cachedCatalog = {
        at: Date.now(),
        fingerprint: fp,
        chain,
      }
      return { chain, liveVerified: true }
    }
  } catch {}

  return { chain: defaultChain, liveVerified: false }
}

export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  const customKey = req.headers.get('x-aether-custom-gemini-key')
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'
  const apiKey = resolveServerGeminiKey(customKey)
  const defaultChain = getDefaultFlagshipChain()

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        status: 401,
        topModel: 'Fast Executive',
        topBadge: 'Fast Executive',
        engineLabelAr: 'إجابة تنفيذية سريعة',
        engineLabelEn: 'Fast Executive',
        chain: defaultChain,
      },
      { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const catalog = await discoverFlagshipGeminiCatalog(apiKey, forceRefresh && !customKey)

  return NextResponse.json(
    {
      ok: true,
      status: 200,
      liveVerified: catalog.liveVerified,
      flagshipModel: 'Fast Executive',
      flagshipBadge: 'Fast Executive',
      activeModel: 'Fast Executive',
      activeBadge: 'Fast Executive',
      engineLabelAr: 'إجابة تنفيذية سريعة',
      engineLabelEn: 'Fast Executive',
      chain: catalog.chain,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

interface GeminiMediaPartInput {
  mimeType: string
  data: string
  label?: string
}

interface GeminiProxyPostBody {
  systemPrompt?: string
  userPrompt?: string
  audioBase64?: string
  mimeType?: string
  mediaParts?: GeminiMediaPartInput[]
  jsonMode?: boolean
  maxOutputTokens?: number
  customApiKey?: string
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`gemini:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let body: GeminiProxyPostBody = {}
  try {
    body = (await req.json()) as GeminiProxyPostBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const apiKey = resolveServerGeminiKey(body.customApiKey)
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'GEMINI_KEY_MISSING' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const userPrompt = (body.userPrompt ?? '').trim().slice(0, 16000)
  const incomingMedia = Array.isArray(body.mediaParts)
    ? body.mediaParts
        .filter((p) => p && typeof p.mimeType === 'string' && typeof p.data === 'string' && p.data.length > 0)
        .slice(0, 4)
    : []
  const hasMultimodal = Boolean(body.audioBase64) || incomingMedia.length > 0

  if (!userPrompt && !hasMultimodal) {
    return NextResponse.json(
      { ok: false, error: 'EMPTY_PROMPT' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const systemPrompt = (body.systemPrompt ?? '').trim().slice(0, 48000)
  const maxOutputTokens =
    typeof body.maxOutputTokens === 'number' && body.maxOutputTokens > 0
      ? Math.min(8192, Math.floor(body.maxOutputTokens))
      : 8192
  const jsonMode = Boolean(body.jsonMode)

  const catalog = await discoverFlagshipGeminiCatalog(apiKey, false)
  const readyModels = catalog.chain.filter((m) => !isCoolingDown(m))
  const chain = readyModels.length > 0 ? readyModels : catalog.chain

  const buildParts = (includeInlineSystem: boolean, skipRawVideo = false) => {
    const parts: Array<Record<string, unknown>> = []
    if (body.audioBase64) {
      parts.push({
        inlineData: {
          mimeType: (body.mimeType || 'audio/webm').split(';')[0] || 'audio/webm',
          data: body.audioBase64,
        },
      })
    }
    for (const mp of incomingMedia) {
      const cleanMime = (mp.mimeType || 'image/jpeg').split(';')[0].trim() || 'image/jpeg'
      if (skipRawVideo && cleanMime.startsWith('video/')) {
        continue
      }
      if (mp.label) {
        parts.push({ text: mp.label })
      }
      parts.push({
        inlineData: {
          mimeType: cleanMime,
          data: mp.data,
        },
      })
    }
    const effectiveUserText = userPrompt || 'Analyze the attached visual media in full detail.'
    const mergedText =
      includeInlineSystem && systemPrompt
        ? `${systemPrompt}\n\n---\n\n${effectiveUserText}`
        : effectiveUserText
    parts.push({ text: mergedText })
    return parts
  }

  let lastStatus = 500
  let lastError = 'GEMINI_UNAVAILABLE'
  const hasNativeVideoPart = incomingMedia.some((p) => p.mimeType.startsWith('video/'))

  for (const model of chain) {
    if (hasMultimodal && model.startsWith('gemma-')) {
      continue
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const isGemma = model.startsWith('gemma-')

    const attempts: Array<{
      thinkingMode: string
      payload: Record<string, unknown>
    }> = [
      {
        thinkingMode: 'HIGH',
        payload: {
          ...(!isGemma && systemPrompt
            ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
            : {}),
          contents: [{ role: 'user', parts: buildParts(isGemma, false) }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
            thinkingConfig: { thinkingLevel: 'HIGH' },
          },
        },
      },
      {
        thinkingMode: 'HIGH',
        payload: {
          ...(!isGemma && systemPrompt
            ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
            : {}),
          contents: [{ role: 'user', parts: buildParts(isGemma, false) }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
            thinkingConfig: { thinkingBudget: 24576 },
          },
        },
      },
      {
        thinkingMode: 'HIGH',
        payload: {
          contents: [{ role: 'user', parts: buildParts(true, hasNativeVideoPart) }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        },
      },
    ]

    for (let i = 0; i < attempts.length; i++) {
      try {
        const upstream = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(hasMultimodal ? 45000 : 28000),
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(attempts[i].payload),
        })

        lastStatus = upstream.status

        if (upstream.status === 401) {
          return NextResponse.json({ ok: false, error: 'GEMINI_AUTH_FAILED' }, { status: 401 })
        }

        if (upstream.status === 400 && i + 1 < attempts.length) {
          continue
        }

        if (upstream.status === 429 || upstream.status === 404 || upstream.status === 403 || upstream.status === 503 || upstream.status === 500) {
          let errMsg = `HTTP_${upstream.status}`
          try {
            const errJson = (await upstream.json()) as { error?: { message?: string } }
            if (errJson?.error?.message) errMsg = errJson.error.message
          } catch {}
          lastError = errMsg
          const cooldownMs = /limit:\s*0\b/i.test(errMsg) || upstream.status === 404
            ? ZERO_QUOTA_COOLDOWN_MS
            : 2 * 60 * 1000
          markCooldown(model, cooldownMs)
          break
        }

        if (upstream.ok) {
          const data = (await upstream.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string; thought?: boolean }> }
            }>
            usageMetadata?: { thoughtsTokenCount?: number }
          }

          const rawParts = data?.candidates?.[0]?.content?.parts ?? []
          const textOut = rawParts
            .filter((p) => !p.thought && typeof p.text === 'string')
            .map((p) => p.text)
            .join('\n')
            .trim()

          if (textOut) {
            const friendlyEn = incomingMedia.length > 0 ? 'Vision & Video Inspector' : 'Fast Executive'
            const friendlyAr = incomingMedia.length > 0 ? 'فحص الصور والفيديو' : 'إجابة تنفيذية سريعة'
            return NextResponse.json({
              ok: true,
              status: 200,
              model: friendlyEn,
              modelBadge: friendlyEn,
              engineLabelAr: friendlyAr,
              engineLabelEn: friendlyEn,
              thinkingLevel: attempts[i].thinkingMode,
              thoughtsTokenCount: data?.usageMetadata?.thoughtsTokenCount ?? 0,
              text: textOut,
            })
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'FETCH_TIMEOUT'
        markCooldown(model, 2 * 60 * 1000)
        break
      }
    }
  }

  return NextResponse.json(
    { ok: false, status: lastStatus, error: lastError },
    { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502 },
  )
}
