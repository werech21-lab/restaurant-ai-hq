import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { NextRequest } from 'next/server'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { odooStub } = vi.hoisted(() => ({
  odooStub: {
    rows: [
      { product_id: [90051, '[RIC90051] Chicken Noodles'], price_subtotal: 220, qty: 100 },
      { product_id: [90099, '[RIC90099] Beef Fried Rice'], price_subtotal: 180, qty: 60 },
    ] as Array<{ product_id: [number, string]; price_subtotal: number; qty: number }>,
  },
}))

vi.mock('@/lib/odoo-live-connector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/odoo-live-connector')>()
  return {
    ...actual,
    executeOdooKw: async (model: string, method: string) => {
      if (model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Noodles & Rice', parent_id: [10, 'CG'] },
        ]
      }
      if (model === 'pos.order.line' && method === 'read_group') {
        return odooStub.rows
      }
      if (model === 'product.product' && method === 'search_read') {
        return [
          { id: 90051, pos_categ_id: [11, 'CG / Noodles & Rice'] },
          { id: 90052, pos_categ_id: [11, 'CG / Noodles & Rice'] },
          { id: 90099, pos_categ_id: [11, 'CG / Noodles & Rice'] },
        ]
      }
      return []
    },
    fetchLiveOdooSnapshot: async () => ({
      source: 'live' as const,
      connected: true,
      sourceMode: 'odoo17-live' as const,
      noData: false,
      lastSyncAt: '2026-11-20T09:00:00.000Z',
      isStale24h: false,
      odooCompanyId: 1,
      dateRange: { from: '2026-10-22', to: '2026-11-20' },
      syncedAt: '2026-11-20T09:00:00.000Z',
      period: { from: '2026-10-22', to: '2026-11-20' },
      database: null,
      bucket: 'month' as const,
      totals: { netSalesKwd: 400, orders: 120, aovKwd: 3.333 },
      brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 400, sharePct: 100 }],
      branches: [
        {
          id: '360-mall',
          name: '360 Mall',
          unit: 'مول 360',
          netSalesKwd: 400,
          orders: 120,
          sharePct: 100,
        },
      ],
      channels: [{ name: 'dine-in', amountKwd: 400 }],
    }),
  }
})

import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import { TodaysDiscoveriesView } from '@/components/aether/TodaysDiscoveries'
import {
  localizeEstimateFormulaAr,
  localizeOdooModelAr,
} from '@/components/erp/KpiProvenanceBadge'
import { SeasonsStudioView } from '@/components/erp/SeasonsStudio'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import {
  SUGGESTED_SEASON_EVENTS,
  seasonsAdvisor,
  type SeasonEvent,
} from '@/lib/council/advisors/seasons'
import type { CouncilDiscovery } from '@/lib/council/types'
import { prisma } from '@/lib/db'
import {
  detectOdooToolKind,
  isExecutivePricingOrMenuStrategyQuestion,
  isItemLevelPosQuestion,
} from '@/lib/feryal-intent'
import { askFeryalOdooAgent } from '@/lib/feryal-odoo-agent'
import { isExecutiveAdvisorQuestion } from '@/lib/feryal/executive-advisor'
import { shouldRunExecutivePricingChat } from '@/lib/feryal/executive-chat-runner'
import {
  computeDeterministicSuggestedPrice,
  findMatchingMenuItems,
  matchProposedPrice,
  MISSING_COST_SUGGESTED_PRICE_PHRASE_AR,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import { logger } from '@/lib/logger'
import { ACTIVE_VENTURE_BRANCH_IDS } from '@/lib/odoo-terminal-mappings'
import {
  CLOSED_YEAR_PG_CONNECT_TIMEOUT_MS,
  CLOSED_YEAR_PG_READ_COOLDOWN_MS,
  createCooldownAwarePostgresYearClosedStore,
  type ClosedYearHealthState,
  type ClosedYearSqlQueryable,
} from '@/lib/odoo/closed-year-store'
import {
  clearYearClosedMemoryCache,
  configureYearClosedPersistentStore,
  flushYearClosedInflightWrites,
  readClosedYearPlusToday,
  YEAR_CLOSED_L2_IO_TIMEOUT_MS,
} from '@/lib/odoo/pos-order-query'
import {
  COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE,
  runFeryalCouncil,
} from '@/server/ai/council'
import type { CouncilKeys } from '@/server/ai/env'
import type { CouncilModels } from '@/server/ai/models'
import {
  AI_PG_CONNECT_TIMEOUT_MS,
  configureAiPersistQueryable,
  isPostgresOnlyAiStore,
  listCouncilDecisionMirrorBriefs,
  listDailyBriefs,
  listLatestDailyBrief,
  persistDailyBrief,
  safeListAiRuns,
  upsertCouncilDecisionMirrorBrief,
  type AiSqlQueryable,
} from '@/server/ai/persist'
import {
  callProvider,
  resetProviderCooldowns,
  resetProviderTelemetry,
  type ProviderId,
} from '@/server/ai/providers'
import { comparisonMatchesFacts } from '@/server/ai/structured-claim'
import { loadLiveTodaySummary } from './support/dashboard-fixture'

const REPO_ROOT = process.cwd()
const FIXED_NOW_MS = Date.parse('2026-11-20T12:00:00.000Z')

const TEST_KEYS: CouncilKeys = {
  anthropic: 'sk-ant-gate-bundle-secret-77001',
  google: 'AIzaSy-gate-bundle-secret-77002',
  xai: 'xai-gate-bundle-secret-77003',
}

const TEST_MODELS: CouncilModels = {
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-3.1-pro-preview',
  xai: 'grok-4',
}

function createPgliteAdapter(pglite: PGlite): AiSqlQueryable & ClosedYearSqlQueryable {
  return {
    async query<R extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<{ rows: R[]; rowCount?: number | null }> {
      const res = await pglite.query<R>(text, params)
      return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length }
    },
  }
}

