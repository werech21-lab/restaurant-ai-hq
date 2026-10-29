import { z } from 'zod'
import type { RuleKey } from '@/modules/ai/domain/types'

// Thresholds live in `erp_automation_rules.condition_json`, one set per rule per tenant. A missing field takes the default
// below. An unknown field is rejected, so a typo cannot silently leave a rule on its default.

const MAX_MONEY_MINOR = 1_000_000_000_000

const days = (fallback: number) => z.number().int().min(1).max(3650).default(fallback)
const windowDays = z.number().int().min(1).max(365).default(30)
const cooldownDays = z.number().int().min(0).max(365).default(7)

const lowStockSchema = z.strictObject({
  restockMultiplier: z.number().int().min(1).max(20).default(2),
  targetCoverDays: z.number().int().min(1).max(365).default(30),
  windowDays,
  cooldownDays,
})

const fastDepletingSchema = z.strictObject({
  coverDays: z.number().int().min(1).max(365).default(14),
  restockMultiplier: z.number().int().min(1).max(20).default(2),
  targetCoverDays: z.number().int().min(1).max(365).default(30),
  windowDays,
  cooldownDays,
})

const paymentReminderSchema = z.strictObject({
  minOverdueDays: days(7),
  minOverdueMinor: z.number().int().min(0).max(MAX_MONEY_MINOR).default(1_000_000),
  cooldownDays,
})

const creditHoldSchema = z.strictObject({
  minOverdueDays: days(30),
  minOverdueMinor: z.number().int().min(0).max(MAX_MONEY_MINOR).default(1_000_000),
  cooldownDays,
})

const marginFloorSchema = z.strictObject({
  marginFloorBps: z.number().int().min(1).max(9000).default(2000),
  windowDays,
  cooldownDays,
})

const stalledLeadsSchema = z.strictObject({
  minProbability: z.number().int().min(1).max(100).default(60),
  staleDays: days(14),
  cooldownDays,
})

const discountIncentiveSchema = z.strictObject({
  discountBps: z.number().int().min(1).max(5000).default(500),
  minProbability: z.number().int().min(1).max(100).default(60),
  staleDays: days(14),
  cooldownDays,
})

const costScenariosSchema = z.strictObject({
  minImpactMinor: z.number().int().min(1).max(MAX_MONEY_MINOR).default(1),
  cooldownDays,
})

export type LowStockThresholds = z.output<typeof lowStockSchema>
export type FastDepletingThresholds = z.output<typeof fastDepletingSchema>
export type PaymentReminderThresholds = z.output<typeof paymentReminderSchema>
export type CreditHoldThresholds = z.output<typeof creditHoldSchema>
export type MarginFloorThresholds = z.output<typeof marginFloorSchema>
export type StalledLeadsThresholds = z.output<typeof stalledLeadsSchema>
export type DiscountIncentiveThresholds = z.output<typeof discountIncentiveSchema>
export type CostScenariosThresholds = z.output<typeof costScenariosSchema>

export type ThresholdsByRule = {
  'inventory.low_stock': LowStockThresholds
  'inventory.fast_depleting': FastDepletingThresholds
  'finance.payment_reminder': PaymentReminderThresholds
  'finance.credit_hold': CreditHoldThresholds
  'finance.margin_floor': MarginFloorThresholds
  'crm.stalled_leads': StalledLeadsThresholds
  'crm.discount_incentive': DiscountIncentiveThresholds
  'operations.cost_scenarios': CostScenariosThresholds
}

export const thresholdSchemas = {
  'inventory.low_stock': lowStockSchema,
  'inventory.fast_depleting': fastDepletingSchema,
  'finance.payment_reminder': paymentReminderSchema,
  'finance.credit_hold': creditHoldSchema,
  'finance.margin_floor': marginFloorSchema,
  'crm.stalled_leads': stalledLeadsSchema,
  'crm.discount_incentive': discountIncentiveSchema,
  'operations.cost_scenarios': costScenariosSchema,
} as const satisfies Record<RuleKey, z.ZodType>

export type ThresholdParse<K extends RuleKey> =
  | { ok: true; value: ThresholdsByRule[K] }
  | { ok: false; message: string }

/** Reads a rule's condition JSON, filling defaults. `ok: false` means the rule cannot run until the JSON is fixed. */
export function parseThresholds<K extends RuleKey>(ruleKey: K, conditionJson: unknown): ThresholdParse<K> {
  const result = thresholdSchemas[ruleKey].safeParse(conditionJson)
  if (!result.success) {
    return { ok: false, message: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') }
  }
  // The schema chosen by `ruleKey` produces exactly `ThresholdsByRule[K]`.
  return { ok: true, value: result.data as ThresholdsByRule[K] }
}
