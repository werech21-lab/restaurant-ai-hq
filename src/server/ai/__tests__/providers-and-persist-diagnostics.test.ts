import { execFileSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authState = {
  role: 'gm' as string,
  sub: 'exec-gm-1',
}

vi.mock('@/lib/auth/api-guard', () => ({
  ENTERPRISE_API_SECURITY_HEADERS: { 'x-content-type-options': 'nosniff' },
  requireExecApiSession: vi.fn(async () => ({
    ok: true as const,
    session: { sub: authState.sub, role: authState.role },
  })),
}))

vi.mock('@/server/council/store', () => ({
  listDecisions: vi.fn(async () => []),
  saveDecision: vi.fn(async () => {
    throw new Error('primary council_decisions store unavailable in test')
  }),
}))

vi.mock('@/server/council/service', () => ({
  latestCouncilSnapshot: vi.fn(async () => null),
}))

vi.mock('@/lib/odoo-live-connector', () => ({
  fetchLiveOdooSnapshot: vi.fn(async () => null),
}))

import {
  GET as getCouncilDecisions,
  POST as postCouncilDecisions,
} from '@/app/api/erp/council/decisions/route'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { hashQuestion, runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
import type { CouncilKeys } from '@/server/ai/env'
import type { CouncilModels } from '@/server/ai/models'
import {
  AI_PG_CONNECT_TIMEOUT_MS,
  COUNCIL_DECISION_BRIEF_TAG,
  configureAiPersistQueryable,
  diagnoseGuardRejectedAnswer,
  listDailyBriefs,
  listLatestDailyBrief,
  safeListAiRuns,
  type AiSqlQueryable,
} from '@/server/ai/persist'
import {
  callProvider,
  getProviderAttemptTelemetry,
  listProviderAttemptTelemetry,
  MAX_PROVIDER_TELEMETRY_ENTRIES,
  resetProviderCooldowns,
  resetProviderTelemetry,
  type ProviderId,
} from '@/server/ai/providers'
import type { ComparableFact } from '@/server/ai/structured-claim'

const SECRET_KEYS: CouncilKeys = {
  anthropic: 'sk-ant-secret-key-do-not-leak-90001',
  google: 'AIzaSy-secret-key-do-not-leak-90002',
  xai: 'xai-secret-bearer-do-not-leak-90003',
}

const MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
  xai: 'grok-4',
}

const RETURNED_MODELS: Record<ProviderId, string> = {
  anthropic: 'claude-sonnet-4-6-20251101',
  google: 'gemini-3.1-pro-preview-001',
  xai: 'grok-4-0709',
}

const COMPARABLE_FACTS: readonly ComparableFact[] = [
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function providerResponse(provider: ProviderId, text: string): Response {
  if (provider === 'anthropic') {
    return jsonResponse({
      model: RETURNED_MODELS.anthropic,
      content: [{ type: 'text', text }],
      usage: { input_tokens: 24, output_tokens: 12 },
    })
  }
  if (provider === 'google') {
    return jsonResponse({
      modelVersion: RETURNED_MODELS.google,
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 22, candidatesTokenCount: 10 },
    })
  }
  return jsonResponse({
    model: RETURNED_MODELS.xai,
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 20, completion_tokens: 8 },
  })
}

function providerOfUrl(url: string): ProviderId | null {
  if (url.includes('api.anthropic.com')) return 'anthropic'
  if (url.includes('generativelanguage.googleapis.com')) return 'google'
  if (url.includes('api.x.ai')) return 'xai'
  return null
}

