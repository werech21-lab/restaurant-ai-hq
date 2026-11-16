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

const ID_KEYS = new Set(['id', 'name', 'scope', 'code', 'metric', 'odoo_id', 'scopeLabel'])

export function collectCanonicalIds(payload: unknown): Set<string> {
  const ids = new Set<string>()
  const walk = (node: unknown, key: string | null) => {
    if (key && ID_KEYS.has(key) && (typeof node === 'string' || typeof node === 'number')) {
      const value = String(node).trim()
      if (value) ids.add(value)
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, null)
      return
    }
    if (node && typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node)) walk(child, childKey)
    }
  }
  walk(payload, null)
  return ids
}

export function factTokens(facts: readonly BriefFact[]): Set<string> {
  return collectCanonicalIds(facts)
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

/** Every displayed figure is this function. The model does not supply the number. */
export function computeClaimFigure(claim: StructuredClaim, cited: readonly BriefFact[]): ComputedFigure | null {
  const ordered = claim.cited_fact_ids.flatMap((id) => {
    const fact = cited.find((item) => item.id === id)
    return fact ? [fact] : []
  })
  if (ordered.length !== claim.cited_fact_ids.length || ordered.length === 0) return null
  if (!claim.operation) {
    if (claim.direction !== 'flat') return null
    const parsed = parseValue(ordered[0]?.value ?? '')
    if (!parsed) return null
    return { kind: 'value', value: parsed.canonical(), sign: 0 }
  }
  if (ordered.length < 2) return null
  const base = parseValue(ordered[0]?.value ?? '')
  const next = parseValue(ordered[1]?.value ?? '')
  if (!base || !next) return null
  const hundred = Decimal.parse('100')
  if (!hundred) return null
  if (claim.operation === 'delta') {
    const delta = next.sub(base)
    const sign = delta.sign()
    if (signToDirection(sign) !== claim.direction) return null
    return { kind: 'delta', value: delta.canonical(), sign }
  }
  if (claim.operation === 'ratio') {
    if (next.sign() === 0 || claim.direction !== 'flat') return null
    const ratio = base.div(next, 4)
    if (!ratio) return null
    return { kind: 'ratio', value: ratio.canonical(), sign: 0 }
  }
  if (next.sign() === 0 && claim.operation === 'share') return null
  if (base.sign() === 0 && claim.operation === 'pct_change') return null
  const ratio =
    claim.operation === 'pct_change' ? next.sub(base).div(base, 8) : base.div(next, 8)
  if (!ratio) return null
  const percent = ratio.mul(hundred).roundHalfUp(0)
  const sign = percent.sign()
  if (claim.operation === 'pct_change') {
    if (signToDirection(sign) !== claim.direction) return null
    return { kind: 'pct_change', value: percent.canonical(), sign }
  }
  if (claim.direction !== 'flat') return null
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
  const tokens = factTokens(cited)
  const nameOk = claim.target.name ? tokens.has(claim.target.name) : false
  const idOk = claim.target.odoo_id !== undefined ? tokens.has(String(claim.target.odoo_id)) : false
  if (!nameOk && !idOk) return false
  return cited.some((fact) => fact.metric === claim.metric)
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

export function comparisonMatchesFacts(comparison: StructuredComparison, payload: unknown): boolean {
  const tokens = collectCanonicalIds(payload)
  const normalized = normalizeComparison(comparison)
  if (!tokens.has(normalized.subject_id)) return false
  if (normalized.object_id && !tokens.has(normalized.object_id)) return false
  if (!tokens.has(normalized.metric)) return false
  return comparison.cited_fact_ids.every((id) => tokens.has(id))
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
