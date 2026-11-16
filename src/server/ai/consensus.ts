import { createHash } from 'node:crypto'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import type {
  BriefAdvisory,
  BriefCitation,
  BriefDispute,
  BriefDropped,
  BriefFact,
  BriefFinding,
  BriefModelState,
  BriefProposal,
  BriefProvider,
  BriefRecommendation,
  BriefUnadoptedFinding,
  ReviewedAdvisoryItem,
  ReviewedBriefItem,
  ReviewedBriefModel,
  StoredBriefReport,
} from './brief-types'
import { claimKey, claimRecognised, claimsContradict, normalizeClaim, type NormalizedClaim } from './claims'
import { extractCanonicalDecimals, guardAnswerAgainstFacts } from './number-guard'
import { factForGuard, parseFactSource } from './source-links'

const PROVIDERS: readonly BriefProvider[] = ['anthropic', 'google', 'xai']

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function factKey(factIds: readonly string[]): string {
  return [...factIds].sort().join('|')
}

function citationsFor(factIds: readonly string[], byId: ReadonlyMap<string, BriefFact>): BriefCitation[] {
  return factIds.map((id) => {
    const fact = byId.get(id)
    return {
      metric: fact?.metric ?? '',
      period: fact?.period ?? '',
      scope: fact?.scope ?? '',
      value: fact?.value ?? '',
      unit: fact?.unit ?? '',
      source: parseFactSource(fact?.source) ?? null,
    }
  })
}

function reviewText(text: string, factIds: readonly string[], byId: ReadonlyMap<string, BriefFact>): { ok: true } | { ok: false; code: 'GUARD' | 'CITATION' } {
  if (!text.trim() || factIds.length === 0) return { ok: false, code: 'CITATION' }
  const cited: BriefFact[] = []
  for (const id of factIds) {
    const fact = byId.get(id)
    if (!fact) return { ok: false, code: 'CITATION' }
    cited.push(fact)
  }
  const citedJson = JSON.stringify(cited)
  if (isExcludedOdooEntity(text) && !isExcludedOdooEntity(citedJson)) return { ok: false, code: 'GUARD' }
  const guard = guardAnswerAgainstFacts(text, cited)
  if (!guard.ok) return { ok: false, code: 'GUARD' }
  const present = new Set(extractCanonicalDecimals(text))
  for (const fact of cited) {
    if (!present.has(fact.value)) return { ok: false, code: 'CITATION' }
  }
  return { ok: true }
}

function reviewAdvisory(text: string, facts: readonly BriefFact[]): { ok: true } | { ok: false; code: 'GUARD' } {
  const factsJson = JSON.stringify(facts)
  if (isExcludedOdooEntity(text) && !isExcludedOdooEntity(factsJson)) return { ok: false, code: 'GUARD' }
  const guard = guardAnswerAgainstFacts(text, facts)
  return guard.ok ? { ok: true } : { ok: false, code: 'GUARD' }
}

function readAdvisory(value: unknown, facts: readonly BriefFact[]): { items: ReviewedAdvisoryItem[]; sawGuard: boolean } {
  if (!Array.isArray(value)) return { items: [], sawGuard: false }
  const items: ReviewedAdvisoryItem[] = []
  let sawGuard = false
  for (const entry of value) {
    const record = asRecord(entry)
    const topic = record?.topic
    const text = typeof record?.text === 'string' ? record.text.trim() : ''
    if (topic !== 'organization' && topic !== 'strategic_plan' && topic !== 'app_capability') continue
    if (!text) continue
    const review = reviewAdvisory(text, facts)
    if (!review.ok) {
      sawGuard = true
      continue
    }
    items.push({ topic, text })
  }
  return { items, sawGuard }
}

function proposalId(provider: string, text: string): string {
  return createHash('sha256').update(`${provider}\n${text}`).digest('hex').slice(0, 16)
}

export function githubIssueDraft(proposal: BriefProposal): string {
  return [
    'Title: Proposed app capability',
    '',
    'Status: proposed',
    'Kind: opinion, not an Odoo data finding',
    `Model: ${proposal.provider}/${proposal.modelId || 'unknown'}`,
    '',
    proposal.text,
    '',
    'A person reviews this draft. The council does not write code and does not deploy.',
  ].join('\n')
}

