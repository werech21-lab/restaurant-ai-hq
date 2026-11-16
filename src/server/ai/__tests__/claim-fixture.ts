import type { BriefFact } from '@/server/ai/brief-types'
import type { StructuredClaim } from '@/server/ai/structured-claim'

export function structuredClaim(
  facts: BriefFact[],
  options: Partial<Pick<StructuredClaim, 'action' | 'direction' | 'polarity' | 'operation'>> & {
    targetType?: StructuredClaim['target']['type']
    targetName?: string
  } = {},
): StructuredClaim {
  const first = facts[0]
  if (!first) throw new Error('structured claim needs a fact')
  return {
    action: options.action ?? 'monitor',
    target: {
      type: options.targetType ?? (first.scope === 'company' ? 'company' : 'branch'),
      name: options.targetName ?? first.scope,
    },
    metric: first.metric,
    direction: options.direction ?? 'flat',
    polarity: options.polarity ?? 'do',
    cited_fact_ids: facts.map((fact) => fact.id),
    ...(options.operation ? { operation: options.operation } : {}),
  }
}

export function claimResponse(input: {
  findings?: StructuredClaim[]
  recommendations?: StructuredClaim[]
  advisory?: Array<{ topic: string; text: string }>
}): string {
  return JSON.stringify({
    findings: (input.findings ?? []).map((claim) => ({ claim })),
    recommendations: (input.recommendations ?? []).map((claim) => ({ claim })),
    advisory: input.advisory ?? [],
  })
}

export function comparisonResponse(input: {
  subject_id: string
  relation: 'better' | 'worse' | 'best' | 'worst' | 'equal'
  object_id: string | null
  metric: string
  cited_fact_ids: string[]
}): string {
  return JSON.stringify({ comparison: input })
}
