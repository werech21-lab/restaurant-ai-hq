import { readFileSync } from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGlobalFilterState, mockOdooState } = vi.hoisted(() => ({
  mockGlobalFilterState: {
    current: null as Record<string, unknown> | null,
  },
  mockOdooState: {
    calls: [] as Array<{ model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> }>,
  },
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
  useSearchParams: () => new URLSearchParams(),
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
  useGlobalFilter: () => mockGlobalFilterState.current,
}))

vi.mock('@/lib/odoo-live-connector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/odoo-live-connector')>()
  return {
    ...actual,
    executeOdooKw: async (
      model: string,
      method: string,
      args: unknown[] = [],
      kwargs: Record<string, unknown> = {},
    ) => {
      mockOdooState.calls.push({ model, method, args, kwargs })
      if (model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Appetizers & Mains', parent_id: [10, 'CG'] },
        ]
      }
      if (model === 'pos.order.line' && method === 'read_group') {
        return [
          { product_id: [101, 'Sweet & Sour Chicken'], price_subtotal: 2500, qty: 1000 },
          { product_id: [102, 'Spring Roll'], price_subtotal: 1500, qty: 1000 },
          { product_id: [103, 'Beef Broccoli'], price_subtotal: 800, qty: 250 },
          { product_id: [104, 'Jasmine Steamed Rice'], price_subtotal: 200, qty: 200 },
        ]
      }
      return []
    },
    fetchLiveOdooSnapshot: async () => ({
      source: 'live' as const,
      connected: true,
      sourceMode: 'odoo17-live' as const,
      noData: false,
      lastSyncAt: '2026-11-19T08:00:00.000Z',
      isStale24h: false,
      odooCompanyId: 1,
      dateRange: { from: '2026-11-01', to: '2026-11-19' },
      syncedAt: '2026-11-19T08:00:00.000Z',
      period: { from: '2026-11-01', to: '2026-11-19' },
      database: null,
      bucket: 'month' as const,
      totals: { netSalesKwd: 5000, orders: 1200, aovKwd: 4.167 },
      brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 5000, sharePct: 100 }],
      branches: [
        { id: '360-mall', name: '360 Mall', unit: 'مول 360', netSalesKwd: 3000, orders: 720, sharePct: 60 },
        { id: 'avenues', name: 'Avenues', unit: 'الأفنيوز', netSalesKwd: 2000, orders: 480, sharePct: 40 },
      ],
      channels: [
        { name: 'talabat', amountKwd: 3250 },
        { name: 'dine-in', amountKwd: 1750 },
      ],
    }),
  }
})

import {
  computeGlobalWorkspace,
  DEFAULT_GLOBAL_FILTERS,
} from '@/lib/aether/global-filter-engine'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import {
  confirmDocumentIntakeDraft,
  EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
  USER_INPUT_CONFIRMED_LABEL,
  type ConfirmedPriceSheet,
  type DocumentIntakeDraft,
} from '@/lib/feryal/document-intake-types'
import {
  buildExecutiveContextPack,
  collectExecutiveGroundedNumbers,
  DETERMINISTIC_SIMULATION_TAG,
  DETERMINISTIC_SIMULATION_TAG_AR,
  ODOO_VERIFIED_ACTUAL_TAG,
  ODOO_VERIFIED_ACTUAL_TAG_AR,
  simulateExecutivePricingOptions,
  USER_INPUT_CONFIRMED_TAG_AR,
  type ExecutiveContextPack,
} from '@/lib/feryal/executive-advisor'
import {
  buildExecutiveComparableFacts,
  createExecutivePricingAskOdoo,
  runExecutivePricingChat,
} from '@/lib/feryal/executive-chat-runner'
import { LanguageProvider } from '@/lib/i18n'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import { POST as intakePost } from '@/app/api/erp/feryal/document-intake/route'
import {
  FeryalDocumentReviewCard,
  toggleDraftRowExcluded,
  updateDraftRowProposedPrice,
} from '@/components/aether/FeryalDocumentReviewCard'
import { FeryalGovernanceStudio } from '@/components/erp/feryal-governance-studio'
import {
  COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE,
  COUNCIL_ANALYSIS_TIMEOUT_MS,
  runFeryalCouncil,
} from '@/server/ai/council'
import {
  guardAnswerAgainstFacts,
  hasExplicitGroundingLabel,
  reviewGroundedNumbers,
} from '@/server/ai/number-guard'
import { ANALYSIS_MAX_TOKENS, callProvider } from '@/server/ai/providers'

