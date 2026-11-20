import { execFileSync } from 'node:child_process'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { liveOdooStubState } = vi.hoisted(() => ({
  liveOdooStubState: {
    rows: [
      { product_id: [90051, '[RIC90051] Chicken Noodles'], price_subtotal: 270, qty: 120 },
      { product_id: [90099, '[RIC90099] Beef Fried Rice'], price_subtotal: 200, qty: 80 },
    ] as Array<{ product_id: [number, string]; price_subtotal: number; qty: number }>,
    calls: [] as Array<{ model: string; method: string; args: unknown[]; kwargs: Record<string, unknown> }>,
  },
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
      liveOdooStubState.calls.push({ model, method, args, kwargs })
      if (model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Noodles & Rice', parent_id: [10, 'CG'] },
        ]
      }
      if (model === 'pos.order.line' && method === 'read_group') {
        return liveOdooStubState.rows
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
      totals: { netSalesKwd: 470, orders: 140, aovKwd: 3.357 },
      brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 470, sharePct: 100 }],
      branches: [
        { id: '360-mall', name: '360 Mall', unit: 'مول 360', netSalesKwd: 470, orders: 140, sharePct: 100 },
      ],
      channels: [{ name: 'dine-in', amountKwd: 470 }],
    }),
  }
})

