import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '@/lib/logger'
import { BRIEF_MAX_TOKENS } from '@/server/ai/brief'
import { runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
import type { CouncilKeys } from '@/server/ai/env'
import type { CouncilModels } from '@/server/ai/models'
import { diagnoseGuardRejectedAnswer } from '@/server/ai/persist'
import {
  ANALYSIS_MAX_TOKENS,
  GEMINI_FINISH_REASON_MAX_TOKENS,
  GEMINI_FLASH_LITE_THINKING_BUDGET,
  GEMINI_JSON_MIME_TYPE,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_THINKING_BUDGET,
  GEMINI_THINKING_LEVEL,
  STRUCTURED_JSON_SYSTEM_MARKER,
  callProvider,
  resetProviderCooldowns,
  resetProviderTelemetry,
} from '@/server/ai/providers'
import { comparisonMatchesFacts, type ComparableFact, type StructuredComparison } from '@/server/ai/structured-claim'

const API_KEY = 'test-google-key-00000001'
const PROMPT_SENTINEL = 'SENTINEL_PROMPT_DO_NOT_LOG'
const EXPLICIT_PROSE_TOKENS = 1_000
const PRODUCT_FACT_ID = 'item_net_kwd|16492|2026-11-01..2026-11-21'
const HALLUCINATED_NUMBER = '999.9'
const PRODUCT_ID_NUMBER = '16492'

const KEYS: CouncilKeys = {
  anthropic: 'test-anthropic-key-0001',
  google: API_KEY,
  xai: 'test-grok-key-0000000001',
}

const MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
  xai: 'grok-4',
}

const BRANCH_FACTS: ComparableFact[] = [
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

const PRODUCT_FACT: ComparableFact = {
  id: PRODUCT_FACT_ID,
  metric: 'item_net_kwd',
  period: '2026-11-01..2026-11-21',
  date: '2026-11-21',
  unit: 'KWD',
  value: '10.5',
  entityType: 'product',
  entityId: PRODUCT_ID_NUMBER,
  entityName: 'Spring Roll',
}

const BETTER: StructuredComparison = {
  subject_id: 'avenues',
  relation: 'better',
  object_id: 'salmiya',
  metric: 'net_sales',
  cited_fact_ids: ['fact-net', 'fact-salmiya'],
}

const STRUCTURED_SYSTEM = `${STRUCTURED_JSON_SYSTEM_MARKER}\nShape: {"comparison":{}}`
const COUNCIL_USER = `Question:\n${PROMPT_SENTINEL}\n\nOdoo facts JSON:\n[]`

interface GeminiGenerationConfig {
  maxOutputTokens?: number
  responseMimeType?: string
  thinkingConfig?: { thinkingLevel?: string; thinkingBudget?: number }
}

function generationConfigOf(body: string): GeminiGenerationConfig {
  const parsed = JSON.parse(body) as { generationConfig?: GeminiGenerationConfig }
  return parsed.generationConfig ?? {}
}

function geminiReply(text: string, finishReason: string, tokensOut = 12): Response {
  return Response.json({
    modelVersion: 'gemini-3.1-pro-preview-001',
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 8, candidatesTokenCount: tokensOut },
  })
}

async function captureGeminiBody(input: {
  model: string
  system: string
  user: string
  maxTokens?: number
}): Promise<GeminiGenerationConfig> {
  let captured = ''
  await callProvider({
    provider: 'google',
    apiKey: API_KEY,
    model: input.model,
    system: input.system,
    user: input.user,
    timeoutMs: 1_000,
    ...(input.maxTokens !== undefined ? { maxTokens: input.maxTokens } : {}),
    fetchImpl: async (_url, init) => {
      captured = String(init?.body ?? '')
      return geminiReply('{"ok":true}', 'STOP')
    },
  })
  return generationConfigOf(captured)
}