const LanguageProviderHost = LanguageProvider as unknown as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', element: React.ReactElement): string {
  return renderToStaticMarkup(
    React.createElement(LanguageProviderHost, { initialLocale: locale }, element),
  )
}

function sampleExecutivePack(): ExecutiveContextPack {
  return buildExecutiveContextPack({
    fromIso: '2026-11-01',
    toIso: '2026-11-19',
    brandId: 'china-garden',
    branchId: null,
    rows: [
      { productId: 101, name: 'Sweet & Sour Chicken', qty: '1000', netKwd: '2500.000', unitPriceKwd: '2.500', categoryId: 10 },
      { productId: 102, name: 'Spring Roll', qty: '1000', netKwd: '1500.000', unitPriceKwd: '1.500', categoryId: 10 },
      { productId: 103, name: 'Beef Broccoli', qty: '250', netKwd: '800.000', unitPriceKwd: '3.200', categoryId: 10 },
      { productId: 104, name: 'Jasmine Steamed Rice', qty: '200', netKwd: '200.000', unitPriceKwd: '1.000', categoryId: 10 },
    ],
    liveSummary: {
      source: 'live',
      connected: true,
      sourceMode: 'odoo17-live',
      noData: false,
      lastSyncAt: '2026-11-19T08:00:00.000Z',
      isStale24h: false,
      odooCompanyId: 1,
      dateRange: { from: '2026-11-01', to: '2026-11-19' },
      syncedAt: '2026-11-19T08:00:00.000Z',
      period: { from: '2026-11-01', to: '2026-11-19' },
      database: null,
      totals: { netSalesKwd: 5000, orders: 1200, aovKwd: 4.167 },
      brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 5000, sharePct: 100 }],
      branches: [
        { id: '360-mall', name: '360 Mall', unit: 'مول 360', netSalesKwd: 3000, orders: 720, sharePct: 60 },
        { id: 'avenues', name: 'Avenues', unit: 'الأفنيوز', netSalesKwd: 2000, orders: 480, sharePct: 40 },
      ],
      channels: [
        { name: 'talabat', amountKwd: 3250 },
        { name: 'dine-in', amountKwd: 1750 },
      ],
    },
  })
}

