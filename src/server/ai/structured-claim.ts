import { z } from 'zod'
import type { BriefFact } from './brief-types'
import { Decimal } from './decimal'

export const CLAIM_ACTIONS = [
  'expand',
  'close',
  'reduce',
  'increase',
  'stop',
  'start',
  'hire',
  'cut',
  'monitor',
  'none',
] as const

export const TARGET_TYPES = [
  'branch',
  'product',
  'shift',
  'staff',
  'discount',
  'brand',
  'company',
  'warehouse',
] as const

export const CLAIM_DIRECTIONS = ['up', 'down', 'flat'] as const
export const CLAIM_POLARITIES = ['do', 'do_not'] as const
export const CLAIM_OPERATIONS = ['delta', 'pct_change', 'ratio', 'share'] as const
export const COMPARISON_RELATIONS = ['better', 'worse', 'best', 'worst', 'equal'] as const

const targetId = z.union([z.string().trim().min(1), z.number().int().nonnegative()])

export const structuredClaimSchema = z
  .strictObject({
    action: z.enum(CLAIM_ACTIONS),
    target: z
      .strictObject({
        type: z.enum(TARGET_TYPES),
        odoo_id: targetId.optional(),
        name: z.string().trim().min(1).optional(),
      })
      .refine((target) => target.odoo_id !== undefined || Boolean(target.name), { message: 'target_required' }),
    metric: z.string().trim().min(1),
    direction: z.enum(CLAIM_DIRECTIONS),
    polarity: z.enum(CLAIM_POLARITIES),
    cited_fact_ids: z.array(z.string().trim().min(1)).min(1),
    operation: z.enum(CLAIM_OPERATIONS).optional(),
  })

export type StructuredClaim = z.infer<typeof structuredClaimSchema>
export type ClaimOperation = (typeof CLAIM_OPERATIONS)[number]

export const comparisonSchema = z
  .strictObject({
    subject_id: z.string().trim().min(1),
    relation: z.enum(COMPARISON_RELATIONS),
    object_id: z.string().trim().min(1).nullable(),
    metric: z.string().trim().min(1),
    cited_fact_ids: z.array(z.string().trim().min(1)).min(1),
  })
  .refine((comparison) => {
    if (comparison.relation === 'best' || comparison.relation === 'worst') return true
    return Boolean(comparison.object_id)
  }, { message: 'object_required' })

export type StructuredComparison = z.infer<typeof comparisonSchema>

const ACTION_AR: Record<StructuredClaim['action'], string> = {
  expand: 'توسيع',
  close: 'إغلاق',
  reduce: 'تخفيض',
  increase: 'زيادة',
  stop: 'إيقاف',
  start: 'بدء',
  hire: 'توظيف',
  cut: 'خفض',
  monitor: 'مراقبة',
  none: 'بدون إجراء',
}

const ACTION_EN: Record<StructuredClaim['action'], string> = {
  expand: 'Expand',
  close: 'Close',
  reduce: 'Reduce',
  increase: 'Increase',
  stop: 'Stop',
  start: 'Start',
  hire: 'Hire',
  cut: 'Cut',
  monitor: 'Monitor',
  none: 'No action',
}

const DIRECTION_AR: Record<StructuredClaim['direction'], string> = {
  up: 'ارتفاع',
  down: 'هبوط',
  flat: 'ثبات',
}

const DIRECTION_EN: Record<StructuredClaim['direction'], string> = {
  up: 'up',
  down: 'down',
  flat: 'flat',
}

export function claimIdentity(claim: StructuredClaim): string {
  const target =
    claim.target.odoo_id !== undefined ? `id:${String(claim.target.odoo_id)}` : `name:${claim.target.name ?? ''}`
  return [claim.action, claim.target.type, target, claim.metric, claim.direction, claim.polarity].join('|')
}

export function sharesFact(left: readonly string[], right: readonly string[]): boolean {
  const ids = new Set(left)
  return right.some((id) => ids.has(id))
}

export function signToDirection(sign: -1 | 0 | 1): StructuredClaim['direction'] {
  if (sign > 0) return 'up'
  if (sign < 0) return 'down'
  return 'flat'
}

export interface ComputedFigure {
  kind: 'value' | ClaimOperation
  value: string
  sign: -1 | 0 | 1
}

