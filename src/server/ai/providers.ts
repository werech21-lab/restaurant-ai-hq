import 'server-only'
import { createHash } from 'node:crypto'
import { logger } from '@/lib/logger'
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_XAI_MODEL,
} from './models'

export { DEFAULT_GEMINI_MODEL }

export type ProviderId = 'anthropic' | 'google' | 'xai'

export const COUNCIL_PROVIDERS: readonly ProviderId[] = ['anthropic', 'google', 'xai']
export const MAX_PROVIDER_TELEMETRY_ENTRIES = 128

const MIN_KEY_LENGTH = 20
const COUNCIL_QUESTION_PREFIX = 'Question:\n'
const COUNCIL_FACTS_DELIMITER = '\n\nOdoo facts JSON:\n'
export const ANALYSIS_MAX_TOKENS = 800
const MAX_PROVIDER_OUTPUT_TOKENS = 4_096

export const PROVIDER_COOLDOWN_MS = 45_000
export const REPEATED_TIMEOUT_THRESHOLD = 2

export interface ProviderCallInput {
  provider: ProviderId
  apiKey: string
  model: string
  system: string
  user: string
  timeoutMs: number
  maxTokens?: number
  fetchImpl?: typeof fetch
  sleepImpl?: (ms: number) => Promise<void>
  enableCooldown?: boolean
  nowMs?: number
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
  httpStatus?: number | null
  errorSummary?: string | null
}

export interface ProviderPingResult {
  provider: ProviderId
  ready: boolean
  latencyMs: number
  errorCode: string | null
}

export interface ProviderHealthSnapshot {
  provider: ProviderId
  inCooldown: boolean
  cooldownUntilMs: number | null
  consecutiveTimeouts: number
  lastErrorCode: string | null
  lastStatusAtMs: number | null
}

export interface ProviderAttemptTelemetry {
  provider: ProviderId
  requestedModel: string
  modelId: string
  text: string
  factsJson: string | null
  questionHash: string | null
  status: 'ok' | 'error'
  errorCode: string | null
  httpStatus: number | null
  errorSummary: string | null
  latencyMs: number
  recordedAtMs: number
}

interface ProviderCooldownEntry {
  cooldownUntilMs: number | null
  consecutiveTimeouts: number
  lastErrorCode: string | null
  lastStatusAtMs: number | null
}

type GlobalWithProviderCooldown = typeof globalThis & {
  __aetherAiProviderCooldowns?: Partial<Record<ProviderId, ProviderCooldownEntry>>
  __aetherAiProviderTelemetry?: ProviderAttemptTelemetry[]
}

function telemetryStore(): ProviderAttemptTelemetry[] {
  const g = globalThis as GlobalWithProviderCooldown
  if (!g.__aetherAiProviderTelemetry) {
    g.__aetherAiProviderTelemetry = []
  }
  return g.__aetherAiProviderTelemetry
}

export function resetProviderTelemetry(): void {
  const g = globalThis as GlobalWithProviderCooldown
  g.__aetherAiProviderTelemetry = []
}

export function listProviderAttemptTelemetry(): readonly ProviderAttemptTelemetry[] {
  return [...telemetryStore()]
}

export function getProviderAttemptTelemetry(
  questionHash: string,
  provider: string,
): ProviderAttemptTelemetry | null {
  const targetHash = questionHash.trim()
  const targetProvider = provider.trim()
  if (!targetHash || !targetProvider) return null
  const store = telemetryStore()
  for (let index = store.length - 1; index >= 0; index -= 1) {
    const entry = store[index]
    if (entry && entry.questionHash === targetHash && entry.provider === targetProvider) {
      return entry
    }
  }
  return null
}

function resolveRequestedModel(provider: ProviderId, model: string): string {
  const trimmed = model.trim()
  if (trimmed.length > 0) return trimmed
  if (provider === 'anthropic') return DEFAULT_ANTHROPIC_MODEL
  if (provider === 'google') return DEFAULT_GEMINI_MODEL
  return DEFAULT_XAI_MODEL
}

