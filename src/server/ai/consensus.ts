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
import { factForGuard, parseFactSource } from './source-links'
import {
  claimIdentity,
  computeClaimFigure,
  renderClaimText,
  sharesFact,
  structuredClaimSchema,
  targetMatchesFacts,
  type StructuredClaim,
} from './structured-claim'

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

function reviewAdvisory(_text: string, _facts: readonly BriefFact[]): { ok: true } | { ok: false; code: 'GUARD' } {
  return { ok: false, code: 'GUARD' }
}

function reviewStructuredClaim(
  value: unknown,
  byId: ReadonlyMap<string, BriefFact>,
): { ok: true; item: ReviewedBriefItem } | { ok: false; code: 'GUARD' | 'CITATION' } {
  const record = asRecord(value)
  if (!record || !('claim' in record) || 'text' in record || 'solution' in record || 'factIds' in record) {
    return { ok: false, code: 'GUARD' }
  }
  const parsed = structuredClaimSchema.safeParse(record.claim)
  if (!parsed.success) return { ok: false, code: 'GUARD' }
  const claim: StructuredClaim = parsed.data
  const cited: BriefFact[] = []
  for (const id of claim.cited_fact_ids) {
    const fact = byId.get(id)
    if (!fact) return { ok: false, code: 'CITATION' }
    cited.push(fact)
  }
  if (!targetMatchesFacts(claim, cited)) return { ok: false, code: 'CITATION' }
  const targetLabel = claim.target.name ?? String(claim.target.odoo_id ?? '')
  if (isExcludedOdooEntity(targetLabel) && !isExcludedOdooEntity(JSON.stringify(cited))) {
    return { ok: false, code: 'GUARD' }
  }
  const figure = computeClaimFigure(claim, cited)
  if (!figure) return { ok: false, code: 'GUARD' }
  return {
    ok: true,
    item: {
      factIds: [...claim.cited_fact_ids],
      text: renderClaimText(claim, figure),
      stance: claim.polarity === 'do_not' ? 'dispute' : 'support',
      claimKey: claimIdentity(claim),
    },
  }
}