function sampleConfirmedSheet(): ConfirmedPriceSheet {
  return {
    draftId: 'draft-cg-nov19',
    fileName: 'china-garden-q4.xlsx',
    sourceTag: USER_INPUT_CONFIRMED_LABEL,
    confirmedAtIso: '2026-11-19T10:00:00.000Z',
    rows: [
      {
        rowId: 'r1',
        brand: 'China Garden',
        itemName: 'Sweet & Sour Chicken',
        currentPriceKwd: '2.500',
        proposedOptions: [
          { optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.700' },
          { optionKey: 'ae', label: 'AE', proposedPriceKwd: '3.000' },
        ],
        matchedOdooProductId: 101,
      },
      {
        rowId: 'r2',
        brand: 'China Garden',
        itemName: 'Spring Roll',
        currentPriceKwd: '1.500',
        proposedOptions: [
          { optionKey: 'ch', label: 'CH', proposedPriceKwd: '1.650' },
          { optionKey: 'ae', label: 'AE', proposedPriceKwd: '1.800' },
        ],
        matchedOdooProductId: 102,
      },
      {
        rowId: 'r3',
        brand: 'China Garden',
        itemName: 'Beef Broccoli',
        currentPriceKwd: '3.200',
        proposedOptions: [
          { optionKey: 'ch', label: 'CH', proposedPriceKwd: '3.450' },
          { optionKey: 'ae', label: 'AE', proposedPriceKwd: '3.600' },
        ],
        matchedOdooProductId: 103,
      },
    ],
  }
}

function setStudioContext(): void {
  const summary: OdooLiveSummary = {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    lastSyncAt: '2026-11-19T08:00:00.000Z',
    isStale24h: false,
    odooCompanyId: 1,
    dateRange: { from: '2026-11-01', to: '2026-11-19' },
    syncedAt: '2026-11-19T08:00:00.000Z',
    period: { from: '2026-11-01', to: '2026-11-19' },
    database: null,
    totals: { netSalesKwd: 5000, orders: 1200, aovKwd: 4.167 },
    brands: [],
    branches: [],
    channels: [],
  }
  const workspace = computeGlobalWorkspace(DEFAULT_GLOBAL_FILTERS, summary, '/erp/feryal-ai')
  mockGlobalFilterState.current = {
    filters: DEFAULT_GLOBAL_FILTERS,
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

beforeEach(() => {
  mockOdooState.calls.length = 0
  setStudioContext()
})

describe('Phase 2/3 Integration — Number Guard Whitelisting & Anti-Hallucination', () => {
  it('whitelists Odoo actuals, confirmed user inputs, ABC %, and 3-scenario KWD simulations across 0dp–3dp while blocking fabricated figures & invented COGS/margins', () => {
    const pack = sampleExecutivePack()
    const sheet = sampleConfirmedSheet()
    const simulation = simulateExecutivePricingOptions({ pack, sheet })
    const grounded = collectExecutiveGroundedNumbers(pack, simulation)

    const chOpt = simulation.options.find((o) => o.optionKey === 'ch')!
    const aeOpt = simulation.options.find((o) => o.optionKey === 'ae')!

    const allowedPercents = [
      ...grounded.labeledFacts.filter((f) => f.label.includes('(%)')).map((f) => f.value),
      '0',
      '-5',
      '10',
      '-10',
      '15',
      '80',
      '95',
      '100',
    ]

    const executiveFacts = {
      toolNumbers: grounded.toolNumbers,
      canonicalDecimals: grounded.canonicalDecimals,
      labeledFacts: grounded.labeledFacts,
      cogsReadable: false,
    }

    const validBrief = [
      '### 1. Executive Verdict',
      `China Garden recorded 5,000.000 KWD (${ODOO_VERIFIED_ACTUAL_TAG}) across 2,450 units, with Tier A generating 80% (4,000 KWD).`,
      `Recommend Option CH (${USER_INPUT_CONFIRMED_LABEL}): delivers +${chOpt.baseDeltaKwd} KWD Base, +${chOpt.conservativeDeltaKwd} KWD Conservative (-5% volume on >10% hikes), and +${chOpt.stressTestDeltaKwd} KWD Stress-Test (${DETERMINISTIC_SIMULATION_TAG}).`,
      `Option AE yields ${aeOpt.stressTestDeltaKwd} KWD in Stress-Test due to -10% Tier-A volume compression above 15%.`,
      '### 2. Critical Anomalies & Risk Flags',
      'Sweet & Sour Chicken (50.00% share, 2.500 KWD realized price) rises from 2.500 to 2.700 (+8%) under CH vs from 2.500 to 3.000 (+20%) under AE.',
      '### 5. Data Boundaries',
      'COGS, food cost, and gross/net profit margins cannot be calculated because Odoo 17 integration user 225 lacks read permission on standard_price.',
    ].join('\n')

    expect(hasExplicitGroundingLabel(validBrief)).toBe(true)
    const validRes = reviewGroundedNumbers(validBrief, executiveFacts, {
      allowedDecimals: grounded.canonicalDecimals,
      allowedPercents,
      allowedEntityNames: grounded.allowedEntityNames,
      forbidPosCogsMarginClaims: true,
      executiveBriefMode: true,
    })
    expect(validRes).toEqual({ ok: true, offending: [] })

    // Half-up rounding tolerance check (0dp, 1dp, 2dp, 3dp) on Beef Broccoli conservative delta (3.450 vs 3.200 on 250 qty -> +7.81% -> +62.500 KWD; AE 3.600 -> +12.50% -> 237.5 * 3.6 - 800 = +55.000 KWD)
    const roundedCheck = guardAnswerAgainstFacts(
      `360 Mall contributes 60% (3,000 KWD, ${ODOO_VERIFIED_ACTUAL_TAG}); Beef Broccoli Base uplift is 63 KWD (exact 62.50 KWD / 62.5 KWD, ${DETERMINISTIC_SIMULATION_TAG}).`,
      executiveFacts,
      {
        allowedDecimals: grounded.canonicalDecimals,
        allowedPercents,
        allowedEntityNames: grounded.allowedEntityNames,
        forbidPosCogsMarginClaims: true,
        executiveBriefMode: true,
      },
    )
    expect(roundedCheck.ok).toBe(true)

    // Strictly rejects fabricated KWD figure
    const fabricatedNum = reviewGroundedNumbers(
      `Option CH delivers +912.345 KWD (${DETERMINISTIC_SIMULATION_TAG}).`,
      executiveFacts,
      {
        allowedDecimals: grounded.canonicalDecimals,
        allowedPercents,
        forbidPosCogsMarginClaims: true,
        executiveBriefMode: true,
      },
    )
    expect(fabricatedNum.ok).toBe(false)
    expect(fabricatedNum.offending).toContain('912.345')

    // Strictly rejects invented gross margin / COGS EVEN when reusing an allowed number (50% or 1.500 KWD)!
    const inventedMarginEn = reviewGroundedNumbers(
      `Sweet & Sour Chicken achieves a gross margin of 50.00% (${ODOO_VERIFIED_ACTUAL_TAG}).`,
      executiveFacts,
      {
        allowedDecimals: grounded.canonicalDecimals,
        allowedPercents,
        forbidPosCogsMarginClaims: true,
        executiveBriefMode: true,
      },
    )
    expect(inventedMarginEn.ok).toBe(false)
    expect(inventedMarginEn.offending).toContain('COGS_MARGIN_UNAVAILABLE')

    const inventedCogsAr = reviewGroundedNumbers(
      `تكلفة الطبق للصنف Spring Roll تبلغ 1.500 د.ك وهامش الربح 50%.`,
      executiveFacts,
      {
        allowedDecimals: grounded.canonicalDecimals,
        allowedPercents,
        forbidPosCogsMarginClaims: true,
        executiveBriefMode: true,
      },
    )
    expect(inventedCogsAr.ok).toBe(false)
    expect(inventedCogsAr.offending).toContain('COGS_MARGIN_UNAVAILABLE')
  })
})

describe('Phase 2/3 Integration — Unified runFeryalCouncil Executive Pricing Path (2-of-3 Structured Consensus, <2 Fallback & All-Guard-Rejected)', () => {
  it('preserves default ANALYSIS_MAX_TOKENS=800 and ignores Gemini thought parts', async () => {
    expect(ANALYSIS_MAX_TOKENS).toBe(800)

    let capturedMaxOutputTokens = 0
    const res = await callProvider({
      provider: 'google',
      apiKey: 'test-google-key-00000001',
      model: 'gemini-3.1-pro-preview',
      system: 'sys',
      user: 'usr',
      timeoutMs: 5_000,
      fetchImpl: async (_url, init) => {
        const parsedBody = JSON.parse(String(init?.body ?? '{}')) as {
          generationConfig?: { maxOutputTokens?: number }
        }
        capturedMaxOutputTokens = parsedBody.generationConfig?.maxOutputTokens ?? 0
        return Response.json({
          modelVersion: 'gemini-3.1-pro-preview-001',
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: 'unverified internal thought 999999' },
                  { text: 'Clean executive synthesis 5000 KWD' },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 12 },
        })
      },
    })

    expect(capturedMaxOutputTokens).toBe(ANALYSIS_MAX_TOKENS)
    expect(res.status).toBe('ok')
    expect(res.text).toBe('Clean executive synthesis 5000 KWD')
    expect(res.text).not.toContain('999999')
  })

  it('routes executive pricing through unified runFeryalCouncil: verifies 2-of-3 comparisonSchema consensus (with Google 429 retry), <2 fallback note, and all-guard-rejected council_failed', async () => {
    const pack = sampleExecutivePack()
    const sheet = sampleConfirmedSheet()
    const simulation = simulateExecutivePricingOptions({ pack, sheet })
    const comparableFacts = buildExecutiveComparableFacts(pack, simulation)
    expect(comparableFacts.some((f) => f.id === 'stress_test_delta_kwd|ch|2026-11-01..2026-11-19')).toBe(true)
    expect(comparableFacts.some((f) => f.id === 'stress_test_delta_kwd|ae|2026-11-01..2026-11-19')).toBe(true)

    const validComparisonJson = JSON.stringify({
      comparison: {
        subject_id: 'ch',
        relation: 'better',
        object_id: 'ae',
        metric: 'stress_test_delta_kwd',
        cited_fact_ids: [
          'stress_test_delta_kwd|ch|2026-11-01..2026-11-19',
          'stress_test_delta_kwd|ae|2026-11-01..2026-11-19',
        ],
      },
    })

    expect(COUNCIL_ANALYSIS_TIMEOUT_MS).toBe(20_000)

    const testKeys = {
      anthropic: 'test-anthropic-key-0001',
      google: 'test-google-key-00000001',
      xai: 'test-grok-key-0000000001',
    }
    const testModels = {
      anthropic: 'claude-sonnet-4-6',
      google: 'gemini-3.1-pro-preview',
      xai: 'grok-4',
    }

    // 1) 2-of-3 structured comparison consensus (Anthropic + Google recover 429; xAI guard-rejected)
    let googleAttempts = 0
    const result = await runExecutivePricingChat(
      {
        question: 'Compare Option CH vs Option AE for China Garden and give the CFO executive playbook. What about gross margin?',
        userId: 'cfo-1',
        userRole: 'cfo',
        confirmedPriceSheet: sheet,
      },
      {
        executivePack: pack,
        persist: async () => undefined,
        keys: testKeys,
        models: testModels,
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return Response.json({
              model: 'claude-sonnet-4-6-20251101',
              content: [{ type: 'text', text: validComparisonJson }],
              usage: { input_tokens: 400, output_tokens: 60 },
            })
          }
          if (url.includes('generativelanguage.googleapis.com')) {
            googleAttempts += 1
            if (googleAttempts === 1) {
              return new Response('{}', { status: 429, headers: { 'retry-after': '0' } })
            }
            return Response.json({
              modelVersion: 'gemini-3.1-pro-preview-001',
              candidates: [{ content: { parts: [{ text: validComparisonJson }] } }],
              usageMetadata: { promptTokenCount: 410, candidatesTokenCount: 60 },
            })
          }
          // xAI hallucinates free-text unverified KWD figure -> GUARD_REJECTED without failing 2-of-3 quorum
          return Response.json({
            model: 'grok-4-0709',
            choices: [{ message: { content: 'Approve Option AE for +9,876.543 KWD net profit!' } }],
            usage: { prompt_tokens: 390, completion_tokens: 40 },
          })
        },
      },
    )

    expect(googleAttempts).toBe(2)
    expect(result.status).toBe('answered')
    expect(result.verifier.valid).toBe(true)
    expect(result.verifier.unverifiedNumbers).toEqual([])
    expect(result.agreed.map((a) => a.provider).sort()).toEqual(['anthropic', 'google'])
    expect(result.participants.find((p) => p.provider === 'anthropic')?.status).toBe('ok')
    expect(result.participants.find((p) => p.provider === 'google')?.status).toBe('ok')
    expect(result.participants.find((p) => p.provider === 'xai')).toMatchObject({
      status: 'guard_rejected',
      errorCode: 'GUARD_REJECTED',
    })
    expect(result.reply).toContain('حقائق Odoo 17:')
    expect(result.reply).toContain("## Feryal's Executive Opinion & Justification")
    expect(result.reply).toContain('Executive Verdict')
    expect(result.reply).toContain('Actionable SKU / Operational Playbook')
    expect(result.reply).toContain('Feryal Rec. KWD')
    expect(result.reply).toContain('standard_price')
    expect(result.reply).toContain('ch is better than ae on stress_test_delta_kwd')
    expect(result.reply).not.toContain('9,876.543')

    // 2) <2 agreement fallback (1 ok + 2 provider HTTP 500 errors -> odoo.reply + COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE)
    const fallbackResult = await runFeryalCouncil(
      {
        question: 'Compare Option CH vs Option AE for China Garden',
        userId: 'cfo-1',
        userRole: 'cfo',
      },
      {
        askOdoo: createExecutivePricingAskOdoo({
          confirmedPriceSheet: sheet,
          executivePack: pack,
        }),
        persist: async () => undefined,
        keys: testKeys,
        models: testModels,
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return Response.json({
              model: 'claude-sonnet-4-6-20251101',
              content: [{ type: 'text', text: validComparisonJson }],
              usage: { input_tokens: 400, output_tokens: 60 },
            })
          }
          return new Response('{}', { status: 503 })
        },
      },
    )
    expect(fallbackResult.status).toBe('answered')
    expect(fallbackResult.agreed).toEqual([])
    expect(fallbackResult.verifier.valid).toBe(true)
    expect(fallbackResult.reply).toContain("## Feryal's Executive Opinion & Justification")
    expect(fallbackResult.reply).toContain(COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE)

    // 3) All configured providers guard_rejected -> status: 'council_failed'
    const allRejectedResult = await runFeryalCouncil(
      {
        question: 'Compare Option CH vs Option AE for China Garden',
        userId: 'cfo-1',
        userRole: 'cfo',
      },
      {
        askOdoo: createExecutivePricingAskOdoo({
          confirmedPriceSheet: sheet,
          executivePack: pack,
        }),
        persist: async () => undefined,
        keys: testKeys,
        models: testModels,
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return Response.json({
              model: 'claude-sonnet-4-6-20251101',
              content: [{ type: 'text', text: 'Free-text prose +999.999 KWD' }],
              usage: { input_tokens: 100, output_tokens: 20 },
            })
          }
          if (url.includes('generativelanguage.googleapis.com')) {
            return Response.json({
              modelVersion: 'gemini-3.1-pro-preview-001',
              candidates: [{ content: { parts: [{ text: '{"comparison":{"subject_id":"ae","relation":"better","object_id":"ch","metric":"stress_test_delta_kwd","cited_fact_ids":["stress_test_delta_kwd|ae|2026-11-01..2026-11-19","stress_test_delta_kwd|ch|2026-11-01..2026-11-19"]}}' }] } }],
              usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
            })
          }
          return Response.json({
            model: 'grok-4-0709',
            choices: [{ message: { content: 'Invented margin 68%' } }],
            usage: { prompt_tokens: 100, completion_tokens: 20 },
          })
        },
      },
    )
    expect(allRejectedResult.status).toBe('council_failed')
    expect(allRejectedResult.agreed).toEqual([])
    expect(allRejectedResult.participants.every((p) => p.status === 'guard_rejected')).toBe(true)
  })
})

