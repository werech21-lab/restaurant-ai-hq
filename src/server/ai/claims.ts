export type ClaimAction = 'expand' | 'close' | 'raise' | 'lower' | 'hold' | 'review' | 'none'
export type ClaimDirection = 'up' | 'down' | 'flat' | 'none'

export interface NormalizedClaim {
  direction: ClaimDirection
  action: ClaimAction
  metric: string
  entity: string
}

const ACTION_RULES: ReadonlyArray<{ action: ClaimAction; pattern: RegExp }> = [
  { action: 'close', pattern: /close|shut(?:\s+down)?|إغلاق|اغلاق|أغلق|اغلق|إقفل|اقفل/iu },
  { action: 'expand', pattern: /expand|open(?:\s+a)?\s+branch|توسع|توسيع|وسّع|وسع|افتتاح|افتتح|فتح\s+فرع/iu },
  { action: 'lower', pattern: /lower(?:\s+the)?\s+price|cut(?:\s+the)?\s+price|خفض\s+السعر|تخفيض/iu },
  { action: 'raise', pattern: /raise(?:\s+the)?\s+price|increase(?:\s+the)?\s+price|رفع\s+السعر/iu },
  { action: 'hold', pattern: /\bhold\b|keep\s+open|أبق|ابق|حافظ/iu },
  { action: 'review', pattern: /\breview\b|راجع|مراجعة/iu },
]

const RISE = /(?:^|[^\p{L}\p{N}])(rose|risen|increased|increase|grew|grown|higher|gained|ارتفع|ارتفعت|ارتفاع|زاد|زادت|زيادة)(?=$|[^\p{L}\p{N}])/iu
const FALL = /(?:^|[^\p{L}\p{N}])(fell|fallen|decreased|decrease|dropped|declined|lower|انخفض|انخفضت|انخفاض|نقص|نقصت|تراجع|تراجعت|هبط|هبطت)(?=$|[^\p{L}\p{N}])/iu

const OPPOSITE_ACTIONS: ReadonlyArray<readonly [ClaimAction, ClaimAction]> = [
  ['expand', 'close'],
  ['raise', 'lower'],
]

export function claimDirection(text: string): ClaimDirection {
  const up = RISE.test(text)
  const down = FALL.test(text)
  if (up && down) return 'flat'
  if (up) return 'up'
  if (down) return 'down'
  return 'none'
}

export function claimAction(text: string): ClaimAction {
  for (const rule of ACTION_RULES) {
    if (rule.pattern.test(text)) return rule.action
  }
  return 'none'
}

export function normalizeClaim(
  text: string,
  facts: readonly { metric?: string; scope?: string }[],
): NormalizedClaim {
  const metrics = [...new Set(facts.map((fact) => fact.metric ?? '').filter((metric) => metric.length > 0))].sort()
  const entities = [...new Set(facts.map((fact) => fact.scope ?? '').filter((scope) => scope.length > 0))].sort()
  return {
    direction: claimDirection(text),
    action: claimAction(text),
    metric: metrics.join('+') || 'unspecified',
    entity: entities.join('+') || 'unspecified',
  }
}

export function claimKey(claim: NormalizedClaim): string {
  return [claim.action, claim.direction, claim.metric, claim.entity].join('|')
}

export function claimsContradict(left: NormalizedClaim, right: NormalizedClaim): boolean {
  if (left.metric !== right.metric || left.entity !== right.entity) return false
  const actions = OPPOSITE_ACTIONS.some(
    ([a, b]) => (left.action === a && right.action === b) || (left.action === b && right.action === a),
  )
  const directions =
    (left.direction === 'up' && right.direction === 'down') ||
    (left.direction === 'down' && right.direction === 'up')
  return actions || directions
}
