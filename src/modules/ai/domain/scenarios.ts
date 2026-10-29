import { scenarioOptionCopy } from '@/modules/ai/domain/messages'
import type { Finding, ScenarioOption, ScenarioOptionKey } from '@/modules/ai/domain/types'

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)
const MAX_PRICE = 1_000_000_000

export type CostLine = {
  itemId: string
  sku: string
  name: string
  onHand: number
  unitCostMinor: number
  openingUnitMinor: number
  sellingPriceMinor: number
}

export type WasteLine = { itemId: string; quantity: number; unitCostMinor: number; sellingPriceMinor: number; onHand: number }

export type CostScenarioInput = {
  lines: readonly CostLine[]
  waste: readonly WasteLine[]
  commissionMinor: number
}

function product(left: number, right: number): bigint | null {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right) || left < 0 || right < 0) return null
  const value = BigInt(left) * BigInt(right)
  return value <= MAX_SAFE ? value : null
}

function asNumber(value: bigint): number | null {
  return value >= 0n && value <= MAX_SAFE ? Number(value) : null
}

/** Three quantified options. Empty when every option is below the threshold, or when there is no item to attach the finding to. */
export function evaluateCostScenarios(input: CostScenarioInput, minImpactMinor: number): Finding[] {
  let variance = 0n
  let focus: CostLine | null = null
  let focusAmount = 0n
  for (const line of input.lines) {
    if (line.unitCostMinor <= line.openingUnitMinor || line.onHand <= 0) continue
    const amount = product(line.unitCostMinor - line.openingUnitMinor, line.onHand)
    if (amount === null) return []
    variance += amount
    if (amount > focusAmount) {
      focus = line
      focusAmount = amount
    }
  }
  let waste = 0n
  let wasteFocus: WasteLine | null = null
  let wasteFocusAmount = 0n
  for (const row of input.waste) {
    const amount = product(row.quantity, row.unitCostMinor)
    if (amount === null) return []
    waste += amount
    if (amount > wasteFocusAmount) {
      wasteFocus = row
      wasteFocusAmount = amount
    }
  }
  if (!Number.isSafeInteger(input.commissionMinor) || input.commissionMinor < 0) return []
  const adjust = waste + BigInt(input.commissionMinor)
  const best = [variance, adjust, waste].reduce((left, right) => (right > left ? right : left))
  const bestMinor = asNumber(best)
  const renegotiateMinor = asNumber(variance)
  const adjustMinor = asNumber(adjust)
  const wasteMinor = asNumber(waste)
  if (bestMinor === null || renegotiateMinor === null || adjustMinor === null || wasteMinor === null) return []
  if (bestMinor < minImpactMinor) return []

  const entity = focus ?? input.lines.find((line) => line.itemId === wasteFocus?.itemId) ?? input.lines[0] ?? null
  const entityId = entity?.itemId ?? wasteFocus?.itemId
  if (!entityId) return []
  const selling = entity?.sellingPriceMinor ?? wasteFocus?.sellingPriceMinor ?? null
  const units = entity && entity.onHand > 0 ? entity.onHand : wasteFocus && wasteFocus.onHand > 0 ? wasteFocus.onHand : 1
  let newPriceMinor: number | null = null
  if (selling !== null && adjustMinor > 0) {
    const increase = Number((BigInt(adjustMinor) + BigInt(units) - 1n) / BigInt(units))
    const next = selling + increase
    newPriceMinor = Number.isSafeInteger(next) && next <= MAX_PRICE ? next : null
  }

  const amounts = { renegotiate: renegotiateMinor, adjust_menu: adjustMinor, reduce_waste: wasteMinor }
  const keys: ScenarioOptionKey[] = ['renegotiate', 'adjust_menu', 'reduce_waste']
  const options: ScenarioOption[] = keys.map((key) => {
    const copy = scenarioOptionCopy(key, amounts[key], key === 'adjust_menu' ? newPriceMinor : null)
    return { key, impactMinor: amounts[key], newPriceMinor: key === 'adjust_menu' ? newPriceMinor : null, ...copy }
  })
  const descriptionAr = options.map((option) => `${option.titleAr}: ${option.summaryAr}`).join('\n')
  const payload: Record<string, unknown> = {}
  payload.options = options
  return [
    {
      ruleKey: 'operations.cost_scenarios',
      fingerprint: 'operations.cost_scenarios',
      insight: {
        severity: 'warning',
        category: 'finance',
        titleAr: 'ثلاثة خيارات لتحسين الهامش',
        descriptionAr,
        metricValue: bestMinor,
        metricUnit: 'fils',
        sourceEntityType: 'item',
        sourceEntityId: entityId,
      },
      proposal: {
        actionType: 'scenario_choice',
        titleAr: 'ثلاثة خيارات لتحسين الهامش',
        summaryAr: descriptionAr,
        payload,
        estimatedImpactFils: bestMinor,
      },
    },
  ]
}