function odooAnswer(facts: readonly ComparableFact[]): unknown {
  const reply = 'صافي المبيعات 10.5'
  return {
    reply,
    status: 'answered' as const,
    executedQueries: [],
    verifier: { valid: true, extractedNumbers: [10.5], unverifiedNumbers: [] },
    toolNumbers: [10.5],
    period: { from: '2026-11-15', to: '2026-11-15' },
    facts: [...facts],
    auditEntry: {
      id: 'audit-gemini-log',
      timestampIso: '2026-11-16T00:00:00.000Z',
      userSub: 'user-1',
      userRole: 'admin',
      question: 'كم صافي المبيعات؟',
      status: 'answered' as const,
      executedQueries: [],
      verifier: { valid: true, extractedNumbers: [], unverifiedNumbers: [] },
      finalReply: reply,
    },
  }
}

function councilFetch(texts: { anthropic: string; google: string; xai: string }, onGoogleBody?: (body: string) => void): typeof fetch {
  return async (input, init) => {
    const url = String(input)
    if (url.includes('generativelanguage.googleapis.com')) {
      onGoogleBody?.(String(init?.body ?? ''))
      return geminiReply(texts.google, 'STOP', 10)
    }
    if (url.includes('api.anthropic.com')) {
      return Response.json({
        model: 'claude-sonnet-4-6-20251101',
        content: [{ type: 'text', text: texts.anthropic }],
        usage: { input_tokens: 20, output_tokens: 10 },
      })
    }
    return Response.json({
      model: 'grok-4-0709',
      choices: [{ message: { content: texts.xai } }],
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    })
  }
}

