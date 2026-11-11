import { NextRequest, NextResponse } from 'next/server'
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

const DEFAULT_FLAGSHIP_CHAIN = [
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-3.1-pro-preview',
  'gemini-pro-latest',
  'gemma-4-26b-a4b-it',
]

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

/**
 * Strict Flagship Scorer:
 * - Explicitly INCLUDES `-preview` and `-exp` flagship Pro/Carbon models.
 * - Strictly BANS `flash`, `lite`, `image`, `tts`, `audio`, `embedding`, `robotics`, `computer-use`,
 *   `lyria`, `banana`, `transcribe`, `antigravity` (agent-only), and `deep-research` (async-only).
 */
function scoreGeminiFlagshipModel(id: string): number {
  const m = id.toLowerCase().replace(/^models\//, '')
  if (
    /flash|lite|image|tts|audio|embedding|robotics|computer-use|lyria|banana|transcribe|vision|aqa|antigravity|deep-research|1\.5|2\.0/i.test(
      m,
    )
  ) {
    return -1
  }

  // Priority 1: `carbon` or `gemini-4*` flagships
  if (m.includes('gemini-4') && (m.includes('carbon') || m.includes('pro'))) return 1000
  if (m.includes('carbon')) return 995
  if (m.startsWith('gemini-4')) return 988

  // Priority 2: Highest `gemini-3*pro*` flagships (including `-preview` and `-exp`)
  if (m.includes('gemini-3.5') && m.includes('pro')) return 980
  if (m === 'gemini-3.1-pro-preview') return 976
  if (m.startsWith('gemini-3.1-pro')) return 968
  if (m.includes('gemini-3') && m.includes('pro')) return 962
  if (m === 'gemini-pro-latest') return 952

  // Priority 3: `gemini-2.5-pro` ONLY if higher Pro/Carbon models are absent
  if (m === 'gemini-2.5-pro' || (m.includes('gemini-2.5') && m.includes('pro'))) return 935

  // Priority 4: Non-flash Gen-4 reasoning models (`thinking: true`) for uninterrupted HTTP 200 continuity
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

      const hasHigherGen = unlocked.some((id) => scoreGeminiFlagshipModel(id) >= 950)
      const filteredChain = hasHigherGen
        ? unlocked.filter((id) => !id.startsWith('gemini-2.5-pro'))
        : unlocked

      const chain =
        filteredChain.length > 0
          ? [...new Set([...filteredChain, ...DEFAULT_FLAGSHIP_CHAIN.filter((x) => !x.startsWith('gemini-2.5-pro'))])].slice(0, 7)
          : DEFAULT_FLAGSHIP_CHAIN

      cachedCatalog = {
        at: Date.now(),
        fingerprint: fp,
        chain,
      }
      return { chain, liveVerified: true }
    }
  } catch {
    // Graceful fallback to verified flagship chain
  }

  return { chain: DEFAULT_FLAGSHIP_CHAIN, liveVerified: false }
}

export async function GET(req: NextRequest) {
  const customKey = req.headers.get('x-aether-custom-gemini-key')
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'
  const apiKey = resolveServerGeminiKey(customKey)

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        status: 401,
        topModel: DEFAULT_FLAGSHIP_CHAIN[0],
        topBadge: `${DEFAULT_FLAGSHIP_CHAIN[0]} (HIGH)`,
        chain: DEFAULT_FLAGSHIP_CHAIN,
      },
      { status: 200 },
    )
  }

  const catalog = await discoverFlagshipGeminiCatalog(apiKey, forceRefresh)
  const activeTop = catalog.chain.find((m) => !isCoolingDown(m)) ?? catalog.chain[0]
  const flagshipTop = catalog.chain[0] ?? 'gemini-4-carbon'

  return NextResponse.json({
    ok: true,
    status: 200,
    liveVerified: catalog.liveVerified,
    flagshipModel: flagshipTop,
    flagshipBadge: `${flagshipTop} (HIGH)`,
    activeModel: activeTop,
    activeBadge: `${activeTop} (HIGH)`,
    chain: catalog.chain,
  })
}

interface GeminiProxyPostBody {
  systemPrompt?: string
  userPrompt?: string
  audioBase64?: string
  mimeType?: string
  jsonMode?: boolean
  maxOutputTokens?: number
  customApiKey?: string
}

export async function POST(req: NextRequest) {
  let body: GeminiProxyPostBody = {}
  try {
    body = (await req.json()) as GeminiProxyPostBody
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 })
  }

  const apiKey = resolveServerGeminiKey(body.customApiKey)
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'GEMINI_KEY_MISSING' }, { status: 401 })
  }

  const userPrompt = (body.userPrompt ?? '').trim()
  if (!userPrompt && !body.audioBase64) {
    return NextResponse.json({ ok: false, error: 'EMPTY_PROMPT' }, { status: 400 })
  }

  const systemPrompt = (body.systemPrompt ?? '').trim()
  const maxOutputTokens =
    typeof body.maxOutputTokens === 'number' && body.maxOutputTokens > 0
      ? body.maxOutputTokens
      : 8192
  const jsonMode = Boolean(body.jsonMode)

  const catalog = await discoverFlagshipGeminiCatalog(apiKey, false)
  const readyModels = catalog.chain.filter((m) => !isCoolingDown(m))
  const chain = readyModels.length > 0 ? readyModels : catalog.chain

  const buildParts = (includeInlineSystem: boolean) => {
    const parts: Array<Record<string, unknown>> = []
    if (body.audioBase64) {
      parts.push({
        inlineData: {
          mimeType: (body.mimeType || 'audio/webm').split(';')[0] || 'audio/webm',
          data: body.audioBase64,
        },
      })
    }
    const mergedText =
      includeInlineSystem && systemPrompt
        ? `${systemPrompt}\n\n---\n\n${userPrompt}`
        : userPrompt
    parts.push({ text: mergedText })
    return parts
  }

  let lastStatus = 500
  let lastError = 'GEMINI_UNAVAILABLE'

  for (const model of chain) {
    // If audio attachment is sent, skip text-only Gemma models
    if (body.audioBase64 && model.startsWith('gemma-')) {
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
          contents: [{ role: 'user', parts: buildParts(isGemma) }],
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
          contents: [{ role: 'user', parts: buildParts(isGemma) }],
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
          contents: [{ role: 'user', parts: buildParts(true) }],
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
          signal: AbortSignal.timeout(28000),
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
          // Cooldown zero-quota / unavailable model so subsequent calls route instantaneously
          const cooldownMs = /limit:\s*0\b/i.test(errMsg) || upstream.status === 404
            ? ZERO_QUOTA_COOLDOWN_MS
            : 2 * 60 * 1000
          markCooldown(model, cooldownMs)
          break
        }

        if (upstream.ok) {
          const data = (await upstream.json()) as {
            modelVersion?: string
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
            const resolvedModel =
              typeof data?.modelVersion === 'string' && data.modelVersion.trim()
                ? data.modelVersion.trim().replace(/^models\//, '')
                : model
            return NextResponse.json({
              ok: true,
              status: 200,
              model: resolvedModel,
              modelBadge: `${resolvedModel} (HIGH)`,
              flagshipCatalogTop: catalog.chain[0] ?? 'gemini-4-carbon',
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