function extractTagTexts(html: string, attrPattern: RegExp): string[] {
  const matches: string[] = []
  for (const match of html.matchAll(attrPattern)) {
    const inner = (match[1] ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    if (inner) matches.push(inner)
  }
  return matches
}

describe('Cross-Cutting Bundle Gate — L2 Cache Timeout + 7-Point Follow-Up Bundle', () => {
  let pglite: PGlite | null = null

  beforeEach(() => {
    resetProviderCooldowns()
    resetProviderTelemetry()
    clearYearClosedMemoryCache()
    configureYearClosedPersistentStore(undefined)
    configureAiPersistQueryable(undefined)
    odooStub.rows = [
      { product_id: [90051, '[RIC90051] Chicken Noodles'], price_subtotal: 220, qty: 100 },
      { product_id: [90099, '[RIC90099] Beef Fried Rice'], price_subtotal: 180, qty: 60 },
    ]
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    clearYearClosedMemoryCache()
    configureYearClosedPersistentStore(undefined)
    configureAiPersistQueryable(undefined)
    if (pglite) {
      await pglite.close()
      pglite = null
    }
  })

  it('enforces strict git invariants: council.ts (0B vs b985f9b) and structured-claim.ts (0B vs 653dc84)', () => {
    const councilDiff = execFileSync(
      'git',
      ['diff', 'b985f9b', '--', '**/council.ts'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    expect(councilDiff.length).toBe(0)

    const structuredClaimDiff = execFileSync(
      'git',
      ['diff', '653dc84', '--', '**/structured-claim.ts'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    expect(structuredClaimDiff.length).toBe(0)
  })

  it('preserves f1afbef L2 closed-year 5000ms timeouts and write-bypass of 30s read cooldown', async () => {
    expect(CLOSED_YEAR_PG_CONNECT_TIMEOUT_MS).toBe(5_000)
    expect(CLOSED_YEAR_PG_READ_COOLDOWN_MS).toBe(30_000)
    expect(YEAR_CLOSED_L2_IO_TIMEOUT_MS).toBe(5_000)

    pglite = new PGlite()
    const pgAdapter = createPgliteAdapter(pglite)
    let failNextRead = true
    let clockMs = FIXED_NOW_MS
    const healthState: ClosedYearHealthState = {}

    const queryable: ClosedYearSqlQueryable = {
      async query<R extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        params?: unknown[],
      ) {
        if (failNextRead && /^\s*SELECT\b/i.test(text)) {
          failNextRead = false
          throw new Error('simulated cold TLS connect timeout')
        }
        return pgAdapter.query<R>(text, params)
      },
    }

    const store = createCooldownAwarePostgresYearClosedStore(() => queryable, {
      now: () => clockMs,
      state: healthState,
    })
    configureYearClosedPersistentStore(store)

    let closedRpcCalls = 0
    const closedWindow = { fromUtc: '2026-01-01 00:00:00', toUtc: '2026-11-19 21:00:00' }
    const todayWindow = { fromUtc: '2026-11-19 21:00:00', toUtc: '2026-11-20 21:00:00' }

    const first = await readClosedYearPlusToday<{ slice: string; net: number }>({
      cacheKey: 'bundle-gate:l2:2026',
      closed: closedWindow,
      today: todayWindow,
      nowMs: clockMs,
      scheduleAfter: () => {
        throw new Error('outside request scope')
      },
      read: async (win) => {
        if (win.fromUtc === closedWindow.fromUtc) {
          closedRpcCalls += 1
          clockMs += 20_000
          return [{ slice: 'closed', net: 1500 }]
        }
        return [{ slice: 'today', net: 50 }]
      },
      merge: (rows) => [...rows],
    })

    expect(first).toHaveLength(2)
    expect(closedRpcCalls).toBe(1)
    await flushYearClosedInflightWrites()
    expect(healthState.healthy).toBe(true)

    clearYearClosedMemoryCache()
    clockMs += 1_000

    const second = await readClosedYearPlusToday<{ slice: string; net: number }>({
      cacheKey: 'bundle-gate:l2:2026',
      closed: closedWindow,
      today: todayWindow,
      nowMs: clockMs,
      read: async (win) => {
        if (win.fromUtc === closedWindow.fromUtc) {
          closedRpcCalls += 1
          return [{ slice: 'closed', net: 1500 }]
        }
        return [{ slice: 'today', net: 65 }]
      },
      merge: (rows) => [...rows],
    })

    expect(closedRpcCalls).toBe(1)
    expect(second).toEqual([
      { slice: 'closed', net: 1500 },
      { slice: 'today', net: 65 },
    ])
  })

  it('Item 1: runs ai_daily_briefs and decision mirrors 100% on PostgreSQL (5000ms timeout) with zero SQLite fallback', async () => {
    expect(AI_PG_CONNECT_TIMEOUT_MS).toBe(5_000)
    expect(isPostgresOnlyAiStore({ nodeEnv: 'production', databaseUrl: '' })).toBe(true)
    expect(
      isPostgresOnlyAiStore({
        nodeEnv: 'development',
        databaseUrl: 'postgresql://db.internal:5432/venture',
      }),
    ).toBe(true)

    const decisionsRouteSrc = readFileSync(
      path.join(REPO_ROOT, 'src/app/api/erp/council/decisions/route.ts'),
      'utf8',
    )
    expect(decisionsRouteSrc).not.toMatch(/from\s+['"]@\/lib\/db['"]/)
    expect(decisionsRouteSrc).not.toMatch(/prisma\.aiDailyBrief/)

    pglite = new PGlite()
    const basePg = createPgliteAdapter(pglite)
    let failFirstBriefRead = true
    const pgDouble: AiSqlQueryable = {
      async query<R extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        params?: unknown[],
      ) {
        if (failFirstBriefRead && /FROM\s+public\.ai_daily_briefs/i.test(text)) {
          failFirstBriefRead = false
          throw new Error('transient pg read timeout')
        }
        return basePg.query<R>(text, params)
      },
    }
    configureAiPersistQueryable(pgDouble)

    const sqliteFindFirstSpy = vi.spyOn(prisma.aiDailyBrief, 'findFirst')
    const sqliteFindManySpy = vi.spyOn(prisma.aiDailyBrief, 'findMany')
    const sqliteCreateSpy = vi.spyOn(prisma.aiDailyBrief, 'create')

    await expect(listLatestDailyBrief()).rejects.toThrow('transient pg read timeout')

    // Subsequent Postgres write must NOT be suppressed after a transient read failure
    await persistDailyBrief({
      id: 'brief-gate-1',
      questionHash: 'hash-brief-1',
      status: 'answered',
      reply: 'ملخص تنفيذي موثق',
      agreedModels: 'anthropic/claude-sonnet-4-6,google/gemini-3.1-pro-preview',
    })

    const mirroredOk = await upsertCouncilDecisionMirrorBrief({
      questionHash: 'decision-room:fp-gate-1',
      status: 'approved',
      reply: JSON.stringify({ fingerprint: 'fp-gate-1', status: 'approved' }),
    })
    expect(mirroredOk).toBe(true)

    const latestBrief = await listLatestDailyBrief()
    expect(latestBrief?.id).toBe('brief-gate-1')

    const briefs = await listDailyBriefs(10)
    expect(briefs.map((b) => b.id)).toEqual(['brief-gate-1'])

    const decisionMirrors = await listCouncilDecisionMirrorBriefs(10)
    expect(decisionMirrors).toHaveLength(1)
    expect(decisionMirrors[0]?.questionHash).toBe('decision-room:fp-gate-1')

    expect(sqliteFindFirstSpy).not.toHaveBeenCalled()
    expect(sqliteFindManySpy).not.toHaveBeenCalled()
    expect(sqliteCreateSpy).not.toHaveBeenCalled()
  })

  it('Item 2: renders zero English formulas or ORM tags in Arabic (RTL) mode on /erp and /erp/seasons', () => {
    const summary = loadLiveTodaySummary()
    const customComparableEvent: SeasonEvent = {
      id: 'nov-promo-gate',
      kind: 'custom',
      nameAr: 'موسم نوفمبر التجريبي',
      nameEn: 'November Promo Window',
      startsOn: '2026-11-22',
      endsOn: '2026-11-24',
      previousStartsOn: '2026-10-18',
      previousEndsOn: '2026-10-20',
      recurrence: 'yearly',
      approximate: true,
    }
    const seasonEvents: SeasonEvent[] = [...SUGGESTED_SEASON_EVENTS, customComparableEvent]
    const seasonReport = seasonsAdvisor.run({
      summary,
      events: seasonEvents,
      horizonWeeks: 16,
    })

    const seasonsArHtml = renderToStaticMarkup(
      createElement(SeasonsStudioView, {
        locale: 'ar',
        events: seasonEvents,
        suggested: true,
        report: seasonReport,
        liveSummary: summary,
        canEdit: true,
      }),
    )

    expect(seasonsArHtml).not.toMatch(/\bOdoo\b|window per-day|baseline per-day|event days|previous occurrence|pos\.order|COGS/i)
    const seasonEstimateBlocks = extractTagTexts(
      seasonsArHtml,
      /<span[^>]*data-season-estimate="true"[^>]*>([\s\S]*?)<\/span>/g,
    )
    expect(seasonEstimateBlocks.length).toBeGreaterThan(0)
    for (const block of seasonEstimateBlocks) {
      expect(block).not.toMatch(/[A-Za-z]/)
    }

    const sampleDiscovery: CouncilDiscovery = {
      score: 95,
      linkedAdvisors: ['cfo'],
      finding: {
        fingerprint: 'seasons:salary-gate:2026-11-24',
        advisorId: 'seasons',
        kind: 'upcoming-season',
        entities: {},
        severity: 'medium',
        novelty: 0.9,
        weeklyImpact: null,
        titleAr: 'اقتراب موسم الرواتب في Odoo',
        titleEn: 'Upcoming salary window in Odoo',
        evidence: [
          {
            labelAr: 'متوسط اليوم في الموسم',
            labelEn: 'Season avg day',
            value: 3250.5,
            unit: 'KWD',
            odooModel: 'pos.order',
            domain: 'state in (paid, done, invoiced)',
            period: { from: '2026-10-24', to: '2026-10-30' },
            syncAt: '2026-11-20T09:00:00.000Z',
          },
        ],
        rootCause: {
          ar: 'ارتفاع الطلب خلال نافذة الرواتب في Odoo',
          en: 'Higher demand during salary window in Odoo',
        },
        proposals: [
          {
            who: { ar: 'مدير العمليات', en: 'Ops Manager' },
            what: { ar: 'تعزيز مخزون الفروع', en: 'Reinforce branch stock' },
            when: { ar: 'قبل 48 ساعة', en: '48h before' },
            expectedImpact: {
              label: 'Estimate',
              value: 2450,
              unit: 'KWD',
              formula: '(window per-day net − baseline per-day net) × event days (max 7), previous occurrence',
              inputs: { windowAvg: 3250.5, baselineAvg: 2900.5, days: 7 },
            },
          },
        ],
      },
    }

    const homeDiscoveriesArHtml = renderToStaticMarkup(
      createElement(TodaysDiscoveriesView, {
        locale: 'ar',
        discoveries: [sampleDiscovery],
      }),
    )
    expect(homeDiscoveriesArHtml).toContain('أودو · طلبات نقاط البيع')
    expect(homeDiscoveriesArHtml).not.toMatch(/\bOdoo\b|pos\.order|window per-day|baseline per-day|event days/i)
    const homeEstimateBlocks = extractTagTexts(
      homeDiscoveriesArHtml,
      /<p[^>]*data-estimate="true"[^>]*>([\s\S]*?)<\/p>/g,
    )
    expect(homeEstimateBlocks).toHaveLength(1)
    expect(homeEstimateBlocks[0]).not.toMatch(/[A-Za-z]/)

    expect(localizeOdooModelAr('pos.order')).toBe('طلبات نقاط البيع')
    expect(
      localizeEstimateFormulaAr(
        '(window per-day net − baseline per-day net) × event days (max 7), previous occurrence',
      ),
    ).not.toMatch(/[A-Za-z]/)
  })

  it('Items 3 & 4: accepts optional ال in pricing intent detectors, translates نودلز الدجاج -> [RIC90051] Chicken Noodles, and clarifies multi-SKU hits', async () => {
    const withAl = 'ما السعر المقترح لصنف نودلز الدجاج؟'
    const withoutAl = 'سعر مقترح لنودلز الدجاج'

    for (const prompt of [withAl, withoutAl]) {
      expect(isItemLevelPosQuestion(prompt)).toBe(true)
      expect(isExecutivePricingOrMenuStrategyQuestion(prompt)).toBe(true)
      expect(isExecutiveAdvisorQuestion(prompt)).toBe(true)
      expect(
        detectOdooToolKind(
          prompt,
          null,
          { brandId: null, asksByBrandBreakdown: false },
          false,
        ),
      ).toBe('pos_order_lines')
      expect(shouldRunExecutivePricingChat(prompt, { confirmedPriceSheet: null })).toBe(false)
    }

    // Portfolio strategy prompt still routes to executive pricing advisor
    expect(
      shouldRunExecutivePricingChat('اعطني تحليل باريتو ABC وسيناريوهات التسعير للمنيو', {
        confirmedPriceSheet: null,
      }),
    ).toBe(true)

    const sampleRows: ItemPricingRow[] = [
      {
        productId: 90051,
        name: '[RIC90051] Chicken Noodles',
        qty: '100',
        netKwd: '220.000',
        unitPriceKwd: '2.200',
        categoryId: 11,
      },
      {
        productId: 90099,
        name: '[RIC90099] Beef Fried Rice',
        qty: '60',
        netKwd: '180.000',
        unitPriceKwd: '3.000',
        categoryId: 11,
      },
    ]

    const singleHits = findMatchingMenuItems('نودلز الدجاج', sampleRows)
    expect(singleHits.map((r) => r.name)).toEqual(['[RIC90051] Chicken Noodles'])
    expect(
      matchProposedPrice({ label: 'نودلز الدجاج', amount: '2.500' }, sampleRows)?.name,
    ).toBe('[RIC90051] Chicken Noodles')

    // Multi-match disambiguation asks user to specify the SKU instead of returning brand template
    const multiRows: ItemPricingRow[] = [
      ...sampleRows,
      {
        productId: 90052,
        name: '[RIC90052] Spicy Chicken Noodles',
        qty: '45',
        netKwd: '108.000',
        unitPriceKwd: '2.400',
        categoryId: 11,
      },
    ]
    const multiResult = await askFeryalOdooAgent({
      question: withAl,
      referenceNowMs: FIXED_NOW_MS,
      dataSource: {
        fetchItemPricingLines: async () => ({
          rows: multiRows,
          domain: [],
          groupby: ['product_id'],
          chunks: 1,
          configIds: [1],
        }),
      },
    })

    expect(multiResult.status).toBe('answered')
    expect(multiResult.verifier.valid).toBe(true)
    expect(multiResult.reply).toContain('[RIC90051] Chicken Noodles')
    expect(multiResult.reply).toContain('[RIC90052] Spicy Chicken Noodles')
    expect(multiResult.reply).not.toContain('أعلى الأصناف:')
  })

  it('Item 5: computes suggested price deterministically in code with verified ComparableFacts when cost exists, and replies literally when cost is missing', async () => {
    const missingCostResult = await askFeryalOdooAgent({
      question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
      referenceNowMs: FIXED_NOW_MS,
      dataSource: {
        fetchItemPricingLines: async () => ({
          rows: [
            {
              productId: 90051,
              name: '[RIC90051] Chicken Noodles',
              qty: '100',
              netKwd: '220.000',
              unitPriceKwd: '2.200',
              unitCostKwd: null,
              categoryId: 11,
            },
          ],
          domain: [],
          groupby: ['product_id'],
          chunks: 1,
          configIds: [1],
        }),
      },
    })

    expect(missingCostResult.status).toBe('answered')
    expect(missingCostResult.verifier.valid).toBe(true)
    expect(missingCostResult.reply).toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)
    expect(missingCostResult.reply).toContain('ما بقدر أحسب سعر مقترح بلا تكلفة')

    // Deterministic suggested price when verified cost is available (0.750 / 0.30 = 2.500 KWD)
    const calc = computeDeterministicSuggestedPrice({
      qty: '100',
      netKwd: '220.000',
      unitPriceKwd: '2.200',
      unitCostKwd: '0.750',
    })
    expect(calc).toEqual({
      suggestedPriceKwd: '2.5',
      currentUnitPriceKwd: '2.2',
      unitCostKwd: '0.75',
      unitMarginKwd: '1.75',
      revenueDeltaKwd: '30',
    })

    const withCostResult = await askFeryalOdooAgent({
      question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
      referenceNowMs: FIXED_NOW_MS,
      dataSource: {
        fetchItemPricingLines: async () => ({
          rows: [
            {
              productId: 90051,
              name: '[RIC90051] Chicken Noodles',
              qty: '100',
              netKwd: '220.000',
              unitPriceKwd: '2.200',
              unitCostKwd: '0.750',
              categoryId: 11,
            },
          ],
          domain: [],
          groupby: ['product_id'],
          chunks: 1,
          configIds: [1],
        }),
      },
    })

    expect(withCostResult.status).toBe('answered')
    expect(withCostResult.verifier.valid).toBe(true)
    expect(withCostResult.reply).toContain('2.500')

    const suggestedFact = withCostResult.facts.find((f) => f.id === 'item_suggested_price_90051')
    const currentFact = withCostResult.facts.find((f) => f.id === 'item_current_price_90051')
    expect(suggestedFact).toMatchObject({
      metric: 'unit_price_kwd',
      unit: 'KWD',
      value: '2.5',
      entityType: 'product',
      entityId: 'suggested_price_90051',
    })
    expect(currentFact).toMatchObject({
      metric: 'unit_price_kwd',
      unit: 'KWD',
      value: '2.2',
      entityType: 'product',
      entityId: 'current_price_90051',
    })

    // Unrelaxed comparisonMatchesFacts accepts valid comparison citing the two code-computed facts
    const validClaim = {
      subject_id: 'suggested_price_90051',
      relation: 'better' as const,
      object_id: 'current_price_90051',
      metric: 'unit_price_kwd',
      cited_fact_ids: ['item_suggested_price_90051', 'item_current_price_90051'],
    }
    expect(
      comparisonMatchesFacts(validClaim, withCostResult.facts, {
        activeBranchIds: ACTIVE_VENTURE_BRANCH_IDS,
      }),
    ).toBe(true)
  })

  it('Item 6: replaces English council fallback note with pure Arabic in chat/route.ts without touching council.ts', async () => {
    expect(COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE).toContain(
      'Note: AI analytical explanation is currently unavailable',
    )

    const token = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
    const prevAnthropic = process.env.ANTHROPIC_API_KEY
    const prevGoogle = process.env.GEMINI_API_KEY
    const prevXai = process.env.XAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.XAI_API_KEY

    try {
      const reqAr = new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${EXEC_SESSION_COOKIE}=${token}`,
        },
        body: JSON.stringify({
          question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
          period: 'month',
        }),
      })

      const resAr = await chatPost(reqAr)
      expect(resAr.status).toBe(200)
      const payloadAr = (await resAr.json()) as { ok: boolean; reply: string }
      expect(payloadAr.ok).toBe(true)
      expect(payloadAr.reply).not.toContain('Note: AI analytical explanation is currently unavailable')
      expect(payloadAr.reply).toContain(
        'ملاحظة: الشرح التحليلي الإضافي من النماذج غير متاح حالياً — الأرقام أعلاه موثّقة مباشرة من أودو.',
      )
    } finally {
      if (prevAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevAnthropic
      if (prevGoogle !== undefined) process.env.GEMINI_API_KEY = prevGoogle
      if (prevXai !== undefined) process.env.XAI_API_KEY = prevXai
    }
  })

  it('Item 7: logs provider attempts with requestedModel/errorCode/latencyMs (zero secrets) and persists PARSE_FAIL/SCHEMA_FAIL/FACT_MISMATCH in ai_runs', async () => {
    pglite = new PGlite()
    const pgAdapter = createPgliteAdapter(pglite)
    configureAiPersistQueryable(pgAdapter)

    const warnSpy = vi.spyOn(logger, 'warn')
    const infoSpy = vi.spyOn(logger, 'info')

    // Direct failure() path preserves modelId === '' on return object while logging non-empty requestedModel
    const timeoutOut = await callProvider({
      provider: 'anthropic',
      apiKey: TEST_KEYS.anthropic,
      model: TEST_MODELS.anthropic,
      system: 'sys',
      user: 'usr',
      timeoutMs: 50,
      fetchImpl: async () => {
        const abortErr = new Error('The operation was aborted')
        abortErr.name = 'AbortError'
        throw abortErr
      },
    })
    expect(timeoutOut.modelId).toBe('')
    expect(timeoutOut.requestedModel).toBe('claude-sonnet-4-6')
    expect(timeoutOut.errorCode).toBe('TIMEOUT')

    // End-to-end runFeryalCouncil -> persistAiRuns across PARSE_FAIL, SCHEMA_FAIL, and FACT_MISMATCH
    const sampleFacts = [
      {
        id: 'fact_branch_a',
        metric: 'net_sales_kwd',
        period: '2026-11-20',
        date: '2026-11-20',
        unit: 'KWD',
        value: '500',
        entityType: 'branch' as const,
        entityId: '360-mall',
        entityName: 'مول 360',
      },
      {
        id: 'fact_branch_b',
        metric: 'net_sales_kwd',
        period: '2026-11-20',
        date: '2026-11-20',
        unit: 'KWD',
        value: '300',
        entityType: 'branch' as const,
        entityId: 'salmiya',
        entityName: 'السالمية',
      },
    ]

    const responsesByProvider: Record<ProviderId, string> = {
      anthropic: 'not valid json at all 777.5',
      google: JSON.stringify({
        comparison: {
          subject_id: '360-mall',
          relation: 'not_in_enum',
          object_id: 'salmiya',
          metric: 'net_sales_kwd',
          cited_fact_ids: ['fact_branch_a'],
          bad_num: 888.25,
        },
      }),
      xai: JSON.stringify({
        comparison: {
          subject_id: 'salmiya',
          relation: 'better',
          object_id: '360-mall',
          metric: 'net_sales_999.9',
          cited_fact_ids: ['fact_branch_a', 'fact_branch_b'],
        },
      }),
    }

    await runFeryalCouncil(
      {
        question: 'قارن مبيعات مول 360 والسالمية اليوم',
        userId: 'exec-gate-1',
        userRole: 'admin',
      },
      {
        keys: TEST_KEYS,
        models: TEST_MODELS,
        timeoutMs: 1_000,
        askOdoo: async () => ({
          status: 'answered',
          reply: 'مبيعات مول 360 أعلى من السالمية.',
          executedQueries: [],
          verifier: { valid: true, extractedNumbers: [500, 300], unverifiedNumbers: [] },
          toolNumbers: [500, 300],
          facts: sampleFacts,
          period: { from: '2026-11-20', to: '2026-11-20' },
          source: {
            system: 'Odoo 17',
            model: 'pos.order',
            period: { from: '2026-11-20', to: '2026-11-20' },
            lastSyncAt: null,
          },
          auditEntry: {
            id: 'audit-gate-1',
            timestampIso: '2026-11-20T12:00:00.000Z',
            userSub: 'exec-gate-1',
            userRole: 'admin',
            question: 'قارن مبيعات مول 360 والسالمية اليوم',
            status: 'answered',
            executedQueries: [],
            verifier: { valid: true, extractedNumbers: [500, 300], unverifiedNumbers: [] },
            finalReply: 'مبيعات مول 360 أعلى من السالمية.',
          },
        }),
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return new Response(
              JSON.stringify({
                model: 'claude-sonnet-4-6-20251101',
                content: [{ type: 'text', text: responsesByProvider.anthropic }],
                usage: { input_tokens: 20, output_tokens: 15 },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          }
          if (url.includes('generativelanguage.googleapis.com')) {
            return new Response(
              JSON.stringify({
                modelVersion: 'gemini-3.1-pro-preview-001',
                candidates: [{ content: { parts: [{ text: responsesByProvider.google }] } }],
                usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15 },
              }),
              { status: 200, headers: { 'content-type': 'application/json' } },
            )
          }
          return new Response(
            JSON.stringify({
              model: 'grok-4-0709',
              choices: [{ message: { content: responsesByProvider.xai } }],
              usage: { prompt_tokens: 20, completion_tokens: 15 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        },
      },
    )

    const stored = await safeListAiRuns(10)
    expect(stored.error).toBe(false)
    expect(stored.runs).toHaveLength(3)

    const byProvider = new Map(stored.runs.map((r) => [r.provider, r]))
    expect(byProvider.get('anthropic')?.status).toBe('guard_rejected')
    expect(byProvider.get('anthropic')?.errorCode).toContain('PARSE_FAIL')
    expect(byProvider.get('anthropic')?.errorCode).toContain('requestedModel=claude-sonnet-4-6')
    expect(byProvider.get('anthropic')?.errorCode).toContain('777.5')

    expect(byProvider.get('google')?.status).toBe('guard_rejected')
    expect(byProvider.get('google')?.errorCode).toContain('SCHEMA_FAIL')
    expect(byProvider.get('google')?.errorCode).toContain('requestedModel=gemini-3.1-pro-preview')
    expect(byProvider.get('google')?.errorCode).toContain('888.25')

    expect(byProvider.get('xai')?.status).toBe('guard_rejected')
    expect(byProvider.get('xai')?.errorCode).toContain('FACT_MISMATCH')
    expect(byProvider.get('xai')?.errorCode).toContain('requestedModel=grok-4')
    expect(byProvider.get('xai')?.errorCode).toContain('999.9')

    // Verify zero secrets in any emitted info/warn log call
    const serializedLogs = JSON.stringify([
      ...warnSpy.mock.calls,
      ...infoSpy.mock.calls,
    ])
    expect(serializedLogs).not.toContain(TEST_KEYS.anthropic)
    expect(serializedLogs).not.toContain(TEST_KEYS.google)
    expect(serializedLogs).not.toContain(TEST_KEYS.xai)
  })
})
