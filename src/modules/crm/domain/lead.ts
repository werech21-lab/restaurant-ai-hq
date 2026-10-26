import { DomainError } from '@/lib/domain-error'
import { leadStages, type LeadStage, type StageSummary } from '@/modules/crm/domain/types'

export function isClosedStage(stage: LeadStage): boolean {
  return stage === 'won' || stage === 'lost'
}

/**
 * Stage moves: new, contacted, qualified and proposal move freely in any direction. A lead can be won or lost from any
 * open stage. won and lost are final. Moving to the stage a lead is already in is refused.
 */
export function assertStageMove(from: LeadStage, to: LeadStage): void {
  if (isClosedStage(from)) {
    throw new DomainError('invalid_transition', `A ${from} lead is final and cannot change stage.`)
  }
  if (from === to) {
    throw new DomainError('invalid_transition', 'The lead is already in this stage.')
  }
}

/** A closed lead is read only. Open leads can be edited. */
export function assertLeadEditable(stage: LeadStage): void {
  if (isClosedStage(stage)) {
    throw new DomainError('not_editable', `A ${stage} lead cannot be edited.`)
  }
}

/** Won is certain, lost is impossible. Between open stages the probability the user set is kept. */
export function probabilityAfterMove(to: LeadStage, current: number): number {
  if (to === 'won') return 100
  if (to === 'lost') return 0
  return current
}

/**
 * Totals per stage for the board. Every stage appears, in pipeline order, even when it has no leads.
 * Revenue is a plain sum of the expected revenue, not weighted by probability.
 */
export function summarizeStages(leads: ReadonlyArray<{ stage: LeadStage; expectedRevenueMinor: number }>): StageSummary[] {
  const totals = new Map<LeadStage, StageSummary>(leadStages.map((stage) => [stage, { stage, count: 0, expectedRevenueMinor: 0 }]))
  for (const lead of leads) {
    const entry = totals.get(lead.stage)
    if (!entry) continue
    entry.count += 1
    entry.expectedRevenueMinor += lead.expectedRevenueMinor
  }
  return Array.from(totals.values())
}
