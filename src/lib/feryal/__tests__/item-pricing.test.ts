import { describe, expect, it } from 'vitest'
import { askFeryalOdooAgent, verifyFeryalReplyNumbers } from '@/lib/feryal-odoo-agent'
import { honestVisualReply } from '@/lib/feryal-multimodal'
import { isItemLevelPosQuestion, resolveFeryalQuestionPeriod } from '@/lib/feryal-intent'
import {
  ITEM_PRICING_RPC_TIMEOUT_MS,
  asksMarginOrCogs,
  assertItemPricingReadOnly,
  buildItemLineDomain,
  buildItemPricingAnswer,
  categoryIdsForPosRoot,
  chunkInclusiveIsoDates,
  COGS_UNAVAILABLE_REPLY,
  COGS_UNAVAILABLE_REPLY_AR,
  itemPricingRegisterIds,
  parseProposedPrices,
  readItemPricingLines,
  revenueDeltaKwd,
  type ItemPricingExecute,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'

const MENU_QUESTION =
  'Show our top selling menu items with quantities sold and total sales in KWD from Odoo POS for China Garden'

describe('item pricing register domain', () => {
  it('includes Qurain 24 and 36 by id and leaves out 25, 39 and 40', () => {
    const company = itemPricingRegisterIds(null)
    expect(company).toEqual(expect.arrayContaining([24, 36]))
    expect(company).not.toEqual(expect.arrayContaining([25]))
    expect(company).not.toEqual(expect.arrayContaining([39]))
    expect(company).not.toEqual(expect.arrayContaining([40]))
    const salmiya = itemPricingRegisterIds('salmiya')
    expect(salmiya).toEqual([19, 20])
    expect(salmiya).not.toContain(24)
    const qurain = itemPricingRegisterIds('qurain-delivery')
    expect(qurain).toEqual(expect.arrayContaining([24, 36]))
    expect(qurain).not.toContain(25)
    expect(qurain).not.toContain(39)
    expect(qurain).not.toContain(40)
  })

  it('refuses writes and any standard_price read', () => {
    expect(() => assertItemPricingReadOnly({ method: 'write', args: [], kwargs: {} })).toThrow('READ_ONLY')
    expect(() => assertItemPricingReadOnly({ method: 'create', args: [], kwargs: {} })).toThrow('READ_ONLY')
    expect(() =>
      assertItemPricingReadOnly({ method: 'read', args: [[1], ['standard_price']], kwargs: {} }),
    ).toThrow('STANDARD_PRICE_UNAVAILABLE')
    expect(() =>
      assertItemPricingReadOnly({
        method: 'read_group',
        args: [[['order_id.state', 'in', ['paid', 'done', 'invoiced']]], ['qty:sum'], ['product_id']],
        kwargs: {},
      }),
    ).not.toThrow()
  })

  it('filters lines by the session config id and groups only by product', () => {
    const domain = buildItemLineDomain({
      fromUtc: '2025-12-31 21:00:00',
      toExclusiveUtc: '2026-11-19 21:00:00',
      configIds: [19, 24, 36],
      categoryIds: [10, 11],
    })
    const flat = JSON.stringify(domain)
    expect(flat).toContain('order_id.session_id.config_id')
    expect(flat).not.toContain('order_id.config_id')
    expect(flat).toContain('paid')
    expect(flat).not.toContain('cancel')
    expect(domain).toContainEqual(['order_id.session_id.config_id', 'in', [19, 24, 36]])
    expect(domain).toContainEqual(['product_id.pos_categ_id', 'in', [10, 11]])
    expect(domain.some((clause) => Array.isArray(clause) && clause[0] === 'config_id')).toBe(false)
  })

  it('splits a year-to-date window into chunks of at most 31 days', () => {
    const chunks = chunkInclusiveIsoDates('2026-01-01', '2026-11-19')
    expect(chunks[0]).toEqual({ from: '2026-01-01', to: '2026-01-31' })
    expect(chunks[chunks.length - 1]?.to).toBe('2026-11-19')
    expect(chunks.length).toBeGreaterThan(1)
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i]
      if (!chunk) continue
      const span =
        Math.round(
          (Date.parse(`${chunk.to}T00:00:00Z`) - Date.parse(`${chunk.from}T00:00:00Z`)) / 86_400_000,
        ) + 1
      expect(span).toBeLessThanOrEqual(31)
      if (i > 0) {
        const prev = chunks[i - 1]
        expect(prev && chunk.from > prev.to).toBe(true)
      }
    }
  })

  it('keeps a brand on the category ids under its POS root and drops Heisenberg', () => {
    const ids = categoryIdsForPosRoot(
      [
        { id: 10, name: 'CG', parentId: null },
        { id: 11, name: 'Rice', parentId: 10 },
        { id: 20, name: 'FB', parentId: null },
        { id: 99, name: 'Heisenberg', parentId: null },
        { id: 100, name: 'Special', parentId: 99 },
        { id: 150, name: 'Excluded', parentId: null },
      ],
      'CG',
    )
    expect(ids).toEqual([10, 11])
  })
})

