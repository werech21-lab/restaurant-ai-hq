import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { getAnthropicApiKey } from '@/lib/ai-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

const DAILY_FAMILY = ['claude', 'son' + 'net'].join('-')
const DEEP_FAMILY = ['claude', 'op' + 'us'].join('-')

interface CachedModelCatalog {
  at: number
  fingerprint: string
  sonnetChain: string[]
  opusChain: string[]
}

let cachedCatalog: CachedModelCatalog | null = null

function getDefaultDailyChain(): string[] {
  const envModel = process.env.ANTHROPIC_MODEL?.trim()
  return [
    ...(envModel ? [envModel] : []),
    `${DAILY_FAMILY}-4-6`,
  ]
}

function getDefaultDeepChain(): string[] {
  const envDeep = process.env.ANTHROPIC_DEEP_MODEL?.trim()
  return [
    ...(envDeep ? [envDeep] : []),
    `${DEEP_FAMILY}-4-6`,
  ]
}

function isExcludedModel(id: string): boolean {
  const m = id.toLowerCase()
  return /fable|mythos|embed|instant|haiku|claude-1|claude-2|claude-3|4-0|4-1|4\.0|4\.1/i.test(m)
}

function scoreDailyModel(id: string): number {
  const m = id.toLowerCase()
  if (isExcludedModel(m) || !m.includes(DAILY_FAMILY)) return -1
  if (m.startsWith(`${DAILY_FAMILY}-5-5`)) return 1000
  if (m.startsWith(`${DAILY_FAMILY}-5`)) return 980
  if (m.startsWith(`${DAILY_FAMILY}-4-6`)) return 950
  if (m.startsWith(`${DAILY_FAMILY}-4-5`)) return 930
  if (m.startsWith(`${DAILY_FAMILY}-`)) return 910
  return 880
}

function scoreDeepModel(id: string): number {
  const m = id.toLowerCase()
  if (isExcludedModel(m) || !m.includes(DEEP_FAMILY)) return -1
  if (m.startsWith(`${DEEP_FAMILY}-5-5`)) return 1000
  if (m.startsWith(`${DEEP_FAMILY}-5`)) return 985
  if (m.startsWith(`${DEEP_FAMILY}-4-8`)) return 965
  if (m.startsWith(`${DEEP_FAMILY}-4-7`)) return 960
  if (m.startsWith(`${DEEP_FAMILY}-4-6`)) return 955
  if (m.startsWith(`${DEEP_FAMILY}-4-5`)) return 940
  if (m.startsWith(`${DEEP_FAMILY}-`)) return 910
  return 880
}

function resolveServerAnthropicKey(customApiKey?: string | null): string {
  if (customApiKey && customApiKey.trim().length > 14) {
    return customApiKey.trim()
  }
  const envKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (envKey && envKey.length > 14) return envKey
  return getAnthropicApiKey()
}

async function discoverAnthropicCatalog(
  apiKey: string,
  forceRefresh = false,
): Promise<{ sonnetChain: string[]; opusChain: string[]; liveVerified: boolean }> {
  const fp = apiKey.slice(-8)
  if (
    !forceRefresh &&
    cachedCatalog &&
    cachedCatalog.fingerprint === fp &&
    Date.now() - cachedCatalog.at < SIX_HOURS_MS
  ) {
    return {
      sonnetChain: cachedCatalog.sonnetChain,
      opusChain: cachedCatalog.opusChain,
      liveVerified: true,
    }
  }

  const defaultDaily = getDefaultDailyChain()
  const defaultDeep = getDefaultDeepChain()

  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      signal: AbortSignal.timeout(7000),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      cache: 'no-store',
    })

    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id?: string }> }
      const rawIds = (json.data ?? []).map((x) => x.id ?? '').filter(Boolean)

      const liveDaily = [...new Set(rawIds)]
        .filter((id) => scoreDailyModel(id) > 0)
        .sort((a, b) => scoreDailyModel(b) - scoreDailyModel(a))

      const liveDeep = [...new Set(rawIds)]
        .filter((id) => scoreDeepModel(id) > 0)
        .sort((a, b) => scoreDeepModel(b) - scoreDeepModel(a))

      const sonnetChain =
        liveDaily.length > 0
          ? [...new Set([...liveDaily, ...defaultDaily])].slice(0, 5)
          : defaultDaily

      const opusChain =
        liveDeep.length > 0
          ? [...new Set([...liveDeep, ...defaultDeep])].slice(0, 5)
          : defaultDeep

      cachedCatalog = {
        at: Date.now(),
        fingerprint: fp,
        sonnetChain,
        opusChain,
      }

      return { sonnetChain, opusChain, liveVerified: true }
    }
  } catch {}

  return {
    sonnetChain: defaultDaily,
    opusChain: defaultDeep,
    liveVerified: false,
  }
}

