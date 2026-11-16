import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getAnthropicApiKey, getGeminiApiKey, getOpenAIApiKey, getXaiApiKey } from '@/lib/ai-keys'
import { isAiDailyBriefEnabled } from '@/server/ai/env'
import { canonicalDecimal, guardAnswerNumbers } from '@/server/ai/number-guard'
import { probeCouncilHealth, resetCouncilHealthCache } from '@/server/ai/health'
import { runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
import type { AiRunDraft } from '@/server/ai/persist'
import type { CouncilKeys } from '@/server/ai/env'
import type { CouncilModels } from '@/server/ai/models'

const KEYS: CouncilKeys = {
  anthropic: 'test-anthropic-key-0001',
  google: 'test-google-key-00000001',
  xai: 'test-xai-key-0000000001',
}

const MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
  xai: 'grok-4',
}

const RETURNED = {
  anthropic: 'claude-sonnet-4-6-20251101',
  google: 'gemini-3.1-pro-preview-001',
  xai: 'grok-4-0709',
}

function odooAnswer(status: 'answered' | 'no_odoo_data' = 'answered') {
  const reply = status === 'answered' ? 'صافي المبيعات 10.5' : 'لا أملك بيانات من Odoo عن هذا'
  return {
    reply,
    status,
    executedQueries: [],
    verifier: { valid: status === 'answered', extractedNumbers: status === 'answered' ? [10.5] : [], unverifiedNumbers: [] },
    toolNumbers: status === 'answered' ? [10.5] : [],
    period: { from: '2026-11-15', to: '2026-11-15' },
    records:
      status === 'answered'
        ? [
            { id: 'company', name: 'company', metric: 'net_sales' },
            { id: 'fact-net', name: 'company', metric: 'net_sales' },
          ]
        : [],
    auditEntry: {
      id: 'audit-1',
      timestampIso: '2026-11-16T00:00:00.000Z',
      userSub: 'user-1',
      userRole: 'admin',
      question: 'كم صافي المبيعات؟',
      status,
      executedQueries: [],
      verifier: { valid: status === 'answered', extractedNumbers: [], unverifiedNumbers: [] },
      finalReply: reply,
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function analysisBody(provider: 'anthropic' | 'google' | 'xai', text: string): Response {
  if (provider === 'anthropic') {
    return jsonResponse({
      model: RETURNED.anthropic,
      content: [{ type: 'text', text }],
      usage: { input_tokens: 20, output_tokens: 10 },
    })
  }
  if (provider === 'google') {
    return jsonResponse({
      modelVersion: RETURNED.google,
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8 },
    })
  }
  return jsonResponse({
    model: RETURNED.xai,
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 18, completion_tokens: 6 },
  })
}

function providerOf(url: string): 'anthropic' | 'google' | 'xai' | null {
  if (url.includes('api.anthropic.com')) return 'anthropic'
  if (url.includes('generativelanguage.googleapis.com')) return 'google'
  if (url.includes('api.x.ai')) return 'xai'
  return null
}

function hang(signal: AbortSignal | undefined): Promise<Response> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      reject(error)
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

afterEach(() => {
  resetCouncilHealthCache()
})

describe('number guard', () => {
  const allowed = new Set(['10.5', '2026', '11', '15'])

  it('treats trailing zeros as the same decimal and rejects any other value', () => {
    expect(canonicalDecimal('10.50')).toBe('10.5')
    expect(canonicalDecimal('1,234.50')).toBe('1234.5')
    expect(canonicalDecimal('١٠٫٥٠')).toBe('10.5')
    expect(guardAnswerNumbers('القيمة 10.50', allowed).ok).toBe(true)
    expect(guardAnswerNumbers('القيمة ١٠٫٥', allowed).ok).toBe(true)
    expect(guardAnswerNumbers('القيمة 10.51', allowed)).toEqual({ ok: false, offending: ['10.51'] })
    expect(guardAnswerNumbers('1e3', allowed).ok).toBe(false)
  })
})

describe('feryal council', () => {
  function run(options: {
    texts?: Partial<Record<'anthropic' | 'google' | 'xai', string>>
    hang?: 'anthropic' | 'google' | 'xai'
    keys?: CouncilKeys
    timeoutMs?: number
    ask?: () => Promise<unknown>
    persist?: (rows: readonly AiRunDraft[]) => Promise<void>
    fetchImpl?: typeof fetch
  }) {
    const agreed = JSON.stringify({
      comparison: {
        subject_id: 'company',
        relation: 'best',
        object_id: null,
        metric: 'net_sales',
        cited_fact_ids: ['fact-net'],
      },
    })
    const texts = {
      anthropic: agreed,
      google: agreed,
      xai: agreed,
      ...options.texts,
    }
    let inFlight = 0
    let maxInFlight = 0
    const calls: string[] = []
    const fetchImpl: typeof fetch =
      options.fetchImpl ??
      (async (input, init) => {
        const url = String(input)
        const provider = providerOf(url)
        calls.push(url)
        if (!provider) throw new Error('unexpected host')
        if (options.hang === provider) return hang(init?.signal ?? undefined)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 20))
        inFlight -= 1
        return analysisBody(provider, texts[provider])
      })
    const saved: AiRunDraft[] = []
    const persist = options.persist ?? (async (rows: readonly AiRunDraft[]) => {
      saved.push(...rows)
    })
    const askOdoo = options.ask ?? (async () => odooAnswer())
    const pending = runFeryalCouncil(
      { question: 'كم صافي المبيعات؟', userId: 'user-1', userRole: 'admin' },
      {
        askOdoo: askOdoo as RunCouncilOptions['askOdoo'],
        fetchImpl,
        keys: options.keys ?? KEYS,
        models: MODELS,
        timeoutMs: options.timeoutMs ?? 1_000,
        persist,
      },
    )
    return { pending, saved, calls, maxInFlight: () => maxInFlight }
  }

  it('calls the three providers in parallel and stores the model id the API returned', async () => {
    const { pending, saved, maxInFlight } = run({})
    const result = await pending
    expect(maxInFlight()).toBe(3)
    expect(result.status).toBe('answered')
    expect(result.agreed.map((item) => item.modelId).sort()).toEqual(
      [RETURNED.anthropic, RETURNED.google, RETURNED.xai].sort(),
    )
    expect(result.reply).toContain('صافي المبيعات 10.5')
    expect(result.reply).toContain(RETURNED.anthropic)
    expect(result.reply).not.toMatch(/Deep Strategic/i)
    expect(saved).toHaveLength(3)
    const anthropic = saved.find((row) => row.provider === 'anthropic')
    expect(anthropic).toMatchObject({
      modelId: RETURNED.anthropic,
      status: 'ok',
      tokensIn: 20,
      tokensOut: 10,
      estCostMicroUsd: 210,
      userId: 'user-1',
    })
    expect(anthropic?.modelId).not.toBe(MODELS.anthropic)
    expect(saved.find((row) => row.provider === 'google')?.estCostMicroUsd).toBe(105)
    expect(saved.find((row) => row.provider === 'xai')?.estCostMicroUsd).toBeNull()
  })

  it('records a timeout without dropping the providers that answered', async () => {
    const { pending, saved } = run({ hang: 'anthropic', timeoutMs: 400 })
    const result = await pending
    const claude = result.participants.find((item) => item.provider === 'anthropic')
    expect(claude).toMatchObject({ status: 'error', errorCode: 'TIMEOUT', modelId: '' })
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['google', 'xai'])
    expect(saved.find((row) => row.provider === 'anthropic')?.status).toBe('error')
    expect(result.reply).not.toContain(RETURNED.anthropic)
  })

  it('rejects a model that introduces a number absent from the Odoo facts', async () => {
    const { pending } = run({ texts: { google: 'المجموع 999.9' } })
    const result = await pending
    const google = result.participants.find((item) => item.provider === 'google')
    expect(google).toMatchObject({
      status: 'guard_rejected',
      errorCode: 'GUARD_REJECTED',
      modelId: RETURNED.google,
      offendingNumbers: ['999.9'],
    })
    expect(result.reply).not.toContain('999.9')
    expect(result.reply).not.toContain('المجموع')
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'xai'])
  })

  it('rejects an excluded entity that is not in the supplied facts', async () => {
    const { pending } = run({ texts: { xai: 'أداء هايزنبرغ مع الصافي 10.5' } })
    const result = await pending
    expect(result.participants.find((item) => item.provider === 'xai')).toMatchObject({
      status: 'guard_rejected',
      errorCode: 'EXCLUDED_ENTITY',
    })
    expect(result.reply).not.toContain('هايزنبرغ')
  })

  it('merges only the guarded answers and names the models that passed', async () => {
    const { pending } = run({ texts: { xai: 'رقم مختلف 999.9' } })
    const result = await pending
    expect(result.status).toBe('answered')
    expect(result.reply).toContain('company هو الأفضل في net_sales')
    expect(result.reply).toContain('صافي المبيعات 10.5')
    expect(result.reply).not.toContain('الصافي المسجّل')
    expect(result.reply).toContain(`اجتازت الفحص: anthropic/${RETURNED.anthropic}، google/${RETURNED.google}`)
    expect(result.reply).toContain(`xai/${RETURNED.xai}: GUARD_REJECTED`)
    expect(result.agreed).toHaveLength(2)
  })

  it('returns an honest error when every model fails the guard', async () => {
    const { pending, saved } = run({
      texts: { anthropic: '999.9', google: '999.9', xai: '999.9' },
    })
    const result = await pending
    expect(result.status).toBe('council_failed')
    expect(result.agreed).toEqual([])
    expect(result.reply).toContain('تعذّر التحليل')
    expect(result.reply).toContain('صافي المبيعات 10.5')
    expect(result.reply).not.toContain('999.9')
    expect(result.reply).not.toMatch(/Deep Strategic/i)
    expect(saved.every((row) => row.status === 'guard_rejected')).toBe(true)
  })

  it('does not call providers when Odoo has no facts', async () => {
    let called = false
    const { pending, saved } = run({
      ask: async () => odooAnswer('no_odoo_data'),
      fetchImpl: async () => {
        called = true
        throw new Error('providers must not be called')
      },
    })
    const result = await pending
    expect(result.status).toBe('no_odoo_data')
    expect(result.reply).toBe('لا أملك بيانات من Odoo عن هذا')
    expect(called).toBe(false)
    expect(saved).toEqual([])
  })

  it('skips a provider whose server key is missing', async () => {
    const { pending, calls } = run({ keys: { ...KEYS, xai: '' } })
    const result = await pending
    expect(result.participants.find((item) => item.provider === 'xai')).toMatchObject({
      status: 'error',
      errorCode: 'MISSING_API_KEY',
    })
    expect(calls.some((url) => url.includes('api.x.ai'))).toBe(false)
    expect(calls).toHaveLength(2)
  })

  it('still returns the guarded reply when persistence fails', async () => {
    const { pending } = run({
      persist: async () => {
        throw new Error('disk full')
      },
    })
    const result = await pending
    expect(result.status).toBe('answered')
    expect(result.agreed).toHaveLength(3)
  })
})