describe('item pricing math', () => {
  const rows: ItemPricingRow[] = [
    { productId: 7, name: 'Spring Roll', qty: '100', netKwd: '100', unitPriceKwd: '1', categoryId: 10 },
    { productId: 8, name: 'Fried Rice', qty: '40', netKwd: '80', unitPriceKwd: '2', categoryId: 10 },
  ]

  it('computes qty × (proposed − current) from the Odoo quantity', () => {
    expect(revenueDeltaKwd('100', '1', '1.25')).toBe('25')
    expect(revenueDeltaKwd('40', '2', '1.5')).toBe('-20')
    expect(revenueDeltaKwd('0', '1', '2')).toBeNull()
  })

  it('labels a user price and refuses a margin when standard_price cannot be read', () => {
    const question = [
      'Show menu items for China Garden. What is the margin if we change prices?',
      'proposed price for Spring Roll: 1.250',
    ].join('\n')
    expect(parseProposedPrices(question)).toEqual([{ label: 'Spring Roll', amount: '1.25' }])
    expect(asksMarginOrCogs(question)).toBe(true)
    const built = buildItemPricingAnswer({
      question,
      periodLabel: '2026-01-01 إلى 2026-11-19',
      brandNameAr: 'تشاينا جاردن',
      rows,
    })
    expect(built.reply).toContain('Proposed / User Input')
    expect(built.reply).toContain('Odoo Verified Actuals')
    expect(built.reply).toContain('25.000')
    expect(built.reply).toContain(COGS_UNAVAILABLE_REPLY)
    expect(built.reply).not.toMatch(/هامش\s*[0-9]/)
    const verified = verifyFeryalReplyNumbers(built.reply, built.toolNumbers, {
      allowedDateStrings: ['2026-01-01', '2026-11-19'],
      allowedEntityNames: built.allowedEntityNames,
    })
    expect(verified.unverifiedNumbers).toEqual([])
    expect(verified.valid).toBe(true)

    const arabicQuestion = [
      'اعرض أصناف منيو تشاينا جاردن وما هي تكلفة الصنف وهامش الربح لو عدلنا الأسعار؟',
      'سعر مقترح لـ Spring Roll: 1.250',
    ].join('\n')
    const builtAr = buildItemPricingAnswer({
      question: arabicQuestion,
      periodLabel: '2026-01-01 إلى 2026-11-19',
      brandNameAr: 'تشاينا جاردن',
      rows,
    })
    expect(builtAr.reply).toContain('بيانات فعلية موثّقة من أودو')
    expect(builtAr.reply).toContain('مدخلات المستخدم (مؤكدة)')
    expect(builtAr.reply).toContain(COGS_UNAVAILABLE_REPLY_AR)
    expect(builtAr.reply).not.toContain('Odoo Verified Actual')
    expect(builtAr.reply).not.toContain('Proposed / User Input')
    expect(builtAr.reply).not.toContain('standard_price')
    expect(builtAr.reply).not.toContain('price_subtotal')
    expect(builtAr.reply).not.toMatch(/\bCOGS\b/)
    const verifiedAr = verifyFeryalReplyNumbers(builtAr.reply, builtAr.toolNumbers, {
      allowedDateStrings: ['2026-01-01', '2026-11-19'],
      allowedEntityNames: builtAr.allowedEntityNames,
    })
    expect(verifiedAr.unverifiedNumbers).toEqual([])
    expect(verifiedAr.valid).toBe(true)
  })
})

