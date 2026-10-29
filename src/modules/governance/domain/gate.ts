export const gateActions = ['delivery.assign_driver', 'hr.attendance.hours', 'hr.expense.cash'] as const
export type GateAction = (typeof gateActions)[number]

export const ruleTypes = ['expired_driver_license', 'max_working_hours', 'cash_ceiling_kwd'] as const
export type RuleType = (typeof ruleTypes)[number]

export type ActiveRule = { ruleCode: string; ruleType: RuleType; thresholdValue: number }

export type GateFacts = {
  licenseExpiry?: string | null
  workedMinutes?: number
  cashMinor?: number
}

const ruleTypeByAction: Record<GateAction, RuleType> = {
  'delivery.assign_driver': 'expired_driver_license',
  'hr.attendance.hours': 'max_working_hours',
  'hr.expense.cash': 'cash_ceiling_kwd',
}

export function ruleTypeFor(action: GateAction): RuleType {
  return ruleTypeByAction[action]
}

export function blockMessage(ruleCode: string): string {
  return `تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [${ruleCode}]`
}

export function workedMinutes(checkIn: string, checkOut: string): number {
  const span = Date.parse(checkOut) - Date.parse(checkIn)
  if (!Number.isFinite(span) || span < 0) return 0
  return Math.floor(span / 60_000)
}

export function gateDecision(
  rules: readonly ActiveRule[],
  action: GateAction,
  facts: GateFacts,
  asOf: string,
): { blocked: false } | { blocked: true; ruleCode: string } {
  const rule = rules.find((item) => item.ruleType === ruleTypeFor(action))
  if (!rule) return { blocked: false }
  if (action === 'delivery.assign_driver') {
    if (!facts.licenseExpiry || facts.licenseExpiry >= asOf) return { blocked: false }
    return { blocked: true, ruleCode: rule.ruleCode }
  }
  if (action === 'hr.attendance.hours') {
    if (facts.workedMinutes === undefined || facts.workedMinutes <= rule.thresholdValue * 60) return { blocked: false }
    return { blocked: true, ruleCode: rule.ruleCode }
  }
  if (facts.cashMinor === undefined || facts.cashMinor <= rule.thresholdValue) return { blocked: false }
  return { blocked: true, ruleCode: rule.ruleCode }
}
