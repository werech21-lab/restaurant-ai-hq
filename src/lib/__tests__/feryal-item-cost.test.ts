import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const costMockState = vi.hoisted(() => ({
  fetchLiveOdooProductCosts: vi.fn(),
}))

vi.mock('@/lib/odoo-live-connector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/odoo-live-connector')>()
  return {
    ...actual,
    fetchLiveOdooProductCosts: costMockState.fetchLiveOdooProductCosts,
    getReadOnlyOdooSnapshotStatus: () => ({
      source: 'live' as const,
      connected: true,
      sourceMode: 'odoo17-live' as const,
      noData: false,
      lastSyncAt: '2026-11-21T08:00:00.000Z',
      syncedAt: '2026-11-21T08:00:00.000Z',
      readOnly: true,
    }),
    warmLiveOdooSnapshotInBackground: () => undefined,
  }
})

import {
  askFeryalOdooAgent,
  ITEM_UNIT_COST_TIMEOUT_MS,
  withLiveUnitCost,
} from '@/lib/feryal-odoo-agent'
import {
  assertItemPricingReadOnly,
  buildSuggestedItemPricingAnswer,
  MISSING_COST_SUGGESTED_PRICE_PHRASE_AR,
  type ItemPricingRead,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'

const FIXED_NOW_MS = Date.parse('2026-11-21T08:30:00.000Z')

function singleMatchedRead(): ItemPricingRead {
  const rows: ItemPricingRow[] = [
    {
      productId: 90051,
      name: '[RIC90051] Chicken Noodles',
      qty: '100',
      netKwd: '120.000',
      unitPriceKwd: '1.200',
      categoryId: 11,
      brandId: 'china-garden',
    },
  ]
  return {
    rows,
    domain: [['order_id.state', 'in', ['paid', 'done', 'invoiced']]],
    groupby: ['product_id'],
    chunks: 1,
    configIds: [8, 17, 24, 36],
  }
}

function multiMatchedRead(): ItemPricingRead {
  const base = singleMatchedRead()
  return {
    ...base,
    rows: [
      ...base.rows,
      {
        productId: 90052,
        name: '[RIC90052] Spicy Chicken Noodles',
        qty: '60',
        netKwd: '84.000',
        unitPriceKwd: '1.400',
        categoryId: 11,
        brandId: 'china-garden',
      },
    ],
  }
}

describe('Feryal single-item live Odoo unit cost enrichment (fix/feryal-item-cost)', () => {
  beforeEach(() => {
    costMockState.fetchLiveOdooProductCosts.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('a) uses live 0.450 standard_price cost, includes suggested price + cost + Arabic source clause, sets structuredFacts.costSource = standard_price, and sends unitCostKwd into toolNumbers & facts', async () => {
    costMockState.fetchLiveOdooProductCosts.mockResolvedValueOnce({
      connected: true,
      costs: {
        90051: { unitCostKwd: 0.45, source: 'standard_price' },
      },
      requested: 1,
      lastSyncAt: '2026-11-21T08:25:00.000Z',
    })

    const res = await askFeryalOdooAgent({
      question: 'شو السعر المقترح لصنف نودلز الدجاج وليش؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => singleMatchedRead(),
      },
    })

    expect(costMockState.fetchLiveOdooProductCosts).toHaveBeenCalledTimes(1)
    expect(costMockState.fetchLiveOdooProductCosts).toHaveBeenCalledWith([90051])

    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    expect(res.verifier.unverifiedNumbers).toEqual([])

    // 0.450 / 0.30 = 1.500 KWD suggested price (> 1.200 current price)
    expect(res.reply).toContain('1.500 د.ك')
    expect(res.reply).toContain('0.450 د.ك')
    expect(res.reply).toContain('التكلفة من أودو (standard_price)')
    expect(res.reply).not.toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)

    // Both top-level structuredFacts.costSource and nested suggestedItemPricing.costSource are populated
    expect(res.structuredFacts?.costSource).toBe('standard_price')
    const suggestedMeta = res.structuredFacts?.suggestedItemPricing as
      | Record<string, unknown>
      | undefined
    expect(suggestedMeta?.costSource).toBe('standard_price')
    expect(suggestedMeta?.unitCostKwd).toBe(0.45)

    // Unit cost reaches the guard in both toolNumbers and ComparableFact[] without extra numbers
    expect(res.toolNumbers).toContain(0.45)
    expect(res.toolNumbers).toEqual([100, 120, 1.2, 0.45, 1.5, 1.05, 30])
    expect(res.facts.find((f) => f.id === 'item_unit_cost_90051')).toMatchObject({
      metric: 'item_unit_cost_kwd',
      unit: 'KWD',
      value: '0.45',
    })

    const bodyWithoutFooter = res.reply.split('\n• المصدر:')[0] ?? ''
    expect(
      guardAnswerAgainstFacts(bodyWithoutFooter, res.facts, {
        allowedEntityNames: ['[RIC90051] Chicken Noodles'],
      }),
    ).toEqual({ ok: true, offending: [] })

    // Also normalizes purchase_price -> 'purchase' and preserves 'valuation_layer'
    costMockState.fetchLiveOdooProductCosts.mockResolvedValueOnce({
      connected: true,
      costs: {
        90051: { unitCostKwd: 0.51, source: 'purchase_price' },
      },
      requested: 1,
      lastSyncAt: '2026-11-21T08:25:00.000Z',
    })
    const poEnriched = await withLiveUnitCost(singleMatchedRead().rows[0]!)
    expect(poEnriched).toEqual({
      row: expect.objectContaining({ unitCostKwd: '0.510' }),
      costSource: 'purchase',
    })
  })

  it('b) returns the exact honest missing-cost reply when costs is empty {} (never defaults to 0)', async () => {
    costMockState.fetchLiveOdooProductCosts.mockResolvedValueOnce({
      connected: true,
      costs: {},
      requested: 1,
      lastSyncAt: '2026-11-21T08:25:00.000Z',
    })

    const read = singleMatchedRead()
    const baselineMissingOut = buildSuggestedItemPricingAnswer({
      question: 'شو السعر المقترح لصنف نودلز الدجاج وليش؟',
      periodLabel: 'آخر 30 يوماً (2026-10-23 إلى 2026-11-21)',
      brandNameAr: null,
      matchedRow: read.rows[0] ?? null,
      allRows: read.rows,
    })

    const res = await askFeryalOdooAgent({
      question: 'شو السعر المقترح لصنف نودلز الدجاج وليش؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => read,
      },
    })

    expect(costMockState.fetchLiveOdooProductCosts).toHaveBeenCalledTimes(1)
    expect(res.status).toBe('answered')
    expect(res.verifier.valid).toBe(true)
    const bodyWithoutFooter = res.reply.split('\n• المصدر:')[0] ?? ''
    expect(bodyWithoutFooter).toBe(baselineMissingOut.reply)
    expect(res.reply).toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)
    expect(res.structuredFacts?.costSource).toBeUndefined()
    expect(res.toolNumbers).not.toContain(0)
  })

  it('c) returns the exact same missing-cost reply with no crash when fetchLiveOdooProductCosts throws or exceeds the hard 8s timeout', async () => {
    expect(ITEM_UNIT_COST_TIMEOUT_MS).toBe(8_000)

    // 1) Throw path
    costMockState.fetchLiveOdooProductCosts.mockRejectedValueOnce(
      new Error('Odoo XML-RPC read failed'),
    )
    const thrownRes = await askFeryalOdooAgent({
      question: 'شو السعر المقترح لصنف نودلز الدجاج وليش؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => singleMatchedRead(),
      },
    })

    // 2) Hard 8s timeout path
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW_MS)
    costMockState.fetchLiveOdooProductCosts.mockImplementationOnce(
      () => new Promise(() => {}),
    )
    const pendingTimeoutPromise = askFeryalOdooAgent({
      question: 'شو السعر المقترح لصنف نودلز الدجاج وليش؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => singleMatchedRead(),
      },
    })
    await vi.advanceTimersByTimeAsync(ITEM_UNIT_COST_TIMEOUT_MS)
    const timedOutRes = await pendingTimeoutPromise
    vi.useRealTimers()

    expect(thrownRes.status).toBe('answered')
    expect(timedOutRes.status).toBe('answered')
    expect(thrownRes.verifier.valid).toBe(true)
    expect(timedOutRes.verifier.valid).toBe(true)

    const thrownBody = thrownRes.reply.split('\n• المصدر:')[0] ?? ''
    const timedOutBody = timedOutRes.reply.split('\n• المصدر:')[0] ?? ''
    expect(thrownBody).toContain(MISSING_COST_SUGGESTED_PRICE_PHRASE_AR)
    expect(timedOutBody).toBe(thrownBody)
  })

  it('d) does NOT call fetchLiveOdooProductCosts for multi-match or no-match questions, and keeps assertItemPricingReadOnly & council.ts untouched', async () => {
    // Multi-match (2 Chicken Noodles SKUs)
    const multiRes = await askFeryalOdooAgent({
      question: 'شو السعر المقترح لصنف نودلز الدجاج وليش؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => multiMatchedRead(),
      },
    })
    expect(multiRes.status).toBe('answered')
    expect(multiRes.reply).toContain('[RIC90051] Chicken Noodles')
    expect(multiRes.reply).toContain('[RIC90052] Spicy Chicken Noodles')
    expect(costMockState.fetchLiveOdooProductCosts).not.toHaveBeenCalled()

    // No-match
    const noMatchRes = await askFeryalOdooAgent({
      question: 'شو السعر المقترح لصنف البط الكريسبي؟',
      referenceNowMs: FIXED_NOW_MS,
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async () => singleMatchedRead(),
      },
    })
    expect(noMatchRes.status).toBe('answered')
    expect(costMockState.fetchLiveOdooProductCosts).not.toHaveBeenCalled()

    // Line read path stays strictly STANDARD_PRICE_UNAVAILABLE
    expect(() =>
      assertItemPricingReadOnly({
        method: 'read',
        args: [[90051], ['standard_price']],
        kwargs: {},
      }),
    ).toThrow('STANDARD_PRICE_UNAVAILABLE')

    const councilDiff = execFileSync('git', ['diff', 'b985f9b', '--', '**/council.ts'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(councilDiff).toBe('')
  })
})