function readItems(value: unknown, field: 'text' | 'solution'): { factIds: string[]; text: string; stance: 'support' | 'dispute' }[] {
  if (!Array.isArray(value)) return []
  const items: { factIds: string[]; text: string; stance: 'support' | 'dispute' }[] = []
  for (const entry of value) {
    const record = asRecord(entry)
    if (!record || !Array.isArray(record.factIds)) continue
    const factIds = [...new Set(record.factIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
    const text = typeof record[field] === 'string' ? record[field].trim() : ''
    const stance = record.stance === 'dispute' ? 'dispute' : 'support'
    if (factIds.length === 0 || !text) continue
    items.push({ factIds, text, stance })
  }
  return items
}

export function reviewModelText(input: {
  provider: BriefProvider
  modelId: string
  text: string
  facts: readonly BriefFact[]
}): ReviewedBriefModel {
  const byId = new Map(input.facts.map((fact) => [fact.id, factForGuard(fact)]))
  const parsed = parseJsonObject(input.text)
  const body = asRecord(parsed)
  if (!body) {
    return {
      provider: input.provider,
      modelId: input.modelId,
      status: 'rejected',
      errorCode: 'BAD_RESPONSE',
      findings: [],
      recommendations: [],
      advisory: [],
    }
  }
  const findings: ReviewedBriefItem[] = []
  const recommendations: ReviewedBriefItem[] = []
  let sawGuard = false
  let sawCitation = false
  const accept = (item: { factIds: string[]; text: string; stance: 'support' | 'dispute' }, bucket: ReviewedBriefItem[]) => {
    const review = reviewText(item.text, item.factIds, byId)
    if (!review.ok) {
      if (review.code === 'GUARD') sawGuard = true
      else sawCitation = true
      return
    }
    bucket.push(item)
  }
  for (const item of readItems(body.findings, 'text')) accept(item, findings)
  for (const item of readItems(body.recommendations, 'solution')) accept(item, recommendations)
  const advisory = readAdvisory(body.advisory, input.facts)
  if (advisory.sawGuard) sawGuard = true
  if (findings.length === 0 && recommendations.length === 0 && advisory.items.length === 0) {
    return {
      provider: input.provider,
      modelId: input.modelId,
      status: 'rejected',
      errorCode: sawGuard ? 'GUARD_REJECTED' : sawCitation ? 'MISSING_CITATION' : 'EMPTY_CLAIMS',
      findings: [],
      recommendations: [],
      advisory: [],
    }
  }
  return {
    provider: input.provider,
    modelId: input.modelId,
    status: 'ran',
    errorCode: null,
    findings,
    recommendations,
    advisory: advisory.items,
  }
}

export function assembleBriefReport(input: {
  generatedAt: string
  trigger: 'schedule' | 'manual'
  periods: { yesterday: string; prior: string }
  sections: StoredBriefReport['sections']
  facts: readonly BriefFact[]
  models: readonly ReviewedBriefModel[]
}): StoredBriefReport {
  const byId = new Map(input.facts.map((fact) => [fact.id, fact]))
  const findingGroups = new Map<string, BriefFinding & { claim: NormalizedClaim }>()
  for (const model of input.models) {
    for (const item of model.findings) {
      const factIds = [...item.factIds].sort()
      const cited = factIds.flatMap((id) => {
        const fact = byId.get(id)
        return fact ? [fact] : []
      })
      const claim = normalizeClaim(item.text, cited)
      const key = `${factKey(factIds)}#${claimKey(claim)}`
      const group = findingGroups.get(key) ?? {
        factIds,
        citations: citationsFor(factIds, byId),
        notes: [],
        claim,
      }
      group.notes.push({ provider: model.provider, modelId: model.modelId, text: item.text })
      findingGroups.set(key, group)
    }
  }

  const findings: BriefFinding[] = []
  const unadoptedFindings: BriefUnadoptedFinding[] = []
  const findingsByFacts = new Map<string, Array<BriefFinding & { claim: NormalizedClaim }>>()
  for (const group of findingGroups.values()) {
    const bucket = findingsByFacts.get(factKey(group.factIds)) ?? []
    bucket.push(group)
    findingsByFacts.set(factKey(group.factIds), bucket)
  }
  for (const bucket of findingsByFacts.values()) {
    const contradicted = bucket.some((left, index) =>
      bucket.slice(index + 1).some((right) => claimsContradict(left.claim, right.claim)),
    )
    for (const group of bucket) {
      const supporters = new Set(group.notes.map((note) => note.provider))
      if (!contradicted && supporters.size >= 2 && claimRecognised(group.claim)) {
        findings.push({ factIds: group.factIds, citations: group.citations, notes: group.notes })
        continue
      }
      for (const note of group.notes) {
        unadoptedFindings.push({
          factIds: group.factIds,
          citations: group.citations,
          provider: note.provider,
          modelId: note.modelId,
          text: note.text,
        })
      }
    }
  }

  const advisory: BriefAdvisory[] = []
  const proposals: BriefProposal[] = []
  for (const model of input.models) {
    for (const item of model.advisory) {
      advisory.push({
        topic: item.topic,
        text: item.text,
        provider: model.provider,
        modelId: model.modelId,
        kind: 'opinion',
      })
      if (item.topic !== 'app_capability') continue
      proposals.push({
        id: proposalId(model.provider, item.text),
        text: item.text,
        provider: model.provider,
        modelId: model.modelId,
        status: 'proposed',
        kind: 'opinion',
      })
    }
  }

  type Side = { provider: BriefProvider; modelId: string; solution: string; claim: NormalizedClaim }
  const recommendationGroups = new Map<string, { factIds: string[]; support: Side[]; dispute: Side[] }>()
  for (const model of input.models) {
    for (const item of model.recommendations) {
      const factIds = [...item.factIds].sort()
      const cited = factIds.flatMap((id) => {
        const fact = byId.get(id)
        return fact ? [fact] : []
      })
      const claim = normalizeClaim(item.text, cited)
      const key = factKey(factIds)
      const group = recommendationGroups.get(key) ?? { factIds, support: [], dispute: [] }
      const side = item.stance === 'dispute' ? group.dispute : group.support
      if (!side.some((entry) => entry.provider === model.provider && claimKey(entry.claim) === claimKey(claim))) {
        side.push({ provider: model.provider, modelId: model.modelId, solution: item.text, claim })
      }
      recommendationGroups.set(key, group)
    }
  }

  const recommendations: BriefRecommendation[] = []
  const disputed: BriefDispute[] = []
  const dropped: BriefDropped[] = []
  const asStored = (side: Side) => ({ provider: side.provider, modelId: side.modelId, solution: side.solution })
  for (const group of recommendationGroups.values()) {
    const citations = citationsFor(group.factIds, byId)
    const explicitDispute = group.dispute.length > 0
    const supportClusters = new Map<string, Side[]>()
    for (const side of group.support) {
      const key = claimKey(side.claim)
      const cluster = supportClusters.get(key) ?? []
      cluster.push(side)
      supportClusters.set(key, cluster)
    }
    const clusters = [...supportClusters.values()]
    const contradicted =
      explicitDispute ||
      clusters.some((left, index) =>
        clusters.slice(index + 1).some((right) => right[0] && left[0] && claimsContradict(left[0].claim, right[0].claim)),
      )
    if (contradicted) {
      disputed.push({
        factIds: group.factIds,
        citations,
        support: (explicitDispute ? group.support : (clusters[0] ?? [])).map(asStored),
        dispute: (explicitDispute ? group.dispute : clusters.slice(1).flat()).map(asStored),
      })
      continue
    }
    for (const cluster of clusters) {
      const providers = new Set(cluster.map((side) => side.provider))
      if (providers.size >= 2 && cluster[0] && claimRecognised(cluster[0].claim)) {
        recommendations.push({ factIds: group.factIds, citations, supporters: cluster.map(asStored) })
        continue
      }
      for (const side of cluster) {
        dropped.push({
          factIds: group.factIds,
          citations,
          provider: side.provider,
          modelId: side.modelId,
          solution: side.solution,
        })
      }
    }
  }

  const models = PROVIDERS.map((provider) => {
    const found = input.models.find((model) => model.provider === provider)
    return (
      found ?? {
        provider,
        modelId: '',
        status: 'not_called' as const,
        errorCode: 'MISSING_MODEL',
      }
    )
  }).map((model) => ({
    provider: model.provider,
    modelId: model.modelId,
    status: model.status,
    errorCode: model.errorCode,
  }))

  return {
    generatedAt: input.generatedAt,
    trigger: input.trigger,
    configuration: 'configured',
    missingKeys: [],
    odoo: input.facts.length > 0 ? 'linked' : 'not_linked',
    periods: input.periods,
    sections: input.sections,
    findings,
    unadoptedFindings,
    recommendations,
    disputed,
    dropped,
    advisory,
    proposals,
    models,
  }
}

function asProvider(value: unknown): BriefProvider | null {
  return value === 'anthropic' || value === 'google' || value === 'xai' ? value : null
}

function asModelStatus(value: unknown): BriefModelState['status'] | null {
  if (value === 'ran' || value === 'failed' || value === 'rejected' || value === 'not_configured' || value === 'not_called') {
    return value
  }
  return null
}

function asCitations(value: unknown): BriefCitation[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const record = asRecord(entry)
    if (!record || typeof record.metric !== 'string' || typeof record.value !== 'string') return []
    return [
      {
        metric: record.metric,
        period: typeof record.period === 'string' ? record.period : '',
        scope: typeof record.scope === 'string' ? record.scope : '',
        value: record.value,
        unit: typeof record.unit === 'string' ? record.unit : '',
        source: parseFactSource(record.source),
      },
    ]
  })
}