describe('council health', () => {
  it('marks a provider ready only after a successful ping and caches that result', async () => {
    let calls = 0
    const fetchImpl: typeof fetch = async (input, init) => {
      calls += 1
      const url = String(input)
      expect(init?.method).toBe('GET')
      if (url.includes('api.anthropic.com')) return jsonResponse({ error: 'no' }, 401)
      return jsonResponse({ data: [] })
    }
    const first = await probeCouncilHealth({
      now: 1_000,
      keys: KEYS,
      models: MODELS,
      fetchImpl,
      force: true,
    })
    expect(first.providers.find((item) => item.provider === 'anthropic')).toMatchObject({
      ready: false,
      modelId: '',
      errorCode: 'HTTP_UNAUTHORIZED',
    })
    expect(first.providers.find((item) => item.provider === 'google')).toMatchObject({
      ready: true,
      modelId: MODELS.google,
    })
    expect(first.providers.find((item) => item.provider === 'xai')?.ready).toBe(true)
    const second = await probeCouncilHealth({ now: 1_000 + 60_000, keys: KEYS, models: MODELS, fetchImpl })
    expect(second.cached).toBe(true)
    expect(calls).toBe(3)
    await probeCouncilHealth({
      now: 1_000 + 5 * 60_000 + 1,
      keys: KEYS,
      models: MODELS,
      fetchImpl,
    })
    expect(calls).toBe(6)
  })
})