describe('Phase 2/3 Integration — Document Intake -> Human Confirmation Gate -> POST /api/erp/feryal/chat', () => {
  it('blocks unconfirmed drafts with HTTP 400 and delivers HTTP 200 rich executive analysis once confirmed via confirmDocumentIntakeDraft', async () => {
    const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')

    // 1. Build a real .xlsx workbook containing a critical typo (0.400 vs 1.500 Odoo price) + non-standard fils (2.703)
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Brand', 'Item Name', 'Current Price', 'CH', 'AE'],
      ['China Garden', 'Sweet & Sour Chicken', '2.500', '2.703', '3.000'],
      ['China Garden', 'Spring Roll', '1.500', '0.400', '1.800'],
      ['China Garden', 'Beef Broccoli', '3.200', '3.450', '3.600'],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'MenuPricing')
    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const formData = new FormData()
    formData.append(
      'file',
      new File([new Uint8Array(xlsxBuffer)], 'china-garden-sheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    formData.append('period', 'month')
    formData.append('brand', 'china-garden')

    const intakeRes = await intakePost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/document-intake', {
        method: 'POST',
        headers: { cookie: `${EXEC_SESSION_COOKIE}=${adminToken}` },
        body: formData,
      }),
    )
    expect(intakeRes.status).toBe(200)
    const intakeJson = (await intakeRes.json()) as { ok: boolean; draft: DocumentIntakeDraft }
    expect(intakeJson.ok).toBe(true)
    const draft = intakeJson.draft
    expect(draft.sourceTag).toBe(EXTRACTED_DRAFT_UNCONFIRMED_LABEL)
    expect(draft.requiresHumanConfirmation).toBe(true)
    expect(draft.summary.criticalCount).toBeGreaterThanOrEqual(1)
    expect(draft.summary.warningCount).toBeGreaterThanOrEqual(1)

    // Verify zero standard_price queries were sent to Odoo
    expect(JSON.stringify(mockOdooState.calls)).not.toContain('standard_price')

    // 2. Attempting to bypass the Human Confirmation Gate with the unconfirmed draft MUST fail with HTTP 400!
    const unconfirmedAsSheetRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
        },
        body: JSON.stringify({
          question: 'Run executive pricing simulation now',
          brand: 'china-garden',
          confirmedPriceSheet: draft,
        }),
      }),
    )
    expect(unconfirmedAsSheetRes.status).toBe(400)
    const rejectedPayload = (await unconfirmedAsSheetRes.json()) as {
      ok: boolean
      error: string
      code: string
    }
    expect(rejectedPayload.ok).toBe(false)
    expect(rejectedPayload.error).toBe('HUMAN_CONFIRMATION_REQUIRED')
    expect(rejectedPayload.code).toBe('UNCONFIRMED_DRAFT_REJECTED')

    const rawDraftFieldRes = await chatPost(
      new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
        },
        body: JSON.stringify({
          question: 'حللي جدول الأسعار',
          draft,
        }),
      }),
    )
    expect(rawDraftFieldRes.status).toBe(400)

    // 3. Human fixes the 0.400 typo -> 1.650 and 2.703 -> 2.700 inline, clearing critical & warning flags live!
    const springRollRow = draft.rows.find((r) => r.itemName === 'Spring Roll')!
    const sweetSourRow = draft.rows.find((r) => r.itemName === 'Sweet & Sour Chicken')!
    expect(springRollRow.anomalies.some((a) => a.code === 'SUSPICIOUS_DROP_GT_30PCT')).toBe(true)
    expect(sweetSourRow.anomalies.some((a) => a.code === 'NON_STANDARD_KWD_FILS')).toBe(true)

    let editedDraft = updateDraftRowProposedPrice(draft, springRollRow.rowId, 'ch', '1.650')
    editedDraft = updateDraftRowProposedPrice(editedDraft, sweetSourRow.rowId, 'ch', '2.700')
    expect(editedDraft.summary.criticalCount).toBe(0)
    expect(editedDraft.summary.warningCount).toBe(0)

    // Test excluding and re-including a row live
    const toggledOut = toggleDraftRowExcluded(editedDraft, sweetSourRow.rowId)
    expect(confirmDocumentIntakeDraft(toggledOut).rows).toHaveLength(2)

    const confirmedSheet = confirmDocumentIntakeDraft(editedDraft)
    expect(confirmedSheet.sourceTag).toBe(USER_INPUT_CONFIRMED_LABEL)
    expect(confirmedSheet.rows).toHaveLength(3)

    // 4. Submitting ConfirmedPriceSheet to POST /api/erp/feryal/chat returns HTTP 200 rich executive analysis!
    const prevKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      xai: process.env.XAI_API_KEY,
    }
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.XAI_API_KEY
    try {
      const confirmedChatRes = await chatPost(
        new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
          },
          body: JSON.stringify({
            question: 'حلّلي جدول الأسعار المؤكد لتشاينا جاردن وقارني بين الخيارين CH و AE مع حدود التكلفة',
            period: 'month',
            brand: 'china-garden',
            confirmedPriceSheet: confirmedSheet,
          }),
        }),
      )
      expect(confirmedChatRes.status).toBe(200)
      const okPayload = (await confirmedChatRes.json()) as {
        ok: boolean
        status: string
        reply: string
        verifier: { valid: boolean; unverifiedNumbers: number[] }
      }
      expect(okPayload.ok).toBe(true)
      expect(okPayload.status).toBe('answered')
      expect(okPayload.verifier.valid).toBe(true)
      expect(okPayload.verifier.unverifiedNumbers).toEqual([])
      expect(okPayload.reply).toContain('القرار التنفيذي')
      expect(okPayload.reply).toContain('خطة العمل التنفيذية للأصناف')
      expect(okPayload.reply).toContain('حدود البيانات')
      expect(okPayload.reply).toContain(ODOO_VERIFIED_ACTUAL_TAG_AR)
      expect(okPayload.reply).toContain(USER_INPUT_CONFIRMED_TAG_AR)
      expect(okPayload.reply).toContain(DETERMINISTIC_SIMULATION_TAG_AR)
      expect(okPayload.reply).toContain('المستخدم رقم 225')
      expect(okPayload.reply).not.toContain(ODOO_VERIFIED_ACTUAL_TAG)
      expect(okPayload.reply).not.toContain(USER_INPUT_CONFIRMED_LABEL)
      expect(okPayload.reply).not.toContain(DETERMINISTIC_SIMULATION_TAG)
      expect(okPayload.reply).not.toContain('standard_price')
      expect(okPayload.reply).not.toContain('price_subtotal')
      expect(okPayload.reply).not.toMatch(/\bCOGS\b/)
    } finally {
      if (prevKeys.anthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevKeys.anthropic
      if (prevKeys.gemini !== undefined) process.env.GEMINI_API_KEY = prevKeys.gemini
      if (prevKeys.xai !== undefined) process.env.XAI_API_KEY = prevKeys.xai
    }
  })
})