export function parseStoredBrief(reply: string): StoredBriefReport | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(reply)
  } catch {
    return null
  }
  const body = asRecord(parsed)
  if (!body) return null
  if (body.configuration !== 'configured' && body.configuration !== 'not_configured') return null
  if (body.odoo !== 'linked' && body.odoo !== 'not_linked') return null
  if (body.trigger !== 'schedule' && body.trigger !== 'manual') return null
  if (!Array.isArray(body.models) || !Array.isArray(body.findings) || !Array.isArray(body.recommendations)) return null
  const models: BriefModelState[] = body.models.flatMap((entry) => {
    const record = asRecord(entry)
    const provider = record ? asProvider(record.provider) : null
    const status = record ? asModelStatus(record.status) : null
    if (!record || !provider || !status) return []
    return [
      {
        provider,
        modelId: typeof record.modelId === 'string' ? record.modelId : '',
        status,
        errorCode: typeof record.errorCode === 'string' ? record.errorCode : null,
      },
    ]
  })
  return {
    generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : '',
    trigger: body.trigger,
    configuration: body.configuration,
    missingKeys: Array.isArray(body.missingKeys) ? body.missingKeys.filter((item): item is string => typeof item === 'string') : [],
    odoo: body.odoo,
    periods: asRecord(body.periods) && typeof asRecord(body.periods)?.yesterday === 'string'
      ? {
          yesterday: String(asRecord(body.periods)?.yesterday),
          prior: typeof asRecord(body.periods)?.prior === 'string' ? String(asRecord(body.periods)?.prior) : '',
        }
      : null,
    sections: Array.isArray(body.sections)
      ? body.sections.flatMap((entry) => {
          const record = asRecord(entry)
          if (!record || typeof record.id !== 'string') return []
          const status = record.status === 'linked' || record.status === 'unverified' ? record.status : 'not_linked'
          return [{ id: record.id, status, noteAr: typeof record.noteAr === 'string' ? record.noteAr : '' }]
        })
      : [],
    findings: Array.isArray(body.findings)
      ? body.findings.flatMap((entry) => {
          const record = asRecord(entry)
          if (!record) return []
          const notes = Array.isArray(record.notes)
            ? record.notes.flatMap((note) => {
                const item = asRecord(note)
                const provider = item ? asProvider(item.provider) : null
                if (!item || !provider || typeof item.text !== 'string') return []
                return [{ provider, modelId: typeof item.modelId === 'string' ? item.modelId : '', text: item.text }]
              })
            : []
          return [
            {
              factIds: Array.isArray(record.factIds) ? record.factIds.filter((id): id is string => typeof id === 'string') : [],
              citations: asCitations(record.citations),
              notes,
            },
          ]
        })
      : [],
    recommendations: Array.isArray(body.recommendations)
      ? body.recommendations.flatMap((entry) => {
          const record = asRecord(entry)
          if (!record || !Array.isArray(record.supporters)) return []
          const supporters = record.supporters.flatMap((item) => {
            const note = asRecord(item)
            const provider = note ? asProvider(note.provider) : null
            if (!note || !provider || typeof note.solution !== 'string') return []
            return [{ provider, modelId: typeof note.modelId === 'string' ? note.modelId : '', solution: note.solution }]
          })
          return [
            {
              factIds: [],
              citations: asCitations(record.citations),
              supporters,
            },
          ]
        })
      : [],
    disputed: Array.isArray(body.disputed)
      ? body.disputed.flatMap((entry) => {
          const record = asRecord(entry)
          if (!record) return []
          const readSide = (value: unknown) =>
            Array.isArray(value)
              ? value.flatMap((item) => {
                  const note = asRecord(item)
                  const provider = note ? asProvider(note.provider) : null
                  if (!note || !provider || typeof note.solution !== 'string') return []
                  return [{ provider, modelId: typeof note.modelId === 'string' ? note.modelId : '', solution: note.solution }]
                })
              : []
          return [
            {
              factIds: [],
              citations: asCitations(record.citations),
              support: readSide(record.support),
              dispute: readSide(record.dispute),
            },
          ]
        })
      : [],
    dropped: Array.isArray(body.dropped)
      ? body.dropped.flatMap((entry) => {
          const record = asRecord(entry)
          const provider = record ? asProvider(record.provider) : null
          if (!record || !provider || typeof record.solution !== 'string') return []
          return [
            {
              factIds: [],
              citations: asCitations(record.citations),
              provider,
              modelId: typeof record.modelId === 'string' ? record.modelId : '',
              solution: record.solution,
            },
          ]
        })
      : [],
    unadoptedFindings: Array.isArray(body.unadoptedFindings)
      ? body.unadoptedFindings.flatMap((entry) => {
          const record = asRecord(entry)
          const provider = record ? asProvider(record.provider) : null
          if (!record || !provider || typeof record.text !== 'string') return []
          return [
            {
              factIds: [],
              citations: asCitations(record.citations),
              provider,
              modelId: typeof record.modelId === 'string' ? record.modelId : '',
              text: record.text,
            },
          ]
        })
      : [],
    advisory: Array.isArray(body.advisory)
      ? body.advisory.flatMap((entry) => {
          const record = asRecord(entry)
          const provider = record ? asProvider(record.provider) : null
          const topic = record?.topic
          if (!record || !provider || typeof record.text !== 'string' || record.kind !== 'opinion') return []
          if (topic !== 'organization' && topic !== 'strategic_plan' && topic !== 'app_capability') return []
          return [{ topic, text: record.text, provider, modelId: typeof record.modelId === 'string' ? record.modelId : '', kind: 'opinion' as const }]
        })
      : [],
    proposals: Array.isArray(body.proposals)
      ? body.proposals.flatMap((entry) => {
          const record = asRecord(entry)
          const provider = record ? asProvider(record.provider) : null
          if (!record || !provider || typeof record.text !== 'string' || typeof record.id !== 'string') return []
          if (record.status !== 'proposed' || record.kind !== 'opinion') return []
          return [
            {
              id: record.id,
              text: record.text,
              provider,
              modelId: typeof record.modelId === 'string' ? record.modelId : '',
              status: 'proposed' as const,
              kind: 'opinion' as const,
            },
          ]
        })
      : [],
    models,
  }
}
