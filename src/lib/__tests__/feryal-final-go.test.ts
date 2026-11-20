import { execFileSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildFeryalConnectionErrorOutcome,
  FERYAL_CONNECTION_ERROR_AR,
  FERYAL_CONNECTION_ERROR_EN,
  parseFeryalChatHttpResponse,
} from '@/lib/feryal-intent'
import {
  askFeryalOdooAgent,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import {
  asksSuggestedPriceQuestion,
  extractTargetDishFromQuestion,
  findMatchingMenuItems,
  type ItemPricingRead,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import { logger } from '@/lib/logger'
import {
  clearYearClosedCache,
  clearYearClosedMemoryCache,
  configureYearClosedPersistentStore,
  flushYearClosedInflightWrites,
  readClosedYearPlusToday,
  scheduleYearClosedPersistentWrite,
  writeYearClosedPersistentEntry,
  type YearClosedPersistentStore,
} from '@/lib/odoo/pos-order-query'
import { runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'
import {
  DEFAULT_GEMINI_MODEL,
  resolveCouncilModels,
  type CouncilModels,
} from '@/server/ai/models'
import {
  configureAiPersistQueryable,
  diagnoseGuardRejectedAnswer,
  safeListAiRuns,
  type AiSqlQueryable,
} from '@/server/ai/persist'
import {
  callProvider,
  resetProviderCooldowns,
  resetProviderTelemetry,
  type ProviderId,
} from '@/server/ai/providers'
import type { ComparableFact } from '@/server/ai/structured-claim'

const SECRET_KEYS = {
  anthropic: ['sk-ant-', 'fake-test-only-key-90001'].join(''),
  google: ['AIza', 'FakeTestOnlyKey90002000'].join(''),
  xai: ['xai-', 'fake-test-only-key-90003'].join(''),
}

const TEST_MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: DEFAULT_GEMINI_MODEL,
  xai: 'grok-4',
}

const PERIOD_COMPARABLE_FACTS: readonly ComparableFact[] = [
  {
    id: 'fact-avenues-nov20',
    metric: 'net_sales',
    period: '2026-11-01..2026-11-20',
    date: '2026-11-20',
    unit: 'KWD',
    value: '1850.5',
    entityType: 'branch',
    entityId: 'avenues',
    entityName: 'avenues',
  },
  {
    id: 'fact-salmiya-nov20',
    metric: 'net_sales',
    period: '2026-11-20',
    date: '2026-11-20',
    unit: 'KWD',
    value: '1420.25',
    entityType: 'branch',
    entityId: 'salmiya',
    entityName: 'salmiya',
  },
]

function buildMenuItemFixture(): ItemPricingRow[] {
  return [
    {
      productId: 90051,
      name: '[RIC90051] Chicken Noodles',
      qty: '160',
      netKwd: '472.000',
      unitPriceKwd: '2.950',
      unitCostKwd: '0.780',
      categoryId: 11,
      brandId: 'china-garden',
    },
    {
      productId: 90088,
      name: '[RIC90088] Vegetable Spring Roll',
      qty: '95',
      netKwd: '142.500',
      unitPriceKwd: '1.500',
      unitCostKwd: '0.350',
      categoryId: 11,
      brandId: 'china-garden',
    },
  ]
}

function buildItemPricingRead(rows: ItemPricingRow[]): ItemPricingRead {
  return {
    rows,
    domain: [['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
    groupby: ['product_id'],
    chunks: 1,
    configIds: [8, 17, 24, 36],
  }
}

function providerOfUrl(url: string): ProviderId | null {
  if (url.includes('anthropic.com')) return 'anthropic'
  if (url.includes('googleapis.com')) return 'google'
  if (url.includes('x.ai')) return 'xai'
  return null
}

function jsonHttpResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function okProviderResponse(provider: ProviderId, text: string): Response {
  if (provider === 'anthropic') {
    return jsonHttpResponse({
      model: 'claude-sonnet-4-6-20260101',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 100, output_tokens: 40 },
    })
  }
  if (provider === 'google') {
    return jsonHttpResponse({
      modelVersion: 'gemini-2.5-flash',
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40 },
    })
  }
  return jsonHttpResponse({
    model: 'grok-4-0709',
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 100, completion_tokens: 40 },
  })
}

describe('fix/feryal-final-go verification gate', () => {
  beforeEach(() => {
    resetProviderCooldowns()
    resetProviderTelemetry()
    configureAiPersistQueryable(undefined)
    configureYearClosedPersistentStore(undefined)
    clearYearClosedMemoryCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    configureAiPersistQueryable(undefined)
    clearYearClosedCache()
    configureYearClosedPersistentStore(undefined)
  })

  it('Item 1: strips Arabic interrogative/reasoning tails (وليش، ليش، لماذا، ولماذا، ليه، وليه، ؟) and matches literal "شو السعر المقترح لصنف نودلز الدجاج وليش؟" to Chicken Noodles', async () => {
    const literalQuestion = 'شو السعر المقترح لصنف نودلز الدجاج وليش؟'

    expect(asksSuggestedPriceQuestion(literalQuestion)).toBe(true)
    const extracted = extractTargetDishFromQuestion(literalQuestion)
    expect(extracted).toBe('نودلز الدجاج')

    const items = buildMenuItemFixture()
    const matched = findMatchingMenuItems(extracted!, items)
    expect(matched).toHaveLength(1)
    expect(matched[0]?.name).toBe('[RIC90051] Chicken Noodles')
    expect(matched[0]?.productId).toBe(90051)

    const variants = [
      'ما السعر المقترح لصنف نودلز الدجاج ليش؟',
      'كم السعر المقترح لطبق نودلز الدجاج ولماذا؟',
      'السعر المقترح لصنف نودلز الدجاج لماذا؟',
      'شو السعر المقترح لصنف نودلز الدجاج وليه؟',
      'شو السعر المقترح لصنف نودلز الدجاج ليه؟',
    ]
    for (const q of variants) {
      const target = extractTargetDishFromQuestion(q)
      expect(target).toBe('نودلز الدجاج')
      const variantMatches = findMatchingMenuItems(target!, items)
      expect(variantMatches).toHaveLength(1)
      expect(variantMatches[0]?.name).toBe('[RIC90051] Chicken Noodles')
    }

    const stubDataSource: FeryalOdooDataSource = {
      fetchPeriodCube: async () => null,
      fetchWarehouseChain: async () => null,
      fetchPurchaseOrders: async () => null,
      fetchReceivablesSummary: async () => null,
      fetchBranchTopProducts: async () => null,
      getLastSyncAt: async () => '2026-11-20T12:00:00.000Z',
      fetchItemPricingLines: async () => buildItemPricingRead(items),
    }

    const answer = await askFeryalOdooAgent({
      question: literalQuestion,
      userSub: 'exec-boudi',
      userRole: 'admin',
      referenceNowMs: Date.parse('2026-11-20T12:00:00.000Z'),
      dataSource: stubDataSource,
      skipAuditLog: true,
    })

    expect(answer.status).toBe('answered')
    expect(answer.reply).toContain('Chicken Noodles')
    expect(answer.reply).toContain('السعر المقترح')
    expect(answer.verifier.valid).toBe(true)
  })

  it('Item 2: replaces broken gemini-3.1-pro-preview with stable gemini-2.5-flash and logs actual HTTP status + sanitized errorSummary inside ai_provider_attempt and ai_runs', async () => {
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-2.5-flash')
    expect(DEFAULT_GEMINI_MODEL).not.toBe('gemini-3.1-pro-preview')
    expect(resolveCouncilModels({ NODE_ENV: 'test' })).toMatchObject({
      google: 'gemini-2.5-flash',
    })

    const warnSpy = vi.spyOn(logger, 'warn')
    const pglite = new PGlite()
    try {
      await pglite.exec('CREATE ROLE anon; CREATE ROLE authenticated;')
      const pgAdapter: AiSqlQueryable = {
        async query<R extends Record<string, unknown> = Record<string, unknown>>(
          text: string,
          params?: unknown[],
        ) {
          const res = await pglite.query<R>(text, params)
          return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
        },
      }
      configureAiPersistQueryable(pgAdapter)

      const direct404 = await callProvider({
        provider: 'google',
        apiKey: SECRET_KEYS.google,
        model: DEFAULT_GEMINI_MODEL,
        system: 'Return JSON.',
        user: 'Question:\ntest\n\nOdoo facts JSON:\n[]',
        timeoutMs: 1_500,
        fetchImpl: async () =>
          jsonHttpResponse(
            {
              error: {
                code: 404,
                message: `models/legacy-preview is not found for API version v1beta (api_key=${SECRET_KEYS.google})`,
                status: 'NOT_FOUND',
              },
            },
            404,
          ),
      })

      expect(direct404).toMatchObject({
        provider: 'google',
        requestedModel: 'gemini-2.5-flash',
        status: 'error',
        errorCode: 'HTTP_CLIENT',
        httpStatus: 404,
      })
      expect(direct404.errorSummary).toContain(
        'NOT_FOUND: models/legacy-preview is not found for API version v1beta',
      )
      expect(direct404.errorSummary).not.toContain(SECRET_KEYS.google)

      expect(warnSpy).toHaveBeenCalledWith(
        'ai_provider_attempt',
        expect.objectContaining({
          provider: 'google',
          requestedModel: 'gemini-2.5-flash',
          modelId: 'gemini-2.5-flash',
          status: 'error',
          errorCode: 'HTTP_CLIENT',
          httpStatus: 404,
          errorSummary: expect.stringContaining('NOT_FOUND: models/legacy-preview is not found'),
        }),
      )

      const validComparison = JSON.stringify({
        comparison: {
          subject_id: 'avenues',
          relation: 'better',
          object_id: 'salmiya',
          metric: 'net_sales',
          cited_fact_ids: ['fact-avenues-nov20', 'fact-salmiya-nov20'],
        },
      })

      const councilRes = await runFeryalCouncil(
        {
          question: 'قارن صافي المبيعات بين الأفنيوز والسالمية في 2026-11-20',
          userId: 'exec-1',
          userRole: 'admin',
        },
        {
          askOdoo: (async () => ({
            reply: 'مبيعات الأفنيوز 1850.5 د.ك مقابل السالمية 1420.25 د.ك.',
            status: 'answered' as const,
            executedQueries: [],
            verifier: { valid: true, extractedNumbers: [1850.5, 1420.25], unverifiedNumbers: [] },
            toolNumbers: [1850.5, 1420.25],
            period: { from: '2026-11-20', to: '2026-11-20' },
            source: null,
            facts: [...PERIOD_COMPARABLE_FACTS],
            auditEntry: {
              id: 'audit-final-go-1',
              timestampIso: '2026-11-20T12:00:00.000Z',
              userSub: 'exec-1',
              userRole: 'admin',
              question: 'قارن صافي المبيعات بين الأفنيوز والسالمية في 2026-11-20',
              status: 'answered' as const,
              executedQueries: [],
              verifier: { valid: true, extractedNumbers: [1850.5, 1420.25], unverifiedNumbers: [] },
              finalReply: 'مبيعات الأفنيوز 1850.5 د.ك مقابل السالمية 1420.25 د.ك.',
            },
          })) as RunCouncilOptions['askOdoo'],
          keys: SECRET_KEYS,
          models: TEST_MODELS,
          timeoutMs: 1_500,
          fetchImpl: async (input) => {
            const p = providerOfUrl(String(input))
            if (p === 'google') {
              return jsonHttpResponse(
                {
                  error: {
                    code: 400,
                    message: 'Invalid value at generation_config',
                    status: 'INVALID_ARGUMENT',
                  },
                },
                400,
              )
            }
            if (!p) throw new Error('unexpected url')
            return okProviderResponse(p, validComparison)
          },
        },
      )

      expect(councilRes.status).toBe('answered')
      const runsSnap = await safeListAiRuns(10)
      const googleRow = runsSnap.runs.find((r) => r.provider === 'google')
      expect(googleRow).toMatchObject({
        provider: 'google',
        modelId: 'gemini-2.5-flash',
        status: 'error',
        errorCode:
          'HTTP_CLIENT;httpStatus=400;errorSummary=INVALID_ARGUMENT: Invalid value at generation_config',
      })
    } finally {
      await pglite.close()
    }
  })

  it('Item 3: always renders Ask Feryal connection error in Arabic regardless of UI locale', async () => {
    expect(FERYAL_CONNECTION_ERROR_AR).toBe('تعذّر الاتصال — أعد المحاولة')
    expect(FERYAL_CONNECTION_ERROR_EN).toBe('تعذّر الاتصال — أعد المحاولة')

    const arOutcome = buildFeryalConnectionErrorOutcome(true)
    const enOutcome = buildFeryalConnectionErrorOutcome(false)

    expect(arOutcome).toEqual({
      replyText: 'تعذّر الاتصال — أعد المحاولة',
      modelBadge: 'تعذّر الاتصال',
      replyStatus: 'connection_error',
    })
    expect(enOutcome).toEqual({
      replyText: 'تعذّر الاتصال — أعد المحاولة',
      modelBadge: 'تعذّر الاتصال',
      replyStatus: 'connection_error',
    })
    expect(enOutcome.replyText).not.toMatch(/[A-Za-z]/)
    expect(enOutcome.modelBadge).not.toMatch(/[A-Za-z]/)

    const httpFailEn = await parseFeryalChatHttpResponse(
      { ok: false, json: async () => ({}) },
      false,
    )
    expect(httpFailEn.replyStatus).toBe('connection_error')
    expect(httpFailEn.replyText).toBe('تعذّر الاتصال — أعد المحاولة')
    expect(httpFailEn.modelBadge).toBe('تعذّر الاتصال')

    const malformedPayloadEn = await parseFeryalChatHttpResponse(
      { ok: true, json: async () => ({ ok: false }) },
      false,
    )
    expect(malformedPayloadEn.replyStatus).toBe('connection_error')
    expect(malformedPayloadEn.replyText).toBe('تعذّر الاتصال — أعد المحاولة')
    expect(malformedPayloadEn.modelBadge).toBe('تعذّر الاتصال')
  })

  it('Item 4: excludes period date parts (e.g. 11, 20, 2026) from logged offendingNumbers in persist.ts without touching council.ts or guards', async () => {
    const diagnosisWithHallucination = diagnoseGuardRejectedAnswer({
      text: 'خلال الفترة 2026-11-01 إلى 2026-11-20 وفي يوم 20 من شهر 11 بلغت المبيعات 999.9 د.ك',
      facts: PERIOD_COMPARABLE_FACTS,
      requestedModel: DEFAULT_GEMINI_MODEL,
    })

    expect(diagnosisWithHallucination).toEqual({
      reason: 'PARSE_FAIL',
      requestedModel: 'gemini-2.5-flash',
      offendingNumbers: ['999.9'],
      errorCode: 'PARSE_FAIL;requestedModel=gemini-2.5-flash;offendingNumbers=[999.9]',
    })

    const diagnosisOnlyPeriodDateParts = diagnoseGuardRejectedAnswer({
      text: 'ملخص يوم 20 من شهر 11 لعام 2026 (2026-11-20)',
      facts: PERIOD_COMPARABLE_FACTS,
      requestedModel: 'claude-sonnet-4-6',
    })
    expect(diagnosisOnlyPeriodDateParts.offendingNumbers).toEqual([])
    expect(diagnosisOnlyPeriodDateParts.errorCode).toBe(
      'PARSE_FAIL;requestedModel=claude-sonnet-4-6;offendingNumbers=[]',
    )

    const councilDiff = execFileSync(
      'git',
      ['diff', 'b985f9b', '--', 'src/server/ai/council.ts'],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    expect(councilDiff).toBe('')

    const structuredClaimDiff = execFileSync(
      'git',
      ['diff', '6fa6911', '--', 'src/server/ai/structured-claim.ts'],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    expect(structuredClaimDiff).toBe('')

    const numberGuardDiff = execFileSync(
      'git',
      ['diff', '6fa6911', '--', 'src/server/ai/number-guard.ts'],
      { cwd: process.cwd(), encoding: 'utf8' },
    )
    expect(numberGuardDiff).toBe('')
  })

  it('Item 5: makes background L2 cache fill non-blocking (<100ms even on 5s slow write or throwing after()) and deduplicated so it never runs twice', async () => {
    let setCallCount = 0
    let releaseSlowWrite: () => void = () => {}
    const slowWriteGate = new Promise<void>((resolve) => {
      releaseSlowWrite = resolve
    })

    const slowL2Store: YearClosedPersistentStore = {
      async get() {
        return undefined
      },
      async set() {
        setCallCount += 1
        await slowWriteGate
      },
      scheduleAfter: () => {
        throw new Error('after was called outside a request scope')
      },
    }

    configureYearClosedPersistentStore(slowL2Store)
    clearYearClosedMemoryCache()

    const closedWindow = { fromUtc: '2026-01-01 00:00:00', toUtc: '2026-11-19 21:00:00' }
    const todayWindow = { fromUtc: '2026-11-19 21:00:00', toUtc: '2026-11-20 21:00:00' }
    const startedMs = Date.now()

    const rows = await readClosedYearPlusToday<{ id: number; net: number }>({
      cacheKey: 'final-go:nonblocking:2026',
      closed: closedWindow,
      today: todayWindow,
      l2TimeoutMs: 5_000,
      read: async (win) =>
        win.fromUtc === closedWindow.fromUtc ? [{ id: 1, net: 900 }] : [{ id: 2, net: 45 }],
      merge: (all) => [...all],
    })

    const elapsedMs = Date.now() - startedMs
    expect(rows).toEqual([
      { id: 1, net: 900 },
      { id: 2, net: 45 },
    ])
    // Must NEVER add 5_000ms to the first request!
    expect(elapsedMs).toBeLessThan(250)

    // Trigger duplicate background writes for the same key while first write is still in flight
    scheduleYearClosedPersistentWrite('final-go:nonblocking:2026', { rows, at: Date.now() })
    void writeYearClosedPersistentEntry('final-go:nonblocking:2026', { rows, at: Date.now() })

    releaseSlowWrite()
    await flushYearClosedInflightWrites()

    // Deduplicated: store.set executed strictly ONCE (never twice!)
    expect(setCallCount).toBe(1)
  })
})
