import 'server-only'

export type ProviderId = 'anthropic' | 'google' | 'xai'

export const COUNCIL_PROVIDERS: readonly ProviderId[] = ['anthropic', 'google', 'xai']

const MIN_KEY_LENGTH = 20
const ANALYSIS_MAX_TOKENS = 800

export interface ProviderCallInput {
  provider: ProviderId
  apiKey: string
  model: string
  system: string
  user: string
  timeoutMs: number
  maxTokens?: number
  fetchImpl?: typeof fetch
}

export interface ProviderCallResult {
  provider: ProviderId
  requestedModel: string
  modelId: string
  text: string
  latencyMs: number
  tokensIn: number | null
  tokensOut: number | null
  status: 'ok' | 'error'
  errorCode: string | null
}

export interface ProviderPingResult {
  provider: ProviderId
  ready: boolean
  latencyMs: number
  errorCode: string | null
}

interface EstimatedRate {
  input: number
  output: number
}

/** Published list-price estimate in USD per million tokens. xAI is omitted until a rate is configured. */
const ESTIMATED_USD_PER_MILLION: Partial<Record<ProviderId, EstimatedRate>> = {
  anthropic: { input: 3, output: 15 },
  google: { input: 1.25, output: 10 },
}

export function estimateCostMicroUsd(
  provider: ProviderId,
  tokensIn: number | null,
  tokensOut: number | null,
): number | null {
  const rate = ESTIMATED_USD_PER_MILLION[provider]
  if (!rate || tokensIn == null || tokensOut == null) return null
  if (!Number.isFinite(tokensIn) || !Number.isFinite(tokensOut)) return null
  return Math.round(tokensIn * rate.input + tokensOut * rate.output)
}

function httpErrorCode(status: number): string {
  if (status === 401) return 'HTTP_UNAUTHORIZED'
  if (status === 403) return 'HTTP_FORBIDDEN'
  if (status === 408 || status === 504) return 'TIMEOUT'
  if (status === 429) return 'HTTP_RATE_LIMIT'
  if (status >= 500) return 'HTTP_SERVER'
  return 'HTTP_CLIENT'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function integerField(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

function failure(
  input: ProviderCallInput,
  latencyMs: number,
  errorCode: string,
): ProviderCallResult {
  return {
    provider: input.provider,
    requestedModel: input.model,
    modelId: '',
    text: '',
    latencyMs,
    tokensIn: null,
    tokensOut: null,
    status: 'error',
    errorCode,
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function tokenBudget(input: ProviderCallInput): number {
  return input.maxTokens && input.maxTokens > 0 ? input.maxTokens : ANALYSIS_MAX_TOKENS
}

function anthropicBody(input: ProviderCallInput): string {
  return JSON.stringify({
    model: input.model,
    max_tokens: tokenBudget(input),
    system: input.system,
    messages: [{ role: 'user', content: input.user }],
  })
}

function geminiBody(input: ProviderCallInput): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: input.system }] },
    contents: [{ role: 'user', parts: [{ text: input.user }] }],
    generationConfig: { maxOutputTokens: tokenBudget(input) },
  })
}

function xaiBody(input: ProviderCallInput): string {
  return JSON.stringify({
    model: input.model,
    max_tokens: tokenBudget(input),
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
  })
}

