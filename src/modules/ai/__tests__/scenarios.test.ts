import { describe, expect, it } from 'vitest'
import { evaluateCostScenarios, type CostLine, type WasteLine } from '@/modules/ai/domain/scenarios'

const item: CostLine = {
  itemId: '10000000-0000-4000-8000-000000000010',
  sku: 'DEMO-FLOUR',
  name: 'Flour',
  onHand: 6,
  unitCostMinor: 1_000,
  openingUnitMinor: 800,
  sellingPriceMinor: 1_500,
}

const waste: WasteLine = { itemId: item.itemId, quantity: 2, unitCostMinor: 1_000, sellingPriceMinor: 1_500, onHand: 6 }

describe('evaluateCostScenarios', () => {
  it('returns three quantified options when cost, waste or commission is above the threshold', () => {
    const [finding] = evaluateCostScenarios({ lines: [item], waste: [waste], commissionMinor: 500 }, 1)
    expect(finding?.ruleKey).toBe('operations.cost_scenarios')
    expect(finding?.proposal?.actionType).toBe('scenario_choice')
    const options = finding?.proposal?.payload.options as Array<{ key: string; impactMinor: number }>
    expect(options.map((option) => option.key)).toEqual(['renegotiate', 'adjust_menu', 'reduce_waste'])
    expect(options.map((option) => option.impactMinor)).toEqual([1_200, 2_500, 2_000])
    expect(finding?.proposal?.estimatedImpactFils).toBe(2_500)
  })

  it('returns nothing when the gap, the waste and the commission are all below the threshold', () => {
    const quiet: CostLine = { ...item, unitCostMinor: 800, openingUnitMinor: 800, onHand: 6 }
    expect(evaluateCostScenarios({ lines: [quiet], waste: [], commissionMinor: 0 }, 1)).toEqual([])
  })

  it('ignores a cost that fell below the opening price', () => {
    const cheaper: CostLine = { ...item, unitCostMinor: 700, openingUnitMinor: 800 }
    const [finding] = evaluateCostScenarios({ lines: [cheaper], waste: [], commissionMinor: 500 }, 1)
    const options = finding?.proposal?.payload.options as Array<{ key: string; impactMinor: number }>
    expect(options.find((option) => option.key === 'renegotiate')?.impactMinor).toBe(0)
    expect(options.find((option) => option.key === 'adjust_menu')?.impactMinor).toBe(500)
  })

  it('returns nothing when a product overflows a safe integer', () => {
    const huge: CostLine = { ...item, unitCostMinor: 20_000_000, openingUnitMinor: 1, onHand: 1_000_000_000 }
    expect(evaluateCostScenarios({ lines: [huge], waste: [], commissionMinor: 0 }, 1)).toEqual([])
  })
})