describe('Gemini JSON output and guard log field names', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetProviderCooldowns()
    resetProviderTelemetry()
  })

  it('forces JSON and the 2000 token budget on council and brief shaped Gemini calls', async () => {
    const councilBySystem = await captureGeminiBody({
      model: 'gemini-3.5-flash',
      system: STRUCTURED_SYSTEM,
      user: 'compare the branches',
    })
    expect(councilBySystem).toEqual({
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: GEMINI_JSON_MIME_TYPE,
      thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL },
    })

    const councilByUser = await captureGeminiBody({
      model: 'gemini-3.1-pro-preview',
      system: 'Return JSON.',
      user: COUNCIL_USER,
    })
    expect(councilByUser.responseMimeType).toBe(GEMINI_JSON_MIME_TYPE)
    expect(councilByUser.maxOutputTokens).toBe(GEMINI_MAX_OUTPUT_TOKENS)
    expect(councilByUser.thinkingConfig).toEqual({ thinkingLevel: GEMINI_THINKING_LEVEL })

    const briefShaped = await captureGeminiBody({
      model: 'gemini-3.5-flash',
      system: STRUCTURED_SYSTEM,
      user: '{"periods":{}}',
      maxTokens: BRIEF_MAX_TOKENS,
    })
    expect(briefShaped.responseMimeType).toBe(GEMINI_JSON_MIME_TYPE)
    expect(briefShaped.maxOutputTokens).toBe(BRIEF_MAX_TOKENS)

    expect(readFileSync('src/server/ai/council.ts', 'utf8')).toContain(STRUCTURED_JSON_SYSTEM_MARKER)
    expect(readFileSync('src/server/ai/brief.ts', 'utf8')).toContain(STRUCTURED_JSON_SYSTEM_MARKER)
  })

  it('leaves non-JSON Gemini calls and other providers on their previous request shape', async () => {
    const prose = await captureGeminiBody({
      model: 'gemini-3.5-flash',
      system: 'Write a short paragraph.',
      user: 'Summarize the week.',
      maxTokens: EXPLICIT_PROSE_TOKENS,
    })
    expect(prose.responseMimeType).toBeUndefined()
    expect(prose.maxOutputTokens).toBe(EXPLICIT_PROSE_TOKENS)
    expect(prose.thinkingConfig).toEqual({ thinkingLevel: GEMINI_THINKING_LEVEL })

    const unknownModel = await captureGeminiBody({
      model: 'gemini-test',
      system: 'sys',
      user: 'usr',
    })
    expect(unknownModel).toEqual({ maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS })

    const flashLite = await captureGeminiBody({
      model: 'gemini-2.5-flash-lite',
      system: STRUCTURED_SYSTEM,
      user: 'facts',
    })
    expect(flashLite.thinkingConfig).toEqual({ thinkingBudget: GEMINI_FLASH_LITE_THINKING_BUDGET })
    expect(flashLite.thinkingConfig?.thinkingLevel).toBeUndefined()

    const gemini25 = await captureGeminiBody({
      model: 'gemini-2.5-pro',
      system: STRUCTURED_SYSTEM,
      user: 'facts',
    })
    expect(gemini25.thinkingConfig).toEqual({ thinkingBudget: GEMINI_THINKING_BUDGET })

    let anthropicBody = ''
    await callProvider({
      provider: 'anthropic',
      apiKey: 'test-anthropic-key-0001',
      model: 'claude-sonnet-4-6',
      system: STRUCTURED_SYSTEM,
      user: COUNCIL_USER,
      timeoutMs: 1_000,
      fetchImpl: async (_url, init) => {
        anthropicBody = String(init?.body ?? '')
        return Response.json({
          model: 'claude-sonnet-4-6-20251101',
          content: [{ type: 'text', text: '{"ok":true}' }],
          usage: { input_tokens: 4, output_tokens: 2 },
        })
      },
    })
    const anthropic = JSON.parse(anthropicBody) as { max_tokens?: number; generationConfig?: unknown }
    expect(anthropic.max_tokens).toBe(ANALYSIS_MAX_TOKENS)
    expect(anthropic.generationConfig).toBeUndefined()
    expect(anthropicBody).not.toContain('responseMimeType')
  })

  it('logs and returns finishReason, and warns on MAX_TOKENS or unparseable JSON', async () => {
    const infoSpy = vi.spyOn(logger, 'info')
    const warnSpy = vi.spyOn(logger, 'warn')

    const ok = await callProvider({
      provider: 'google',
      apiKey: API_KEY,
      model: 'gemini-3.5-flash',
      system: STRUCTURED_SYSTEM,
      user: COUNCIL_USER,
      timeoutMs: 1_000,
      fetchImpl: async () => geminiReply('{"comparison":{}}', 'STOP', 18),
    })
    expect(ok.finishReason).toBe('STOP')
    expect(ok.tokensOut).toBe(18)
    expect(infoSpy).toHaveBeenCalledWith(
      'ai_provider_attempt',
      expect.objectContaining({
        provider: 'google',
        requestedModel: 'gemini-3.5-flash',
        modelVersion: 'gemini-3.1-pro-preview-001',
        finishReason: 'STOP',
        tokensOut: 18,
      }),
    )
    expect(warnSpy).not.toHaveBeenCalledWith('ai_provider_max_tokens', expect.anything())
    expect(warnSpy).not.toHaveBeenCalledWith('ai_provider_unparseable_json', expect.anything())

    const truncated = await callProvider({
      provider: 'google',
      apiKey: API_KEY,
      model: 'gemini-3.5-flash',
      system: STRUCTURED_SYSTEM,
      user: COUNCIL_USER,
      timeoutMs: 1_000,
      fetchImpl: async () => geminiReply('{"comparison":', GEMINI_FINISH_REASON_MAX_TOKENS, GEMINI_MAX_OUTPUT_TOKENS),
    })
    expect(truncated.status).toBe('ok')
    expect(truncated.finishReason).toBe(GEMINI_FINISH_REASON_MAX_TOKENS)
    expect(infoSpy).toHaveBeenCalledWith(
      'ai_provider_attempt',
      expect.objectContaining({
        provider: 'google',
        requestedModel: 'gemini-3.5-flash',
        modelVersion: 'gemini-3.1-pro-preview-001',
        finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
        tokensOut: GEMINI_MAX_OUTPUT_TOKENS,
        status: 'ok',
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_max_tokens',
      expect.objectContaining({
        provider: 'google',
        requestedModel: 'gemini-3.5-flash',
        modelVersion: 'gemini-3.1-pro-preview-001',
        finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
        tokensOut: GEMINI_MAX_OUTPUT_TOKENS,
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_unparseable_json',
      expect.objectContaining({
        provider: 'google',
        finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
        tokensOut: GEMINI_MAX_OUTPUT_TOKENS,
      }),
    )

    const empty = await callProvider({
      provider: 'google',
      apiKey: API_KEY,
      model: 'gemini-3.5-flash',
      system: STRUCTURED_SYSTEM,
      user: COUNCIL_USER,
      timeoutMs: 1_000,
      fetchImpl: async () => geminiReply('', GEMINI_FINISH_REASON_MAX_TOKENS, GEMINI_MAX_OUTPUT_TOKENS),
    })
    expect(empty).toMatchObject({
      status: 'error',
      errorCode: 'EMPTY_ANSWER',
      modelId: 'gemini-3.1-pro-preview-001',
      finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
      tokensOut: GEMINI_MAX_OUTPUT_TOKENS,
      text: '',
    })
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_max_tokens',
      expect.objectContaining({
        provider: 'google',
        requestedModel: 'gemini-3.5-flash',
        modelVersion: 'gemini-3.1-pro-preview-001',
        finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
        tokensOut: GEMINI_MAX_OUTPUT_TOKENS,
      }),
    )

    const cappedJsonTokensOut = 40
    const cappedButJson = await callProvider({
      provider: 'google',
      apiKey: API_KEY,
      model: 'gemini-3.5-flash',
      system: STRUCTURED_SYSTEM,
      user: COUNCIL_USER,
      timeoutMs: 1_000,
      fetchImpl: async () => geminiReply('{"ok":true}', GEMINI_FINISH_REASON_MAX_TOKENS, cappedJsonTokensOut),
    })
    expect(cappedButJson).toMatchObject({
      status: 'ok',
      finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
      tokensOut: cappedJsonTokensOut,
    })
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_max_tokens',
      expect.objectContaining({
        finishReason: GEMINI_FINISH_REASON_MAX_TOKENS,
        tokensOut: cappedJsonTokensOut,
      }),
    )
    const unparseableForCappedJson = warnSpy.mock.calls.filter(
      (call) =>
        call[0] === 'ai_provider_unparseable_json' &&
        (call[1] as { tokensOut?: number }).tokensOut === cappedJsonTokensOut,
    )
    expect(unparseableForCappedJson).toEqual([])

    const serialized = JSON.stringify([...infoSpy.mock.calls, ...warnSpy.mock.calls])
    expect(serialized).not.toContain(API_KEY)
    expect(serialized).not.toContain(PROMPT_SENTINEL)
    expect(serialized).not.toContain('{"comparison":')
  })

  it('moves cited fact-id numbers into factIdNumbers without changing the guard verdict', async () => {
    expect(comparisonMatchesFacts(BETTER, BRANCH_FACTS)).toBe(true)
    expect(comparisonMatchesFacts({ ...BETTER, relation: 'worse' }, BRANCH_FACTS)).toBe(false)

    const agreed = JSON.stringify({ comparison: BETTER })
    const accepted = await runFeryalCouncil(
      { question: 'كم صافي المبيعات؟', userId: 'user-1' },
      {
        askOdoo: (async () => odooAnswer(BRANCH_FACTS)) as RunCouncilOptions['askOdoo'],
        keys: KEYS,
        models: MODELS,
        timeoutMs: 1_000,
        persist: async () => undefined,
        fetchImpl: councilFetch({ anthropic: agreed, google: agreed, xai: agreed }),
      },
    )
    expect(accepted.status).toBe('answered')
    expect(accepted.participants.map((item) => item.status)).toEqual(['ok', 'ok', 'ok'])
    expect(accepted.participants.map((item) => item.errorCode)).toEqual([null, null, null])
    expect(accepted.participants.map((item) => item.offendingNumbers)).toEqual([[], [], []])

    const citedProse = `${PRODUCT_FACT_ID} المجموع ${HALLUCINATED_NUMBER}`
    let googleBody = ''
    const mixed = await runFeryalCouncil(
      { question: 'كم صافي المبيعات؟', userId: 'user-1' },
      {
        askOdoo: (async () => odooAnswer([...BRANCH_FACTS, PRODUCT_FACT])) as RunCouncilOptions['askOdoo'],
        keys: KEYS,
        models: MODELS,
        timeoutMs: 1_000,
        persist: async () => undefined,
        fetchImpl: councilFetch({ anthropic: agreed, google: citedProse, xai: agreed }, (body) => {
          googleBody = body
        }),
      },
    )
    expect(mixed.status).toBe('answered')
    expect(mixed.agreed.map((item) => item.provider).sort()).toEqual(['anthropic', 'xai'])
    const google = mixed.participants.find((item) => item.provider === 'google')
    expect(google).toMatchObject({
      status: 'guard_rejected',
      errorCode: 'GUARD_REJECTED',
      offendingNumbers: ['16492', '2026', '-11', '-1', '2026', '-11', '-21', HALLUCINATED_NUMBER],
    })
    expect(generationConfigOf(googleBody)).toMatchObject({
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: GEMINI_JSON_MIME_TYPE,
      thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL },
    })

    const diagnosis = diagnoseGuardRejectedAnswer({
      text: citedProse,
      facts: [...BRANCH_FACTS, PRODUCT_FACT],
      requestedModel: 'gemini-3.5-flash',
    })
    expect(diagnosis.reason).toBe('PARSE_FAIL')
    expect(diagnosis.numbersInText).toEqual([HALLUCINATED_NUMBER])
    expect(diagnosis.factIdNumbers).toEqual([PRODUCT_ID_NUMBER])
    expect(diagnosis.errorCode).toBe(
      'PARSE_FAIL;requestedModel=gemini-3.5-flash;numbersInText=[999.9];factIdNumbers=[16492]',
    )
    expect(diagnosis.errorCode).not.toContain('offendingNumbers=')

    const repeatedOutside = diagnoseGuardRejectedAnswer({
      text: `${PRODUCT_FACT_ID} الرقم ${PRODUCT_ID_NUMBER}`,
      facts: [PRODUCT_FACT],
      requestedModel: 'gemini-3.5-flash',
    })
    expect(repeatedOutside.reason).toBe('PARSE_FAIL')
    expect(repeatedOutside.numbersInText).toEqual([PRODUCT_ID_NUMBER])
    expect(repeatedOutside.factIdNumbers).toEqual([PRODUCT_ID_NUMBER])

    const bareFact: ComparableFact = { ...PRODUCT_FACT, id: PRODUCT_ID_NUMBER }
    const embeddedNumber = diagnoseGuardRejectedAnswer({
      text: '9916492',
      facts: [bareFact],
      requestedModel: 'gemini-3.5-flash',
    })
    expect(embeddedNumber.reason).toBe('PARSE_FAIL')
    expect(embeddedNumber.numbersInText).toEqual(['9916492'])
    expect(embeddedNumber.factIdNumbers).toEqual([])

    const standaloneFactId = diagnoseGuardRejectedAnswer({
      text: `الصنف ${PRODUCT_ID_NUMBER}`,
      facts: [bareFact],
      requestedModel: 'gemini-3.5-flash',
    })
    expect(standaloneFactId.numbersInText).toEqual([])
    expect(standaloneFactId.factIdNumbers).toEqual([PRODUCT_ID_NUMBER])

    const unknownFactId = diagnoseGuardRejectedAnswer({
      text: citedProse,
      facts: BRANCH_FACTS,
      requestedModel: 'gemini-3.5-flash',
    })
    expect(unknownFactId.reason).toBe('PARSE_FAIL')
    expect(unknownFactId.numbersInText).toEqual([PRODUCT_ID_NUMBER, HALLUCINATED_NUMBER])
    expect(unknownFactId.factIdNumbers).toEqual([])

    const councilDiff = execFileSync('git', ['diff', 'b985f9b', '--', 'src/server/ai/council.ts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(councilDiff).toBe('')
  })
})