function abortOnSignal(signal: AbortSignal | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const abort = () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      reject(err)
    }
    if (signal?.aborted) {
      abort()
      return
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function buildOdooCouncilAnswer(): unknown {
  const reply = 'صافي المبيعات 10.5'
  return {
    reply,
    status: 'answered' as const,
    executedQueries: [],
    verifier: { valid: true, extractedNumbers: [10.5], unverifiedNumbers: [] },
    toolNumbers: [10.5],
    period: { from: '2026-11-15', to: '2026-11-15' },
    facts: [...COMPARABLE_FACTS],
    auditEntry: {
      id: 'audit-diag-1',
      timestampIso: '2026-11-16T00:00:00.000Z',
      userSub: 'user-1',
      userRole: 'admin',
      question: 'قارن صافي المبيعات بين الأفنيوز والسالمية',
      status: 'answered' as const,
      executedQueries: [],
      verifier: { valid: true, extractedNumbers: [], unverifiedNumbers: [] },
      finalReply: reply,
    },
  }
}

function clearDecisionFallbackCache(): void {
  const globalDecisionState = globalThis as unknown as {
    __aetherDecisionRecordsFallback?: Map<string, unknown>
  }
  globalDecisionState.__aetherDecisionRecordsFallback?.clear()
}

describe('Items 1 & 7: PostgreSQL-only ai_daily_briefs, provider telemetry, and granular ai_runs rejection diagnostics', () => {
  beforeEach(() => {
    resetProviderCooldowns()
    resetProviderTelemetry()
    clearDecisionFallbackCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    configureAiPersistQueryable(undefined)
    resetProviderCooldowns()
    resetProviderTelemetry()
    clearDecisionFallbackCache()
  })

  it('Item 1: /api/erp/council/decisions persists and reads mirror decisions 100% on PostgreSQL public.ai_daily_briefs in production without touching prisma.aiDailyBrief', async () => {
    expect(AI_PG_CONNECT_TIMEOUT_MS).toBe(5_000)

    const findManySpy = vi.spyOn(prisma.aiDailyBrief, 'findMany')
    const findFirstSpy = vi.spyOn(prisma.aiDailyBrief, 'findFirst')
    const createSpy = vi.spyOn(prisma.aiDailyBrief, 'create')
    const deleteManySpy = vi.spyOn(prisma.aiDailyBrief, 'deleteMany')

    const pglite = new PGlite()
    try {
      await pglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
      const pgAdapter: AiSqlQueryable = {
        async query<R extends Record<string, unknown> = Record<string, unknown>>(
          text: string,
          params?: unknown[],
        ): Promise<{ rows: R[]; rowCount?: number | null }> {
          const res = await pglite.query<R>(text, params)
          return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
        },
      }
      vi.stubEnv('NODE_ENV', 'production')
      configureAiPersistQueryable(pgAdapter)

      const fingerprint = 'cfo:cost-drift:avenues:2026-11'
      const postAccept = await postCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fingerprint,
            status: 'accepted',
            note: 'Approved on Postgres mirror',
            findingMeta: {
              advisorId: 'cfo',
              titleAr: 'مراجعة تكلفة الأفنيوز',
              titleEn: 'Review Avenues cost drift',
              kind: 'cost-drift',
              branchId: 'avenues',
              expectedWeeklyKwd: 320.5,
            },
          }),
        }),
      )
      expect(postAccept.status).toBe(200)

      // Clear in-memory fallback map so GET must read strictly from PostgreSQL public.ai_daily_briefs
      clearDecisionFallbackCache()

      const getAfterAccept = await getCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', { method: 'GET' }),
      )
      expect(getAfterAccept.status).toBe(200)
      const acceptPayload = (await getAfterAccept.json()) as {
        ok: boolean
        decisions: Array<{ fingerprint: string; status: string; note: string | null }>
      }
      expect(acceptPayload.ok).toBe(true)
      expect(acceptPayload.decisions).toHaveLength(1)
      expect(acceptPayload.decisions[0]).toMatchObject({
        fingerprint,
        status: 'accepted',
        note: 'Approved on Postgres mirror',
      })

      // Update status to 'rejected' and verify upsert replaces previous row in Postgres
      const postReject = await postCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            fingerprint,
            status: 'rejected',
            note: 'Superseded decision',
            findingMeta: {
              advisorId: 'cfo',
              titleAr: 'مراجعة تكلفة الأفنيوز',
              titleEn: 'Review Avenues cost drift',
              kind: 'cost-drift',
              branchId: 'avenues',
              expectedWeeklyKwd: 320.5,
            },
          }),
        }),
      )
      expect(postReject.status).toBe(200)
      clearDecisionFallbackCache()

      const getAfterReject = await getCouncilDecisions(
        new NextRequest('http://localhost/api/erp/council/decisions', { method: 'GET' }),
      )
      const rejectPayload = (await getAfterReject.json()) as {
        decisions: Array<{ fingerprint: string; status: string; note: string | null }>
      }
      expect(rejectPayload.decisions).toHaveLength(1)
      expect(rejectPayload.decisions[0]).toMatchObject({
        fingerprint,
        status: 'rejected',
        note: 'Superseded decision',
      })

      const pgRows = await pglite.query<{
        questionHash: string
        status: string
        agreedModels: string
      }>(
        `SELECT "questionHash", status, "agreedModels" FROM public.ai_daily_briefs`,
      )
      expect(pgRows.rows).toEqual([
        {
          questionHash: `decision-room:${fingerprint}`,
          status: 'rejected',
          agreedModels: COUNCIL_DECISION_BRIEF_TAG,
        },
      ])

      // Decision mirror rows never leak into Daily Brief readers
      expect(await listDailyBriefs(10)).toEqual([])
      expect(await listLatestDailyBrief()).toBeNull()

      // ZERO calls to Prisma SQLite (`main.ai_daily_briefs`)
      expect(findManySpy).not.toHaveBeenCalled()
      expect(findFirstSpy).not.toHaveBeenCalled()
      expect(createSpy).not.toHaveBeenCalled()
      expect(deleteManySpy).not.toHaveBeenCalled()
    } finally {
      await pglite.close()
    }
  })

  it('Item 7a: providers.ts logs requestedModel (never empty), errorCode, and latencyMs across anthropic, google, and xai with zero secret leakage', async () => {
    const infoSpy = vi.spyOn(logger, 'info')
    const warnSpy = vi.spyOn(logger, 'warn')

    const question = 'قارن صافي المبيعات بين الأفنيوز والسالمية'
    const factsJson = JSON.stringify(COMPARABLE_FACTS)
    const councilUserPrompt = `Question:\n${question}\n\nOdoo facts JSON:\n${factsJson}`

    // 1) Successful calls across all 3 providers
    for (const provider of ['anthropic', 'google', 'xai'] as const) {
      const okRes = await callProvider({
        provider,
        apiKey: SECRET_KEYS[provider],
        model: MODELS[provider],
        system: 'Return JSON.',
        user: councilUserPrompt,
        timeoutMs: 1_000,
        fetchImpl: async () => providerResponse(provider, '{"comparison":{}}'),
      })
      expect(okRes.status).toBe('ok')
      expect(okRes.requestedModel).toBe(MODELS[provider])
      expect(okRes.modelId).toBe(RETURNED_MODELS[provider])
    }

    expect(infoSpy).toHaveBeenCalledTimes(3)
    for (const provider of ['anthropic', 'google', 'xai'] as const) {
      expect(infoSpy).toHaveBeenCalledWith(
        'ai_provider_attempt',
        expect.objectContaining({
          provider,
          requestedModel: MODELS[provider],
          modelId: RETURNED_MODELS[provider],
          status: 'ok',
          errorCode: null,
          latencyMs: expect.any(Number),
        }),
      )
    }

    // 2) Failure paths across anthropic (TIMEOUT), google (HTTP 401), xai (HTTP 503), and missing API key
    const timeoutRes = await callProvider({
      provider: 'anthropic',
      apiKey: SECRET_KEYS.anthropic,
      model: MODELS.anthropic,
      system: 'Return JSON.',
      user: councilUserPrompt,
      timeoutMs: 250,
      fetchImpl: async (_url, init) => abortOnSignal(init?.signal ?? undefined),
    })
    // Preserves council.test.ts:241 contract (`modelId: ''` on failure return)
    expect(timeoutRes).toMatchObject({
      provider: 'anthropic',
      requestedModel: MODELS.anthropic,
      modelId: '',
      status: 'error',
      errorCode: 'TIMEOUT',
    })

    const unauthRes = await callProvider({
      provider: 'google',
      apiKey: SECRET_KEYS.google,
      model: MODELS.google,
      system: 'Return JSON.',
      user: councilUserPrompt,
      timeoutMs: 1_000,
      fetchImpl: async () => jsonResponse({ error: 'unauthorized' }, 401),
    })
    expect(unauthRes).toMatchObject({
      provider: 'google',
      requestedModel: MODELS.google,
      modelId: '',
      status: 'error',
      errorCode: 'HTTP_UNAUTHORIZED',
    })

    const serverErrRes = await callProvider({
      provider: 'xai',
      apiKey: SECRET_KEYS.xai,
      model: '', // Even when caller passes empty model, requestedModel falls back to provider default and is NEVER ''
      system: 'Return JSON.',
      user: councilUserPrompt,
      timeoutMs: 1_000,
      fetchImpl: async () => jsonResponse({ error: 'unavailable' }, 503),
    })
    expect(serverErrRes).toMatchObject({
      provider: 'xai',
      requestedModel: 'grok-4',
      modelId: '',
      status: 'error',
      errorCode: 'HTTP_SERVER',
    })

    const missingKeyRes = await callProvider({
      provider: 'google',
      apiKey: 'short',
      model: MODELS.google,
      system: 'Return JSON.',
      user: councilUserPrompt,
      timeoutMs: 1_000,
    })
    expect(missingKeyRes).toMatchObject({
      provider: 'google',
      requestedModel: MODELS.google,
      modelId: '',
      status: 'error',
      errorCode: 'MISSING_API_KEY',
      latencyMs: 0,
    })

    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_attempt',
      expect.objectContaining({
        provider: 'anthropic',
        requestedModel: MODELS.anthropic,
        modelId: MODELS.anthropic,
        status: 'error',
        errorCode: 'TIMEOUT',
        latencyMs: expect.any(Number),
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_attempt',
      expect.objectContaining({
        provider: 'google',
        requestedModel: MODELS.google,
        modelId: MODELS.google,
        status: 'error',
        errorCode: 'HTTP_UNAUTHORIZED',
        latencyMs: expect.any(Number),
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_attempt',
      expect.objectContaining({
        provider: 'xai',
        requestedModel: 'grok-4',
        modelId: 'grok-4',
        status: 'error',
        errorCode: 'HTTP_SERVER',
        latencyMs: expect.any(Number),
      }),
    )
    expect(warnSpy).toHaveBeenCalledWith(
      'ai_provider_attempt',
      expect.objectContaining({
        provider: 'google',
        requestedModel: MODELS.google,
        modelId: MODELS.google,
        status: 'error',
        errorCode: 'MISSING_API_KEY',
        latencyMs: 0,
      }),
    )

    // Verify ZERO secret/API-key/header leakage across all info & warn calls
    const serializedLogs = JSON.stringify([
      ...infoSpy.mock.calls,
      ...warnSpy.mock.calls,
    ])
    expect(serializedLogs).not.toContain(SECRET_KEYS.anthropic)
    expect(serializedLogs).not.toContain(SECRET_KEYS.google)
    expect(serializedLogs).not.toContain(SECRET_KEYS.xai)
    expect(serializedLogs).not.toMatch(/x-api-key|x-goog-api-key|Bearer/i)

    // Verify telemetry lookup & bounded buffer cap (128 max)
    const expectedHash = hashQuestion(question)
    const googleTelemetry = getProviderAttemptTelemetry(expectedHash, 'google')
    expect(googleTelemetry).toMatchObject({
      provider: 'google',
      requestedModel: MODELS.google,
      errorCode: 'MISSING_API_KEY',
      factsJson,
      questionHash: expectedHash,
    })

    for (let i = 0; i < MAX_PROVIDER_TELEMETRY_ENTRIES + 15; i += 1) {
      await callProvider({
        provider: 'xai',
        apiKey: 'short',
        model: MODELS.xai,
        system: 'sys',
        user: `Question:\nq-${i}\n\nOdoo facts JSON:\n[]`,
        timeoutMs: 500,
      })
    }
    expect(listProviderAttemptTelemetry()).toHaveLength(MAX_PROVIDER_TELEMETRY_ENTRIES)
  })

  it('Item 7b: diagnoseGuardRejectedAnswer + end-to-end runFeryalCouncil -> persistAiRuns records PARSE_FAIL, SCHEMA_FAIL, FACT_MISMATCH, numbersInText, and requestedModel in public.ai_runs with council.ts untouched', async () => {
    // 1) Pure classifier checks (including strict ACTIVE_VENTURE_BRANCH_IDS enforcement)
    expect(
      diagnoseGuardRejectedAnswer({
        text: 'المجموع المتوقع 999.9 د.ك',
        facts: COMPARABLE_FACTS,
        requestedModel: MODELS.google,
      }),
    ).toEqual({
      reason: 'PARSE_FAIL',
      requestedModel: MODELS.google,
      numbersInText: ['999.9'],
      factIdNumbers: [],
      errorCode: 'PARSE_FAIL;requestedModel=gemini-3.1-pro-preview;numbersInText=[999.9];factIdNumbers=[]',
    })

    expect(
      diagnoseGuardRejectedAnswer({
        text: JSON.stringify({
          comparison: {
            subject_id: 'avenues',
            relation: 'invalid_relation',
            object_id: 'salmiya',
            metric: 'net_sales',
            cited_fact_ids: [],
            extra: 77.25,
          },
        }),
        facts: COMPARABLE_FACTS,
        requestedModel: MODELS.anthropic,
      }),
    ).toEqual({
      reason: 'SCHEMA_FAIL',
      requestedModel: MODELS.anthropic,
      numbersInText: ['77.25'],
      factIdNumbers: [],
      errorCode: 'SCHEMA_FAIL;requestedModel=claude-sonnet-4-6;numbersInText=[77.25];factIdNumbers=[]',
    })

    // 'best' with only 2 of the active branches must still fail comparisonMatchesFacts -> FACT_MISMATCH
    expect(
      diagnoseGuardRejectedAnswer({
        text: JSON.stringify({
          comparison: {
            subject_id: 'avenues',
            relation: 'best',
            object_id: null,
            metric: 'net_sales',
            cited_fact_ids: ['fact-net', 'fact-salmiya'],
          },
        }),
        facts: COMPARABLE_FACTS,
        requestedModel: MODELS.xai,
      }),
    ).toEqual({
      reason: 'FACT_MISMATCH',
      requestedModel: MODELS.xai,
      numbersInText: [],
      factIdNumbers: [],
      errorCode: 'FACT_MISMATCH;requestedModel=grok-4;numbersInText=[];factIdNumbers=[]',
    })

    // 2) End-to-end runFeryalCouncil -> persistAiRuns -> PGlite public.ai_runs
    const pglite = new PGlite()
    try {
      await pglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
      const pgAdapter: AiSqlQueryable = {
        async query<R extends Record<string, unknown> = Record<string, unknown>>(
          text: string,
          params?: unknown[],
        ): Promise<{ rows: R[]; rowCount?: number | null }> {
          const res = await pglite.query<R>(text, params)
          return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
        },
      }
      configureAiPersistQueryable(pgAdapter)
      const warnSpy = vi.spyOn(logger, 'warn')

      // Run 1: All three rejection stages (PARSE_FAIL, SCHEMA_FAIL, FACT_MISMATCH) in one real council run
      const rejectedTexts: Record<ProviderId, string> = {
        anthropic: 'تحليل حر مع رقم غير موثق 999.9',
        google: JSON.stringify({
          comparison: {
            subject_id: 'avenues',
            relation: 'not_in_enum',
            object_id: 'salmiya',
            metric: 'net_sales',
            cited_fact_ids: ['fact-net'],
            bad_num: 42.75,
          },
        }),
        xai: JSON.stringify({
          comparison: {
            subject_id: 'salmiya',
            relation: 'better',
            object_id: 'avenues',
            metric: 'net_sales_888.5',
            cited_fact_ids: ['fact-net', 'fact-salmiya'],
          },
        }),
      }

      const councilRejected = await runFeryalCouncil(
        {
          question: 'قارن صافي المبيعات بين الأفنيوز والسالمية',
          userId: 'exec-1',
          userRole: 'admin',
        },
        {
          askOdoo: (async () => buildOdooCouncilAnswer()) as RunCouncilOptions['askOdoo'],
          keys: SECRET_KEYS,
          models: MODELS,
          timeoutMs: 1_000,
          fetchImpl: async (input) => {
            const provider = providerOfUrl(String(input))
            if (!provider) throw new Error('unexpected provider url')
            return providerResponse(provider, rejectedTexts[provider])
          },
        },
      )

      expect(councilRejected.status).toBe('council_failed')

      const snapshotAfterRejections = await safeListAiRuns(10)
      expect(snapshotAfterRejections.error).toBe(false)
      expect(snapshotAfterRejections.source).toBe('postgres')
      expect(snapshotAfterRejections.runs).toHaveLength(3)

      const anthropicRun = snapshotAfterRejections.runs.find((r) => r.provider === 'anthropic')
      const googleRun = snapshotAfterRejections.runs.find((r) => r.provider === 'google')
      const xaiRun = snapshotAfterRejections.runs.find((r) => r.provider === 'xai')

      expect(anthropicRun).toMatchObject({
        status: 'guard_rejected',
        modelId: RETURNED_MODELS.anthropic,
        errorCode: 'PARSE_FAIL;requestedModel=claude-sonnet-4-6;numbersInText=[999.9];factIdNumbers=[]',
      })
      expect(googleRun).toMatchObject({
        status: 'guard_rejected',
        modelId: RETURNED_MODELS.google,
        errorCode: 'SCHEMA_FAIL;requestedModel=gemini-3.1-pro-preview;numbersInText=[42.75];factIdNumbers=[]',
      })
      expect(xaiRun).toMatchObject({
        status: 'guard_rejected',
        modelId: RETURNED_MODELS.xai,
        errorCode: 'FACT_MISMATCH;requestedModel=grok-4;numbersInText=[888.5];factIdNumbers=[]',
      })

      expect(warnSpy).toHaveBeenCalledWith(
        'ai_run_guard_rejected',
        expect.objectContaining({
          questionHash: councilRejected.questionHash,
          provider: 'anthropic',
          requestedModel: MODELS.anthropic,
          modelId: RETURNED_MODELS.anthropic,
          reason: 'PARSE_FAIL',
          numbersInText: ['999.9'],
          factIdNumbers: [],
        }),
      )
      expect(warnSpy).toHaveBeenCalledWith(
        'ai_run_guard_rejected',
        expect.objectContaining({
          questionHash: councilRejected.questionHash,
          provider: 'google',
          requestedModel: MODELS.google,
          modelId: RETURNED_MODELS.google,
          reason: 'SCHEMA_FAIL',
          numbersInText: ['42.75'],
          factIdNumbers: [],
        }),
      )
      expect(warnSpy).toHaveBeenCalledWith(
        'ai_run_guard_rejected',
        expect.objectContaining({
          questionHash: councilRejected.questionHash,
          provider: 'xai',
          requestedModel: MODELS.xai,
          modelId: RETURNED_MODELS.xai,
          reason: 'FACT_MISMATCH',
          numbersInText: ['888.5'],
          factIdNumbers: [],
        }),
      )

      // Run 2: Provider timeout (`modelId: ''` on participant) stores `requestedModel` in public.ai_runs."modelId"
      const validComparison = JSON.stringify({
        comparison: {
          subject_id: 'avenues',
          relation: 'better',
          object_id: 'salmiya',
          metric: 'net_sales',
          cited_fact_ids: ['fact-net', 'fact-salmiya'],
        },
      })

      const councilTimeout = await runFeryalCouncil(
        {
          question: 'أيهما أعلى مبيعات اليوم الأفنيوز أم السالمية؟',
          userId: 'exec-1',
          userRole: 'admin',
        },
        {
          askOdoo: (async () => buildOdooCouncilAnswer()) as RunCouncilOptions['askOdoo'],
          keys: SECRET_KEYS,
          models: MODELS,
          timeoutMs: 300,
          fetchImpl: async (input, init) => {
            const provider = providerOfUrl(String(input))
            if (!provider) throw new Error('unexpected provider url')
            if (provider === 'anthropic') {
              return abortOnSignal(init?.signal ?? undefined)
            }
            return providerResponse(provider, validComparison)
          },
        },
      )

      expect(councilTimeout.status).toBe('answered')
      expect(
        councilTimeout.participants.find((p) => p.provider === 'anthropic'),
      ).toMatchObject({
        status: 'error',
        errorCode: 'TIMEOUT',
        modelId: '',
      })

      const timeoutPgRows = await pglite.query<{
        provider: string
        modelId: string
        status: string
        errorCode: string | null
      }>(
        `SELECT provider, "modelId", status, "errorCode"
         FROM public.ai_runs
         WHERE "questionHash" = $1
         ORDER BY provider`,
        [councilTimeout.questionHash],
      )
      expect(timeoutPgRows.rows).toEqual([
        {
          provider: 'anthropic',
          modelId: MODELS.anthropic,
          status: 'error',
          errorCode: 'TIMEOUT',
        },
        {
          provider: 'google',
          modelId: RETURNED_MODELS.google,
          status: 'ok',
          errorCode: null,
        },
        {
          provider: 'xai',
          modelId: RETURNED_MODELS.xai,
          status: 'ok',
          errorCode: null,
        },
      ])

      // Verify council.ts and structured-claim.ts remain 100% untouched
      const councilDiff = execFileSync('git', ['diff', 'b985f9b', '--', '**/council.ts'], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
      expect(councilDiff).toBe('')
      const structuredClaimDiff = execFileSync(
        'git',
        ['diff', 'HEAD', '--', 'src/server/ai/structured-claim.ts'],
        { cwd: process.cwd(), encoding: 'utf8' },
      )
      expect(structuredClaimDiff).toBe('')
    } finally {
      await pglite.close()
    }
  })
})
