import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getAnthropicApiKey, getGeminiApiKey, getOpenAIApiKey, getXaiApiKey } from '@/lib/ai-keys'
import { isAiDailyBriefEnabled } from '@/server/ai/env'
import { canonicalDecimal, guardAnswerNumbers } from '@/server/ai/number-guard'
import { probeCouncilHealth, resetCouncilHealthCache } from '@/server/ai/health'
import { COUNCIL_MODEL_FALLBACK_NOTE, runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
import type { FeryalContextPack } from '@/lib/feryal-context-types'
import type { AiRunDraft } from '@/server/ai/persist'
import type { CouncilKeys } from '@/server/ai/env'
import type { CouncilModels } from '@/server/ai/models'

const KEYS: CouncilKeys = {
  anthropic: 'test-anthropic-key-0001',
  google: 'test-google-key-00000001',
  xai: 'test-grok-key-0000000001',
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

function makeCouncilPack(): FeryalContextPack {
  const src = {
    model: 'pos.order',
    period: { from: '2026-11-15', to: '2026-11-15' },
    lastSyncAt: '2026-11-16T00:00:00.000Z',
  }
  const unavail = (model: string) => ({
    status: 'unavailable' as const,
    reason: 'not_loaded',
    source: { ...src, model },
  })
  return {
    generatedAtIso: '2026-11-16T00:00:00.000Z',
    connected: true,
    period: { from: '2026-11-15', to: '2026-11-15', days: 1, labelAr: '2026-11-15', labelEn: '2026-11-15' },
    previousPeriod: { from: '2026-11-14', to: '2026-11-14' },
    elapsedDaysInMonth: 15,
    totalDaysInMonth: 30,
    companyTotals: {
      status: 'ok',
      source: src,
      data: { netSalesKwd: 14.5, orders: 14, aovKwd: 1.036, mappedBranchesNetKwd: 14.5, unattributedSalesKwd: 0 },
    },
    branches: {
      status: 'ok',
      source: src,
      data: {
        items: [
          { branchId: 'avenues', nameAr: 'الأفنيوز', nameEn: 'Avenues', netKwd: 10.5, orders: 10, aovKwd: 1.05, group: 'restaurant' },
          { branchId: 'salmiya', nameAr: 'السالمية', nameEn: 'Salmiya', netKwd: 4.0, orders: 4, aovKwd: 1.0, group: 'restaurant' },
        ],
      },
    },
    unattributed: unavail('pos.order'),
    channels: unavail('pos.payment'),
    brands: unavail('pos.order.line'),
    topProducts: unavail('pos.order.line'),
    hourly: unavail('pos.order'),
    deltas: unavail('pos.order'),
    gl: unavail('account.move.line'),
    receivables: unavail('account.move.line'),
    purchases: unavail('purchase.order'),
    stock: unavail('stock.move'),
    hr: unavail('hr.employee'),
    advisorReports: [],
    companyContext: '',
  }
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
    ...(status === 'answered' ? { contextPack: makeCouncilPack() } : {}),
    facts:
      status === 'answered'
        ? [
            {
              id: 'fact-net',
              metric: 'net_sales',
              period: '2026-11-15',
              date: '2026-11-15',
              unit: 'KWD',
              value: '10.5',
              entityType: 'branch',
              entityId: 'avenues',
              entityName: 'avenues',
            },
            {
              id: 'fact-salmiya',
              metric: 'net_sales',
              period: '2026-11-15',
              date: '2026-11-15',
              unit: 'KWD',
              value: '4.0',
              entityType: 'branch',
              entityId: 'salmiya',
              entityName: 'salmiya',
            },
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
  const validContract = JSON.stringify({
    answer_ar: 'حقق فرع الأفنيوز صافي مبيعات 10.5 د.ك مقابل 4 د.ك في السالمية.',
    claims: [
      {
        text: 'حقق فرع الأفنيوز صافي مبيعات 10.5 د.ك مقابل 4 د.ك في السالمية.',
        numbers: [
          { value: 10.5, section: 'branches' },
          { value: 4, section: 'branches' },
        ],
      },
    ],
    root_causes: [{ text: 'ارتفاع متوسط الطلب في الأفنيوز مقابل السالمية.', kind: 'hypothesis' }],
    proposals: [{ text: 'مراجعة عروض الساعات الهادئة في السالمية اليوم.', owner: 'مدير العمليات', kind: 'proposal' }],
    missing_metrics: [],
  })
  const reviewerOk = JSON.stringify({ status: 'ok', note: '' })

  function run(options: {
    texts?: Partial<Record<'anthropic' | 'google' | 'xai', string>>
    hang?: 'anthropic' | 'google' | 'xai'
    keys?: CouncilKeys
    timeoutMs?: number
    ask?: () => Promise<unknown>
    persist?: (rows: readonly AiRunDraft[]) => Promise<void>
    fetchImpl?: typeof fetch
  }) {
    const texts = {
      anthropic: validContract,
      google: reviewerOk,
      xai: validContract,
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

  it('calls the first healthy provider + optional reviewer and stores the model id the API returned', async () => {
    const { pending, saved, calls } = run({})
    const result = await pending
    expect(calls).toHaveLength(2)
    expect(result.status).toBe('answered')
    expect(result.agreed.map((item) => item.modelId).sort()).toEqual(
      [RETURNED.anthropic, RETURNED.google].sort(),
    )
    expect(result.reply).toContain('10.5')
    expect(result.reply).toContain('اقتراح')
    expect(result.reply).not.toMatch(/Deep Strategic/i)
    expect(saved).toHaveLength(2)
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
  })

  it('records a timeout and fails over cleanly to the next configured provider + reviewer', async () => {
    const { pending, saved } = run({
      hang: 'anthropic',
      timeoutMs: 400,
      texts: { google: validContract, xai: reviewerOk },
    })
    const result = await pending
    const claude = result.participants.find((item) => item.provider === 'anthropic')
    expect(claude).toMatchObject({ status: 'error', errorCode: 'TIMEOUT', modelId: '' })
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['google', 'xai'])
    expect(saved.find((row) => row.provider === 'anthropic')?.status).toBe('error')
    expect(saved.find((row) => row.provider === 'xai')?.estCostMicroUsd).toBeNull()
    expect(result.reply).not.toContain(RETURNED.anthropic)
  })

  it('rejects a model that only emits numbers absent from the Odoo pack and fails over cleanly', async () => {
    const badOnly = JSON.stringify({
      answer_ar: 'المجموع 999.9',
      claims: [{ text: 'المجموع 999.9', numbers: [{ value: 999.9, section: 'companyTotals' }] }],
      proposals: [],
      missing_metrics: [],
    })
    const { pending } = run({ texts: { anthropic: badOnly, google: validContract, xai: reviewerOk } })
    const result = await pending
    const anthropic = result.participants.find((item) => item.provider === 'anthropic')
    expect(anthropic).toMatchObject({
      status: 'guard_rejected',
      errorCode: 'GUARD_REJECTED',
      modelId: RETURNED.anthropic,
      offendingNumbers: ['999.9'],
    })
    expect(result.reply).not.toContain('999.9')
    expect(result.reply).not.toContain('المجموع')
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['google', 'xai'])
  })

  it('rejects an excluded entity in model output and fails over cleanly', async () => {
    const leaked = JSON.stringify({
      answer_ar: 'أداء هايزنبرغ مع الصافي 10.5',
      claims: [{ text: 'أداء هايزنبرغ مع الصافي 10.5', numbers: [{ value: 10.5, section: 'branches' }] }],
      proposals: [],
      missing_metrics: [],
    })
    const { pending } = run({ texts: { anthropic: leaked, google: validContract, xai: reviewerOk } })
    const result = await pending
    expect(result.participants.find((item) => item.provider === 'anthropic')).toMatchObject({
      status: 'guard_rejected',
      errorCode: 'EXCLUDED_ENTITY',
    })
    expect(result.reply).not.toContain('هايزنبرغ')
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['google', 'xai'])
  })

  it('drops only the unverified claim per claim and keeps the valid claims and proposals', async () => {
    const mixed = JSON.stringify({
      answer_ar: 'صافي المبيعات 10.5 د.ك في الأفنيوز. وبلغت المبيعات الوهمية 999.9 د.ك.',
      claims: [
        { text: 'صافي المبيعات 10.5 د.ك في الأفنيوز.', numbers: [{ value: 10.5, section: 'branches' }] },
        { text: 'وبلغت المبيعات الوهمية 999.9 د.ك.', numbers: [{ value: 999.9, section: 'branches' }] },
      ],
      proposals: [{ text: 'متابعة الساعات الهادئة.', owner: 'مدير الفرع', kind: 'proposal' }],
      missing_metrics: [],
    })
    const { pending } = run({ texts: { anthropic: mixed, google: reviewerOk } })
    const result = await pending
    expect(result.status).toBe('answered')
    expect(result.reply).toContain('صافي المبيعات 10.5')
    expect(result.reply).not.toContain('999.9')
    expect(result.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'google'])
  })

  it('falls back deterministically with status="answered" when every model fails the guard', async () => {
    const badOnly = JSON.stringify({
      answer_ar: 'الرقم 999.9',
      claims: [{ text: 'الرقم 999.9', numbers: [{ value: 999.9, section: 'companyTotals' }] }],
      proposals: [],
      missing_metrics: [],
    })
    const { pending, saved } = run({
      texts: { anthropic: badOnly, google: badOnly, xai: badOnly },
    })
    const result = await pending
    expect(result.status).toBe('answered')
    expect(result.agreed).toEqual([])
    expect(result.reply).toContain(COUNCIL_MODEL_FALLBACK_NOTE)
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
    expect(result.status).toBe('answered')
    expect(result.participants.some((item) => item.provider === 'xai')).toBe(false)
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
    expect(result.agreed).toHaveLength(2)
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
      process.env.XAI_API_KEY = 'env-only-grok-test'
      process.env.OPENAI_API_KEY = 'env-only-openai-test'
      expect(getAnthropicApiKey()).toBe('env-only-anthropic-test')
      expect(getGeminiApiKey()).toBe('env-only-gemini-test')
      expect(getXaiApiKey()).toBe('env-only-grok-test')
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
