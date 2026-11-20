import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/context'
import {
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  DEFAULT_GLOBAL_FILTERS,
  computeGlobalWorkspace,
  type GlobalFilters,
} from '@/lib/aether/global-filter-engine'
import { selectReceivablesHeadline } from '@/lib/aether/receivables-headline'
import { verifyFeryalReplyNumbers, type AskFeryalOdooAgentResult } from '@/lib/feryal-odoo-agent'
import {
  confirmDocumentIntakeDraft,
  formatIntakeSourceTag,
  type DocumentIntakeDraft,
} from '@/lib/feryal/document-intake-types'
import {
  DETERMINISTIC_SIMULATION_TAG,
  DETERMINISTIC_SIMULATION_TAG_AR,
  EXECUTIVE_COGS_BOUNDARY_AR,
  ODOO_VERIFIED_ACTUAL_TAG,
  ODOO_VERIFIED_ACTUAL_TAG_AR,
  USER_INPUT_CONFIRMED_TAG,
  USER_INPUT_CONFIRMED_TAG_AR,
  buildExecutiveContextPack,
  collectExecutiveGroundedNumbers,
  formatExecutiveSourceTag,
  renderDeterministicExecutiveBrief,
  simulateExecutivePricingOptions,
} from '@/lib/feryal/executive-advisor'
import {
  createExecutivePricingAskOdoo,
  runExecutivePricingChat,
} from '@/lib/feryal/executive-chat-runner'
import {
  COGS_UNAVAILABLE_REPLY_AR,
  buildItemPricingAnswer,
  renderCogsUnavailableReply,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import { LanguageProvider } from '@/lib/i18n'
import { logger } from '@/lib/logger'
import {
  YEAR_CLOSED_MAX,
  YEAR_CLOSED_READ_TIMEOUT_MS,
  YEAR_CLOSED_TTL_MS,
  yearClosedWindow,
  yearReadCall,
} from '@/lib/odoo/pos-order-query'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { OdooPeriodCube } from '@/lib/odoo-live-connector'
import { buildOperationalForensicReport } from '@/lib/reports/operational-forensic-report'
import {
  FORENSIC_MISSING_DATA_REASON,
  buildForensicMatrix,
  buildForensicReport,
} from '@/modules/governance/domain/forensic-radar'
import {
  clearForensicHistory,
  runForensicScan,
} from '@/modules/governance/services/forensic-radar-service'
import {
  COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE,
  COUNCIL_ANALYSIS_TIMEOUT_MS,
  composeCouncilReply,
  runFeryalCouncil,
} from '@/server/ai/council'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'

type GlobalFilterContextValue = ReturnType<
  typeof import('@/components/aether/GlobalFilterContext').useGlobalFilter
>

const filterStateHolder: { current: GlobalFilterContextValue | null } = {
  current: null,
}

const emailTransportSpy = vi.fn(async () => ({
  ok: true,
  engine: 'smtp' as const,
  message: 'delivered',
}))

const whatsappTransportSpy = vi.fn(async () => ({ ok: true }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/erp/aggregator-radar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/aether/GlobalFilterContext', () => ({
  useGlobalFilter: () => {
    if (!filterStateHolder.current) {
      throw new Error('filterStateHolder.current must be initialized before rendering')
    }
    return filterStateHolder.current
  },
}))

vi.mock('@/lib/email/server-mail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/server-mail')>()
  return {
    ...actual,
    dispatchServerEmail: (...args: Parameters<typeof actual.dispatchServerEmail>) => {
      void args
      return emailTransportSpy()
    },
    getSmtpPublicStatus: vi.fn(async () => ({
      configured: false,
      enabled: false,
      from: 'sec@venturefoodskw.com',
      host: 'smtp.gmail.com',
      port: 465,
      provider: 'google_workspace' as const,
    })),
  }
})

vi.mock('@/services/notification.service', () => ({
  deliverWhatsApp: () => whatsappTransportSpy(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationSetting: { findUnique: vi.fn(async () => null) },
  },
}))

import { DeliveryRadarV5 } from '@/components/aether/DeliveryRadarV5'
import { dispatchExclusiveOperationalReport } from '@/lib/alerts'

const TypedLanguageProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const TypedDeliveryRadar = DeliveryRadarV5 as React.ComponentType<{
  initialLiveCube?: OdooPeriodCube | null
}>

const REPO_ROOT = process.cwd()