function parseValue(raw: string): Decimal | null {
  return Decimal.parse(raw.trim())
}

/** The calendar day a fact belongs to. A missing or ranged period is not a change base. */
export function factDate(fact: BriefFact): string | null {
  if (fact.date && /^\d{4}-\d{2}-\d{2}$/.test(fact.date)) return fact.date
  const period = fact.period.trim()
  const single = /^(\d{4}-\d{2}-\d{2})$/.exec(period)
  if (single) return single[1]
  const range = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(period)
  if (range && range[1] === range[2]) return range[1]
  return null
}

export interface FactEntity {
  type: string
  name: string
  id?: string
}

/** Entity comes from the fact, not from a number that happens to match an id. */
export function entityOf(fact: BriefFact): FactEntity | null {
  if (!fact.metric || !fact.scope || !fact.unit || !factDate(fact)) return null
  if (fact.entityType) return { type: fact.entityType, name: fact.scope, id: fact.entityId }
  if (fact.metric.startsWith('hourly') || fact.metric.includes('hour')) {
    return { type: 'hour', name: fact.scope, id: fact.scope }
  }
  if (fact.metric.startsWith('product')) return { type: 'product', name: fact.scope, id: fact.entityId }
  if (fact.metric.startsWith('brand')) return { type: 'brand', name: fact.scope, id: fact.entityId ?? fact.scope }
  if (fact.scope === 'company') return { type: 'company', name: fact.scope, id: fact.entityId ?? 'company' }
  return { type: 'branch', name: fact.scope, id: fact.entityId ?? fact.scope }
}

function citedFacts(claim: StructuredClaim, cited: readonly BriefFact[]): BriefFact[] | null {
  const ordered = claim.cited_fact_ids.flatMap((id) => {
    const fact = cited.find((item) => item.id === id)
    return fact ? [fact] : []
  })
  if (ordered.length !== claim.cited_fact_ids.length || ordered.length === 0) return null
  if (ordered.some((fact) => !entityOf(fact) || !fact.metric || !fact.unit)) return null
  return ordered
}

/** Earlier day is the base. Same day, mixed unit, or mixed entity is not a change. */
function trendPair(facts: readonly BriefFact[]): [BriefFact, BriefFact] | null {
  if (facts.length !== 2) return null
  const [left, right] = facts
  if (!left || !right) return null
  if (left.metric !== right.metric || left.unit !== right.unit || left.scope !== right.scope) return null
  const leftDate = factDate(left)
  const rightDate = factDate(right)
  if (!leftDate || !rightDate || leftDate === rightDate) return null
  return leftDate < rightDate ? [left, right] : [right, left]
}

/**
 * Share and ratio pick a role. Citation order is not the role.
 * Share: the claim metric is the part, or a narrower entity over company.
 * Ratio: the claim metric is the numerator and the other fact is the denominator.
 */
function rolePair(claim: StructuredClaim, facts: readonly BriefFact[]): [BriefFact, BriefFact] | null {
  if (facts.length !== 2) return null
  const [left, right] = facts
  if (!left || !right || left.unit !== right.unit) return null
  const leftDate = factDate(left)
  const rightDate = factDate(right)
  if (!leftDate || !rightDate || leftDate !== rightDate || left.period !== right.period) return null
  if (claim.operation === 'share' && left.metric === right.metric) {
    const company = [left, right].filter((fact) => entityOf(fact)?.type === 'company')
    const part = [left, right].filter((fact) => entityOf(fact)?.type !== 'company')
    if (company.length !== 1 || part.length !== 1) return null
    return [part[0]!, company[0]!]
  }
  const numerators = [left, right].filter((fact) => fact.metric === claim.metric)
  const denominators = [left, right].filter((fact) => fact.metric !== claim.metric)
  if (numerators.length !== 1 || denominators.length !== 1) return null
  return [numerators[0]!, denominators[0]!]
}

