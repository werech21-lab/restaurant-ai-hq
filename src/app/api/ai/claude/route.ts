import { NextRequest, NextResponse } from 'next/server'
import { getAnthropicApiKey } from '@/lib/ai-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

interface CachedModelCatalog {
  at: number
  fingerprint: string
  sonnetChain: string[]
  opusChain: string[]
}

let cachedCatalog: CachedModelCatalog | null = null

const DEFAULT_SONNET_CHAIN = ['claude-sonnet-5-5', 'claude-sonnet-5', 'claude-sonnet-4-6']
const DEFAULT_OPUS_CHAIN = [
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
]

function isExcludedModel(id: string): boolean {
  const m = id.toLowerCase()
  return /fable|mythos|embed|instant|haiku|claude-1|claude-2|claude-3|4-0|4-1|4\.0|4\.1/i.test(m)
}

function scoreClaudeSonnet(id: string): number {
  const m = id.toLowerCase()
  if (isExcludedModel(m) || !m.includes('sonnet')) return -1
  if (m.startsWith('claude-sonnet-5-5')) return 1000
  if (m.startsWith('claude-sonnet-5')) return 980
  if (m.startsWith('claude-sonnet-4-6')) return 950
  if (m.startsWith('claude-sonnet-4-5')) return 930
  if (m.startsWith('claude-sonnet-')) return 910
  return 880
}

function scoreClaudeOpus(id: string): number {
  const m = id.toLowerCase()
  if (isExcludedModel(m) || !m.includes('opus')) return -1
  if (m.startsWith('claude-opus-5-5')) return 1000
  if (m.startsWith('claude-opus-5')) return 985
  if (m.startsWith('claude-opus-4-8')) return 965
  if (m.startsWith('claude-opus-4-7')) return 960
  if (m.startsWith('claude-opus-4-6')) return 955
  if (m.startsWith('claude-opus-4-5')) return 940
  if (m.startsWith('claude-opus-')) return 910
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

      const liveSonnets = [...new Set(rawIds)]
        .filter((id) => scoreClaudeSonnet(id) > 0)
        .sort((a, b) => scoreClaudeSonnet(b) - scoreClaudeSonnet(a))

      const liveOpuses = [...new Set(rawIds)]
        .filter((id) => scoreClaudeOpus(id) > 0)
        .sort((a, b) => scoreClaudeOpus(b) - scoreClaudeOpus(a))

      const sonnetChain =
        liveSonnets.length > 0
          ? [...new Set([...liveSonnets, ...DEFAULT_SONNET_CHAIN])].slice(0, 5)
          : DEFAULT_SONNET_CHAIN

      const opusChain =
        liveOpuses.length > 0
          ? [...new Set([...liveOpuses, ...DEFAULT_OPUS_CHAIN])].slice(0, 5)
          : DEFAULT_OPUS_CHAIN

      cachedCatalog = {
        at: Date.now(),
        fingerprint: fp,
        sonnetChain,
        opusChain,
      }

      return { sonnetChain, opusChain, liveVerified: true }
    }
  } catch {
    // Graceful fallback to verified 5.5 -> 4.6 chains
  }

  return {
    sonnetChain: DEFAULT_SONNET_CHAIN,
    opusChain: DEFAULT_OPUS_CHAIN,
    liveVerified: false,
  }
}

export async function GET(req: NextRequest) {
  const customKey = req.headers.get('x-aether-custom-anthropic-key')
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'
  const apiKey = resolveServerAnthropicKey(customKey)

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        status: 401,
        sonnetModel: DEFAULT_SONNET_CHAIN[0],
        opusModel: DEFAULT_OPUS_CHAIN[0],
        sonnetChain: DEFAULT_SONNET_CHAIN,
        opusChain: DEFAULT_OPUS_CHAIN,
      },
      { status: 200 },
    )
  }

  const catalog = await discoverAnthropicCatalog(apiKey, forceRefresh)
  return NextResponse.json({
    ok: true,
    status: 200,
    liveVerified: catalog.liveVerified,
    sonnetModel: catalog.sonnetChain[0],
    opusModel: catalog.opusChain[0],
    sonnetChain: catalog.sonnetChain,
    opusChain: catalog.opusChain,
  })
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
  let body: ClaudeProxyPostBody = {}
  try {
    body = (await req.json()) as ClaudeProxyPostBody
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 })
  }

  const apiKey = resolveServerAnthropicKey(body.customApiKey)
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_KEY_MISSING' }, { status: 401 })
  }

  const userPrompt = (body.userPrompt ?? '').trim()
  const validImages = Array.isArray(body.images)
    ? body.images
        .filter((img) => img && typeof img.data === 'string' && img.data.length > 0)
        .slice(0, 12)
    : []

  if (!userPrompt && validImages.length === 0) {
    return NextResponse.json({ ok: false, error: 'EMPTY_PROMPT' }, { status: 400 })
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

  // Smart Dual-Tier Chain:
  // - Daily / Economy (`sonnetOnly` or `tier !== 'deep'`): newest enabled Claude Sonnet (`max_tokens: 4096`)
  // - Executive Deep Study (`tier === 'deep'`): newest enabled Claude Opus (`max_tokens: 8192`), with Sonnet safety net at tail
  const chain = isDeep
    ? [...new Set([...catalog.opusChain, catalog.sonnetChain[0]])]
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
    const modelIsDeepOpus = model.includes('opus') || isDeep
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
      // 5.x Cross-Version Adaptive Effort (`high` for Deep Study, `medium` for Daily Speed & Economy)
      payloads.push({
        model,
        max_tokens: requestedMaxTokens,
        output_config: { effort: modelIsDeepOpus && body.tier === 'deep' ? 'high' : 'medium' },
        ...(systemBlocks ? { system: systemBlocks } : {}),
        messages: [{ role: 'user', content: userMessageContent }],
      })
    } else if (body.tier === 'deep' && requestedMaxTokens >= 2048) {
      // 4.x Deep Extended Thinking (`budget_tokens: 8000`)
      payloads.push({
        model,
        max_tokens: Math.max(requestedMaxTokens, 10000),
        thinking: { type: 'enabled', budget_tokens: 8000 },
        ...(systemBlocks ? { system: systemBlocks } : {}),
        messages: [{ role: 'user', content: userMessageContent }],
      })
    }

    // Universal clean fallback payload without optional thinking / output_config fields (auto-retried on HTTP 400)
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
          // Retry cleanly without optional thinking / effort fields
          continue
        }

        if (upstream.status === 429 || upstream.status === 529 || upstream.status === 404) {
          lastError = `HTTP_${upstream.status}`
          break
        }

        if (upstream.ok) {
          const res = (await upstream.json()) as {
            model?: string
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
            const resolvedModel =
              typeof res.model === 'string' && res.model.trim() ? res.model.trim() : model
            const tierUsed: 'sonnet' | 'opus' = resolvedModel.includes('opus') ? 'opus' : 'sonnet'
            return NextResponse.json({
              ok: true,
              status: 200,
              model: resolvedModel,
              tierUsed,
              text,
              thinkingSummary: thinkingSummary ? thinkingSummary.slice(0, 600) : undefined,
              usage: res.usage,
              sonnetModel: catalog.sonnetChain[0],
              opusModel: catalog.opusChain[0],
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