describe('ai key vault', () => {
  it('reads provider keys only from the environment', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/lib/ai-keys.ts'), 'utf8')
    expect(source).not.toMatch(/atob|fromCharCode|charCodeAt/)
    const previous = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      xai: process.env.XAI_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    }
    const restore = (name: 'ANTHROPIC_API_KEY' | 'GEMINI_API_KEY' | 'XAI_API_KEY' | 'OPENAI_API_KEY', value: string | undefined) => {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    try {
      process.env.ANTHROPIC_API_KEY = 'env-only-anthropic-test'
      process.env.GEMINI_API_KEY = 'env-only-gemini-test'
      process.env.XAI_API_KEY = 'env-only-xai-test'
      process.env.OPENAI_API_KEY = 'env-only-openai-test'
      expect(getAnthropicApiKey()).toBe('env-only-anthropic-test')
      expect(getGeminiApiKey()).toBe('env-only-gemini-test')
      expect(getXaiApiKey()).toBe('env-only-xai-test')
      expect(getOpenAIApiKey()).toBe('env-only-openai-test')
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GEMINI_API_KEY
      delete process.env.XAI_API_KEY
      delete process.env.OPENAI_API_KEY
      expect(getAnthropicApiKey()).toBe('')
      expect(getGeminiApiKey()).toBe('')
      expect(getXaiApiKey()).toBe('')
      expect(getOpenAIApiKey()).toBe('')
    } finally {
      restore('ANTHROPIC_API_KEY', previous.anthropic)
      restore('GEMINI_API_KEY', previous.gemini)
      restore('XAI_API_KEY', previous.xai)
      restore('OPENAI_API_KEY', previous.openai)
    }
  })

  it('keeps the background schedule on unless the flag explicitly turns it off', () => {
    expect(isAiDailyBriefEnabled('')).toBe(true)
    expect(isAiDailyBriefEnabled('true')).toBe(true)
    expect(isAiDailyBriefEnabled('1')).toBe(true)
    expect(isAiDailyBriefEnabled('0')).toBe(false)
    expect(isAiDailyBriefEnabled('false')).toBe(false)
    expect(isAiDailyBriefEnabled('off')).toBe(false)
  })
})