/** Every displayed figure is this function. The model does not supply the number. */
export function computeClaimFigure(claim: StructuredClaim, cited: readonly BriefFact[]): ComputedFigure | null {
  const ordered = citedFacts(claim, cited)
  if (!ordered) return null
  if (!claim.operation) {
    if (claim.direction !== 'flat' || ordered.length === 0) return null
    const dated = ordered.flatMap((item) => {
      const parsed = parseValue(item.value)
      const date = factDate(item)
      return parsed ? [{ item, parsed, date }] : []
    })
    if (dated.length !== ordered.length) return null
    if (dated.some((entry) => !entry.date)) {
      if (dated.length !== 1) return null
      return { kind: 'value', value: dated[0]?.parsed.canonical() ?? '', sign: 0 }
    }
    const latest = dated.reduce((best, entry) => (entry.date! > best.date! ? entry : best))
    const latestValues = new Set(dated.filter((entry) => entry.date === latest.date).map((entry) => entry.parsed.canonical()))
    if (latestValues.size !== 1) return null
    return { kind: 'value', value: latest.parsed.canonical(), sign: 0 }
  }
  const hundred = Decimal.parse('100')
  if (!hundred) return null
  if (claim.operation === 'delta' || claim.operation === 'pct_change') {
    const pair = trendPair(ordered)
    if (!pair) return null
    const base = parseValue(pair[0].value)
    const next = parseValue(pair[1].value)
    if (!base || !next) return null
    if (claim.operation === 'delta') {
      const delta = next.sub(base)
      const sign = delta.sign()
      if (signToDirection(sign) !== claim.direction) return null
      return { kind: 'delta', value: delta.canonical(), sign }
    }
    if (base.sign() === 0) return null
    const ratio = next.sub(base).div(base, 8)
    if (!ratio) return null
    const percent = ratio.mul(hundred).roundHalfUp(0)
    const sign = percent.sign()
    if (signToDirection(sign) !== claim.direction) return null
    return { kind: 'pct_change', value: percent.canonical(), sign }
  }
  const roles = rolePair(claim, ordered)
  if (!roles || claim.direction !== 'flat') return null
  const base = parseValue(roles[0].value)
  const next = parseValue(roles[1].value)
  if (!base || !next || next.sign() === 0) return null
  if (claim.operation === 'ratio') {
    const ratio = base.div(next, 4)
    if (!ratio) return null
    return { kind: 'ratio', value: ratio.canonical(), sign: 0 }
  }
  const ratio = base.div(next, 8)
  if (!ratio) return null
  const percent = ratio.mul(hundred).roundHalfUp(0)
  return { kind: 'share', value: percent.canonical(), sign: 0 }
}

function figurePhrase(figure: ComputedFigure): { ar: string; en: string } {
  if (figure.kind === 'pct_change' || figure.kind === 'share') {
    const labelAr = figure.kind === 'pct_change' ? 'التغيّر' : 'الحصة'
    const labelEn = figure.kind === 'pct_change' ? 'Change' : 'Share'
    return { ar: `${labelAr} ${figure.value}%`, en: `${labelEn} ${figure.value}%` }
  }
  if (figure.kind === 'ratio') return { ar: `النسبة ${figure.value}`, en: `Ratio ${figure.value}` }
  if (figure.kind === 'delta') return { ar: `الفرق ${figure.value}`, en: `Difference ${figure.value}` }
  return { ar: `القيمة ${figure.value}`, en: `Value ${figure.value}` }
}

export function renderClaimText(claim: StructuredClaim, figure: ComputedFigure): string {
  const target = claim.target.name ?? String(claim.target.odoo_id ?? '')
  const polarityAr = claim.polarity === 'do_not' ? 'لا تنفّذ: ' : ''
  const polarityEn = claim.polarity === 'do_not' ? 'Do not: ' : ''
  const phrase = figurePhrase(figure)
  const arabic = `${polarityAr}${ACTION_AR[claim.action]} ${claim.target.type} ${target}. ${DIRECTION_AR[claim.direction]}. ${phrase.ar}.`
  const english = `${polarityEn}${ACTION_EN[claim.action]} ${claim.target.type} ${target}. ${DIRECTION_EN[claim.direction]}. ${phrase.en}.`
  return `${arabic}\n${english}`
}