function extractPromptTelemetryMetadata(userPrompt: string): {
  questionHash: string | null
  factsJson: string | null
} {
  if (userPrompt.startsWith(COUNCIL_QUESTION_PREFIX)) {
    const delimiterIdx = userPrompt.lastIndexOf(COUNCIL_FACTS_DELIMITER)
    if (delimiterIdx >= COUNCIL_QUESTION_PREFIX.length) {
      const question = userPrompt.slice(COUNCIL_QUESTION_PREFIX.length, delimiterIdx).trim()
      const factsRaw = userPrompt.slice(delimiterIdx + COUNCIL_FACTS_DELIMITER.length).trim()
      const questionHash = createHash('sha256').update(question).digest('hex')
      return {
        questionHash,
        factsJson: factsRaw,
      }
    }
  }
  if (userPrompt.startsWith('{"periods":')) {
    try {
      const parsed = JSON.parse(userPrompt) as {
        periods?: { yesterday?: unknown; prior?: unknown }
      }
      const yesterday =
        typeof parsed.periods?.yesterday === 'string' ? parsed.periods.yesterday : ''
      const prior = typeof parsed.periods?.prior === 'string' ? parsed.periods.prior : ''
      if (yesterday && prior) {
        const questionHash = createHash('sha256')
          .update(`background:${yesterday}:${prior}`)
          .digest('hex')
        return { questionHash, factsJson: null }
      }
    } catch {
      return { questionHash: null, factsJson: null }
    }
  }
  return { questionHash: null, factsJson: null }
}

const MAX_ERROR_SUMMARY_LENGTH = 200

