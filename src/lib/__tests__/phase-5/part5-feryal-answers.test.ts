/**
 * Part 5 (§F) Verification Suite — Feryal Answers Properly.
 *
 * Uses `feryal-dialect-fixture.ts` shapes (no invented business numbers). Covers all 10 required
 * Part 5 §F cases, Qurain central kitchen handling, conversation `history` forwarding across
 * `feryal-governance-studio.tsx` and `POST /api/erp/feryal/chat`, plus 6 grounded Q→A transcripts.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGlobalFilter } = vi.hoisted(() => ({
  mockGlobalFilter: { current: null as Record<string, unknown> | null },
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/feryal-ai',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('period=today&branch=salmiya'),
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname?: string }
    children?: React.ReactNode
    className?: string
  }) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : href?.pathname ?? '#', ...rest },
      children,
    ),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => mockGlobalFilter.current,
}))

import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'
import { computeGlobalWorkspace, DEFAULT_GLOBAL_FILTERS } from '@/lib/aether/global-filter-engine'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import type { FeryalChatHistoryTurn } from '@/lib/feryal-context-types'
import {
  buildFeryalChatRequestPayload,
  detectTargetBranchFromQuestion,
  isCentralKitchenQurainQuestion,
  sanitizeFeryalChatHistory,
} from '@/lib/feryal-intent'
import {
  askFeryalOdooAgent,
  buildFeryalNoOdooDataSuggestion,
  FERYAL_NO_ODOO_DATA_REPLY,
  resetFeryalAuditCache,
  type FeryalOdooDataSource,
} from '@/lib/feryal-odoo-agent'
import { LanguageProvider } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import { bustOdooLiveCache, type OdooPeriodCube } from '@/lib/odoo-live-connector'
import { loadFeryalCompanyContext, loadLatestAdvisorReports } from '@/server/ai/advisor-reports'
import {
  COUNCIL_MODEL_FALLBACK_NOTE,
  runFeryalCouncil,
  type RunCouncilOptions,
} from '@/server/ai/council'
import { computeRunRateProjection, RUN_RATE_PROJECTION_LABEL_AR } from '@/server/ai/derived-numbers'
import type { CouncilKeys } from '@/server/ai/env'
import type { CouncilModels } from '@/server/ai/models'
import {
  createDialectDataSource,
  DIALECT_NOW_MS,
  monthCube,
  todayCube,
  yesterdayCube,
} from './support/feryal-dialect-fixture'

const TEST_KEYS: CouncilKeys = {
  anthropic: 'test-anthropic-key-0001',
  google: 'test-google-key-00000001',
  xai: 'test-grok-key-0000000001',
}

const TEST_MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
  xai: 'grok-4',
}

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function emptyChannelsRecord() {
  return {
    'dine-in': { netKwd: 0, orders: 0 },
    'takeaway-direct': { netKwd: 0, orders: 0 },
    'talabat-tgo': { netKwd: 0, orders: 0 },
    'talabat-tmp': { netKwd: 0, orders: 0 },
    keeta: { netKwd: 0, orders: 0 },
    deliveroo: { netKwd: 0, orders: 0 },
    jahez: { netKwd: 0, orders: 0 },
    snoonu: { netKwd: 0, orders: 0 },
  }
}

function makeExhibitionCube(base: OdooPeriodCube): OdooPeriodCube {
  const synthNetKwd = 100
  const synthOrders = 20
  const synthAovKwd = 5
  return {
    ...base,
    totals: {
      ...base.totals,
      netSalesKwd: base.totals.netSalesKwd + synthNetKwd,
      orders: base.totals.orders + synthOrders,
      mappedBranchesNetKwd: base.totals.mappedBranchesNetKwd + synthNetKwd,
      mappedBranchesOrders: base.totals.mappedBranchesOrders + synthOrders,
    },
    byBranch: {
      ...base.byBranch,
      exhibitions: {
        netKwd: synthNetKwd,
        orders: synthOrders,
        aovKwd: synthAovKwd,
        channels: emptyChannelsRecord(),
      },
    },
  }
}

function createExhibitionDialectDataSource(): FeryalOdooDataSource {
  const base = createDialectDataSource()
  return {
    ...base,
    fetchPeriodCube: async (fromIso, toIso, ref) => {
      const cube = await base.fetchPeriodCube(fromIso, toIso, ref)
      return cube ? makeExhibitionCube(cube) : null
    },
  }
}

function makeProviderResponse(url: string, text: string): Response {
  if (url.includes('api.anthropic.com')) {
    return Response.json({
      model: 'claude-sonnet-4-6-test',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 20, output_tokens: 15 },
    })
  }
  if (url.includes('generativelanguage.googleapis.com')) {
    return Response.json({
      modelVersion: 'gemini-3.1-pro-test',
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10 },
    })
  }
  return Response.json({
    model: 'grok-4-test',
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: 20, completion_tokens: 10 },
  })
}

function runCouncilWithFixture(params: {
  question: string
  dataSource?: FeryalOdooDataSource
  history?: FeryalChatHistoryTurn[]
  period?: string
  keys?: CouncilKeys
  fetchImpl: typeof fetch
}) {
  const ds = params.dataSource ?? createDialectDataSource()
  return runFeryalCouncil(
    {
      question: params.question,
      userId: 'part5-test',
      userRole: 'admin',
      referenceNowMs: DIALECT_NOW_MS,
      ...(params.period ? { period: params.period } : {}),
      ...(params.history ? { history: params.history } : {}),
    },
    {
      askOdoo: ((agentInput) =>
        askFeryalOdooAgent({
          ...agentInput,
          dataSource: ds,
          skipAuditLog: true,
        })) as RunCouncilOptions['askOdoo'],
      fetchImpl: params.fetchImpl,
      keys: params.keys ?? TEST_KEYS,
      models: TEST_MODELS,
      persist: async () => undefined,
    },
  )
}

function setupStudioFilterMock() {
  const filters = { ...DEFAULT_GLOBAL_FILTERS, period: 'today' as const, branch: 'salmiya' as const }
  const summary = {
    source: 'live' as const,
    connected: true,
    sourceMode: 'odoo17-live' as const,
    noData: false,
    lastSyncAt: '2026-11-17T11:15:00.000Z',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: '2026-11-17', to: '2026-11-17' },
    syncedAt: '2026-11-17T11:15:00.000Z',
    period: { from: '2026-11-17', to: '2026-11-17' },
    database: null,
    totals: { netSalesKwd: 1350, orders: 1100, aovKwd: 4.9 },
    brands: [],
    branches: [],
    channels: [],
  }
  const workspace = computeGlobalWorkspace(filters, summary, '/erp/feryal-ai')
  mockGlobalFilter.current = {
    filters,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: vi.fn(async () => undefined),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setLens: vi.fn(),
    resetFilters: vi.fn(),
    buildShareDeepLinkText: () => '',
  }
}

describe('Part 5 (§F) — Feryal answers properly from Odoo context pack', () => {
  beforeEach(() => {
    resetFeryalAuditCache()
    setupStudioFilterMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Case 1: «فهمتي شو؟», «مرحبا», «في محادثات قديمة معك وبينا» never return FERYAL_NO_ODOO_DATA_REPLY or status=no_odoo_data in agent or council', async () => {
    const ds = createDialectDataSource()
    const genericSuggestion = buildFeryalNoOdooDataSuggestion('generic')
    const metaQuestions = ['فهمتي شو؟', 'مرحبا', 'في محادثات قديمة معك وبينا']
    const sampleHistory: FeryalChatHistoryTurn[] = [
      { role: 'user', text: 'كم مبيعات السالمية أمس؟' },
      { role: 'assistant', text: 'سجلت السالمية مبيعات أمس حسب مكعب Odoo.' },
    ]

    for (const q of metaQuestions) {
      const agentRes = await askFeryalOdooAgent({
        question: q,
        history: q === 'مرحبا' ? undefined : sampleHistory,
        referenceNowMs: DIALECT_NOW_MS,
        dataSource: ds,
        skipAuditLog: true,
      })
      expect(agentRes.status, q).toBe('answered')
      expect(agentRes.status, q).not.toBe('no_odoo_data')
      expect(agentRes.reply, q).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
      expect(agentRes.reply, q).not.toBe(genericSuggestion)
      expect(agentRes.verifier.valid, q).toBe(true)

      const councilFallbackRes = await runCouncilWithFixture({
        question: q,
        dataSource: ds,
        history: q === 'مرحبا' ? undefined : sampleHistory,
        keys: { anthropic: '', google: '', xai: '' },
        fetchImpl: async () => {
          throw new Error('must not call network when keys are empty')
        },
      })
      expect(councilFallbackRes.status, `${q} (council fallback)`).toBe('answered')
      expect(councilFallbackRes.status, `${q} (council fallback)`).not.toBe('no_odoo_data')
      expect(councilFallbackRes.reply, `${q} (council fallback)`).not.toContain(
        FERYAL_NO_ODOO_DATA_REPLY,
      )
      expect(councilFallbackRes.reply, `${q} (council fallback)`).not.toBe(genericSuggestion)

      const councilModelRes = await runCouncilWithFixture({
        question: q,
        dataSource: ds,
        history: sampleHistory,
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return makeProviderResponse(
              url,
              JSON.stringify({
                answer_ar:
                  'أهلاً بك! نعم أتابع محادثتنا حول السالمية وأقرأ مكعب Odoo للفترة الحالية بصافي 78,240.0 د.ك.',
                claims: [
                  {
                    text: 'أقرأ مكعب Odoo للفترة الحالية بصافي 78,240.0 د.ك.',
                    numbers: [{ value: 78240, section: 'companyTotals' }],
                  },
                ],
                proposals: [
                  {
                    text: 'مراجعة أداء فرع السالمية وساعات الذروة لهذا الأسبوع.',
                    owner: 'مدير العمليات',
                    kind: 'proposal',
                  },
                ],
                missing_metrics: [],
              }),
            )
          }
          return makeProviderResponse(url, JSON.stringify({ status: 'ok', note: '' }))
        },
      })
      expect(councilModelRes.status, `${q} (council model)`).toBe('answered')
      expect(councilModelRes.status, `${q} (council model)`).not.toBe('no_odoo_data')
      expect(councilModelRes.reply, `${q} (council model)`).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
    }
  })

  it('Case 2: «شو أفضل ساعة عندنا؟» uses hourlySeries from fixture and names the peak hour', async () => {
    const ds = createDialectDataSource()
    // Period default -> monthCube uses YESTERDAY_HOURLY whose peak is hour 20 (470 KWD, 94 orders)
    const monthHourlyRes = await askFeryalOdooAgent({
      question: 'شو أفضل ساعة عندنا؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(monthHourlyRes.status).toBe('answered')
    expect(monthHourlyRes.verifier.valid).toBe(true)
    expect(monthHourlyRes.reply).toContain('20:00')
    expect(monthHourlyRes.reply).toContain('470.0 د.ك')
    expect(monthHourlyRes.reply).toContain('94 طلبات')
    expect(monthHourlyRes.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)

    // Today's partial cube -> TODAY_HOURLY peak is hour 13 (360 KWD, 72 orders)
    const todayHourlyRes = await askFeryalOdooAgent({
      question: 'شو أفضل ساعة عندنا اليوم؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(todayHourlyRes.status).toBe('answered')
    expect(todayHourlyRes.reply).toContain('13:00')
    expect(todayHourlyRes.reply).toContain('360.0 د.ك')
    expect(todayHourlyRes.reply).toContain('72 طلبات')
    expect(todayHourlyRes.verifier.valid).toBe(true)

    const todayFixturePeak = todayCube().hourlySeries.reduce((best, cur) =>
      cur.netKwd > best.netKwd ? cur : best,
    )
    expect(todayFixturePeak.hour).toBe(13)
  })

  it('Case 3: «ليش طلبات عم تنزلنا؟» uses channel data (talabat) and returns hypotheses and proposals labelled «اقتراح»', async () => {
    const ds = createDialectDataSource()
    const res = await askFeryalOdooAgent({
      question: 'ليش طلبات عم تنزلنا؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    expect(res.verifier.unverifiedNumbers).toEqual([])
    expect(res.reply).toContain('talabat-tgo')
    expect(res.reply).toContain('talabat-tmp')
    expect(res.reply).toContain('20,800.0 د.ك')
    expect(res.reply).toContain('14,400.0 د.ك')
    expect(res.reply).toContain('6,400.0 د.ك')
    expect(res.reply).toContain('استنتاج')
    expect(res.reply).toContain('اقتراح')
  })

  it('Case 4: «شو وضع البوثات؟» includes «بوثات المعارض» figures from fixture exhibitions cell', async () => {
    const ds = createExhibitionDialectDataSource()
    const res = await askFeryalOdooAgent({
      question: 'شو وضع البوثات؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    expect(res.reply).toContain('بوثات المعارض')
    expect(res.reply).toContain('100.0 د.ك')
    expect(res.reply).toContain('20 طلبات')
    expect(res.reply).toContain('5.0 د.ك')
    expect(res.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
  })

  it('Case 5: missing metric question (prep time / drivers) states unavailable once («غير متاح في Odoo») and analyzes available sections', async () => {
    const ds = createDialectDataSource()
    const prepRes = await askFeryalOdooAgent({
      question: 'شو اقتراحك لزمن التحضير؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(prepRes.status).toBe('answered')
    expect(prepRes.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
    expect(prepRes.reply.match(/غير متاح في Odoo/g)).toHaveLength(1)
    expect(prepRes.reply).toContain('KDS / Prep Time')
    // Available pack sections (hourly + company totals + proposals) are still present
    expect(prepRes.reply).toContain('20:00')
    expect(prepRes.reply).toContain('470.0 د.ك')
    expect(prepRes.reply).toContain('78,240.0 د.ك')
    expect(prepRes.reply).toContain('اقتراح')
    expect(prepRes.verifier.valid).toBe(true)

    const driverRes = await askFeryalOdooAgent({
      question: 'كيف أداء سائقي التوصيل اليوم؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(driverRes.status).toBe('answered')
    expect(driverRes.reply.match(/غير متاح في Odoo/g)).toHaveLength(1)
    expect(driverRes.reply).toContain('Drivers / GPS')
    expect(driverRes.reply).toContain('13:00')
    expect(driverRes.reply).toContain('اقتراح')
    expect(driverRes.verifier.valid).toBe(true)
  })

  it('Case 6: forecast question returns labelled projection whose number equals server-recomputed run-rate from fixture values', async () => {
    const ds = createDialectDataSource()
    const month = monthCube()
    const expectedRunRate = computeRunRateProjection({
      actualToDateKwd: month.totals.netSalesKwd,
      elapsedDays: 17,
      totalDaysInMonth: 30,
    })

    const res = await askFeryalOdooAgent({
      question: 'شو توقعات مبيعات هذا الشهر؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: ds,
      skipAuditLog: true,
    })
    expect(res.status).toBe('answered')
    expect(res.reply).toContain(RUN_RATE_PROJECTION_LABEL_AR)
    expect(res.reply).toContain('78,240.0 د.ك')
    expect(res.reply).toContain('138,070.588 د.ك')
    expect(expectedRunRate.projectedKwd).toBe(138070.588)
    expect(res.reply).toContain('غير متاح في Odoo')
    expect(res.verifier.valid).toBe(true)

    // Council verifies LLM forecast claim only when derived run-rate matches server recomputation
    const councilRes = await runCouncilWithFixture({
      question: 'شو توقعات مبيعات هذا الشهر؟',
      dataSource: ds,
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.includes('api.anthropic.com')) {
          return makeProviderResponse(
            url,
            JSON.stringify({
              answer_ar: `${RUN_RATE_PROJECTION_LABEL_AR}: بناءً على مبيعات 78,240 د.ك خلال 17 يوماً يكون إسقاط 30 يوماً نحو 138,070.588 د.ك.`,
              claims: [
                {
                  text: `مبيعات الشهر حتى تاريخه 78,240 د.ك وإسقاط نهاية الشهر 138,070.588 د.ك.`,
                  numbers: [
                    { value: 78240, section: 'companyTotals' },
                    { value: 138070.588, section: 'companyTotals' },
                  ],
                },
              ],
              proposals: [
                {
                  text: 'متابعة متوسط الطلب في الساعات الهادئة أسبوعياً.',
                  owner: 'مدير العمليات',
                  kind: 'proposal',
                },
              ],
              missing_metrics: ['الموازنات التقديرية (crossovered.budget) غير متاح في Odoo'],
            }),
          )
        }
        return makeProviderResponse(url, JSON.stringify({ status: 'ok', note: '' }))
      },
    })
    expect(councilRes.status).toBe('answered')
    expect(councilRes.reply).toContain('138,070.588')
    expect(councilRes.reply).toContain(RUN_RATE_PROJECTION_LABEL_AR)
  })

  it('Case 7: mock model output with 1 unverified claim + 1 valid claim drops ONLY the unverified claim and returns status=answered', async () => {
    const yesterday = yesterdayCube()
    const validNet = yesterday.totals.netSalesKwd // 4890
    const res = await runCouncilWithFixture({
      question: 'كم كانت مبيعات أمس؟',
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.includes('api.anthropic.com')) {
          return makeProviderResponse(
            url,
            JSON.stringify({
              answer_ar: `بلغ صافي مبيعات أمس ${validNet} د.ك. وسجل فرع الأفنيوز زيادة وهمية بمقدار 99,999.9 د.ك.`,
              claims: [
                {
                  text: `بلغ صافي مبيعات أمس ${validNet} د.ك.`,
                  numbers: [{ value: validNet, section: 'companyTotals' }],
                },
                {
                  text: 'وسجل فرع الأفنيوز زيادة وهمية بمقدار 99,999.9 د.ك.',
                  numbers: [{ value: 99999.9, section: 'branches' }],
                },
              ],
              root_causes: [{ text: 'تركز الطلب في الساعة المسائية.', kind: 'hypothesis' }],
              proposals: [
                {
                  text: 'تعزيز طاقم المطبخ قبل ساعة الذروة.',
                  owner: 'مدير العمليات',
                  kind: 'proposal',
                },
              ],
              missing_metrics: [],
            }),
          )
        }
        return makeProviderResponse(url, JSON.stringify({ status: 'ok', note: '' }))
      },
    })
    expect(res.status).toBe('answered')
    expect(res.reply).toContain('4890')
    expect(res.reply).toContain('اقتراح')
    expect(res.reply).not.toContain('99,999.9')
    expect(res.reply).not.toContain('99999.9')
    expect(res.agreed.map((a) => a.provider)).toContain('anthropic')
  })

  it('Case 8: when all providers fail (HTTP 500), deterministic answer returns with status=answered and never generic refusal', async () => {
    const res = await runCouncilWithFixture({
      question: 'شو أفضل ساعة عندنا؟',
      fetchImpl: async () => new Response('provider error', { status: 500 }),
    })
    expect(res.status).toBe('answered')
    expect(res.agreed).toEqual([])
    expect(res.participants).toHaveLength(3)
    expect(res.participants.every((p) => p.status === 'error')).toBe(true)
    expect(res.reply).toContain('20:00')
    expect(res.reply).toContain('470.0 د.ك')
    expect(res.reply).toContain(COUNCIL_MODEL_FALLBACK_NOTE)
    expect(res.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
  })

  it('Case 9: data-source section throwing logs section name via logger.warn with zero secrets while other sections still answer', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const fakeSecret = 'sk-secret-token-DO-NOT-LOG-123456'
    const base = createDialectDataSource()
    const throwingDs: FeryalOdooDataSource = {
      ...base,
      fetchPurchaseOrders: async () => {
        const err = new Error(`upstream auth failed with key ${fakeSecret}`) as Error & {
          code?: string
        }
        err.code = 'ODOO_PO_TIMEOUT'
        throw err
      },
    }

    const res = await askFeryalOdooAgent({
      question: 'كم إجمالي المشتريات والموردين هذا الشهر؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: throwingDs,
      skipAuditLog: true,
    })

    expect(res.status).toBe('answered')
    expect(res.reply).toContain('78,240.0 د.ك')
    expect(res.reply).toContain('غير متاح في Odoo')
    expect(res.reply).not.toContain(fakeSecret)

    const purchaseWarnCall = warnSpy.mock.calls.find(
      ([msg, fields]) =>
        msg === 'feryal context section failed' &&
        (fields as { section?: string } | undefined)?.section === 'purchases',
    )
    expect(purchaseWarnCall).toBeDefined()
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(fakeSecret)
  })

  it('Case 10: excluded entities (IDs 24, 25, 39, 40 and excluded labels) never appear in replies even when injected into mock LLM output', async () => {
    const base = createDialectDataSource()
    const pollutedDs: FeryalOdooDataSource = {
      ...base,
      fetchPeriodCube: async (fromIso, toIso, ref) => {
        const cube = await base.fetchPeriodCube(fromIso, toIso, ref)
        if (!cube) return null
        return {
          ...cube,
          topProducts: [
            ...cube.topProducts,
            {
              productId: 999,
              name: 'صنف الجهراء الموقوف pos.config 25',
              brandId: 'china-garden',
              netKwd: 50,
              qty: 10,
              linesCount: 10,
              avgDiscountPct: 0,
              discountKwd: 0,
            },
          ],
        }
      },
    }

    // 1. Mixed model output containing excluded entity claim + excluded config IDs + valid claim
    const mixedRes = await runCouncilWithFixture({
      question: 'شو أفضل ساعة عندنا؟',
      dataSource: pollutedDs,
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.includes('api.anthropic.com')) {
          return makeProviderResponse(
            url,
            JSON.stringify({
              answer_ar:
                'ساعة الذروة هي 20:00 بصافي 470.0 د.ك.\nفرع الجهراء سجل 470.0 د.ك عبر pos.config 25 وpos.config 24 وpos.config 39 وpos.config 40.',
              claims: [
                {
                  text: 'ساعة الذروة هي 20:00 بصافي 470.0 د.ك.',
                  numbers: [
                    { value: 20, section: 'hourly' },
                    { value: 470, section: 'hourly' },
                  ],
                },
                {
                  text: 'فرع الجهراء pos.config 25 وهايزنبرغ',
                  numbers: [{ value: 470, section: 'hourly' }],
                },
              ],
              proposals: [
                {
                  text: 'تغطية الذروة في pos.config 39.',
                  owner: 'الجهراء',
                  kind: 'proposal',
                },
                {
                  text: 'تأمين طاقم المطبخ قبل الساعة المسائية.',
                  owner: 'مدير العمليات',
                  kind: 'proposal',
                },
              ],
              missing_metrics: ['بيانات pos.config 40'],
            }),
          )
        }
        return makeProviderResponse(url, JSON.stringify({ status: 'ok', note: '' }))
      },
    })
    expect(mixedRes.status).toBe('answered')
    expect(mixedRes.reply).toContain('20:00')
    expect(mixedRes.reply).toContain('470.0')
    expect(mixedRes.reply).not.toMatch(/الجهراء|هايزنبرغ|jahra|heisenberg/i)
    expect(mixedRes.reply).not.toMatch(/\bpos\.?config\s*(?:24|25|39|40)\b/i)

    // 2. Model output containing ONLY excluded entity leaks is guard_rejected with EXCLUDED_ENTITY
    const leakOnlyRes = await runCouncilWithFixture({
      question: 'شو أفضل ساعة عندنا؟',
      dataSource: pollutedDs,
      fetchImpl: async (input) => {
        const url = String(input)
        return makeProviderResponse(
          url,
          JSON.stringify({
            answer_ar: 'سجل الجهراء عبر pos.config 24 و25 و39 و40 صافي 470.0 د.ك.',
            claims: [
              {
                text: 'سجل الجهراء عبر pos.config 24 صافي 470.0 د.ك.',
                numbers: [{ value: 470, section: 'hourly' }],
              },
            ],
            proposals: [],
            missing_metrics: [],
          }),
        )
      },
    })
    expect(leakOnlyRes.status).toBe('answered')
    expect(leakOnlyRes.participants.every((p) => p.status === 'guard_rejected' && p.errorCode === 'EXCLUDED_ENTITY')).toBe(true)
    expect(leakOnlyRes.reply).not.toMatch(/الجهراء|هايزنبرغ|jahra|heisenberg/i)
    expect(leakOnlyRes.reply).not.toMatch(/\bpos\.?config\s*(?:24|25|39|40)\b/i)
  })

  it('Qurain central kitchen («شو وضع المطبخ المركزي في القرين؟») never routes to unknown_branch and answers honestly', async () => {
    const q = 'شو وضع المطبخ المركزي في القرين؟'
    expect(isCentralKitchenQurainQuestion(q)).toBe(true)
    expect(detectTargetBranchFromQuestion(q).unknownBranchRequested).toBe(false)

    const res = await askFeryalOdooAgent({
      question: q,
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: createDialectDataSource(),
      skipAuditLog: true,
    })
    expect(res.status).toBe('answered')
    expect(res.reply).toContain('المطبخ المركزي (القرين) ليس منفذ بيع POS')
    expect(res.reply).toContain('78,240.0 د.ك')
    expect(res.reply).toContain('غير متاح في Odoo')
    expect(res.reply).toContain('اقتراح')
    expect(res.reply).not.toMatch(/\bpos\.?config\s*(?:24|25|39|40)\b/i)
    expect(res.verifier.valid).toBe(true)

    // Council LLM path accepts explicit central-kitchen phrasing while still rejecting bare retail branch or pos.config leaks
    const councilRes = await runCouncilWithFixture({
      question: q,
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.includes('api.anthropic.com')) {
          return makeProviderResponse(
            url,
            JSON.stringify({
              answer_ar:
                'المطبخ المركزي (القرين) ليس منفذ بيع POS بل وحدة تشغيل وتوريد، بينما بلغت مبيعات الفروع المعتمدة 78,240.0 د.ك. وتم رفض فرع القرين وpos.config 25.',
              claims: [
                {
                  text: 'بلغت مبيعات الفروع المعتمدة 78,240.0 د.ك.',
                  numbers: [{ value: 78240, section: 'companyTotals' }],
                },
                {
                  text: 'فرع القرين سجل 78,240.0 د.ك.',
                  numbers: [{ value: 78240, section: 'companyTotals' }],
                },
              ],
              proposals: [
                {
                  text: 'مطابقة تحويلات المطبخ المركزي (القرين) في stock.move مع الفروع يومياً.',
                  owner: 'مدير المطبخ المركزي',
                  kind: 'proposal',
                },
              ],
              missing_metrics: ['مبيعات نقاط البيع للمطبخ المركزي (القرين) غير متاحة في Odoo'],
            }),
          )
        }
        return makeProviderResponse(url, JSON.stringify({ status: 'ok', note: '' }))
      },
    })
    expect(councilRes.status).toBe('answered')
    expect(councilRes.agreed.map((a) => a.provider)).toContain('anthropic')
    expect(councilRes.reply).toContain('المطبخ المركزي (القرين)')
    expect(councilRes.reply).toContain('78,240.0')
    expect(councilRes.reply).not.toContain('فرع القرين')
    expect(councilRes.reply).not.toMatch(/\bpos\.?config\s*(?:24|25|39|40)\b/i)
  })

  it('forwards conversation history through buildFeryalChatRequestPayload, FeryalGovernanceStudio UI, and POST /api/erp/feryal/chat', async () => {
    // 1. Payload builder keeps last 10 sanitized turns
    const twelveTurns: FeryalChatHistoryTurn[] = Array.from({ length: 12 }, (_, idx) => ({
      role: idx % 2 === 0 ? 'user' : 'assistant',
      text: `رسالة رقم ${idx + 1}   مع فراغات`,
    }))
    const sanitized = sanitizeFeryalChatHistory(twelveTurns)
    expect(sanitized).toHaveLength(10)
    expect(sanitized[0]?.text).toBe('رسالة رقم 3 مع فراغات')

    const payload = buildFeryalChatRequestPayload(
      'فهمتي شو؟',
      { ...DEFAULT_GLOBAL_FILTERS, period: 'today', branch: 'salmiya' },
      undefined,
      twelveTurns,
    )
    expect(payload.history).toHaveLength(10)
    expect(payload.history?.[9]?.text).toBe('رسالة رقم 12 مع فراغات')

    // 2. Studio component forwards historyTurns & renders Part 5 single/agreed verification states
    const studioHtml = renderToStaticMarkup(
      React.createElement(
        LanguageProviderHost,
        { initialLocale: 'ar' },
        React.createElement(FeryalGovernanceStudio, {
          sessionRole: 'admin',
          initialMainTab: 'chat',
          initialMessages: [
            {
              id: 'm1',
              sender: 'feryal',
              text: 'تحليل السالمية جاهز.',
              time: '14:20',
              replyStatus: 'answered',
              council: [{ provider: 'anthropic', modelId: 'claude-test', status: 'ok' }],
              agreed: [{ provider: 'anthropic', modelId: 'claude-test' }],
            },
            {
              id: 'm2',
              sender: 'feryal',
              text: 'تحليل مراجَع بنموذجين.',
              time: '14:21',
              replyStatus: 'answered',
              council: [
                { provider: 'anthropic', modelId: 'claude-test', status: 'ok' },
                { provider: 'google', modelId: 'gemini-test', status: 'ok' },
              ],
              agreed: [
                { provider: 'anthropic', modelId: 'claude-test' },
                { provider: 'google', modelId: 'gemini-test' },
              ],
            },
          ],
        }),
      ),
    )
    expect(studioHtml).toContain('data-feryal-verified="single"')
    expect(studioHtml).toContain('data-feryal-consensus="agreed"')
    expect(studioHtml).not.toContain('data-feryal-contradiction="true"')

    const studioSrc = readFileSync(
      path.join(process.cwd(), 'src/components/erp/feryal-governance-studio.tsx'),
      'utf8',
    )
    expect(studioSrc).toContain("filter((m) => m.replyStatus !== 'connection_error')")
    expect(studioSrc).toContain('.slice(-10)')
    expect(studioSrc).toContain(
      'buildFeryalChatRequestPayload(\n          effectivePrompt,\n          workspace.filters,\n          urlSearch,\n          historyTurns,\n        )',
    )

    // 3. Real POST /api/erp/feryal/chat forwards sanitized history end-to-end without network calls
    const savedEnv: Record<string, string | undefined> = {
      ODOO_URL: process.env.ODOO_URL,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      XAI_API_KEY: process.env.XAI_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    }
    try {
      delete process.env.ODOO_URL
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GEMINI_API_KEY
      delete process.env.XAI_API_KEY
      delete process.env.OPENAI_API_KEY
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })

      const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
      const routeRes = await chatPost(
        new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
          },
          body: JSON.stringify({
            question: 'فهمتي شو؟',
            history: [
              { role: 'user', text: 'كم مبيعات السالمية أمس؟' },
              { role: 'assistant', text: 'عرضنا مبيعات السالمية.' },
            ],
          }),
        }),
      )
      expect(routeRes.status).toBe(200)
      const json = (await routeRes.json()) as { ok: boolean; status: string; reply: string }
      expect(json.ok).toBe(true)
      expect(json.status).toBe('answered')
      expect(json.reply).toContain('السالمية')
      expect(json.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
    } finally {
      for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      bustOdooLiveCache({ resetCooldown: true, clearLastKnownGood: true })
    }
  })

  it('loads owner company context (qualitative, zero numbers) and empty advisor reports slot safely', async () => {
    const contextMd = loadFeryalCompanyContext()
    expect(contextMd).toContain('Ramadan')
    expect(contextMd).toContain('14–15 Sep')
    expect(contextMd).toContain('Talabat TGO')
    const reports = await loadLatestAdvisorReports()
    expect(reports).toEqual([])
  })

  it('produces 6 grounded Q→A fixture transcripts for verification', async () => {
    const exDs = createExhibitionDialectDataSource()
    const baseDs = createDialectDataSource()

    const t1 = await askFeryalOdooAgent({
      question: 'فهمتي شو؟',
      history: [{ role: 'user', text: 'كم مبيعات السالمية أمس؟' }],
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: baseDs,
      skipAuditLog: true,
    })
    const t2 = await askFeryalOdooAgent({
      question: 'شو أفضل ساعة عندنا؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: baseDs,
      skipAuditLog: true,
    })
    const t3 = await askFeryalOdooAgent({
      question: 'ليش طلبات عم تنزلنا؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: baseDs,
      skipAuditLog: true,
    })
    const t4 = await askFeryalOdooAgent({
      question: 'شو وضع البوثات؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: exDs,
      skipAuditLog: true,
    })
    const t5 = await askFeryalOdooAgent({
      question: 'شو اقتراحك لزمن التحضير؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: baseDs,
      skipAuditLog: true,
    })
    const t6 = await askFeryalOdooAgent({
      question: 'شو توقعات مبيعات هذا الشهر؟',
      referenceNowMs: DIALECT_NOW_MS,
      dataSource: baseDs,
      skipAuditLog: true,
    })

    for (const t of [t1, t2, t3, t4, t5, t6]) {
      expect(t.status).toBe('answered')
      expect(t.verifier.valid).toBe(true)
      expect(t.reply).not.toContain(FERYAL_NO_ODOO_DATA_REPLY)
    }
  })
})
