import type { Approval, Insight, InsightDraft, ProposalDraft } from '@/modules/ai/domain/types'

/** JSON text with the keys of every object sorted, so two equal values always give the same text. jsonb reorders keys. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

/** True when a rescan found exactly what the stored insight already says. */
export function sameInsight(stored: Insight, found: InsightDraft): boolean {
  return (
    stored.severity === found.severity &&
    stored.category === found.category &&
    stored.titleAr === found.titleAr &&
    stored.descriptionAr === found.descriptionAr &&
    stored.metricValue === found.metricValue &&
    stored.metricUnit === found.metricUnit &&
    stored.sourceEntityType === found.sourceEntityType &&
    stored.sourceEntityId === found.sourceEntityId
  )
}

/** True when a rescan proposes exactly what the stored pending request already says. */
export function sameProposal(stored: Approval, found: ProposalDraft, insightId: string | null): boolean {
  return (
    stored.insightId === insightId &&
    stored.actionType === found.actionType &&
    stored.titleAr === found.titleAr &&
    stored.summaryAr === found.summaryAr &&
    stored.estimatedImpactFils === found.estimatedImpactFils &&
    stableStringify(stored.payloadJson) === stableStringify(found.payload)
  )
}