export function sanitizeProviderErrorSummary(rawBody: string): string | null {
  const trimmed = rawBody.trim()
  if (!trimmed) return null

  let extracted = trimmed
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      const root = asRecord(parsed)
      const nestedErr = asRecord(root?.error)
      if (nestedErr) {
        const msg =
          typeof nestedErr.message === 'string' && nestedErr.message.trim()
            ? nestedErr.message.trim()
            : ''
        const statusOrType =
          typeof nestedErr.status === 'string' && nestedErr.status.trim()
            ? nestedErr.status.trim()
            : typeof nestedErr.type === 'string' && nestedErr.type.trim()
              ? nestedErr.type.trim()
              : ''
        if (msg && statusOrType && !msg.toLowerCase().includes(statusOrType.toLowerCase())) {
          extracted = `${statusOrType}: ${msg}`
        } else if (msg) {
          extracted = msg
        } else if (statusOrType) {
          extracted = statusOrType
        }
      } else if (typeof root?.error === 'string' && root.error.trim()) {
        extracted = root.error.trim()
      } else if (typeof root?.message === 'string' && root.message.trim()) {
        extracted = root.message.trim()
      }
    } catch {
      extracted = trimmed
    }
  }

  const redacted = extracted
    .replace(/\bBearer\s+[^\s,;)"'\]]+/gi, '[redacted-token]')
    .replace(/\b(?:x-api-key|x-goog-api-key)\s*[:=]\s*[^\s,;)"'\]]+/gi, '[redacted-header]')
    .replace(/\b(?:api[_-]?key|key|token|secret|password|passwd|pwd)\s*[:=]\s*[^\s,&;)"'\]]+/gi, '[redacted-secret]')
    .replace(/\b(?:sk-ant-|sk-|AIza|xai-)[A-Za-z0-9_-]{8,}/g, '[redacted-key]')
    .replace(/\bpostgres(?:ql)?:\/\/[^\s'")\],;]+/gi, '[redacted-db-url]')
    .replace(/\b[A-Za-z0-9._%+-]+:[^\s@'")\],;]+@[^\s'")\],;]+/g, '[redacted-credentials]')
    .replace(/\s+/g, ' ')
    .trim()

  if (!redacted) return null
  return redacted.length > MAX_ERROR_SUMMARY_LENGTH
    ? `${redacted.slice(0, MAX_ERROR_SUMMARY_LENGTH - 3)}...`
    : redacted
}

function logProviderAttempt(input: ProviderCallInput, result: ProviderCallResult): void {
  const requestedModel = resolveRequestedModel(input.provider, input.model)
  const effectiveModelId = result.modelId.trim() || requestedModel
  const httpStatus = typeof result.httpStatus === 'number' ? result.httpStatus : null
  const errorSummary =
    typeof result.errorSummary === 'string' && result.errorSummary.trim()
      ? result.errorSummary.trim()
      : null
  const fields = {
    provider: input.provider,
    requestedModel,
    modelId: effectiveModelId,
    status: result.status,
    errorCode: result.errorCode,
    ...(httpStatus !== null ? { httpStatus } : {}),
    ...(errorSummary !== null ? { errorSummary } : {}),
    latencyMs: result.latencyMs,
  }
  if (result.status === 'ok') {
    logger.info('ai_provider_attempt', fields)
    return
  }
  logger.warn('ai_provider_attempt', fields)
}

function recordProviderTelemetry(input: ProviderCallInput, result: ProviderCallResult): void {
  const requestedModel = resolveRequestedModel(input.provider, input.model)
  const { questionHash, factsJson } = extractPromptTelemetryMetadata(input.user)
  const httpStatus = typeof result.httpStatus === 'number' ? result.httpStatus : null
  const errorSummary =
    typeof result.errorSummary === 'string' && result.errorSummary.trim()
      ? result.errorSummary.trim()
      : null
  const store = telemetryStore()
  store.push({
    provider: input.provider,
    requestedModel,
    modelId: result.modelId,
    text: result.text,
    factsJson,
    questionHash,
    status: result.status,
    errorCode: result.errorCode,
    httpStatus,
    errorSummary,
    latencyMs: result.latencyMs,
    recordedAtMs: input.nowMs ?? Date.now(),
  })
  if (store.length > MAX_PROVIDER_TELEMETRY_ENTRIES) {
    store.splice(0, store.length - MAX_PROVIDER_TELEMETRY_ENTRIES)
  }
}

function finalizeProviderCall(
  input: ProviderCallInput,
  result: ProviderCallResult,
): ProviderCallResult {
  logProviderAttempt(input, result)
  recordProviderTelemetry(input, result)
  return result
}

function cooldownStore(): Partial<Record<ProviderId, ProviderCooldownEntry>> {
  const g = globalThis as GlobalWithProviderCooldown
  if (!g.__aetherAiProviderCooldowns) {
    g.__aetherAiProviderCooldowns = {}
  }
  return g.__aetherAiProviderCooldowns
}

function getOrCreateEntry(provider: ProviderId): ProviderCooldownEntry {
  const store = cooldownStore()
  const existing = store[provider]
  if (existing) return existing
  const created: ProviderCooldownEntry = {
    cooldownUntilMs: null,
    consecutiveTimeouts: 0,
    lastErrorCode: null,
    lastStatusAtMs: null,
  }
  store[provider] = created
  return created
}

export function resetProviderCooldowns(): void {
  const g = globalThis as GlobalWithProviderCooldown
  g.__aetherAiProviderCooldowns = {}
}

export function isProviderInCooldown(provider: ProviderId, nowMs = Date.now()): boolean {
  const entry = cooldownStore()[provider]
  if (!entry || entry.cooldownUntilMs === null) return false
  if (nowMs >= entry.cooldownUntilMs) {
    entry.cooldownUntilMs = null
    return false
  }
  return true
}

export function getProviderCooldownSnapshot(
  nowMs = Date.now(),
): Record<ProviderId, ProviderHealthSnapshot> {
  const out = {} as Record<ProviderId, ProviderHealthSnapshot>
  for (const provider of COUNCIL_PROVIDERS) {
    const entry = cooldownStore()[provider]
    const activeCooldown =
      entry?.cooldownUntilMs != null && nowMs < entry.cooldownUntilMs ? entry.cooldownUntilMs : null
    out[provider] = {
      provider,
      inCooldown: activeCooldown !== null,
      cooldownUntilMs: activeCooldown,
      consecutiveTimeouts: entry?.consecutiveTimeouts ?? 0,
      lastErrorCode: entry?.lastErrorCode ?? null,
      lastStatusAtMs: entry?.lastStatusAtMs ?? null,
    }
  }
  return out
}

function recordProviderOutcome(
  provider: ProviderId,
  status: 'ok' | 'error',
  errorCode: string | null,
  nowMs: number,
  cooldownMs = PROVIDER_COOLDOWN_MS,
): void {
  const entry = getOrCreateEntry(provider)
  entry.lastStatusAtMs = nowMs
  if (status === 'ok') {
    entry.consecutiveTimeouts = 0
    entry.cooldownUntilMs = null
    entry.lastErrorCode = null
    return
  }

  entry.lastErrorCode = errorCode
  if (errorCode === 'HTTP_RATE_LIMIT') {
    entry.cooldownUntilMs = nowMs + cooldownMs
    return
  }
  if (errorCode === 'TIMEOUT') {
    entry.consecutiveTimeouts += 1
    if (entry.consecutiveTimeouts >= REPEATED_TIMEOUT_THRESHOLD) {
      entry.cooldownUntilMs = nowMs + cooldownMs
    }
  }
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
  if (status === 429 || status === 529) return 'HTTP_RATE_LIMIT'
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
    requestedModel: resolveRequestedModel(input.provider, input.model),
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
  if (typeof input.maxTokens === 'number' && Number.isFinite(input.maxTokens) && input.maxTokens > 0) {
    return Math.min(MAX_PROVIDER_OUTPUT_TOKENS, Math.round(input.maxTokens))
  }
  return ANALYSIS_MAX_TOKENS
}

function anthropicBody(input: ProviderCallInput): string {
  return JSON.stringify({
    model: resolveRequestedModel('anthropic', input.model),
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
    model: resolveRequestedModel('xai', input.model),
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
    const model = encodeURIComponent(resolveRequestedModel('google', input.model))
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
      if (!record || record.thought === true || typeof record.text !== 'string') return ''
      return record.text
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

export const GOOGLE_RATE_LIMIT_ATTEMPTS = 3
const GOOGLE_RATE_LIMIT_BACKOFF_MS = [300, 800]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get('retry-after')
  if (!raw) return null
  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds < 0) return null
  return Math.min(1_500, Math.round(seconds * 1000))
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  return name === 'AbortError' || name === 'TimeoutError'
}

async function callProviderOnce(input: ProviderCallInput, timeoutMs: number): Promise<ProviderCallResult & { retryAfterMs: number | null }> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const request = requestFor({ ...input, timeoutMs }, controller.signal)
    const response = await (input.fetchImpl ?? fetch)(request.url, request.init)
    if (!response.ok) {
      const rawErrorBody =
        typeof response.text === 'function' ? await response.text().catch(() => '') : ''
      const errorSummary = sanitizeProviderErrorSummary(rawErrorBody)
      return {
        ...failure(input, Date.now() - started, httpErrorCode(response.status)),
        httpStatus: response.status,
        errorSummary,
        retryAfterMs: response.status === 429 || response.status === 529 ? retryAfterMs(response) : null,
      }
    }
    const parsed = parseProvider(input.provider, await readJson(response))
    if (!parsed) return { ...failure(input, Date.now() - started, 'MISSING_MODEL_ID'), retryAfterMs: null }
    if (!parsed.text) return { ...failure(input, Date.now() - started, 'EMPTY_ANSWER'), retryAfterMs: null }
    return {
      provider: input.provider,
      requestedModel: resolveRequestedModel(input.provider, input.model),
      modelId: parsed.modelId,
      text: parsed.text,
      latencyMs: Date.now() - started,
      tokensIn: parsed.tokensIn,
      tokensOut: parsed.tokensOut,
      status: 'ok',
      errorCode: null,
      retryAfterMs: null,
    }
  } catch (error) {
    const aborted = isAbortError(error)
    const errorSummary = aborted
      ? null
      : sanitizeProviderErrorSummary(error instanceof Error ? error.message : '')
    return {
      ...failure(input, Date.now() - started, aborted ? 'TIMEOUT' : 'NETWORK'),
      ...(errorSummary ? { errorSummary } : {}),
      retryAfterMs: null,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function callProvider(input: ProviderCallInput): Promise<ProviderCallResult> {
  const started = Date.now()
  const requestedModel = resolveRequestedModel(input.provider, input.model)
  if (input.apiKey.trim().length < MIN_KEY_LENGTH) {
    return finalizeProviderCall(input, failure(input, 0, 'MISSING_API_KEY'))
  }

  // Apply global cooldown automatically on live network calls (`fetchImpl === undefined`) or when
  // explicitly enabled, while keeping injected `fetchImpl` unit tests isolated and deterministic.
  const useCooldown = input.enableCooldown ?? (input.fetchImpl === undefined)
  const checkTimeMs = input.nowMs ?? started
  if (useCooldown && isProviderInCooldown(input.provider, checkTimeMs)) {
    const entry = cooldownStore()[input.provider]
    return finalizeProviderCall(
      input,
      failure(input, 0, entry?.lastErrorCode ?? 'PROVIDER_COOLDOWN'),
    )
  }

  const deadline = Date.now() + input.timeoutMs
  const attempts = input.provider === 'google' ? GOOGLE_RATE_LIMIT_ATTEMPTS : 1
  let last: ProviderCallResult | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const remaining = deadline - Date.now()
    if (remaining < 200) {
      const timedOutResult = last
        ? { ...last, latencyMs: Date.now() - started }
        : failure(input, Date.now() - started, 'TIMEOUT')
      if (useCooldown) {
        recordProviderOutcome(
          input.provider,
          timedOutResult.status,
          timedOutResult.errorCode,
          input.nowMs ?? Date.now(),
        )
      }
      return finalizeProviderCall(input, timedOutResult)
    }

    const once = await callProviderOnce(input, remaining)
    last = { ...once, requestedModel }
    const retry =
      input.provider === 'google' && once.errorCode === 'HTTP_RATE_LIMIT' && attempt < attempts - 1
    if (!retry) {
      const finalResult: ProviderCallResult = {
        provider: once.provider,
        requestedModel,
        modelId: once.modelId,
        text: once.text,
        latencyMs: Date.now() - started,
        tokensIn: once.tokensIn,
        tokensOut: once.tokensOut,
        status: once.status,
        errorCode: once.errorCode,
        ...(once.httpStatus != null ? { httpStatus: once.httpStatus } : {}),
        ...(once.errorSummary ? { errorSummary: once.errorSummary } : {}),
      }
      if (useCooldown) {
        recordProviderOutcome(
          input.provider,
          finalResult.status,
          finalResult.errorCode,
          input.nowMs ?? Date.now(),
        )
      }
      return finalizeProviderCall(input, finalResult)
    }

    const wait = once.retryAfterMs ?? GOOGLE_RATE_LIMIT_BACKOFF_MS[attempt] ?? 800
    const room = deadline - Date.now() - 200
    if (room < wait) {
      const exhaustedResult: ProviderCallResult = {
        provider: once.provider,
        requestedModel,
        modelId: once.modelId,
        text: once.text,
        latencyMs: Date.now() - started,
        tokensIn: once.tokensIn,
        tokensOut: once.tokensOut,
        status: once.status,
        errorCode: once.errorCode,
        ...(once.httpStatus != null ? { httpStatus: once.httpStatus } : {}),
        ...(once.errorSummary ? { errorSummary: once.errorSummary } : {}),
      }
      if (useCooldown) {
        recordProviderOutcome(
          input.provider,
          exhaustedResult.status,
          exhaustedResult.errorCode,
          input.nowMs ?? Date.now(),
        )
      }
      return finalizeProviderCall(input, exhaustedResult)
    }
    logProviderAttempt(input, once)
    await (input.sleepImpl ?? delay)(wait)
  }

  const finalFallback = last
    ? { ...last, latencyMs: Date.now() - started }
    : failure(input, Date.now() - started, 'HTTP_RATE_LIMIT')
  if (useCooldown) {
    recordProviderOutcome(
      input.provider,
      finalFallback.status,
      finalFallback.errorCode,
      input.nowMs ?? Date.now(),
    )
  }
  return finalizeProviderCall(input, finalFallback)
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