import { POST as chatPost } from '@/app/api/erp/feryal/chat/route'
import {
  createExecSessionToken,
  DEFAULT_ADMIN_EMAIL,
  EXEC_SESSION_COOKIE,
} from '@/lib/auth/exec-session'
import {
  detectFeryalPromptLocale,
  detectOdooToolKind,
  detectTargetBrandFromQuestion,
  isExecutivePricingOrMenuStrategyQuestion,
  isItemLevelPosQuestion,
} from '@/lib/feryal-intent'
import { askFeryalOdooAgent, verifyFeryalReplyNumbers } from '@/lib/feryal-odoo-agent'
import { isExecutiveAdvisorQuestion } from '@/lib/feryal/executive-advisor'
import { shouldRunExecutivePricingChat } from '@/lib/feryal/executive-chat-runner'
import {
  buildItemLineDomain,
  canonicalizeDishLabel,
  computeDeterministicSuggestedPrice,
  findMatchingMenuItems,
  itemPricingRegisterIds,
  matchProposedPrice,
  MISSING_COST_SUGGESTED_PRICE_PHRASE_AR,
  parseProposedPrices,
  translateDishToken,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import { ACTIVE_VENTURE_BRANCH_IDS } from '@/lib/odoo-terminal-mappings'
import { COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE, runFeryalCouncil } from '@/server/ai/council'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'
import { comparisonMatchesFacts } from '@/server/ai/structured-claim'

const REPO_ROOT = process.cwd()
const FIXED_NOW_MS = Date.parse('2026-11-20T12:00:00.000Z')

describe('Items 3, 4, 5 & 6 — Feryal Definite-Article Intent, Dish Dictionary, Deterministic Suggested Price & Arabic Fallback Note', () => {
  beforeEach(() => {
    liveOdooStubState.calls.length = 0
    liveOdooStubState.rows = [
      { product_id: [90051, '[RIC90051] Chicken Noodles'], price_subtotal: 270, qty: 120 },
      { product_id: [90099, '[RIC90099] Beef Fried Rice'], price_subtotal: 200, qty: 80 },
    ]
  })

  it('Item 3: accepts optional «ال» across all pricing intent detectors and routes item-level pricing questions into runItemLevelPricingTool', async () => {
    const definitePrompts = [
      'ما السعر المقترح لصنف نودلز الدجاج؟',
      'سعر مقترح لنودلز الدجاج',
      'السعر المقترح لنودلز الدجاج في رايس',
      'السعر المقترح لنودلز الدجاج في تشاينا جاردن',
      'ما هي الأسعار المقترحة للأصناف؟',
      'اسعار مقترحه للمنيو',
    ]

    for (const prompt of definitePrompts) {
      expect(isItemLevelPosQuestion(prompt), `isItemLevelPosQuestion(${prompt})`).toBe(true)
      expect(
        isExecutivePricingOrMenuStrategyQuestion(prompt),
        `isExecutivePricingOrMenuStrategyQuestion(${prompt})`,
      ).toBe(true)
      expect(isExecutiveAdvisorQuestion(prompt), `isExecutiveAdvisorQuestion(${prompt})`).toBe(true)
    }

    // detectOdooToolKind routes single-item suggested price queries to 'pos_order_lines' even when a brand is mentioned
    for (const itemPrompt of [
      'ما السعر المقترح لصنف نودلز الدجاج؟',
      'سعر مقترح لنودلز الدجاج',
      'السعر المقترح لنودلز الدجاج في رايس',
      'السعر المقترح لنودلز الدجاج في تشاينا جاردن',
    ]) {
      const brandDet = detectTargetBrandFromQuestion(itemPrompt)
      expect(detectOdooToolKind(itemPrompt, null, brandDet, false, false)).toBe('pos_order_lines')
      expect(
        shouldRunExecutivePricingChat(itemPrompt, {
          confirmedPriceSheet: null,
          isFollowUpOnConfirmedSheet: false,
        }),
      ).toBe(false)
    }

    // Portfolio / ABC / 3-scenario prompts still return true on shouldRunExecutivePricingChat
    expect(
      shouldRunExecutivePricingChat('Run Pareto ABC velocity analysis for China Garden', {
        confirmedPriceSheet: null,
      }),
    ).toBe(true)
    expect(
      shouldRunExecutivePricingChat('ما هو أثر تعديل الأسعار في سيناريو اختبار الضغط؟', {
        confirmedPriceSheet: null,
      }),
    ).toBe(true)

    // Verify askFeryalOdooAgent enters runItemLevelPricingTool (feryal-odoo-agent.ts:1217-1228)
    let itemPricingInvoked = false
    const configIds = itemPricingRegisterIds(null)
    expect(configIds).toEqual(expect.arrayContaining([24, 36]))
    expect(configIds).not.toContain(25)
    expect(configIds).not.toContain(39)
    expect(configIds).not.toContain(40)

    const agentRes = await askFeryalOdooAgent({
      question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => {
          itemPricingInvoked = true
          return {
            rows: [
              {
                productId: 90051,
                name: '[RIC90051] Chicken Noodles',
                qty: '120',
                netKwd: '270.000',
                unitPriceKwd: '2.250',
                unitCostKwd: null,
                categoryId: 11,
              },
            ],
            domain: buildItemLineDomain({
              fromUtc: '2026-10-21 21:00:00',
              toExclusiveUtc: '2026-11-20 21:00:00',
              configIds,
              categoryIds: [11],
            }),
            groupby: ['product_id'],
            chunks: 1,
            configIds,
          }
        },
      },
    })

    expect(itemPricingInvoked).toBe(true)
    expect(agentRes.status).toBe('answered')
    expect(agentRes.executedQueries[0]?.model).toBe('pos.order.line')
    expect(agentRes.executedQueries[0]?.groupby).toEqual(['product_id'])
    expect(agentRes.verifier.valid).toBe(true)
    expect(agentRes.reply).toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)
  })

  it('Item 4: translates Arabic dish tokens to English SKUs and asks the user to disambiguate when multiple SKUs match', async () => {
    // Verify dictionary mappings across standard + Gulf dialect + definite articles
    expect(translateDishToken('النودلز')).toBe('noodles')
    expect(translateDishToken('معكرونة')).toBe('noodles')
    expect(translateDishToken('الدجاج')).toBe('chicken')
    expect(translateDishToken('دياي')).toBe('chicken')
    expect(translateDishToken('جكن')).toBe('chicken')
    expect(translateDishToken('تشيكن')).toBe('chicken')
    expect(translateDishToken('اللحم')).toBe('beef')
    expect(translateDishToken('بقري')).toBe('beef')
    expect(translateDishToken('روبيان')).toBe('shrimp')
    expect(translateDishToken('شرمب')).toBe('shrimp')
    expect(translateDishToken('جمبري')).toBe('shrimp')
    expect(translateDishToken('سمك')).toBe('fish')
    expect(translateDishToken('فيليه')).toBe('fish')
    expect(translateDishToken('أرز')).toBe('rice')
    expect(translateDishToken('عيش')).toBe('rice')
    expect(translateDishToken('رايس')).toBe('rice')
    expect(translateDishToken('برجر')).toBe('burger')
    expect(translateDishToken('ساندوتش')).toBe('wrap')
    expect(translateDishToken('راب')).toBe('wrap')
    expect(translateDishToken('بطاطس')).toBe('fries')
    expect(translateDishToken('فرايز')).toBe('fries')
    expect(translateDishToken('جبنة')).toBe('cheese')
    expect(translateDishToken('سبايسي')).toBe('spicy')
    expect(translateDishToken('مشوي')).toBe('grilled')
    expect(translateDishToken('مقرمش')).toBe('crispy')
    expect(translateDishToken('كرك')).toBe('karak')
    expect(translateDishToken('شباتي')).toBe('chapati')
    expect(translateDishToken('وجبة')).toBe('combo')
    expect(translateDishToken('عائلي')).toBe('family')
    expect(translateDishToken('صغير')).toBe('small')
    expect(translateDishToken('وسط')).toBe('medium')
    expect(translateDishToken('كبير')).toBe('large')

    expect(canonicalizeDishLabel('نودلز الدجاج').tokens).toEqual(['noodles', 'chicken'])
    expect(canonicalizeDishLabel('لنودلز الدجاج').tokens).toEqual(['noodles', 'chicken'])
    expect(parseProposedPrices('ما السعر المقترح لصنف [RIC90051] Chicken Noodles؟')).toEqual([])

    const singleMatchRows: ItemPricingRow[] = [
      {
        productId: 90051,
        name: '[RIC90051] Chicken Noodles',
        qty: '120',
        netKwd: '270.000',
        unitPriceKwd: '2.250',
        categoryId: 11,
      },
      {
        productId: 90099,
        name: '[RIC90099] Beef Fried Rice',
        qty: '80',
        netKwd: '200.000',
        unitPriceKwd: '2.500',
        categoryId: 11,
      },
    ]

    expect(matchProposedPrice({ label: 'نودلز الدجاج', amount: '2.500' }, singleMatchRows)?.productId).toBe(
      90051,
    )
    expect(findMatchingMenuItems('ما السعر المقترح لصنف نودلز الدجاج؟', singleMatchRows).map((r) => r.productId)).toEqual([
      90051,
    ])
    expect(findMatchingMenuItems('السعر المقترح لنودلز الدجاج في رايس', singleMatchRows).map((r) => r.productId)).toEqual([
      90051,
    ])

    // Multi-match scenario: [RIC90051] Chicken Noodles & [RIC90052] Spicy Chicken Noodles
    const multiMatchRows: ItemPricingRow[] = [
      ...singleMatchRows,
      {
        productId: 90052,
        name: '[RIC90052] Spicy Chicken Noodles',
        qty: '95',
        netKwd: '237.500',
        unitPriceKwd: '2.500',
        categoryId: 11,
      },
    ]

    const multiHits = findMatchingMenuItems('ما السعر المقترح لصنف نودلز الدجاج؟', multiMatchRows)
    expect(multiHits.map((r) => r.productId)).toEqual([90051, 90052])

    // Disambiguating with "الحار" or explicit "[RIC90051]" narrows to 1 match
    expect(
      findMatchingMenuItems('ما السعر المقترح لنودلز الدجاج الحار؟', multiMatchRows).map((r) => r.productId),
    ).toEqual([90052])
    expect(
      findMatchingMenuItems('ما السعر المقترح لصنف [RIC90051]؟', multiMatchRows).map((r) => r.productId),
    ).toEqual([90051])

    // Full askFeryalOdooAgent call on multi-match -> asks user in Arabic to specify exact SKU (never generic brand template!)
    const configIds = itemPricingRegisterIds(null)
    const multiRes = await askFeryalOdooAgent({
      question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => ({
          rows: multiMatchRows,
          domain: buildItemLineDomain({
            fromUtc: '2026-10-21 21:00:00',
            toExclusiveUtc: '2026-11-20 21:00:00',
            configIds,
            categoryIds: [11],
          }),
          groupby: ['product_id'],
          chunks: 1,
          configIds,
        }),
      },
    })

    expect(multiRes.status).toBe('answered')
    expect(multiRes.verifier.valid).toBe(true)
    expect(multiRes.verifier.unverifiedNumbers).toEqual([])
    expect(multiRes.reply).toContain('يرجى تحديد الصنف المطلوب بدقة')
    expect(multiRes.reply).toContain('[RIC90051] Chicken Noodles')
    expect(multiRes.reply).toContain('[RIC90052] Spicy Chicken Noodles')
    expect(multiRes.reply).not.toContain('أعلى الأصناف:')

    // Multi-match ALSO triggers when user supplies a proposed price for an ambiguous dish name
    const multiProposalRes = await askFeryalOdooAgent({
      question: 'السعر المقترح لنودلز الدجاج: 2.650',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => ({
          rows: multiMatchRows,
          domain: [],
          groupby: ['product_id'],
          chunks: 1,
          configIds,
        }),
      },
    })
    expect(multiProposalRes.status).toBe('answered')
    expect(multiProposalRes.verifier.valid).toBe(true)
    expect(multiProposalRes.reply).toContain('[RIC90051] Chicken Noodles')
    expect(multiProposalRes.reply).toContain('[RIC90052] Spicy Chicken Noodles')
    expect(multiProposalRes.reply).not.toContain('أعلى الأصناف:')
  })

  it('Item 5: computes suggested price deterministically in code with verified ComparableFact[] passing comparisonMatchesFacts & runFeryalCouncil, and refuses literally when cost is null', async () => {
    // 1) Pure Decimal calculation verification
    const calc = computeDeterministicSuggestedPrice({
      qty: '120',
      netKwd: '270.000',
      unitPriceKwd: '2.250',
      unitCostKwd: '0.900',
    })
    expect(calc).toEqual({
      suggestedPriceKwd: '3',
      currentUnitPriceKwd: '2.25',
      unitCostKwd: '0.9',
      unitMarginKwd: '2.1',
      revenueDeltaKwd: '90',
    })

    // Bounded deterministic step when current price already beats the 30% food-cost benchmark
    const boundedCalc = computeDeterministicSuggestedPrice({
      qty: '100',
      netKwd: '250.000',
      unitPriceKwd: '2.500',
      unitCostKwd: '0.600',
    })
    expect(boundedCalc).toEqual({
      suggestedPriceKwd: '2.65',
      currentUnitPriceKwd: '2.5',
      unitCostKwd: '0.6',
      unitMarginKwd: '2.05',
      revenueDeltaKwd: '15',
    })

    const configIds = itemPricingRegisterIds(null)

    // 2) Case A: unitCostKwd is null -> literal "ما بقدر أحسب سعر مقترح بلا تكلفة" with zero invented numbers
    const missingCostRes = await askFeryalOdooAgent({
      question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => ({
          rows: [
            {
              productId: 90051,
              name: '[RIC90051] Chicken Noodles',
              qty: '120',
              netKwd: '270.000',
              unitPriceKwd: '2.250',
              unitCostKwd: null,
              categoryId: 11,
            },
          ],
          domain: [],
          groupby: ['product_id'],
          chunks: 1,
          configIds,
        }),
      },
    })

    expect(missingCostRes.status).toBe('answered')
    expect(missingCostRes.verifier.valid).toBe(true)
    expect(missingCostRes.verifier.unverifiedNumbers).toEqual([])
    expect(missingCostRes.reply).toContain('ما بقدر أحسب سعر مقترح بلا تكلفة')
    expect(missingCostRes.reply).not.toContain('3.000')
    expect(
      guardAnswerAgainstFacts(missingCostRes.reply.split('\n• المصدر:')[0] ?? '', missingCostRes.facts, {
        allowedEntityNames: ['[RIC90051] Chicken Noodles'],
        forbidPosCogsMarginClaims: true,
      }),
    ).toEqual({ ok: true, offending: [] })

    // 3) Case B: unitCostKwd is available -> deterministic suggested price + ComparableFact[] + 3-model runFeryalCouncil consensus
    const askWithVerifiedCost = (input: Parameters<typeof askFeryalOdooAgent>[0]) =>
      askFeryalOdooAgent({
        ...input,
        referenceNowMs: FIXED_NOW_MS,
        skipAuditLog: true,
        dataSource: {
          fetchItemPricingLines: async () => ({
            rows: [
              {
                productId: 90051,
                name: '[RIC90051] Chicken Noodles',
                qty: '120',
                netKwd: '270.000',
                unitPriceKwd: '2.250',
                unitCostKwd: '0.900',
                categoryId: 11,
              },
            ],
            domain: [],
            groupby: ['product_id'],
            chunks: 1,
            configIds,
          }),
        },
      })

    const directWithCost = await askWithVerifiedCost({
      question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
    })
    expect(directWithCost.status).toBe('answered')
    expect(directWithCost.verifier.valid).toBe(true)
    expect(directWithCost.verifier.unverifiedNumbers).toEqual([])
    expect(directWithCost.reply).toContain('3.000 د.ك')
    expect(directWithCost.reply).toContain('2.250 د.ك')
    expect(directWithCost.reply).toContain('0.900 د.ك')
    expect(directWithCost.reply).toContain('2.100 د.ك')
    expect(directWithCost.reply).toContain('90.000 د.ك')
    expect(directWithCost.reply).not.toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)

    const bodyWithoutFooter = directWithCost.reply.split('\n• المصدر:')[0] ?? ''
    expect(
      verifyFeryalReplyNumbers(bodyWithoutFooter, directWithCost.toolNumbers, {
        allowedDateStrings: ['2026-10-22', '2026-11-20', '22/10/2026', '20/11/2026'],
        allowedEntityNames: ['[RIC90051] Chicken Noodles'],
      }).valid,
    ).toBe(true)
    expect(
      guardAnswerAgainstFacts(bodyWithoutFooter, directWithCost.facts, {
        allowedEntityNames: ['[RIC90051] Chicken Noodles'],
      }),
    ).toEqual({ ok: true, offending: [] })

    const suggestedFact = directWithCost.facts.find((f) => f.id === 'item_suggested_price_90051')
    const currentFact = directWithCost.facts.find((f) => f.id === 'item_current_price_90051')
    expect(suggestedFact).toMatchObject({
      id: 'item_suggested_price_90051',
      metric: 'unit_price_kwd',
      unit: 'KWD',
      value: '3',
      entityType: 'product',
      entityId: 'suggested_price_90051',
    })
    expect(currentFact).toMatchObject({
      id: 'item_current_price_90051',
      metric: 'unit_price_kwd',
      unit: 'KWD',
      value: '2.25',
      entityType: 'product',
      entityId: 'current_price_90051',
    })

    const validComparison = {
      subject_id: 'suggested_price_90051',
      relation: 'better' as const,
      object_id: 'current_price_90051',
      metric: 'unit_price_kwd',
      cited_fact_ids: ['item_suggested_price_90051', 'item_current_price_90051'],
    }
    expect(
      comparisonMatchesFacts(validComparison, directWithCost.facts, {
        activeBranchIds: ACTIVE_VENTURE_BRANCH_IDS,
      }),
    ).toBe(true)

    const validComparisonJson = JSON.stringify({ comparison: validComparison })
    const councilRes = await runFeryalCouncil(
      {
        question: 'ما السعر المقترح لصنف نودلز الدجاج؟',
        userId: 'exec-item-pricing-1',
        referenceNowMs: FIXED_NOW_MS,
      },
      {
        askOdoo: askWithVerifiedCost,
        persist: async () => undefined,
        keys: {
          anthropic: 'test-anthropic-key-0001',
          google: 'test-google-key-00000001',
          xai: 'test-xai-grok-key-000001',
        },
        models: {
          anthropic: 'claude-sonnet-4-6',
          google: 'gemini-3.1-pro-preview',
          xai: 'grok-4',
        },
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.includes('api.anthropic.com')) {
            return Response.json({
              model: 'claude-sonnet-4-6',
              content: [{ type: 'text', text: validComparisonJson }],
              usage: { input_tokens: 80, output_tokens: 35 },
            })
          }
          if (url.includes('generativelanguage.googleapis.com')) {
            return Response.json({
              modelVersion: 'gemini-3.1-pro-preview',
              candidates: [{ content: { parts: [{ text: validComparisonJson }] } }],
              usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 35 },
            })
          }
          return Response.json({
            model: 'grok-4',
            choices: [{ message: { content: validComparisonJson } }],
            usage: { prompt_tokens: 80, completion_tokens: 35 },
          })
        },
      },
    )

    expect(councilRes.status).toBe('answered')
    expect(councilRes.agreed).toHaveLength(3)
    expect(councilRes.verifier.valid).toBe(true)
    expect(councilRes.reply).toContain('3.000 د.ك')
    expect(councilRes.reply).toContain('90.000 د.ك')
  })

  it('Item 6: strips English fallback note in Arabic mode via chat/route.ts while keeping council.ts & structured-claim.ts 0-byte diff', async () => {
    const councilDiff = execFileSync('git', ['diff', 'b985f9b', '--', '**/council.ts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
    expect(councilDiff).toBe('')

    const structuredClaimDiff = execFileSync(
      'git',
      ['diff', '653dc84', '--', '**/structured-claim.ts'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      },
    )
    expect(structuredClaimDiff).toBe('')

    // Underlying COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE in council.ts remains untouched
    expect(COUNCIL_AI_EXPLANATION_UNAVAILABLE_NOTE).toContain(
      'Note: AI analytical explanation is currently unavailable',
    )

    const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')
    const prevKeys = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      xai: process.env.XAI_API_KEY,
    }
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.XAI_API_KEY

    try {
      const arQuestion = 'ما السعر المقترح لصنف نودلز الدجاج؟'
      expect(detectFeryalPromptLocale(arQuestion)).toBe('ar')

      const arRes = await chatPost(
        new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
          },
          body: JSON.stringify({
            question: arQuestion,
            period: 'month',
          }),
        }),
      )
      expect(arRes.status).toBe(200)
      const arJson = (await arRes.json()) as {
        ok: boolean
        status: string
        reply: string
        verifier: { valid: boolean; unverifiedNumbers: number[] }
      }
      expect(arJson.ok).toBe(true)
      expect(arJson.status).toBe('answered')
      expect(arJson.verifier.valid).toBe(true)
      expect(arJson.reply).toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)
      expect(arJson.reply).toContain(
        'ملاحظة: الشرح التحليلي الإضافي من النماذج غير متاح حالياً — الأرقام أعلاه موثّقة مباشرة من أودو.',
      )
      expect(arJson.reply).not.toContain('Note: AI analytical explanation is currently unavailable')
      expect(arJson.reply).not.toContain('verified directly from Odoo')

      // English prompt keeps English fallback note intact
      const enQuestion =
        'Show our top selling menu items with quantities sold and total sales in KWD from Odoo POS for China Garden'
      expect(detectFeryalPromptLocale(enQuestion)).toBe('en')

      const enRes = await chatPost(
        new NextRequest('https://aetherbi.com/api/erp/feryal/chat', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: `${EXEC_SESSION_COOKIE}=${adminToken}`,
          },
          body: JSON.stringify({
            question: enQuestion,
            period: 'month',
            brand: 'china-garden',
          }),
        }),
      )
      expect(enRes.status).toBe(200)
      const enJson = (await enRes.json()) as { ok: boolean; status: string; reply: string }
      expect(enJson.ok).toBe(true)
      expect(enJson.status).toBe('answered')
      expect(enJson.reply).toContain('Note: AI analytical explanation is currently unavailable')
    } finally {
      if (prevKeys.anthropic !== undefined) process.env.ANTHROPIC_API_KEY = prevKeys.anthropic
      if (prevKeys.gemini !== undefined) process.env.GEMINI_API_KEY = prevKeys.gemini
      if (prevKeys.xai !== undefined) process.env.XAI_API_KEY = prevKeys.xai
    }
  })
})