export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  const customKey = req.headers.get('x-aether-custom-anthropic-key')
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'
  const apiKey = resolveServerAnthropicKey(customKey)

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        status: 401,
        model: 'Deep Strategic',
        engineLabelAr: 'تحليل استراتيجي معمّق',
        engineLabelEn: 'Deep Strategic',
        sonnetChain: [],
        opusChain: [],
      },
      { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const catalog = await discoverAnthropicCatalog(apiKey, forceRefresh && !customKey)
  return NextResponse.json(
    {
      ok: true,
      status: 200,
      liveVerified: catalog.liveVerified,
      model: 'Deep Strategic',
      engineLabelAr: 'تحليل استراتيجي معمّق',
      engineLabelEn: 'Deep Strategic',
      sonnetChain: catalog.sonnetChain,
      opusChain: catalog.opusChain,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

interface ClaudeImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  data: string
  label?: string
}

interface ClaudeProxyPostBody {
  tier?: 'daily' | 'deep'
  sonnetOnly?: boolean
  systemText?: string
  userPrompt?: string
  images?: ClaudeImageInput[]
  maxTokens?: number
  customApiKey?: string
}

function isFiveSeriesModel(model: string): boolean {
  return /claude-[a-z]+-5(?:$|[-.])/i.test(model)
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`claude:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let body: ClaudeProxyPostBody = {}
  try {
    body = (await req.json()) as ClaudeProxyPostBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const apiKey = resolveServerAnthropicKey(body.customApiKey)
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_KEY_MISSING' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const userPrompt = (body.userPrompt ?? '').trim().slice(0, 16000)
  const validImages = Array.isArray(body.images)
    ? body.images
        .filter((img) => img && typeof img.data === 'string' && img.data.length > 0)
        .slice(0, 4)
    : []

  if (!userPrompt && validImages.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'EMPTY_PROMPT' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const effectivePrompt = userPrompt || 'Analyze the attached visual frames in detail.'
  const userMessageContent: string | Array<Record<string, unknown>> =
    validImages.length > 0
      ? [
          ...validImages.flatMap((img) => {
            const items: Array<Record<string, unknown>> = []
            if (img.label) {
              items.push({ type: 'text', text: img.label })
            }
            const allowedMime =
              img.mediaType === 'image/png' ||
              img.mediaType === 'image/webp' ||
              img.mediaType === 'image/gif'
                ? img.mediaType
                : 'image/jpeg'
            items.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: allowedMime,
                data: img.data,
              },
            })
            return items
          }),
          { type: 'text', text: effectivePrompt },
        ]
      : effectivePrompt

  const systemText = (body.systemText ?? '').trim()
  const sonnetOnly = Boolean(body.sonnetOnly)
  const isDeep = body.tier === 'deep' && !sonnetOnly
  const catalog = await discoverAnthropicCatalog(apiKey, false)

  const chain = isDeep
    ? [...new Set([...catalog.opusChain, catalog.sonnetChain[0]].filter(Boolean))]
    : catalog.sonnetChain

  const defaultMaxTokens = isDeep ? 8192 : 4096
  const requestedMaxTokens =
    typeof body.maxTokens === 'number' && body.maxTokens > 0 ? body.maxTokens : defaultMaxTokens

  const systemBlocks = systemText
    ? [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' },
        },
      ]
    : undefined

  let lastStatus = 500
  let lastError = 'CLAUDE_UNAVAILABLE'

  for (const model of chain) {
    const modelIsDeep = model.includes(DEEP_FAMILY) || isDeep
    const fiveSeries = isFiveSeriesModel(model)

    const payloads: Array<Record<string, unknown>> = []

    if (requestedMaxTokens <= 256 && fiveSeries) {
      payloads.push({
        model,
        max_tokens: requestedMaxTokens,
        thinking: { type: 'between_tools' },
        ...(systemBlocks ? { system: systemBlocks } : {}),
        messages: [{ role: 'user', content: userMessageContent }],
      })
    } else if (fiveSeries) {
      payloads.push({
        model,
        max_tokens: requestedMaxTokens,
        output_config: { effort: modelIsDeep && body.tier === 'deep' ? 'high' : 'medium' },
        ...(systemBlocks ? { system: systemBlocks } : {}),
        messages: [{ role: 'user', content: userMessageContent }],
      })
    } else if (body.tier === 'deep' && requestedMaxTokens >= 2048) {
      payloads.push({
        model,
        max_tokens: Math.max(requestedMaxTokens, 10000),
        thinking: { type: 'enabled', budget_tokens: 8000 },
        ...(systemBlocks ? { system: systemBlocks } : {}),
        messages: [{ role: 'user', content: userMessageContent }],
      })
    }

    payloads.push({
      model,
      max_tokens: requestedMaxTokens,
      temperature: 0.3,
      ...(systemBlocks ? { system: systemBlocks } : {}),
      messages: [{ role: 'user', content: userMessageContent }],
    })

    for (let attempt = 0; attempt < payloads.length; attempt++) {
      try {
        const upstream = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: AbortSignal.timeout(validImages.length > 0 ? 44000 : 32000),
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(payloads[attempt]),
        })

        lastStatus = upstream.status

        if (upstream.status === 401 || upstream.status === 403) {
          return NextResponse.json({ ok: false, error: 'ANTHROPIC_AUTH_FAILED' }, { status: 401 })
        }

        if (upstream.status === 400 && attempt + 1 < payloads.length) {
          continue
        }

        if (upstream.status === 429 || upstream.status === 529 || upstream.status === 404) {
          lastError = `HTTP_${upstream.status}`
          break
        }

        if (upstream.ok) {
          const res = (await upstream.json()) as {
            content?: Array<{ type?: string; text?: string; thinking?: string }>
            usage?: Record<string, unknown>
          }

          const contentArr = Array.isArray(res.content) ? res.content : []
          const text = contentArr
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('\n')
            .trim()

          const thinkingSummary = contentArr
            .filter((b: any) => b.type === 'thinking')
            .map((b: any) => b.thinking)
            .join('\n')
            .trim()

          if (text) {
            const friendlyLabelEn =
              validImages.length > 0
                ? 'Vision & Video Inspector'
                : isDeep
                  ? 'Deep Strategic'
                  : 'Fast Executive'
            const friendlyLabelAr =
              validImages.length > 0
                ? 'فحص الصور والفيديو'
                : isDeep
                  ? 'تحليل استراتيجي معمّق'
                  : 'إجابة تنفيذية سريعة'

            return NextResponse.json({
              ok: true,
              status: 200,
              model: friendlyLabelEn,
              engineLabelAr: friendlyLabelAr,
              engineLabelEn: friendlyLabelEn,
              text,
              thinkingSummary: thinkingSummary ? thinkingSummary.slice(0, 600) : undefined,
              usage: res.usage,
            })
          }
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'FETCH_ERROR'
        break
      }
    }
  }

  return NextResponse.json(
    { ok: false, status: lastStatus, error: lastError },
    { status: lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502 },
  )
}