const PRODUCTION_FILES_UNDER_AUDIT = [
  'src/server/ai/council.ts',
  'src/server/ai/models.ts',
  'src/server/ai/providers.ts',
  'src/server/ai/number-guard.ts',
  'src/app/api/erp/feryal/chat/route.ts',
  'src/lib/feryal/executive-chat-runner.ts',
  'src/lib/feryal/executive-advisor.ts',
  'src/lib/feryal/document-intake-types.ts',
  'src/lib/feryal/item-pricing.ts',
  'src/lib/feryal-odoo-agent.ts',
  'src/lib/feryal-multimodal.ts',
  'src/components/aether/FeryalDocumentReviewCard.tsx',
  'src/components/aether/DeliveryRadarV5.tsx',
  'src/lib/aether/receivables-headline.ts',
  'src/modules/governance/domain/forensic-radar.ts',
  'src/modules/governance/services/forensic-radar-service.ts',
  'src/modules/governance/client.ts',
  'src/modules/governance/index.ts',
  'src/lib/reports/operational-forensic-report.ts',
  'src/lib/alerts.ts',
  'src/app/api/aggregator-radar/alert/route.ts',
  'src/app/api/aggregator-radar/route.ts',
  'src/app/api/aggregator-radar/scan/route.ts',
  'src/lib/odoo/pos-order-query.ts',
  'src/lib/odoo/closed-year-store.ts',
] as const

function buildRadarFixtureSummary(
  aggregatorReceivables: OdooLiveSummary['aggregatorReceivables'],
  unavailableSections: string[] = [],
): OdooLiveSummary {
  const todayIso = '2026-11-17'
  const uiChannels = {
    ...Object.fromEntries(APPROVED_CHANNEL_IDS.map((ch) => [ch, { netKwd: 0, orders: 0 }])),
    'dine-in': { netKwd: 420.5, orders: 64 },
    'talabat-tgo': { netKwd: 185.25, orders: 29 },
    keeta: { netKwd: 94.75, orders: 15 },
  }
  const bucket: OdooBucketSummary = {
    key: 'today',
    from: todayIso,
    to: '2026-11-18',
    days: 1,
    totals: {
      netSalesKwd: 700.5,
      orders: 108,
      aovKwd: 6.486,
      restaurantNetKwd: 700.5,
      restaurantOrders: 108,
    },
    byLocation: {
      avenues: { netKwd: 700.5, orders: 108, uiChannels },
    },
    mappedByLocation: {
      avenues: { netKwd: 700.5, orders: 108 },
    },
    byBrand: Object.fromEntries(
      APPROVED_BRAND_IDS.map((brandId) => [
        brandId,
        {
          netKwd: brandId === 'china-garden' ? 700.5 : 0,
          orders: brandId === 'china-garden' ? 108 : 0,
          qty: 0,
        },
      ]),
    ),
    uiChannels,
    unattributedSalesKwd: 0,
    unattributedOrders: 0,
  }

  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    noData: false,
    partial: unavailableSections.length > 0,
    unavailableSections,
    syncedAt: '2026-11-17T11:25:00.000Z',
    lastSyncAt: '2026-11-17T11:25:00.000Z',
    latestRecordAt: '2026-11-17T11:20:00.000Z',
    latestOperationalDate: todayIso,
    period: { from: todayIso, to: todayIso },
    database: null,
    totals: { netSalesKwd: 700.5, orders: 108, aovKwd: 6.486 },
    brands: [],
    branches: [],
    channels: [],
    buckets: {
      today: bucket,
      week: { ...bucket, key: 'week', days: 7 },
      month: { ...bucket, key: 'month', days: 30 },
    },
    dailySeries: [{ day: todayIso, orders: 108, netKwd: 700.5 }],
    hourlySeries: [],
    aggregatorReceivables,
  }
}

function renderDeliveryRadarMarkup(locale: 'ar' | 'en', summary: OdooLiveSummary): string {
  const filters: GlobalFilters = {
    ...DEFAULT_GLOBAL_FILTERS,
    period: 'today',
  }
  const workspace = computeGlobalWorkspace(filters, summary, '/erp/aggregator-radar')
  filterStateHolder.current = {
    filters: workspace.filters,
    workspace,
    liveSummary: summary,
    isAuditor: false,
    sessionRole: 'admin',
    syncingOdoo: false,
    syncCooldownSec: 0,
    triggerOdooSyncNow: vi.fn(async () => {}),
    setPeriod: vi.fn(),
    setCustomRange: vi.fn(),
    setKuwaitSlice: vi.fn(),
    setBrand: vi.fn(),
    setBranch: vi.fn(),
    setChannel: vi.fn(),
    setLens: vi.fn(),
    resetFilters: vi.fn(),
    buildShareDeepLinkText: vi.fn(() => ''),
  }

  return renderToStaticMarkup(
    React.createElement(
      TypedLanguageProvider,
      { initialLocale: locale },
      React.createElement(TypedDeliveryRadar, { initialLiveCube: null }),
    ),
  )
}