export function targetMatchesFacts(claim: StructuredClaim, cited: readonly BriefFact[]): boolean {
  const described = cited.flatMap((fact) => {
    const entity = entityOf(fact)
    return entity ? [{ fact, entity }] : []
  })
  if (described.length !== cited.length || described.length === 0) return false
  const matched = described.filter(({ fact, entity }) => {
    if (entity.type !== claim.target.type) return false
    const nameOk = claim.target.name != null && claim.target.name === entity.name
    const idOk =
      claim.target.odoo_id !== undefined && entity.id !== undefined && String(entity.id) === String(claim.target.odoo_id)
    if (!nameOk && !idOk) return false
    return fact.metric === claim.metric
  })
  return matched.length > 0
}

/** 'Y worse than X' is the same comparison as 'X better than Y'. */
export function normalizeComparison(comparison: StructuredComparison): StructuredComparison {
  if (comparison.relation !== 'worse') return comparison
  return {
    ...comparison,
    subject_id: comparison.object_id ?? comparison.subject_id,
    object_id: comparison.subject_id,
    relation: 'better',
  }
}

export function comparisonKey(comparison: StructuredComparison): string {
  const normalized = normalizeComparison(comparison)
  return [normalized.subject_id, normalized.relation, normalized.object_id ?? '', normalized.metric].join('|')
}

export interface ComparableFact {
  id: string
  metric: string
  period: string
  date: string
  unit: string
  value: string
  entityType: string
  entityId: string
  entityName: string
}

function sideFact(id: string, cited: readonly ComparableFact[], metric: string): ComparableFact | null {
  const matches = cited.filter((fact) => fact.metric === metric && (fact.entityId === id || fact.entityName === id))
  return matches.length === 1 ? matches[0] ?? null : null
}

/** The relation is computed from the cited numeric facts. A name is not a fact. */
export function comparisonMatchesFacts(comparison: StructuredComparison, facts: readonly ComparableFact[]): boolean {
  const byId = new Map(facts.map((fact) => [fact.id, fact]))
  const cited: ComparableFact[] = []
  for (const id of comparison.cited_fact_ids) {
    const fact = byId.get(id)
    if (!fact || !fact.date || !fact.unit || !fact.metric || !fact.entityId || !parseValue(fact.value)) return false
    cited.push(fact)
  }
  const normalized = normalizeComparison(comparison)
  if (cited.length === 0 || cited.some((fact) => fact.metric !== normalized.metric)) return false
  const unit = cited[0]?.unit
  const period = cited[0]?.period
  if (!unit || !period || cited.some((fact) => fact.unit !== unit || fact.period !== period)) return false
  const subject = sideFact(normalized.subject_id, cited, normalized.metric)
  if (!subject) return false
  const subjectValue = parseValue(subject.value)
  if (!subjectValue) return false
  if (normalized.relation === 'best' || normalized.relation === 'worst') {
    const others = cited.filter((fact) => fact.id !== subject.id)
    return others.every((other) => {
      const value = parseValue(other.value)
      if (!value) return false
      const compared = subjectValue.compare(value)
      return normalized.relation === 'best' ? compared > 0 : compared < 0
    })
  }
  if (!normalized.object_id) return false
  const object = sideFact(normalized.object_id, cited, normalized.metric)
  if (!object || object.id === subject.id) return false
  const objectValue = parseValue(object.value)
  if (!objectValue) return false
  const compared = subjectValue.compare(objectValue)
  if (normalized.relation === 'better') return compared > 0
  if (normalized.relation === 'equal') return compared === 0
  return false
}

export function renderComparisonText(comparison: StructuredComparison): string {
  const normalized = normalizeComparison(comparison)
  const subject = normalized.subject_id
  const object = normalized.object_id ?? ''
  const metric = normalized.metric
  const arabic =
    normalized.relation === 'better'
      ? `${subject} أفضل من ${object} في ${metric}`
      : normalized.relation === 'best'
        ? `${subject} هو الأفضل في ${metric}`
        : normalized.relation === 'worst'
          ? `${subject} هو الأسوأ في ${metric}`
          : `${subject} مساوٍ لـ ${object} في ${metric}`
  const english =
    normalized.relation === 'better'
      ? `${subject} is better than ${object} on ${metric}`
      : normalized.relation === 'best'
        ? `${subject} is the best on ${metric}`
        : normalized.relation === 'worst'
          ? `${subject} is the worst on ${metric}`
          : `${subject} equals ${object} on ${metric}`
  return `${arabic}\n${english}`
}