function requestFor(input: ProviderCallInput, signal: AbortSignal): { url: string; init: RequestInit } {
  if (input.provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      init: {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': input.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: anthropicBody(input),
      },
    }
  }
  if (input.provider === 'google') {
    const model = encodeURIComponent(input.model)
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      init: {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': input.apiKey,
        },
        body: geminiBody(input),
      },
    }
  }
  return {
    url: 'https://api.x.ai/v1/chat/completions',
    init: {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.apiKey}`,
      },
      body: xaiBody(input),
    },
  }
}

function pingRequest(provider: ProviderId, apiKey: string, signal: AbortSignal): { url: string; init: RequestInit } {
  if (provider === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/models?limit=1',
      init: {
        method: 'GET',
        signal,
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      },
    }
  }
  if (provider === 'google') {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
      init: {
        method: 'GET',
        signal,
        headers: { 'x-goog-api-key': apiKey },
      },
    }
  }
  return {
    url: 'https://api.x.ai/v1/models',
    init: {
      method: 'GET',
      signal,
      headers: { authorization: `Bearer ${apiKey}` },
    },
  }
}

function parseAnthropic(payload: unknown): { modelId: string; text: string; tokensIn: number | null; tokensOut: number | null } | null {
  const body = asRecord(payload)
  if (!body || typeof body.model !== 'string' || !body.model.trim()) return null
  const content = Array.isArray(body.content) ? body.content : []
  const text = content
    .map((part) => {
      const record = asRecord(part)
      if (!record || record.type !== 'text' || typeof record.text !== 'string') return ''
      return record.text
    })
    .join('')
    .trim()
  const usage = asRecord(body.usage)
  return {
    modelId: body.model.trim(),
    text,
    tokensIn: integerField(usage?.input_tokens),
    tokensOut: integerField(usage?.output_tokens),
  }
}

function parseGemini(payload: unknown): { modelId: string; text: string; tokensIn: number | null; tokensOut: number | null } | null {
  const body = asRecord(payload)
  if (!body) return null
  const modelId =
    (typeof body.modelVersion === 'string' && body.modelVersion.trim()) ||
    (typeof body.model === 'string' && body.model.trim()) ||
    ''
  if (!modelId) return null
  const candidates = Array.isArray(body.candidates) ? body.candidates : []
  const first = asRecord(candidates[0])
  const content = asRecord(first?.content)
  const parts = Array.isArray(content?.parts) ? content.parts : []
  const text = parts
    .map((part) => {
      const record = asRecord(part)
      return record && typeof record.text === 'string' ? record.text : ''
    })
    .join('')
    .trim()
  const usage = asRecord(body.usageMetadata)
  return {
    modelId,
    text,
    tokensIn: integerField(usage?.promptTokenCount),
    tokensOut: integerField(usage?.candidatesTokenCount),
  }
}

function parseXai(payload: unknown): { modelId: string; text: string; tokensIn: number | null; tokensOut: number | null } | null {
  const body = asRecord(payload)
  if (!body || typeof body.model !== 'string' || !body.model.trim()) return null
  const choices = Array.isArray(body.choices) ? body.choices : []
  const first = asRecord(choices[0])
  const message = asRecord(first?.message)
  const text = typeof message?.content === 'string' ? message.content.trim() : ''
  const usage = asRecord(body.usage)
  return {
    modelId: body.model.trim(),
    text,
    tokensIn: integerField(usage?.prompt_tokens),
    tokensOut: integerField(usage?.completion_tokens),
  }
}

function parseProvider(provider: ProviderId, payload: unknown) {
  if (provider === 'anthropic') return parseAnthropic(payload)
  if (provider === 'google') return parseGemini(payload)
  return parseXai(payload)
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return name === 'AbortError' || name === 'TimeoutError'
}

export async function callProvider(input: ProviderCallInput): Promise<ProviderCallResult> {
  const started = Date.now()
  if (input.apiKey.trim().length < MIN_KEY_LENGTH) {
    return failure(input, 0, 'MISSING_API_KEY')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    const request = requestFor(input, controller.signal)
    const response = await (input.fetchImpl ?? fetch)(request.url, request.init)
    if (!response.ok) return failure(input, Date.now() - started, httpErrorCode(response.status))
    const parsed = parseProvider(input.provider, await readJson(response))
    if (!parsed) return failure(input, Date.now() - started, 'MISSING_MODEL_ID')
    if (!parsed.text) return failure(input, Date.now() - started, 'EMPTY_ANSWER')
    return {
      provider: input.provider,
      requestedModel: input.model,
      modelId: parsed.modelId,
      text: parsed.text,
      latencyMs: Date.now() - started,
      tokensIn: parsed.tokensIn,
      tokensOut: parsed.tokensOut,
      status: 'ok',
      errorCode: null,
    }
  } catch (error) {
    return failure(input, Date.now() - started, isAbortError(error) ? 'TIMEOUT' : 'NETWORK')
  } finally {
    clearTimeout(timer)
  }
}

export async function pingProvider(input: {
  provider: ProviderId
  apiKey: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}): Promise<ProviderPingResult> {
  const started = Date.now()
  if (input.apiKey.trim().length < MIN_KEY_LENGTH) {
    return { provider: input.provider, ready: false, latencyMs: 0, errorCode: 'MISSING_API_KEY' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    const request = pingRequest(input.provider, input.apiKey, controller.signal)
    const response = await (input.fetchImpl ?? fetch)(request.url, request.init)
    return {
      provider: input.provider,
      ready: response.ok,
      latencyMs: Date.now() - started,
      errorCode: response.ok ? null : httpErrorCode(response.status),
    }
  } catch (error) {
    return {
      provider: input.provider,
      ready: false,
      latencyMs: Date.now() - started,
      errorCode: isAbortError(error) ? 'TIMEOUT' : 'NETWORK',
    }
  } finally {
    clearTimeout(timer)
  }
}