describe('Boudi QA Blockers Audit Suite (Blockers #1, #2, #3, #4 + Static Repo Invariants)', () => {
  beforeEach(() => {
    clearForensicHistory()
    emailTransportSpy.mockClear()
    whatsappTransportSpy.mockClear()
    filterStateHolder.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('Blocker #1: src/server/ai/council.ts is 100% byte-for-byte identical to commit b985f9b (20s timeout, 0 fallback models, original consensus)', async () => {
    const diffOutput = execFileSync('git', ['diff', 'b985f9b', '--', '**/council.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(diffOutput).toBe('')

    const historicalBlobSha = execFileSync(
      'git',
      ['rev-parse', 'b985f9b:src/server/ai/council.ts'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim()
    const historicalCouncil = execFileSync('git', ['show', 'b985f9b:src/server/ai/council.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    const currentCouncil = fs.readFileSync(path.join(REPO_ROOT, 'src/server/ai/council.ts'), 'utf8')
    expect(currentCouncil.replace(/\r\n/g, '\n')).toBe(historicalCouncil.replace(/\r\n/g, '\n'))
    expect(historicalBlobSha).toMatch(/^[0-9a-f]{40}$/)
    expect(COUNCIL_ANALYSIS_TIMEOUT_MS).toBe(20_000)
    expect(currentCouncil).not.toContain('fallbackModel')
    expect(currentCouncil).not.toContain('resolveFallbackCouncilModels')

    const modelsSource = fs.readFileSync(path.join(REPO_ROOT, 'src/server/ai/models.ts'), 'utf8')
    expect(modelsSource).not.toContain('FALLBACK_MODEL')
    expect(modelsSource).not.toContain('resolveFallbackCouncilModels')

    const claimJson = JSON.stringify({
      comparison: {
        subject_id: 'avenues',
        relation: 'best',
        object_id: null,
        metric: 'net_sales_kwd',
        cited_fact_ids: ['f-avenues-sales'],
      },
    })
    const composed = composeCouncilReply({
      odooReply: 'الأفنيوز: 4,200.000 د.ك',
      passed: [
        { provider: 'anthropic', modelId: 'claude-3-5-haiku-latest', text: claimJson },
        { provider: 'google', modelId: 'gemini-2.0-flash', text: claimJson },
      ],
      failed: [],
    })
    expect(composed.agreed).toHaveLength(2)

    const verifierResult = { valid: true, extractedNumbers: [4200], unverifiedNumbers: [] }
    const odooStubResult: AskFeryalOdooAgentResult = {
      status: 'answered',
      reply: 'الأفنيوز: 4,200.000 د.ك',
      executedQueries: [],
      verifier: verifierResult,
      toolNumbers: [4200],
      period: { from: '2026-11-17', to: '2026-11-17' },
      source: null,
      auditEntry: {
        id: 'audit-boudi-1',
        timestampIso: '2026-11-17T12:00:00.000Z',
        userSub: 'u-audit',
        userRole: 'admin',
        question: 'ما أعلى فرع مبيعات اليوم؟',
        status: 'answered',
        executedQueries: [],
        verifier: verifierResult,
        finalReply: 'الأفنيوز: 4,200.000 د.ك',
      },
      facts: [
        {
          id: 'f-avenues-sales',
          metric: 'net_sales_kwd',
          period: '2026-11-17',
          date: '2026-11-17',
          unit: 'KWD',
          value: '4200.000',
          entityType: 'branch',
          entityId: 'avenues',
          entityName: 'The Avenues',
        },
      ],
    }

    const councilResult = await runFeryalCouncil(
      { question: 'ما أعلى فرع مبيعات اليوم؟', userId: 'u-audit' },
      {
        askOdoo: async () => odooStubResult,
        keys: { anthropic: '', google: '', xai: '' },
        persist: async () => {},
      },
    )
    expect(councilResult.status).toBe('answered')
    expect(councilResult.agreed).toEqual([])
    expect(councilResult.reply).toContain('الأفنيوز: 4,200.000 د.ك')
  })

  it('Blocker #1 Round 2: executive-chat-runner.ts has 0 separate LLM/scoring code and chat/route.ts routes ALL pricing questions through unified runFeryalCouncil', async () => {
    const councilDiffBuf = execFileSync('git', ['diff', 'b985f9b', '--', '**/council.ts'], {
      cwd: REPO_ROOT,
    })
    expect(councilDiffBuf.byteLength).toBe(0)

    const runnerSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/lib/feryal/executive-chat-runner.ts'),
      'utf8',
    )
    expect(runnerSource).not.toContain('callProvider')
    expect(runnerSource).not.toContain('COUNCIL_PROVIDERS')
    expect(runnerSource).not.toContain('persistAiRuns')
    expect(runnerSource).not.toContain('scoreExecutiveSynthesis')
    expect(runnerSource).not.toContain('readCouncilKeys')
    expect(runnerSource).not.toContain('resolveCouncilModels')
    expect(runnerSource).not.toContain('orderProvidersByHealth')
    expect(runnerSource).not.toContain('rankedPassed')
    expect(runnerSource).not.toContain('EXECUTIVE_COUNCIL_MAX_TOKENS')

    const routeSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/app/api/erp/feryal/chat/route.ts'),
      'utf8',
    )
    expect(routeSource).toContain('runFeryalCouncil(')
    expect(routeSource).toContain('createExecutivePricingAskOdoo(')
    expect(routeSource).not.toContain('runExecutivePricingChat')
    const councilCallMatches = routeSource.match(/\brunFeryalCouncil\s*\(/g) ?? []
    expect(councilCallMatches).toHaveLength(1)

    const pack = buildExecutiveContextPack({
      fromIso: '2026-11-01',
      toIso: '2026-11-19',
      brandId: 'china-garden',
      rows: [
        {
          productId: 101,
          name: 'Sweet & Sour Chicken',
          qty: '1000',
          netKwd: '2500.000',
          unitPriceKwd: '2.500',
          categoryId: 10,
        },
        {
          productId: 102,
          name: 'Spring Roll',
          qty: '600',
          netKwd: '900.000',
          unitPriceKwd: '1.500',
          categoryId: 10,
        },
      ],
    })

    const intakeDraft: DocumentIntakeDraft = {
      draftId: 'draft-round2-unified',
      fileName: 'cg-round2.xlsx',
      fileKind: 'xlsx',
      sourceTag: 'Extracted Draft (Unconfirmed)',
      requiresHumanConfirmation: true,
      period: { from: '2026-11-01', to: '2026-11-19' },
      brand: 'china-garden',
      branch: null,
      rows: [
        {
          rowId: 'r1',
          brand: 'China Garden',
          itemName: 'Sweet & Sour Chicken',
          sheetCurrentPriceKwd: '2.500',
          proposedOptions: [
            { optionKey: 'ch', label: 'CH', proposedPriceKwd: '2.700' },
            { optionKey: 'ae', label: 'AE', proposedPriceKwd: '3.050' },
          ],
          matchedOdooProductId: 101,
          matchedOdooProductName: 'Sweet & Sour Chicken',
          odooRealizedUnitPriceKwd: '2.500',
          odooQty: '1000',
          odooNetSalesKwd: '2500.000',
          excluded: false,
          anomalies: [],
        },
      ],
      summary: { totalRows: 1, matchedRows: 1, criticalCount: 0, warningCount: 0 },
    }
    const confirmedSheet = confirmDocumentIntakeDraft(intakeDraft, '2026-11-19T12:00:00Z')

    const validComparison = JSON.stringify({
      comparison: {
        subject_id: '101',
        relation: 'better',
        object_id: '102',
        metric: 'item_net_kwd',
        cited_fact_ids: [
          'item_net_kwd|101|2026-11-01..2026-11-19',
          'item_net_kwd|102|2026-11-01..2026-11-19',
        ],
      },
    })

    const keys = {
      anthropic: 'test-anthropic-key-0001',
      google: 'test-google-key-00000001',
      xai: 'test-xai-grok-key-000001',
    }
    const models = {
      anthropic: 'claude-sonnet-4-6',
      google: 'gemini-3.1-pro-preview',
      xai: 'grok-4',
    }

    // 1) 2-of-3 consensus on unified runFeryalCouncil
    const consensusRes = await runExecutivePricingChat(
      {
        question: 'Compare CH vs AE on Sweet & Sour Chicken for China Garden',
        userId: 'u-round2',
        confirmedPriceSheet: confirmedSheet,
      },
      {
        executivePack: pack,
        keys,
        models,
        persist: async () => undefined,
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return Response.json({
              model: 'claude-sonnet-4-6-20251101',
              content: [{ type: 'text', text: validComparison }],
              usage: { input_tokens: 100, output_tokens: 40 },
            })
          }
          if (url.includes('generativelanguage.googleapis.com')) {
            return Response.json({
              modelVersion: 'gemini-3.1-pro-preview-001',
              candidates: [{ content: { parts: [{ text: validComparison }] } }],
              usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40 },
            })
          }
          return new Response('{}', { status: 503 })
        },
      },
    )
    expect(consensusRes.status).toBe('answered')
    expect(consensusRes.agreed.map((a) => a.provider).sort()).toEqual(['anthropic', 'google'])
    expect(consensusRes.reply).toContain("## Feryal's Executive Opinion & Justification")
    expect(consensusRes.reply).toContain('101 is better than 102 on item_net_kwd')

    // 2) <2 agreement fallback -> [odoo.reply, COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE]
    const askOdoo = createExecutivePricingAskOdoo({
      confirmedPriceSheet: confirmedSheet,
      executivePack: pack,
    })
    const odooDirect = await askOdoo({
      question: 'Compare CH vs AE on Sweet & Sour Chicken for China Garden',
      userSub: 'u-round2',
    })
    const fallbackRes = await runFeryalCouncil(
      {
        question: 'Compare CH vs AE on Sweet & Sour Chicken for China Garden',
        userId: 'u-round2',
      },
      {
        askOdoo,
        keys: { anthropic: '', google: '', xai: '' },
        persist: async () => undefined,
      },
    )
    expect(fallbackRes.status).toBe('answered')
    expect(fallbackRes.agreed).toEqual([])
    expect(fallbackRes.reply).toBe(
      [odooDirect.reply, COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE].join('\n\n'),
    )

    // 3) All configured providers guard_rejected -> council_failed
    const guardFailedRes = await runFeryalCouncil(
      {
        question: 'Compare CH vs AE on Sweet & Sour Chicken for China Garden',
        userId: 'u-round2',
      },
      {
        askOdoo,
        keys,
        models,
        persist: async () => undefined,
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return Response.json({
              model: 'claude-sonnet-4-6-20251101',
              content: [{ type: 'text', text: 'unverified prose 999.111 KWD' }],
              usage: { input_tokens: 50, output_tokens: 20 },
            })
          }
          if (url.includes('generativelanguage.googleapis.com')) {
            return Response.json({
              modelVersion: 'gemini-3.1-pro-preview-001',
              candidates: [{ content: { parts: [{ text: 'unverified prose 888.222 KWD' }] } }],
              usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
            })
          }
          return Response.json({
            model: 'grok-4-0709',
            choices: [{ message: { content: 'unverified prose 777.333 KWD' } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
          })
        },
      },
    )
    expect(guardFailedRes.status).toBe('council_failed')
    expect(guardFailedRes.agreed).toEqual([])
  })

  it('Blocker #2: DeliveryRadarV5 displays exact Odoo Net Open Receivables (30,310.675 KWD) and never inflated ~1,077,552', () => {
    vi.useFakeTimers({ now: new Date('2026-11-17T11:30:00.000Z'), toFake: ['Date'] })

    const radarSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/aether/DeliveryRadarV5.tsx'),
      'utf8',
    )
    expect(radarSource).toContain('const arHeadlineKwd = receivablesHeadline.netKwd')
    expect(radarSource).not.toContain('receivablesHeadline.openDebitsKwd ?? receivablesHeadline.netKwd')

    const selected = selectReceivablesHeadline({
      openDebitsKwd: 1077552.125,
      unappliedCreditsKwd: -1047241.45,
      openReceivableKwd: 30310.675,
      unreconciledLineCount: 3804,
    })
    expect(selected.netKwd).toBe(30310.675)

    const liveSummary = buildRadarFixtureSummary({
      readable: true,
      openReceivableKwd: 30310.675,
      grossPositiveReceivableKwd: 31662.047,
      creditClearingOffsetKwd: -1351.372,
      openDebitsKwd: 1077552.125,
      unappliedCreditsKwd: -1047241.45,
      openLinesCount: 3804,
      fromDate: '2025-01-01',
      toDate: '2026-11-17',
      sourceModel: 'account.move.line',
    })

    const enMarkup = renderDeliveryRadarMarkup('en', liveSummary)
    const enHeadline = /data-receivables-headline-kwd="true"[^>]*>([^<]+)</.exec(enMarkup)?.[1]
    expect(enHeadline).toBe('30,310.675 KWD')
    expect(enMarkup).not.toContain('1,077,552')
    expect(enMarkup).not.toContain('1077552')

    const arMarkup = renderDeliveryRadarMarkup('ar', liveSummary)
    const arHeadline = /data-receivables-headline-kwd="true"[^>]*>([^<]+)</.exec(arMarkup)?.[1]
    expect(arHeadline).toBe('30,310.675 د.ك')
    expect(arMarkup).toContain('صافي الذمم المدينة المفتوحة')
    expect(arMarkup).not.toContain('1,077,552')
    expect(arMarkup).not.toContain('1077552')

    const unreadableMarkup = renderDeliveryRadarMarkup(
      'en',
      buildRadarFixtureSummary({
        readable: false,
        openReceivableKwd: 0,
        grossPositiveReceivableKwd: 0,
        creditClearingOffsetKwd: 0,
        openLinesCount: 0,
        fromDate: null,
        toDate: null,
        sourceModel: 'account.move.line',
      }),
    )
    expect(unreadableMarkup).not.toContain('data-receivables-kpi-card="true"')
  })

  it('Blocker #3: forensic-radar.ts has zero synthetic/hashed numbers and nightly email dispatch is strictly Fail-Closed', async () => {
    const forensicSource = fs.readFileSync(
      path.join(REPO_ROOT, 'src/modules/governance/domain/forensic-radar.ts'),
      'utf8',
    )
    expect(forensicSource).not.toContain('diagnose(')
    expect(forensicSource).not.toContain('12_000 +')
    expect(forensicSource).not.toContain('15 + (digest')
    expect(forensicSource).not.toContain('|| 1')

    const warnSpy = vi.spyOn(logger, 'warn')
    const at = new Date('2026-11-20T20:59:00.000Z')

    const emptySnap = buildForensicMatrix(at)
    expect(emptySnap.dataAvailable).toBe(false)
    expect(emptySnap.unavailableReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(emptySnap.rows).toEqual([])
    expect(emptySnap.kpis.totalGmvMinor).toBe(0)
    expect(emptySnap.kpis.financialImpactMinor).toBe(0)

    const emptyReport = buildForensicReport([emptySnap], 'daily', at)
    expect(emptyReport.dataAvailable).toBe(false)
    expect(emptyReport.claimMinor).toBe(0)

    const emptyOperational = buildOperationalForensicReport([emptySnap], at)
    expect(emptyOperational.dataAvailable).toBe(false)
    expect(emptyOperational.combined).toBe('')

    const auth: AuthContext = {
      userId: 'u-audit-cron',
      tenantId: 't-vf',
      role: 'admin',
      permissions: new Set<string>(),
    } as unknown as AuthContext

    const scanRes = await runForensicScan(auth, { at })
    expect(scanRes.alerted).toBe(false)
    expect(scanRes.dispatched).toBe(false)
    expect(scanRes.skippedReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(emailTransportSpy).not.toHaveBeenCalled()
    expect(whatsappTransportSpy).not.toHaveBeenCalled()

    const dispatchRes = await dispatchExclusiveOperationalReport([], at)
    expect(dispatchRes.dispatched).toBe(false)
    expect(dispatchRes.alerted).toBe(false)
    expect(dispatchRes.skippedReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(emailTransportSpy).not.toHaveBeenCalled()
    expect(whatsappTransportSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      'forensic_report_fail_closed_missing_odoo_data',
      expect.objectContaining({ reason: FORENSIC_MISSING_DATA_REASON }),
    )
  })

  it('Blocker #4: Ferial Arabic replies localize Odoo Verified Actual & item-cost permission notices with zero stray English tags', () => {
    expect(formatExecutiveSourceTag(ODOO_VERIFIED_ACTUAL_TAG, 'ar')).toBe('بيانات فعلية موثّقة من أودو')
    expect(formatIntakeSourceTag(ODOO_VERIFIED_ACTUAL_TAG, 'ar')).toBe('بيانات فعلية موثّقة من أودو')
    expect(renderCogsUnavailableReply('ar')).toBe(COGS_UNAVAILABLE_REPLY_AR)
    expect(COGS_UNAVAILABLE_REPLY_AR).not.toMatch(/\bCOGS\b/)
    expect(COGS_UNAVAILABLE_REPLY_AR).not.toContain('standard_price')

    const menuRows: ItemPricingRow[] = [
      {
        productId: 101,
        name: 'Sweet & Sour Chicken',
        qty: '1000',
        netKwd: '2000.000',
        unitPriceKwd: '2.000',
        categoryId: 10,
      },
      {
        productId: 105,
        name: 'Spring Roll',
        qty: '150',
        netKwd: '150.000',
        unitPriceKwd: '1.000',
        categoryId: 12,
      },
    ]

    const liveSummaryForAdvisor: OdooLiveSummary = {
      source: 'live',
      connected: true,
      sourceMode: 'odoo17-live',
      syncedAt: '2026-11-19T12:00:00Z',
      period: { from: '2026-01-01', to: '2026-11-19' },
      bucket: 'year',
      database: null,
      totals: { netSalesKwd: 2150, orders: 500, aovKwd: 4.3 },
      brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 2150, sharePct: 100 }],
      branches: [
        {
          id: 'avenues',
          name: 'The Avenues',
          unit: 'restaurant',
          netSalesKwd: 2150,
          orders: 500,
          sharePct: 100,
        },
      ],
      channels: [{ name: 'dine-in', amountKwd: 2150 }],
    }

    const pack = buildExecutiveContextPack({
      fromIso: '2026-01-01',
      toIso: '2026-11-19',
      brandId: 'china-garden',
      rows: menuRows,
      liveSummary: liveSummaryForAdvisor,
    })

    const intakeDraft: DocumentIntakeDraft = {
      draftId: 'draft-audit-ar',
      fileName: 'cg-menu.xlsx',
      fileKind: 'xlsx',
      sourceTag: 'Extracted Draft (Unconfirmed)',
      requiresHumanConfirmation: true,
      period: { from: '2026-01-01', to: '2026-11-19' },
      brand: 'china-garden',
      branch: null,
      rows: [
        {
          rowId: 'r1',
          brand: 'China Garden',
          itemName: 'Sweet & Sour Chicken',
          sheetCurrentPriceKwd: '2.000',
          proposedOptions: [{ optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.160' }],
          matchedOdooProductId: 101,
          matchedOdooProductName: 'Sweet & Sour Chicken',
          odooRealizedUnitPriceKwd: '2.000',
          odooQty: '1000',
          odooNetSalesKwd: '2000.000',
          excluded: false,
          anomalies: [],
        },
      ],
      summary: { totalRows: 1, matchedRows: 1, criticalCount: 0, warningCount: 0 },
    }

    const confirmedSheet = confirmDocumentIntakeDraft(intakeDraft, '2026-11-19T12:15:00Z')
    const sim = simulateExecutivePricingOptions({ pack, sheet: confirmedSheet })
    const grounded = collectExecutiveGroundedNumbers(pack, sim)
    const arBrief = renderDeterministicExecutiveBrief(pack, sim, 'ar', true)

    expect(arBrief).toContain(ODOO_VERIFIED_ACTUAL_TAG_AR)
    expect(arBrief).toContain(USER_INPUT_CONFIRMED_TAG_AR)
    expect(arBrief).toContain(DETERMINISTIC_SIMULATION_TAG_AR)
    expect(arBrief).toContain(EXECUTIVE_COGS_BOUNDARY_AR)
    expect(arBrief).not.toContain(ODOO_VERIFIED_ACTUAL_TAG)
    expect(arBrief).not.toContain(USER_INPUT_CONFIRMED_TAG)
    expect(arBrief).not.toContain(DETERMINISTIC_SIMULATION_TAG)
    expect(arBrief).not.toContain('standard_price')
    expect(arBrief).not.toContain('price_subtotal')
    expect(arBrief).not.toMatch(/\bCOGS\b/)
    expect(arBrief).not.toContain('Verdict:')

    const verifiedBrief = verifyFeryalReplyNumbers(arBrief, grounded.toolNumbers, {
      allowedDateStrings: ['2026-01-01', '2026-11-19'],
      allowedEntityNames: grounded.allowedEntityNames,
    })
    expect(verifiedBrief.unverifiedNumbers).toEqual([])
    expect(verifiedBrief.valid).toBe(true)

    const guardedBrief = guardAnswerAgainstFacts(arBrief, grounded.labeledFacts)
    expect(guardedBrief.offending).toEqual([])
    expect(guardedBrief.ok).toBe(true)

    const arPricing = buildItemPricingAnswer({
      question: 'ما هي تكلفة الصنف وهامش الربح في تشاينا جاردن؟\nسعر مقترح لـ Spring Roll: 1.250',
      periodLabel: '2026-01-01 إلى 2026-11-19',
      brandNameAr: 'تشاينا جاردن',
      rows: menuRows,
    })
    expect(arPricing.reply).toContain('بيانات فعلية موثّقة من أودو')
    expect(arPricing.reply).toContain('مدخلات المستخدم (مؤكدة)')
    expect(arPricing.reply).toContain(COGS_UNAVAILABLE_REPLY_AR)
    expect(arPricing.reply).not.toContain('Odoo Verified Actual')
    expect(arPricing.reply).not.toContain('standard_price')
    expect(arPricing.reply).not.toMatch(/\bCOGS\b/)
  })

  it('Blocker #5: Closed-year 45s cap is strictly Cold-Cache closed-window only, bounded by shared deadline, with 24h TTL and 128 LRU capacity', () => {
    expect(YEAR_CLOSED_READ_TIMEOUT_MS).toBe(45_000)
    expect(YEAR_CLOSED_TTL_MS).toBe(24 * 60 * 60 * 1000)
    expect(YEAR_CLOSED_MAX).toBe(128)

    const closedWindow = yearClosedWindow('2026-01-01 00:00:00', '2026-11-19 00:00:00')
    expect(closedWindow).not.toBeNull()
    const closedCall = yearReadCall(closedWindow!, {
      deadlineAtMs: 1_045_000,
      nowMs: 1_020_000,
    })
    expect(closedCall).toEqual({
      kwargs: { lazy: false },
      timeout: { timeoutMs: 25_000, timeoutCapMs: 25_000 },
    })

    const todayCall = yearReadCall(
      { fromUtc: '2026-11-19 00:00:00', toUtc: '2026-11-20 00:00:00' },
      { deadlineAtMs: 1_045_000, nowMs: 1_020_000 },
    )
    expect(todayCall).toEqual({
      kwargs: { lazy: false, context: { year_live_slice: true } },
    })
  })

  it('Enforces static repository invariants across all touched production files, odoo-live-connector.ts, pos-registry.json, prisma/, and feryal-governance-studio.tsx', () => {
    const posRegistryStatus = execFileSync(
      'git',
      ['status', '--porcelain', '--', 'src/lib/odoo/pos-registry.json'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    expect(posRegistryStatus.trim()).toBe('')

    const prismaStatus = execFileSync('git', ['status', '--porcelain', '--', 'prisma/'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(prismaStatus.trim()).toBe('')

    const prismaDiffVsMain = execFileSync('git', ['diff', '097bc9e', '--', 'prisma/'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(prismaDiffVsMain.trim()).toBe('')

    const studioContent = fs.readFileSync(
      path.join(REPO_ROOT, 'src/components/erp/feryal-governance-studio.tsx'),
      'utf8',
    )
    expect(studioContent).not.toContain('truncate')

    const consolePattern = new RegExp('\\bconsole\\.(log|warn|error|info|debug|trace)\\b')
    const explicitAnyPattern = new RegExp(':\\s*' + 'a' + 'ny\\b|\\bas\\s+' + 'a' + 'ny\\b|<' + 'a' + 'ny>')
    const tsIgnorePattern = new RegExp('@ts-' + 'ignore|@ts-' + 'expect-error')
    const sub12PxPattern = /text-\[(?:[0-9]|1[01])px\]/
    const syntheticIdPattern = new RegExp('\\b(' + 'mo' + 'ck[A-Za-z0-9_]*|' + 'se' + 'ed[A-Za-z0-9_]*)\\b', 'i')

    const connectorBytes = fs.readFileSync(path.join(REPO_ROOT, 'src/lib/odoo-live-connector.ts'))
    expect(connectorBytes.includes(0)).toBe(false)
    const connectorContent = connectorBytes.toString('utf8')
    expect(connectorContent).not.toMatch(explicitAnyPattern)
    expect(connectorContent).not.toMatch(tsIgnorePattern)
    expect(connectorContent).not.toMatch(sub12PxPattern)
    expect(connectorContent).not.toMatch(syntheticIdPattern)

    const connectorDiff = execFileSync(
      'git',
      ['diff', '097bc9e', '--', 'src/lib/odoo-live-connector.ts'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    const addedConnectorLines = connectorDiff
      .split(/\r?\n/)
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .join('\n')
    expect(addedConnectorLines).not.toMatch(consolePattern)

    for (const relPath of PRODUCTION_FILES_UNDER_AUDIT) {
      const absPath = path.join(REPO_ROOT, relPath)
      const bytes = fs.readFileSync(absPath)
      expect(bytes.includes(0), `${relPath} must have 0 null bytes`).toBe(false)

      const content = bytes.toString('utf8')
      expect(content, `${relPath} must have 0 console.*`).not.toMatch(consolePattern)
      expect(content, `${relPath} must have 0 explicit any`).not.toMatch(explicitAnyPattern)
      expect(content, `${relPath} must have 0 ts-ignore`).not.toMatch(tsIgnorePattern)
      expect(content, `${relPath} must have 0 sub-12px classes`).not.toMatch(sub12PxPattern)
      expect(content, `${relPath} must have 0 mock*/seed* identifiers`).not.toMatch(syntheticIdPattern)
    }
  })
})
