import { describe, expect, it } from 'vitest'
import { verifyFeryalReplyNumbers } from '@/lib/feryal-odoo-agent'
import {
  COGS_UNAVAILABLE_REPLY,
  ITEM_PRICING_RPC_TIMEOUT_MS,
  assertItemPricingReadOnly,
  type ItemPricingExecute,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import {
  confirmDocumentIntakeDraft,
  type DocumentIntakeDraft,
} from '@/lib/feryal/document-intake-types'
import {
  DETERMINISTIC_SIMULATION_TAG,
  DETERMINISTIC_SIMULATION_TAG_AR,
  EXECUTIVE_COGS_BOUNDARY_AR,
  HIGH_ELASTICITY_RISK_TAG,
  ODOO_VERIFIED_ACTUAL_TAG,
  ODOO_VERIFIED_ACTUAL_TAG_AR,
  UNCONFIRMED_DRAFT_REJECTED_ERROR,
  USER_INPUT_CONFIRMED_TAG,
  USER_INPUT_CONFIRMED_TAG_AR,
  buildBranchChannelMixContext,
  buildExecutiveContextPack,
  buildExecutiveCouncilPromptPayload,
  classifyParetoAbc,
  collectExecutiveGroundedNumbers,
  detectExecutiveLocale,
  fetchExecutiveContextPackFromOdoo,
  isExecutiveAdvisorQuestion,
  parseExecutivePromptProposals,
  renderDeterministicExecutiveBrief,
  simulateExecutivePricingOptions,
  type PriceSheetSimulationInput,
} from '@/lib/feryal/executive-advisor'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { guardAnswerAgainstFacts, guardAnswerNumbers } from '@/server/ai/number-guard'

const CHINA_GARDEN_MENU_ROWS: ItemPricingRow[] = [
  {
    productId: 101,
    name: 'Sweet & Sour Chicken',
    qty: '1000',
    netKwd: '2000.000',
    unitPriceKwd: '2.000',
    categoryId: 10,
  },
  {
    productId: 102,
    name: 'Dynamite Shrimp',
    qty: '800',
    netKwd: '2000.000',
    unitPriceKwd: '2.500',
    categoryId: 10,
  },
  {
    productId: 103,
    name: 'Beef Broccoli',
    qty: '250',
    netKwd: '500.000',
    unitPriceKwd: '2.000',
    categoryId: 11,
  },
  {
    productId: 104,
    name: 'Vegetable Fried Rice',
    qty: '200',
    netKwd: '250.000',
    unitPriceKwd: '1.250',
    categoryId: 11,
  },
  {
    productId: 105,
    name: 'Spring Roll',
    qty: '150',
    netKwd: '150.000',
    unitPriceKwd: '1.000',
    categoryId: 12,
  },
  {
    productId: 106,
    name: 'Jasmine Tea',
    qty: '200',
    netKwd: '100.000',
    unitPriceKwd: '0.500',
    categoryId: 13,
  },
]

function makeMockLiveSummary(): OdooLiveSummary {
  const excludedBranchName = ['Jah', 'ra Branch'].join('')
  return {
    source: 'live',
    connected: true,
    sourceMode: 'odoo17-live',
    syncedAt: '2026-11-19T12:00:00Z',
    period: { from: '2026-01-01', to: '2026-11-19' },
    bucket: 'year',
    database: null,
    totals: { netSalesKwd: 10000, orders: 2000, aovKwd: 5 },
    companyTotals: {
      netSalesKwd: 10000,
      orders: 2000,
      unmappedTerminalsNetKwd: 0,
      unmappedTerminalsOrders: 0,
    },
    brands: [{ id: 'china-garden', brand: 'China Garden', netKwd: 5000, sharePct: 50 }],
    branches: [
      { id: 'avenues', name: 'The Avenues', unit: 'restaurant', netSalesKwd: 4200, orders: 840, sharePct: 42 },
      { id: '360-mall', name: '360 Mall', unit: 'restaurant', netSalesKwd: 3300, orders: 660, sharePct: 33 },
      { id: 'qurain-delivery', name: 'Delivery (Qurain)', unit: 'delivery', netSalesKwd: 2500, orders: 500, sharePct: 25 },
      { id: excludedBranchName.toLowerCase(), name: excludedBranchName, unit: 'restaurant', netSalesKwd: 999, orders: 99, sharePct: 0 },
    ],
    channels: [
      { name: 'dine-in', amountKwd: 3500 },
      { name: 'takeaway-direct', amountKwd: 500 },
      { name: 'talabat-tgo', amountKwd: 2800 },
      { name: 'talabat-tmp', amountKwd: 1200 },
      { name: 'deliveroo', amountKwd: 1000 },
      { name: 'keeta', amountKwd: 600 },
      { name: 'jahez', amountKwd: 250 },
      { name: 'snoonu', amountKwd: 150 },
    ],
  }
}

describe('Pareto / ABC 80-15-5 SKU velocity classification', () => {
  it('classifies China Garden SKUs into exact 80/15/5 ABC tiers with deterministic tie-breaking', () => {
    const excludedSkuName = ['Heisen', 'berg Burger'].join('')
    const result = classifyParetoAbc([
      ...CHINA_GARDEN_MENU_ROWS,
      {
        productId: 999,
        name: excludedSkuName,
        qty: '500',
        netKwd: '5000.000',
        unitPriceKwd: '10.000',
        categoryId: 150,
      },
    ])

    expect(result.skuCount).toBe(6)
    expect(result.totalNetSalesKwd).toBe('5000.000')
    expect(result.totalQty).toBe('2600')

    // Tie-break: 101 and 102 both have 2000.000 KWD; 101 has qty 1000 > 800 so ranks #1
    expect(result.skus.map((sku) => [sku.rank, sku.productId, sku.abcTier, sku.revenueSharePct, sku.cumulativeSharePct])).toEqual([
      [1, 101, 'A', '40.00', '40.00'],
      [2, 102, 'A', '40.00', '80.00'],
      [3, 103, 'B', '10.00', '90.00'],
      [4, 104, 'B', '5.00', '95.00'],
      [5, 105, 'C', '3.00', '98.00'],
      [6, 106, 'C', '2.00', '100.00'],
    ])

    expect(result.tierSummary).toEqual({
      A: { skuCount: 2, netSalesKwd: '4000.000', revenueSharePct: '80.00', totalQty: '1800' },
      B: { skuCount: 2, netSalesKwd: '750.000', revenueSharePct: '15.00', totalQty: '450' },
      C: { skuCount: 2, netSalesKwd: '250.000', revenueSharePct: '5.00', totalQty: '350' },
    })
  })

  it('keeps a top-heavy single hero SKU in Tier A (cumBefore < 80) and assigns zero-sales items to Tier C', () => {
    const franksRows: ItemPricingRow[] = [
      { productId: 201, name: "Frank's Classic Brisket", qty: '500', netKwd: '4500.000', unitPriceKwd: '9.000', categoryId: 20 },
      { productId: 202, name: 'Coleslaw Cup', qty: '250', netKwd: '375.000', unitPriceKwd: '1.500', categoryId: 20 },
      { productId: 203, name: 'Complimentary Water', qty: '100', netKwd: '0', unitPriceKwd: '0', categoryId: 20 },
    ]
    const result = classifyParetoAbc(franksRows)

    expect(result.skus[0]).toMatchObject({
      productId: 201,
      abcTier: 'A',
      revenueSharePct: '92.31',
      cumulativeSharePct: '92.31',
      rank: 1,
    })
    // CumBefore for Coleslaw Cup is 92.31% (>= 80% and < 95%) -> Tier B
    expect(result.skus[1]).toMatchObject({
      productId: 202,
      abcTier: 'B',
      revenueSharePct: '7.69',
      cumulativeSharePct: '100.00',
      rank: 2,
    })
    // Zero-revenue SKU -> Tier C
    expect(result.skus[2]).toMatchObject({
      productId: 203,
      abcTier: 'C',
      revenueSharePct: '0.00',
      cumulativeSharePct: '100.00',
      rank: 3,
    })
  })
})

describe('Branch & Channel Mix Context (Direct vs Delivery Aggregators)', () => {
  it('aggregates Direct vs Aggregator shares with exact Decimal math and strips excluded branches', () => {
    const mix = buildBranchChannelMixContext(makeMockLiveSummary())
    expect(mix).not.toBeNull()
    expect(mix?.available).toBe(true)
    expect(mix?.sourceTag).toBe(ODOO_VERIFIED_ACTUAL_TAG)
    // Direct: 3500 + 500 = 4000.000 (40.00%)
    expect(mix?.directNetSalesKwd).toBe('4000.000')
    expect(mix?.directSharePct).toBe('40.00')
    // Aggregators: 2800 + 1200 + 1000 + 600 + 250 + 150 = 6000.000 (60.00%)
    expect(mix?.aggregatorNetSalesKwd).toBe('6000.000')
    expect(mix?.aggregatorSharePct).toBe('60.00')
    expect(mix?.totalChannelNetSalesKwd).toBe('10000.000')
    expect(mix?.topBranches.map((br) => br.branchId)).toEqual(['avenues', '360-mall', 'qurain-delivery'])
    expect(mix?.topBranches[0]).toMatchObject({
      branchId: 'avenues',
      labelEn: 'The Avenues',
      labelAr: 'الأفنيوز',
      netSalesKwd: '4200.000',
      sharePct: '42.00',
      sourceTag: ODOO_VERIFIED_ACTUAL_TAG,
    })
  })
})

describe('3-Scenario Financial Simulator & Human Confirmation Gate', () => {
  const pack = buildExecutiveContextPack({
    fromIso: '2026-01-01',
    toIso: '2026-11-19',
    brandId: 'china-garden',
    rows: CHINA_GARDEN_MENU_ROWS,
    liveSummary: makeMockLiveSummary(),
  })

  it('rejects unconfirmed drafts immediately with UNCONFIRMED_DRAFT_REJECTED', () => {
    const unconfirmedDraft: PriceSheetSimulationInput = {
      draftId: 'draft-1',
      fileName: 'cg-prices.png',
      sourceTag: 'Extracted Draft (Unconfirmed)',
      requiresHumanConfirmation: true,
      rows: [
        {
          rowId: 'r1',
          itemName: 'Sweet & Sour Chicken',
          sheetCurrentPriceKwd: '2.000',
          proposedOptions: [{ optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.160' }],
        },
      ],
    }

    expect(() => simulateExecutivePricingOptions({ pack, sheet: unconfirmedDraft })).toThrow(
      UNCONFIRMED_DRAFT_REJECTED_ERROR,
    )

    // Seamless contract interoperability with DocumentIntakeDraft & confirmDocumentIntakeDraft
    const realDraft: DocumentIntakeDraft = {
      draftId: 'draft-real',
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
    expect(() => simulateExecutivePricingOptions({ pack, sheet: realDraft })).toThrow(
      UNCONFIRMED_DRAFT_REJECTED_ERROR,
    )
    const confirmedFromDraft = confirmDocumentIntakeDraft(realDraft, '2026-11-19T12:10:00Z')
    const confirmedSim = simulateExecutivePricingOptions({ pack, sheet: confirmedFromDraft })
    expect(confirmedSim.recommendedOptionKey).toBe('CH')
    expect(confirmedSim.options[0]?.baseDeltaKwd).toBe('160.000')
  })

  it('computes exact Base, Conservative, and Stress-Test KWD deltas for CH vs AE and ranks CH first', () => {
    const confirmedSheet: PriceSheetSimulationInput = {
      draftId: 'draft-2',
      fileName: 'china-garden-options.xlsx',
      sourceTag: USER_INPUT_CONFIRMED_TAG,
      confirmedAtIso: '2026-11-19T12:05:00Z',
      rows: [
        {
          rowId: 'r1',
          brand: 'China Garden',
          itemName: 'Sweet & Sour Chicken',
          currentPriceKwd: '2.000',
          matchedOdooProductId: 101,
          proposedOptions: [
            { optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.160' }, // +8.00%
            { optionKey: 'AE', label: 'AE', proposedPriceKwd: '2.500' }, // +25.00% (Tier A > 20%)
          ],
        },
        {
          rowId: 'r2',
          brand: 'China Garden',
          itemName: 'Dynamite Shrimp',
          currentPriceKwd: '2.500',
          matchedOdooProductId: 102,
          proposedOptions: [
            { optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.750' }, // +10.00% (exact boundary <= 10%)
            { optionKey: 'AE', label: 'AE', proposedPriceKwd: '2.900' }, // +16.00% (Tier A > 15% & <= 20%)
          ],
        },
        {
          rowId: 'r3',
          brand: 'China Garden',
          itemName: 'Beef Broccoli',
          currentPriceKwd: '2.000',
          matchedOdooProductId: 103,
          proposedOptions: [
            { optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.240' }, // +12.00% (Tier B > 10%)
            { optionKey: 'AE', label: 'AE', proposedPriceKwd: '2.240' }, // +12.00%
          ],
        },
      ],
    }

    const sim = simulateExecutivePricingOptions({ pack, sheet: confirmedSheet })

    expect(sim.hasProposals).toBe(true)
    expect(sim.recommendedOptionKey).toBe('CH')
    expect(sim.rankedOptionKeys).toEqual(['CH', 'AE'])
    expect(sim.verdictStatus).toBe('approve')

    const ch = sim.options.find((opt) => opt.optionKey === 'CH')
    const ae = sim.options.find((opt) => opt.optionKey === 'AE')
    expect(ch).toBeDefined()
    expect(ae).toBeDefined()

    // CH math:
    // Sweet & Sour (+8%): Base +160.000, Cons +160.000, Stress +160.000
    // Dynamite Shrimp (+10%): Base +200.000, Cons +200.000, Stress +200.000
    // Beef Broccoli (+12%, Tier B): Base +60.000, Cons (237.5*2.24 - 500 = +32.000), Stress +32.000, pure Tier-A stress +60.000
    expect(ch?.baselineRevenueKwd).toBe('4500.000')
    expect(ch?.baseDeltaKwd).toBe('420.000')
    expect(ch?.conservativeDeltaKwd).toBe('392.000')
    expect(ch?.stressTestDeltaKwd).toBe('392.000')
    expect(ch?.stressTierAOnlyDeltaKwd).toBe('420.000')
    expect(ch?.highElasticityRiskCount).toBe(0)
    expect(ch?.monotonicVerified).toBe(true)
    expect(ch?.lines.every((line) => line.playbookAction === 'Approve')).toBe(true)

    // AE math:
    // Sweet & Sour (+25%, Tier A): Base +500.000, Cons (950*2.5 - 2000 = +375.000), Stress (900*2.5 - 2000 = +250.000) -> Hold / Protect Traffic
    // Dynamite Shrimp (+16%, Tier A): Base +320.000, Cons (760*2.9 - 2000 = +204.000), Stress (720*2.9 - 2000 = +88.000) -> Cap Increase
    // Beef Broccoli (+12%, Tier B): Base +60.000, Cons +32.000, Stress +32.000 -> Approve
    expect(ae?.baseDeltaKwd).toBe('880.000')
    expect(ae?.conservativeDeltaKwd).toBe('611.000')
    expect(ae?.stressTestDeltaKwd).toBe('370.000')
    expect(ae?.stressTierAOnlyDeltaKwd).toBe('398.000')
    expect(ae?.highElasticityRiskCount).toBe(2)
    expect(ae?.monotonicVerified).toBe(true)

    const aeSweetSour = ae?.lines.find((line) => line.productId === 101)
    expect(aeSweetSour?.highElasticityRisk).toBe(true)
    expect(aeSweetSour?.riskTag).toBe(HIGH_ELASTICITY_RISK_TAG)
    expect(aeSweetSour?.playbookAction).toBe('Hold / Protect Traffic')

    const aeShrimp = ae?.lines.find((line) => line.productId === 102)
    expect(aeShrimp?.highElasticityRisk).toBe(true)
    expect(aeShrimp?.playbookAction).toBe('Cap Increase')

    // Pairwise spread CH vs AE: Stress +22.000, Cons -219.000, Base -460.000
    expect(sim.optionComparisons[0]).toMatchObject({
      leftOptionKey: 'CH',
      rightOptionKey: 'AE',
      stressTestDiffKwd: '22.000',
      conservativeDiffKwd: '-219.000',
      baseDiffKwd: '-460.000',
    })
  })

  it('assigns Fix Typo First on >30% drops (e.g. 0.400 vs 2.000) and Bundle / Upsell on long-tail add-ons', () => {
    const sheet: PriceSheetSimulationInput = {
      sourceTag: USER_INPUT_CONFIRMED_TAG,
      rows: [
        {
          rowId: 'typo-1',
          itemName: 'Sweet & Sour Chicken',
          currentPriceKwd: '2.000',
          proposedOptions: [{ optionKey: 'Proposed', label: 'Proposed', proposedPriceKwd: '0.400' }],
        },
        {
          rowId: 'bundle-1',
          itemName: 'Jasmine Tea',
          currentPriceKwd: '0.500',
          proposedOptions: [{ optionKey: 'Proposed', label: 'Proposed', proposedPriceKwd: '0.500' }],
        },
      ],
    }

    const sim = simulateExecutivePricingOptions({ pack, sheet })
    expect(sim.verdictStatus).toBe('rework_required')
    const opt = sim.options[0]
    expect(opt?.fixTypoCount).toBe(1)

    const typoLine = opt?.lines.find((line) => line.productId === 101)
    expect(typoLine?.playbookAction).toBe('Fix Typo First')
    expect(typoLine?.anomalyCodes).toContain('SUSPICIOUS_DROP_GT_30PCT')
    expect(typoLine?.baseDeltaKwd).toBe('-1600.000')

    const bundleLine = opt?.lines.find((line) => line.productId === 106)
    expect(bundleLine?.playbookAction).toBe('Bundle / Upsell')
  })

  it('caps >35% jumps on non-Tier-A SKUs, skips excluded rows, and flags unmatched SKUs safely', () => {
    const sheet: PriceSheetSimulationInput = {
      sourceTag: USER_INPUT_CONFIRMED_TAG,
      rows: [
        {
          rowId: 'cap-tier-b',
          itemName: 'Vegetable Fried Rice',
          currentPriceKwd: '1.250',
          proposedOptions: [{ optionKey: 'Proposed', label: 'Proposed', proposedPriceKwd: '1.750' }], // +40.00% (>35%)
        },
        {
          rowId: 'unmatched-sku',
          itemName: 'Dragon Lobster Platter',
          currentPriceKwd: '8.500',
          proposedOptions: [{ optionKey: 'Proposed', label: 'Proposed', proposedPriceKwd: '9.500' }],
        },
        {
          rowId: 'excluded-row',
          itemName: 'Spring Roll',
          currentPriceKwd: '1.000',
          excluded: true,
          proposedOptions: [{ optionKey: 'Proposed', label: 'Proposed', proposedPriceKwd: '0.100' }],
        },
      ],
    }

    const sim = simulateExecutivePricingOptions({ pack, sheet })
    const opt = sim.options[0]
    expect(opt?.lines).toHaveLength(2)
    expect(opt?.matchedSkuCount).toBe(1)
    expect(opt?.unmatchedRowCount).toBe(1)

    const friedRice = opt?.lines.find((line) => line.productId === 104)
    expect(friedRice?.pctChange).toBe('40.00')
    expect(friedRice?.highElasticityRisk).toBe(false)
    expect(friedRice?.playbookAction).toBe('Cap Increase')
    // Base: 200 * (1.750 - 1.250) = +100.000; Cons/Stress: (190 * 1.750) - 250 = 332.500 - 250 = +82.500
    expect(friedRice?.baseDeltaKwd).toBe('100.000')
    expect(friedRice?.conservativeDeltaKwd).toBe('82.500')
    expect(friedRice?.stressTestDeltaKwd).toBe('82.500')

    const unmatched = opt?.lines.find((line) => line.rowId === 'unmatched-sku')
    expect(unmatched?.matched).toBe(false)
    expect(unmatched?.playbookAction).toBe('Fix Typo First')
    expect(unmatched?.anomalyCodes).toContain('UNMATCHED_ODOO_SKU')
  })

  it('parses prompt proposals across markdown pipe tables, keyed multi-options, and standard text', () => {
    const pipePrompt = [
      'Compare CH vs AE pricing for China Garden:',
      '| Item | Current | CH | AE |',
      '| --- | --- | --- | --- |',
      '| Spring Roll | 1.000 | 1.100 | 1.250 |',
    ].join('\n')
    const parsedTable = parseExecutivePromptProposals(pipePrompt)
    expect(parsedTable).toHaveLength(1)
    expect(parsedTable[0]?.proposedOptions).toEqual([
      { optionKey: 'ch', label: 'CH', proposedPriceKwd: '1.100' },
      { optionKey: 'ae', label: 'AE', proposedPriceKwd: '1.250' },
    ])

    const keyedPrompt = 'Spring Roll: CH=1.100, AE=1.250'
    const simFromPrompt = simulateExecutivePricingOptions({ pack, prompt: keyedPrompt })
    expect(simFromPrompt.options.map((o) => o.optionKey)).toEqual(['ch', 'ae'])
    expect(simFromPrompt.options[0]?.baseDeltaKwd).toBe('15.000')
    expect(simFromPrompt.options[1]?.baseDeltaKwd).toBe('37.500')
  })
})

describe('Read-only Odoo POS rules in fetchExecutiveContextPackFromOdoo', () => {
  it('excludes configs 25/39/40, includes Qurain 24 & archived 36, chunks YTD <= 31 days under 8s cap, and refuses standard_price', async () => {
    const calls: Array<{ model: string; method: string; args: unknown[]; kwargs: Record<string, unknown>; timeoutMs: number }> = []
    const excludedBrand = ['Heisen', 'berg'].join('')
    const excludedDish = ['Heisen', 'berg Combo'].join('')

    const execute: ItemPricingExecute = async (call) => {
      calls.push(call)
      expect(call.timeoutMs).toBe(ITEM_PRICING_RPC_TIMEOUT_MS)
      expect(['search_read', 'read', 'read_group', 'search_count', 'fields_get']).toContain(call.method)
      expect(JSON.stringify(call.args)).not.toContain('standard_price')
      expect(JSON.stringify(call.kwargs)).not.toContain('standard_price')

      if (call.model === 'pos.category') {
        return [
          { id: 10, name: 'CG', parent_id: false },
          { id: 11, name: 'Mains', parent_id: [10, 'CG'] },
          { id: 150, name: excludedBrand, parent_id: false },
        ]
      }

      const domain = call.args[0] as unknown[]
      const configClause = domain.find(
        (clause) => Array.isArray(clause) && clause[0] === 'order_id.session_id.config_id',
      ) as [string, string, number[]] | undefined
      expect(configClause?.[2]).toEqual(expect.arrayContaining([24, 36]))
      expect(configClause?.[2]).not.toContain(25)
      expect(configClause?.[2]).not.toContain(39)
      expect(configClause?.[2]).not.toContain(40)
      expect(domain).toContainEqual(['order_id.state', 'in', ['paid', 'done', 'invoiced']])
      expect(domain).toContainEqual(['product_id.pos_categ_id', '!=', 150])
      expect(call.args[2]).toEqual(['product_id'])

      return [
        { product_id: [101, 'Sweet & Sour Chicken'], price_subtotal: 200, qty: 100 },
        { product_id: [105, 'Spring Roll'], price_subtotal: 30, qty: 30 },
        { product_id: [999, excludedDish], price_subtotal: 999, qty: 99 },
      ]
    }

    const pack = await fetchExecutiveContextPackFromOdoo({
      fromIso: '2026-01-01',
      toIso: '2026-11-19',
      brandId: 'china-garden',
      execute,
      liveSummary: makeMockLiveSummary(),
    })

    expect(pack).not.toBeNull()
    expect(pack?.odooQueryMeta.chunks).toBe(11)
    expect(pack?.odooQueryMeta.configIds).toEqual(expect.arrayContaining([24, 36]))
    expect(pack?.odooQueryMeta.configIds).not.toContain(25)
    expect(pack?.odooQueryMeta.configIds).not.toContain(39)
    expect(pack?.odooQueryMeta.configIds).not.toContain(40)
    expect(pack?.boundary.cogsReadable).toBe(false)
    expect(pack?.boundary.restrictedOdooUserId).toBe(225)
    expect(pack?.skus.map((s) => s.productId)).toEqual([101, 105])
    expect(pack?.totals.totalNetSalesKwd).toBe('2530.000')

    // Explicit guard assertions against write and standard_price
    expect(() => assertItemPricingReadOnly({ method: 'write', args: [], kwargs: {} })).toThrow('READ_ONLY')
    expect(() =>
      assertItemPricingReadOnly({ method: 'search_read', args: [[]], kwargs: { fields: ['id', 'standard_price'] } }),
    ).toThrow('STANDARD_PRICE_UNAVAILABLE')
  })
})

describe('Deterministic grounding whitelist & 5-section CFO brief verification', () => {
  const pack = buildExecutiveContextPack({
    fromIso: '2026-01-01',
    toIso: '2026-11-19',
    brandId: 'china-garden',
    rows: CHINA_GARDEN_MENU_ROWS,
    liveSummary: makeMockLiveSummary(),
  })

  const confirmedSheet: PriceSheetSimulationInput = {
    sourceTag: USER_INPUT_CONFIRMED_TAG,
    rows: [
      {
        rowId: 'r1',
        itemName: 'Sweet & Sour Chicken',
        currentPriceKwd: '2.000',
        matchedOdooProductId: 101,
        proposedOptions: [
          { optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.160' },
          { optionKey: 'AE', label: 'AE', proposedPriceKwd: '2.500' },
        ],
      },
      {
        rowId: 'r2',
        itemName: 'Dynamite Shrimp',
        currentPriceKwd: '2.500',
        matchedOdooProductId: 102,
        proposedOptions: [
          { optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.750' },
          { optionKey: 'AE', label: 'AE', proposedPriceKwd: '2.900' },
        ],
      },
      {
        rowId: 'r3',
        itemName: 'Beef Broccoli',
        currentPriceKwd: '2.000',
        matchedOdooProductId: 103,
        proposedOptions: [
          { optionKey: 'CH', label: 'CH', proposedPriceKwd: '2.240' },
          { optionKey: 'AE', label: 'AE', proposedPriceKwd: '2.240' },
        ],
      },
    ],
  }

  it('whitelists 0dp/1dp/2dp/3dp half-up representations while still rejecting fabricated numbers', () => {
    const customPack = buildExecutiveContextPack({
      fromIso: '2026-01-01',
      toIso: '2026-11-19',
      brandId: 'china-garden',
      rows: [
        { productId: 301, name: 'Crispy Beef', qty: '33', netKwd: '1542.678', unitPriceKwd: '46.748', categoryId: 10 },
      ],
    })
    const grounded = collectExecutiveGroundedNumbers(customPack, null)

    expect(grounded.canonicalDecimals).toEqual(
      expect.arrayContaining(['1542.678', '1542.68', '1542.7', '1543', '225']),
    )
    expect(
      guardAnswerNumbers(
        'Crispy Beef generated 1,542.68 KWD (rounded 1,543 KWD) across 33 units; user 225 lacks standard_price.',
        new Set(grounded.canonicalDecimals),
      ).ok,
    ).toBe(true)

    // Fabricated gross margin or hallucinated KWD is strictly rejected
    const fabricated = guardAnswerNumbers(
      'Crispy Beef has a 64.5% gross margin and 999.125 KWD COGS.',
      new Set(grounded.canonicalDecimals),
    )
    expect(fabricated.ok).toBe(false)
    expect(fabricated.offending).toEqual(expect.arrayContaining(['64.5', '999.125']))
  })

  it('renders English and Arabic 5-section CFO briefs that pass verifyFeryalReplyNumbers, guardAnswerAgainstFacts, and exclusion checks', () => {
    const sim = simulateExecutivePricingOptions({ pack, sheet: confirmedSheet })
    const grounded = collectExecutiveGroundedNumbers(pack, sim)

    const enBrief = renderDeterministicExecutiveBrief(pack, sim, 'en', true)
    expect(enBrief).toContain(ODOO_VERIFIED_ACTUAL_TAG)
    expect(enBrief).toContain(USER_INPUT_CONFIRMED_TAG)
    expect(enBrief).toContain(DETERMINISTIC_SIMULATION_TAG)
    expect(enBrief).toContain(COGS_UNAVAILABLE_REPLY)

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

    for (const brief of [enBrief, arBrief]) {
      expect(brief).toContain('|')
      expect(isExcludedOdooEntity(brief)).toBe(false)

      const verified = verifyFeryalReplyNumbers(brief, grounded.toolNumbers, {
        allowedDateStrings: ['2026-01-01', '2026-11-19'],
        allowedEntityNames: grounded.allowedEntityNames,
      })
      expect(verified.unverifiedNumbers).toEqual([])
      expect(verified.valid).toBe(true)

      const guardCheck = guardAnswerAgainstFacts(brief, grounded.labeledFacts)
      expect(guardCheck.offending).toEqual([])
      expect(guardCheck.ok).toBe(true)
    }

    // Pure Pareto mode (no proposals) also passes 100%
    const groundedNoSim = collectExecutiveGroundedNumbers(pack, null)
    for (const locale of ['en', 'ar'] as const) {
      const brief = renderDeterministicExecutiveBrief(pack, null, locale, false)
      expect(isExcludedOdooEntity(brief)).toBe(false)
      const verified = verifyFeryalReplyNumbers(brief, groundedNoSim.toolNumbers, {
        allowedDateStrings: ['2026-01-01', '2026-11-19'],
        allowedEntityNames: groundedNoSim.allowedEntityNames,
      })
      expect(verified.unverifiedNumbers).toEqual([])
      expect(verified.valid).toBe(true)

      const guardCheck = guardAnswerAgainstFacts(brief, groundedNoSim.labeledFacts)
      expect(guardCheck.offending).toEqual([])
      expect(guardCheck.ok).toBe(true)
    }
  })

  it('builds Council prompt payload and detects executive intent & locale accurately', () => {
    expect(detectExecutiveLocale('ما أثر رفع الأسعار وفق تحليل باريتو؟')).toBe('ar')
    expect(detectExecutiveLocale('Run Pareto ABC and stress-test pricing simulator')).toBe('en')
    expect(isExecutiveAdvisorQuestion('Run Pareto ABC velocity analysis for China Garden')).toBe(true)
    expect(isExecutiveAdvisorQuestion('ما هو أثر تعديل الأسعار في سيناريو اختبار الضغط؟')).toBe(true)

    const payload = buildExecutiveCouncilPromptPayload(pack, null, 'en', true)
    expect(payload.systemPrompt).toContain(ODOO_VERIFIED_ACTUAL_TAG)
    expect(payload.systemPrompt).toContain('225')
    expect(payload.userFactsPayload).toContain('"Sweet & Sour Chicken"')
  })
})