describe('item pricing read_group', () => {
  it('uses an 8s cap, chunks a long window, and never reads standard_price', async () => {
    const calls: Array<{ model: string; method: string; args: unknown[]; timeoutMs: number }> = []
    let lineCalls = 0
    const execute: ItemPricingExecute = async (call) => {
      calls.push({ model: call.model, method: call.method, args: call.args, timeoutMs: call.timeoutMs })
      expect(JSON.stringify(call.args)).not.toContain('standard_price')
      expect(JSON.stringify(call.kwargs)).not.toContain('standard_price')
      if (call.model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Rice', parent_id: [10, 'CG'] },
        ]
      }
      lineCalls += 1
      const domain = call.args[0] as unknown[]
      expect(call.args[2]).toEqual(['product_id'])
      expect(JSON.stringify(domain)).toContain('order_id.session_id.config_id')
      const from = String((domain[0] as unknown[])[2] ?? '')
      if (lineCalls === 1 && from.startsWith('2025-12-31')) {
        const error = new Error('timeout')
        error.name = 'TimeoutError'
        throw error
      }
      return [{ product_id: [7, 'Spring Roll'], price_subtotal: 50, qty: 40 }]
    }
    const read = await readItemPricingLines({
      fromIso: '2026-01-01',
      toIso: '2026-03-15',
      branchLocation: null,
      posRoot: 'CG',
      execute,
    })
    expect(calls.every((call) => call.timeoutMs === ITEM_PRICING_RPC_TIMEOUT_MS)).toBe(true)
    expect(read?.configIds).toEqual(expect.arrayContaining([24, 36]))
    expect(read?.groupby).toEqual(['product_id'])
    expect(read?.rows[0]).toMatchObject({ productId: 7, name: 'Spring Roll' })
    expect(Number(read?.rows[0]?.qty)).toBeGreaterThan(40)
    expect(lineCalls).toBeGreaterThan(1)
  })
})

describe('feryal item context', () => {
  it('puts per-SKU quantity and KWD into the reply and the model facts', async () => {
    let posRoot: string | null = 'missing'
    const result = await askFeryalOdooAgent({
      question: MENU_QUESTION,
      referenceNowMs: Date.parse('2026-11-19T09:00:00.000Z'),
      context: { period: 'year' },
      skipAuditLog: true,
      dataSource: {
        fetchItemPricingLines: async (input) => {
          posRoot = input.posRoot
          return {
            rows: [
              {
                productId: 7,
                name: 'Spring Roll',
                qty: '100',
                netKwd: '100',
                unitPriceKwd: '1',
                categoryId: 10,
              },
            ],
            domain: buildItemLineDomain({
              fromUtc: '2025-12-31 21:00:00',
              toExclusiveUtc: '2026-11-19 21:00:00',
              configIds: itemPricingRegisterIds(null),
              categoryIds: [10],
            }),
            groupby: ['product_id'],
            chunks: 11,
            configIds: itemPricingRegisterIds(null),
          }
        },
      },
    })
    expect(posRoot).toBe('CG')
    expect(result.status).toBe('answered')
    expect(result.verifier.valid).toBe(true)
    expect(result.reply).toContain('Spring Roll')
    expect(result.reply).toContain('100')
    expect(result.reply).toContain('Odoo Verified Actuals')
    expect(result.executedQueries[0]?.groupby).toEqual(['product_id'])
    const domain = result.executedQueries[0]?.domain ?? []
    const configClause = domain.find(
      (clause) => Array.isArray(clause) && clause[0] === 'order_id.session_id.config_id',
    ) as [string, string, number[]] | undefined
    expect(configClause?.[2]).toEqual(expect.arrayContaining([24, 36]))
    expect(configClause?.[2]).not.toContain(25)
    expect(configClause?.[2]).not.toContain(39)
    expect(configClause?.[2]).not.toContain(40)
    const net = result.facts.find((fact) => fact.metric === 'item_net_kwd' && fact.entityId === '7')
    expect(net?.value).toBe('100')
    const qty = result.facts.find((fact) => fact.metric === 'item_qty' && fact.entityId === '7')
    expect(qty?.value).toBe('100')
  })
})

describe('price table uploads', () => {
  it('asks for pasted text instead of pretending the image was an Odoo read', () => {
    const reply = honestVisualReply({
      prompt: 'What if these menu prices were applied?',
      lang: 'en',
      fileNames: ['china-garden-prices.png'],
    })
    expect(reply).toContain('Proposed / User Input')
    expect(reply).toContain('Paste the price table')
    expect(reply).not.toContain('No Odoo data available for this visual check')
    const arabic = honestVisualReply({ prompt: 'صورة طبق', lang: 'ar', fileNames: ['dish.jpg'] })
    expect(arabic).toContain('لن أخترع')
    expect(arabic).not.toContain('No Odoo data available')
  })
})

describe('item question routing', () => {
  it('treats a China Garden menu question as item lines and YTD as the year window', () => {
    expect(isItemLevelPosQuestion(MENU_QUESTION)).toBe(true)
    expect(isItemLevelPosQuestion('كم مبيعات تشاينا جاردن هذا الشهر؟')).toBe(false)
    const period = resolveFeryalQuestionPeriod('مبيعات YTD', Date.parse('2026-11-19T09:00:00.000Z'), {
      period: 'year',
      customFrom: null,
      customTo: null,
    })
    expect(period.from).toBe('2026-01-01')
    expect(period.to).toBe('2026-11-19')
  })
})