describe('Phase 2/3 Integration — UI Review & Confirm Table + Client Boundary Verification', () => {
  it('renders Review & Confirm Table with amber/red anomaly badges, inline inputs, and Confirm & Run Executive Analysis gate in AR and EN', () => {
    const draftWithAnomalies: DocumentIntakeDraft = {
      draftId: 'draft-ui-1',
      fileName: 'franks-menu-ocr.png',
      fileKind: 'image',
      sourceTag: EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
      requiresHumanConfirmation: true,
      period: { from: '2026-11-01', to: '2026-11-19' },
      brand: 'china-garden',
      branch: null,
      rows: [
        {
          rowId: 'row-1',
          brand: 'China Garden',
          itemName: 'Spring Roll',
          sheetCurrentPriceKwd: '1.500',
          proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '0.400' }],
          matchedOdooProductId: 102,
          matchedOdooProductName: 'Spring Roll',
          odooRealizedUnitPriceKwd: '1.500',
          odooQty: '1000',
          odooNetSalesKwd: '1500.000',
          excluded: false,
          anomalies: [
            {
              code: 'SUSPICIOUS_DROP_GT_30PCT',
              severity: 'critical',
              optionKey: 'ch',
              referenceOdooPriceKwd: '1.500',
              pctChange: '-73.33',
              messageEn: 'CH (0.400 KWD) drops -73.33% vs reference (1.500 KWD) — verify potential typo.',
              messageAr: 'CH (0.400 د.ك) ينخفض بنسبة -73.33% عن السعر المرجعي (1.500 د.ك) — يرجى التحقق من احتمال خطأ إدخال.',
            },
          ],
        },
        {
          rowId: 'row-2',
          brand: 'China Garden',
          itemName: 'Sweet & Sour Chicken',
          sheetCurrentPriceKwd: '2.500',
          proposedOptions: [{ optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.703' }],
          matchedOdooProductId: 101,
          matchedOdooProductName: 'Sweet & Sour Chicken',
          odooRealizedUnitPriceKwd: '2.500',
          odooQty: '1000',
          odooNetSalesKwd: '2500.000',
          excluded: false,
          anomalies: [
            {
              code: 'NON_STANDARD_KWD_FILS',
              severity: 'warning',
              optionKey: 'ch',
              referenceOdooPriceKwd: '2.500',
              pctChange: null,
              messageEn: 'CH (2.703 KWD) uses non-standard Kuwaiti fils.',
              messageAr: 'CH (2.703 د.ك) يحتوي على فلوس غير قياسية.',
            },
          ],
        },
      ],
      summary: {
        totalRows: 2,
        matchedRows: 2,
        criticalCount: 1,
        warningCount: 1,
      },
    }

    const enHtml = renderWithLocale(
      'en',
      React.createElement(FeryalGovernanceStudio, {
        sessionRole: 'admin',
        initialMainTab: 'chat',
        initialPendingDraft: draftWithAnomalies,
      }),
    )
    expect(enHtml).toContain('data-feryal-review-gate="true"')
    expect(enHtml).toContain(EXTRACTED_DRAFT_UNCONFIRMED_LABEL)
    expect(enHtml).toContain(ODOO_VERIFIED_ACTUAL_TAG)
    expect(enHtml).toContain('data-anomaly-badge="critical"')
    expect(enHtml).toContain('data-anomaly-code="SUSPICIOUS_DROP_GT_30PCT"')
    expect(enHtml).toContain('data-anomaly-badge="warning"')
    expect(enHtml).toContain('data-anomaly-code="NON_STANDARD_KWD_FILS"')
    expect(enHtml).toContain('data-feryal-confirm-intake="true"')
    expect(enHtml).toContain('Confirm &amp; Run Executive Analysis')
    expect(enHtml).toContain('.xlsx,.csv,.jpg,.jpeg,.png,.webp')

    const arCardHtml = renderToStaticMarkup(
      React.createElement(FeryalDocumentReviewCard, {
        draft: draftWithAnomalies,
        isAr: true,
        onDraftChange: () => undefined,
        onConfirmAndRun: () => undefined,
        onCancel: () => undefined,
      }),
    )
    expect(arCardHtml).toContain('تأكيد وتشغيل التحليل التنفيذي')
    expect(arCardHtml).toContain(ODOO_VERIFIED_ACTUAL_TAG_AR)
    expect(arCardHtml).not.toContain(ODOO_VERIFIED_ACTUAL_TAG)
    expect(arCardHtml).toContain('data-anomaly-badge="critical"')
    expect(arCardHtml).toContain('data-anomaly-badge="warning"')

    // Verify client components never import server-only
    const repoRoot = process.cwd()
    for (const rel of [
      'src/components/aether/FeryalDocumentReviewCard.tsx',
      'src/components/aether/FeryalMultimodalBar.tsx',
      'src/components/erp/feryal-governance-studio.tsx',
      'src/lib/feryal/document-intake-types.ts',
    ]) {
      const content = readFileSync(path.join(repoRoot, rel), 'utf8')
      expect(content, `${rel} must not import server-only`).not.toMatch(/['"]server-only['"]/)
    }
  })
})