function readAdvisory(value: unknown, facts: readonly BriefFact[]): { items: ReviewedAdvisoryItem[]; sawGuard: boolean } {
  if (!Array.isArray(value)) return { items: [], sawGuard: false }
  let sawGuard = false
  for (const entry of value) {
    const record = asRecord(entry)
    const text = typeof record?.text === 'string' ? record.text.trim() : ''
    if (!text) continue
    const review = reviewAdvisory(text, facts)
    if (!review.ok) sawGuard = true
  }
  return { items: [], sawGuard }
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

function readClaimEntries(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
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
  const accept = (entry: unknown, bucket: ReviewedBriefItem[]) => {
    const review = reviewStructuredClaim(entry, byId)
    if (!review.ok) {
      if (review.code === 'GUARD') sawGuard = true
      else sawCitation = true
      return
    }
    bucket.push(review.item)
  }
  for (const item of readClaimEntries(body.findings)) accept(item, findings)
  for (const item of readClaimEntries(body.recommendations)) accept(item, recommendations)
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

type ClaimVote = {
  provider: BriefProvider
  modelId: string
  text: string
  claimKey: string
  factIds: string[]
  stance: 'support' | 'dispute'
}

function connectedByFacts(votes: readonly ClaimVote[]): ClaimVote[][] {
  const parent = votes.map((_, index) => index)
  const find = (index: number): number => {
    let cursor = index
    while (parent[cursor] !== cursor) cursor = parent[cursor] ?? cursor
    return cursor
  }
  const unite = (left: number, right: number) => {
    const a = find(left)
    const b = find(right)
    if (a !== b) parent[b] = a
  }
  for (let i = 0; i < votes.length; i += 1) {
    for (let j = i + 1; j < votes.length; j += 1) {
      const left = votes[i]
      const right = votes[j]
      if (left && right && sharesFact(left.factIds, right.factIds)) unite(i, j)
    }
  }
  const groups = new Map<number, ClaimVote[]>()
  votes.forEach((vote, index) => {
    const root = find(index)
    const list = groups.get(root) ?? []
    list.push(vote)
    groups.set(root, list)
  })
  return [...groups.values()]
}

function groupByKey(votes: readonly ClaimVote[]): ClaimVote[][] {
  const grouped = new Map<string, ClaimVote[]>()
  for (const vote of votes) {
    const list = grouped.get(vote.claimKey) ?? []
    list.push(vote)
    grouped.set(vote.claimKey, list)
  }
  return [...grouped.values()]
}

const OPPOSITE_ACTION: Record<string, string> = {
  expand: 'close',
  close: 'expand',
  increase: 'reduce',
  reduce: 'increase',
  start: 'stop',
  stop: 'start',
  hire: 'cut',
  cut: 'hire',
}

function claimParts(key: string): { action: string; type: string; target: string; metric: string; direction: string; polarity: string } {
  const [action = '', type = '', target = '', metric = '', direction = '', polarity = ''] = key.split('|')
  return { action, type, target, metric, direction, polarity }
}

/** Expand versus close on the same target conflicts. A monitor claim on another target does not. */
function claimsConflict(left: string, right: string): boolean {
  const a = claimParts(left)
  const b = claimParts(right)
  if (a.type !== b.type || a.target !== b.target || a.metric !== b.metric) return false
  if (a.polarity !== b.polarity) return true
  if (OPPOSITE_ACTION[a.action] === b.action) return true
  return a.action === b.action && a.direction !== b.direction
}

function agreeingVotes(votes: readonly ClaimVote[]): ClaimVote[] {
  const kept = votes.filter((vote, index) =>
    votes.some(
      (other, otherIndex) =>
        otherIndex !== index && other.provider !== vote.provider && sharesFact(vote.factIds, other.factIds),
    ),
  )
  return new Set(kept.map((vote) => vote.provider)).size >= 2 ? kept : []
}

function adoptedGroups(component: readonly ClaimVote[]): { conflicting: boolean; groups: ClaimVote[][] } {
  const keys = [...new Set(component.map((vote) => vote.claimKey))]
  const conflicting = keys.some((key, index) => keys.slice(index + 1).some((other) => claimsConflict(key, other)))
  if (conflicting) return { conflicting: true, groups: [] }
  const groups = groupByKey(component)
    .map((group) => agreeingVotes(group))
    .filter((group) => group.length >= 2 && !group[0]?.claimKey.startsWith('none|'))
  return { conflicting: false, groups }
}

function sharedFactIds(votes: readonly ClaimVote[]): string[] {
  const counts = new Map<string, number>()
  for (const vote of votes) {
    for (const id of new Set(vote.factIds)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([id]) => id)
    .sort()
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
  const findingVotes: ClaimVote[] = []
  for (const model of input.models) {
    for (const item of model.findings) {
      findingVotes.push({
        provider: model.provider,
        modelId: model.modelId,
        text: item.text,
        claimKey: item.claimKey,
        factIds: [...item.factIds],
        stance: item.stance,
      })
    }
  }

  const findings: BriefFinding[] = []
  const unadoptedFindings: BriefUnadoptedFinding[] = []
  for (const component of connectedByFacts(findingVotes)) {
    const adopted = adoptedGroups(component)
    if (adopted.conflicting || adopted.groups.length === 0) {
      for (const vote of component) {
        unadoptedFindings.push({
          factIds: vote.factIds,
          citations: citationsFor(vote.factIds, byId),
          provider: vote.provider,
          modelId: vote.modelId,
          text: vote.text,
        })
      }
      continue
    }
    const adoptedKeys = new Set(adopted.groups.map((group) => group[0]?.claimKey))
    for (const group of adopted.groups) {
      const factIds = sharedFactIds(group)
      findings.push({
        factIds,
        citations: citationsFor(factIds, byId),
        notes: group.map((vote) => ({ provider: vote.provider, modelId: vote.modelId, text: vote.text })),
      })
    }
    for (const vote of component) {
      if (adoptedKeys.has(vote.claimKey)) continue
      unadoptedFindings.push({
        factIds: vote.factIds,
        citations: citationsFor(vote.factIds, byId),
        provider: vote.provider,
        modelId: vote.modelId,
        text: vote.text,
      })
    }
  }

  const advisory: BriefAdvisory[] = []
  const proposals: BriefProposal[] = []

  const recommendationVotes: ClaimVote[] = []
  for (const model of input.models) {
    for (const item of model.recommendations) {
      recommendationVotes.push({
        provider: model.provider,
        modelId: model.modelId,
        text: item.text,
        claimKey: item.claimKey,
        factIds: [...item.factIds],
        stance: item.stance,
      })
    }
  }

  const recommendations: BriefRecommendation[] = []
  const disputed: BriefDispute[] = []
  const dropped: BriefDropped[] = []
  const asStored = (vote: ClaimVote) => ({ provider: vote.provider, modelId: vote.modelId, solution: vote.text })
  const dropVote = (vote: ClaimVote) => {
    dropped.push({
      factIds: vote.factIds,
      citations: citationsFor(vote.factIds, byId),
      provider: vote.provider,
      modelId: vote.modelId,
      solution: vote.text,
    })
  }
  for (const component of connectedByFacts(recommendationVotes)) {
    const keys = [...new Set(component.map((vote) => vote.claimKey))]
    const factIds = [...new Set(component.flatMap((vote) => vote.factIds))].sort()
    const citations = citationsFor(factIds, byId)
    const adopted = adoptedGroups(component)
    if (adopted.conflicting || (adopted.groups.length === 0 && keys.length > 1)) {
      const grouped = groupByKey(component)
      disputed.push({
        factIds,
        citations,
        support: (grouped[0] ?? []).map(asStored),
        dispute: grouped.slice(1).flat().map(asStored),
      })
      continue
    }
    if (adopted.groups.length === 0) {
      for (const vote of component) dropVote(vote)
      continue
    }
    const adoptedKeys = new Set(adopted.groups.map((group) => group[0]?.claimKey))
    for (const group of adopted.groups) {
      const shared = sharedFactIds(group)
      recommendations.push({
        factIds: shared,
        citations: citationsFor(shared, byId),
        supporters: group.map(asStored),
      })
    }
    for (const vote of component) {
      if (!adoptedKeys.has(vote.claimKey)) dropVote(vote)
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
    advisory: [],
    proposals: [],
    models,
  }
}
