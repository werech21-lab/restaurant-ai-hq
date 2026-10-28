import { DomainError } from '@/lib/domain-error'

/**
 * Moving weighted average, in integer fils. One rounding, half up, at the end of a receipt, a return or a variance.
 * An issue does not change the average: its value is quantity times the average already in force.
 * A zero quantity on hand makes the next receipt's unit cost the new average, so a stale catalogue cost is not blended in.
 */

export type CostSnapshot = {
  qtyBefore: number
  averageBeforeMinor: number
  qtyDelta: number
  unitCostMinor: number
  valueDeltaMinor: number
  qtyAfter: number
  averageAfterMinor: number
}

function whole(name: string, value: number, allowNegative = false): void {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new DomainError('invalid_quantity', `${name} must be a whole number of fils or units.`)
  }
}

/** Positive numerator and denominator. Half up, once. */
export function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new DomainError('invalid_quantity', 'The quantity left must be above zero.')
  const negative = numerator < 0n
  const absolute = negative ? -numerator : numerator
  const rounded = (absolute + denominator / 2n) / denominator
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new DomainError('amount_too_large', 'The average cost is above the supported range.')
  return negative ? -rounded : rounded
}

function money(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new DomainError('amount_too_large', 'The cost amount is above the supported range.')
  }
  return Number(value)
}

export function applyReceiptCost(qtyBefore: number, averageBeforeMinor: number, qtyIn: number, unitCostMinor: number): CostSnapshot {
  whole('Quantity before', qtyBefore)
  whole('Average', averageBeforeMinor)
  whole('Quantity received', qtyIn)
  whole('Unit cost', unitCostMinor)
  if (qtyIn <= 0) throw new DomainError('invalid_quantity', 'A receipt needs a quantity above zero.')
  const value = BigInt(qtyIn) * BigInt(unitCostMinor)
  const qtyAfter = qtyBefore + qtyIn
  const average = qtyBefore === 0 ? BigInt(unitCostMinor) : roundHalfUpDiv(BigInt(qtyBefore) * BigInt(averageBeforeMinor) + value, BigInt(qtyAfter))
  return {
    qtyBefore,
    averageBeforeMinor,
    qtyDelta: qtyIn,
    unitCostMinor,
    valueDeltaMinor: money(value),
    qtyAfter,
    averageAfterMinor: money(average),
  }
}

/** The average is unchanged. The value out is the average in force at this moment. */
export function applyIssueCost(qtyBefore: number, averageBeforeMinor: number, qtyOut: number): CostSnapshot {
  whole('Quantity before', qtyBefore)
  whole('Average', averageBeforeMinor)
  whole('Quantity issued', qtyOut)
  if (qtyOut <= 0 || qtyOut > qtyBefore) throw new DomainError('insufficient_stock', 'There is not enough stock to issue.')
  const value = BigInt(qtyOut) * BigInt(averageBeforeMinor)
  return {
    qtyBefore,
    averageBeforeMinor,
    qtyDelta: -qtyOut,
    unitCostMinor: averageBeforeMinor,
    valueDeltaMinor: money(-value),
    qtyAfter: qtyBefore - qtyOut,
    averageAfterMinor: averageBeforeMinor,
  }
}

/**
 * A supplier return removes quantity at the unit cost that entered (the order price), then recomputes the average.
 * It does not edit the receipt. A remaining value below zero is refused.
 */
export function applyReturnCost(qtyBefore: number, averageBeforeMinor: number, qtyOut: number, unitCostMinor: number): CostSnapshot {
  whole('Quantity before', qtyBefore)
  whole('Average', averageBeforeMinor)
  whole('Quantity returned', qtyOut)
  whole('Unit cost', unitCostMinor)
  if (qtyOut <= 0 || qtyOut > qtyBefore) throw new DomainError('insufficient_stock', 'There is not enough stock to return.')
  const value = BigInt(qtyOut) * BigInt(unitCostMinor)
  const total = BigInt(qtyBefore) * BigInt(averageBeforeMinor) - value
  if (total < 0n) throw new DomainError('cost_exceeds_stock', 'The return cost is more than the value of the stock on hand.')
  const qtyAfter = qtyBefore - qtyOut
  const average = qtyAfter === 0 ? BigInt(averageBeforeMinor) : roundHalfUpDiv(total, BigInt(qtyAfter))
  return {
    qtyBefore,
    averageBeforeMinor,
    qtyDelta: -qtyOut,
    unitCostMinor,
    valueDeltaMinor: money(-value),
    qtyAfter,
    averageAfterMinor: money(average),
  }
}

/**
 * Applies a per-unit price variance to `adjustQty` of the `qtyOnHand` still in stock. Quantity does not change.
 * `unitVarianceMinor` is signed. A pool that would go below zero is refused.
 */
export function applyVarianceCost(qtyOnHand: number, averageBeforeMinor: number, adjustQty: number, unitVarianceMinor: number): CostSnapshot {
  whole('Quantity on hand', qtyOnHand)
  whole('Average', averageBeforeMinor)
  whole('Quantity adjusted', adjustQty)
  whole('Unit variance', unitVarianceMinor, true)
  if (qtyOnHand <= 0 || adjustQty <= 0 || adjustQty > qtyOnHand) {
    throw new DomainError('invalid_quantity', 'A price variance can only be applied to stock that is still on hand.')
  }
  const value = BigInt(adjustQty) * BigInt(unitVarianceMinor)
  const total = BigInt(qtyOnHand) * BigInt(averageBeforeMinor) + value
  if (total < 0n) throw new DomainError('cost_exceeds_stock', 'The price variance would value the stock below zero.')
  const average = roundHalfUpDiv(total, BigInt(qtyOnHand))
  if (average < 0n) throw new DomainError('cost_exceeds_stock', 'The price variance would value the stock below zero.')
  return {
    qtyBefore: qtyOnHand,
    averageBeforeMinor,
    qtyDelta: 0,
    unitCostMinor: Math.abs(unitVarianceMinor),
    valueDeltaMinor: money(value),
    qtyAfter: qtyOnHand,
    averageAfterMinor: money(average),
  }
}
