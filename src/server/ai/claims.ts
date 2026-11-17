export type ClaimAction =
  | 'expand'
  | 'close'
  | 'raise'
  | 'lower'
  | 'hold'
  | 'review'
  | 'promote'
  | 'stop'
  | 'hire'
  | 'fire'
  | 'best'
  | 'worst'
  | 'none'
export type ClaimDirection = 'up' | 'down' | 'flat' | 'none'

export interface NormalizedClaim {
  direction: ClaimDirection
  action: ClaimAction
  negated: boolean
  metric: string
  entity: string
}

const ACTION_RULES: ReadonlyArray<{ action: ClaimAction; source: string }> = [
  {
    action: 'close',
    source: '(?:^|[^\\p{L}\\p{N}])(?:close|shut(?:\\s+down)?|إغلاق|اغلاق|أغلق|اغلق|إقفل|اقفل|تغلق)(?=$|[^\\p{L}\\p{N}])',
  },
  {
    action: 'expand',
    source: '(?:^|[^\\p{L}\\p{N}])(?:expand|open(?:\\s+a)?\\s+branch|توسع|توسيع|وسّع|وسع|افتتاح|افتتح|فتح\\s+فرع)(?=$|[^\\p{L}\\p{N}])',
  },
  {
    action: 'lower',
    source: '(?:^|[^\\p{L}\\p{N}])(?:lower(?:\\s+the)?\\s+price|cut(?:\\s+the)?\\s+price|خفض\\s+السعر|تخفيض)(?=$|[^\\p{L}\\p{N}])',
  },
  {
    action: 'raise',
    source: '(?:^|[^\\p{L}\\p{N}])(?:raise(?:\\s+the)?\\s+price|increase(?:\\s+the)?\\s+price|رفع\\s+السعر)(?=$|[^\\p{L}\\p{N}])',
  },
  {
    action: 'hold',
    source: '(?:^|[^\\p{L}\\p{N}])(?:hold|keep\\s+open|أبق|ابق|حافظ)(?=$|[^\\p{L}\\p{N}])',
  },
  { action: 'review', source: '(?:^|[^\\p{L}\\p{N}])(?:review|راجع|مراجعة)(?=$|[^\\p{L}\\p{N}])' },
  { action: 'promote', source: '(?:^|[^\\p{L}\\p{N}])(?:promote|ادعم)(?=$|[^\\p{L}\\p{N}])' },
  { action: 'stop', source: '(?:^|[^\\p{L}\\p{N}])(?:stop|halt|أوقف|اوقف)(?=$|[^\\p{L}\\p{N}])' },
  { action: 'hire', source: '(?:^|[^\\p{L}\\p{N}])(?:hire|وظف)(?=$|[^\\p{L}\\p{N}])' },
  { action: 'fire', source: '(?:^|[^\\p{L}\\p{N}])(?:fire|سرح)(?=$|[^\\p{L}\\p{N}])' },
  { action: 'best', source: '(?:^|[^\\p{L}\\p{N}])(?:best|الأفضل|الافضل|أفضل|افضل)(?=$|[^\\p{L}\\p{N}])' },
  { action: 'worst', source: '(?:^|[^\\p{L}\\p{N}])(?:worst|الأسوأ|الاسوا|أسوأ|اسوا|الاسوأ)(?=$|[^\\p{L}\\p{N}])' },
]

const RISE =
  /(?:^|[^\p{L}\p{N}])(rose|risen|increased|increase|grew|grown|growth|higher|gained|jumped|jumping|jump|surged|surge|soared|soar|climbed|climb|ارتفع|ارتفعت|ارتفاع|زاد|زادت|زيادة|نمو|نمت|قفز|قفزت|قفزة)(?=$|[^\p{L}\p{N}])/iu
const FALL =
  /(?:^|[^\p{L}\p{N}])(fell|fallen|decreased|decrease|dropped|declined|plunged|plunge|slumped|slump|tumbled|tumble|sank|sink|انخفض|انخفضت|انخفاض|نقص|نقصت|تراجع|تراجعت|هبط|هبطت|هبوط)(?=$|[^\p{L}\p{N}])/iu

const OPPOSITE_ACTIONS: ReadonlyArray<readonly [ClaimAction, ClaimAction]> = [
  ['expand', 'close'],
  ['raise', 'lower'],
  ['promote', 'stop'],
  ['hire', 'fire'],
  ['best', 'worst'],
]

function foldClaim(text: string): string {
  return text
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
}

function negationBefore(before: string): boolean {
  return /(?:^|[^\p{L}\p{N}])(?:do\s+not|don't|dont|never|not|لا|لم|لن|ليس|بدون|دون)\s*$/iu.test(before)
}

export function readClaim(text: string): { action: ClaimAction; negated: boolean } {
  const folded = foldClaim(text)
  let best: { action: ClaimAction; index: number; negated: boolean } | null = null
  for (const rule of ACTION_RULES) {
    const re = new RegExp(rule.source, 'giu')
    for (const match of folded.matchAll(re)) {
      const index = match.index ?? 0
      if (best && index >= best.index) continue
      const before = folded.slice(Math.max(0, index - 32), index)
      best = { action: rule.action, index, negated: negationBefore(before) }
    }
  }
  if (!best) return { action: 'none', negated: false }
  return { action: best.action, negated: best.negated }
}

export function claimDirection(text: string): ClaimDirection {
  const folded = foldClaim(text)
  const up = RISE.test(folded)
  const down = FALL.test(folded)
  if (up && down) return 'flat'
  if (up) return 'up'
  if (down) return 'down'
  return 'none'
}

export function directionSign(text: string): -1 | 0 | 1 {
  const direction = claimDirection(text)
  if (direction === 'up') return 1
  if (direction === 'down') return -1
  return 0
}

export function claimAction(text: string): ClaimAction {
  return readClaim(text).action
}

export function normalizeClaim(
  text: string,
  facts: readonly { metric?: string; scope?: string }[],
): NormalizedClaim {
  const read = readClaim(text)
  const metrics = [...new Set(facts.map((fact) => fact.metric ?? '').filter((metric) => metric.length > 0))].sort()
  const entities = [...new Set(facts.map((fact) => fact.scope ?? '').filter((scope) => scope.length > 0))].sort()
  return {
    direction: claimDirection(text),
    action: read.action,
    negated: read.action !== 'none' && read.negated,
    metric: metrics.join('+') || 'unspecified',
    entity: entities.join('+') || 'unspecified',
  }
}

/** A claim the matcher does not recognise is not something two models can agree on. */
export function claimRecognised(claim: NormalizedClaim): boolean {
  return claim.action !== 'none'
}

export function claimKey(claim: NormalizedClaim): string {
  const action = claim.negated ? `not-${claim.action}` : claim.action
  return [action, claim.direction, claim.metric, claim.entity].join('|')
}

export function claimsContradict(left: NormalizedClaim, right: NormalizedClaim): boolean {
  if (left.metric !== right.metric || left.entity !== right.entity) return false
  const actions = OPPOSITE_ACTIONS.some(
    ([a, b]) => (left.action === a && right.action === b) || (left.action === b && right.action === a),
  )
  const negation =
    left.action !== 'none' && left.action === right.action && left.negated !== right.negated
  const directions =
    (left.direction === 'up' && right.direction === 'down') ||
    (left.direction === 'down' && right.direction === 'up')
  return actions || negation || directions
}
