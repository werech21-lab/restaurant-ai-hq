/**
 * Decision log — what the management decided on a council proposal, and what happened next.
 *
 * Outcome = the decision's scope (a branch, or the whole company) measured on equal, weekday-aligned
 * windows of completed days before and after the decision day (the decision day itself is left out).
 * For a branch, the other branches over the same windows are the control: the reported lift is the
 * branch's change minus the peers' change (difference-in-differences), so a market-wide swing is not
 * credited to the decision. This is "before vs after on the same scope" — not proof of causality.
 */
import { fromFils, r1, shiftIso } from './helpers'
import type { CompletedDaily } from './series'
import type { AdvisorId, CouncilFinding } from './types'

export type DecisionStatus = 'accepted' | 'testing' | 'rejected'
export const DECISION_STATUSES: readonly DecisionStatus[] = ['accepted', 'testing', 'rejected']
export const MIN_MEASURE_DAYS = 7
export const MAX_MEASURE_DAYS = 28

export interface DecisionRecord {
  id: string
  fingerprint: string
  advisorId: AdvisorId
  kind: string
  branchId: string | null
  titleAr: string
  titleEn: string
  status: DecisionStatus
  note: string | null
  decidedBy: string
  /** ISO timestamp of the decision. */
  decidedAt: string
  /** Kuwait calendar day of the decision. */
  decidedDay: string
  /** The finding's own weekly estimate when it had one (KWD), for "expected vs measured". */
  expectedWeeklyKwd: number | null
  outcome: DecisionOutcome | null
  outcomeAt: string | null
}

export interface DecisionOutcome {
  state: 'too-early' | 'measured' | 'no-data'
  scope: 'branch' | 'company'
  /** Completed days after the decision available so far. */
  daysAfter: number
  /** Equal window length used (a multiple of 7), or 0 when too early. */
  windowDays: number
  before: { from: string; to: string; netKwd: number } | null
  after: { from: string; to: string; netKwd: number } | null
  changePct: number | null
  /** Peers (other branches) over the same windows — branch scope only. */
  peersChangePct: number | null
  /** changePct − peersChangePct (points) for a branch; equal to changePct for the company. */
  liftPts: number | null
  /** Weekly KWD difference after vs before, net of the peers' trend for a branch. */
  weeklyLiftKwd: number | null
}

function sumRange(d: CompletedDaily, from: string, to: string, include: (branch: string) => boolean): { fils: number; days: number } {
  let fils = 0
  let days = 0
  for (const day of d.days) {
    if (day < from || day > to) continue
    days++
    for (const [b, c] of Object.entries(d.byDay[day])) if (include(b)) fils += c.netFils
  }
  return { fils, days }
}

/** Measures one decision on the payload's completed per-branch daily rows. Pure and deterministic. */
export function measureDecisionOutcome(decision: Pick<DecisionRecord, 'decidedDay' | 'branchId'>, d: CompletedDaily | null): DecisionOutcome {
  const scope: DecisionOutcome['scope'] = decision.branchId && d?.branchIds.includes(decision.branchId) ? 'branch' : 'company'
  const empty = (state: DecisionOutcome['state'], daysAfter = 0): DecisionOutcome => ({ state, scope, daysAfter, windowDays: 0, before: null, after: null, changePct: null, peersChangePct: null, liftPts: null, weeklyLiftKwd: null })
  if (!d || d.days.length === 0) return empty('no-data')
  const last = d.days[d.days.length - 1]
  const firstAfter = shiftIso(decision.decidedDay, 1)
  const daysAfter = d.days.filter((x) => x >= firstAfter && x <= last).length
  if (daysAfter < MIN_MEASURE_DAYS) return empty('too-early', daysAfter)
  const n = Math.min(MAX_MEASURE_DAYS, Math.floor(daysAfter / 7) * 7)
  const after = { from: firstAfter, to: shiftIso(firstAfter, n - 1) }
  const before = { from: shiftIso(decision.decidedDay, -n), to: shiftIso(decision.decidedDay, -1) }
  const own = (b: string) => (scope === 'branch' ? b === decision.branchId : true)
  const peers = (b: string) => scope === 'branch' && b !== decision.branchId
  const a = sumRange(d, after.from, after.to, own)
  const bf = sumRange(d, before.from, before.to, own)
  if (a.days !== n || bf.days !== n || bf.fils <= 0) return empty('no-data', daysAfter)
  const changePct = r1(((a.fils - bf.fils) / bf.fils) * 100)
  let peersChangePct: number | null = null
  let peerRatio = 1
  if (scope === 'branch') {
    const pa = sumRange(d, after.from, after.to, peers)
    const pb = sumRange(d, before.from, before.to, peers)
    if (pb.fils > 0) {
      peerRatio = pa.fils / pb.fils
      peersChangePct = r1((peerRatio - 1) * 100)
    }
  }
  const liftPts = peersChangePct === null ? changePct : r1(changePct - peersChangePct)
  // Expected "after" without the decision = before × peers' trend; the lift is the gap to it, per week.
  const counterfactual = bf.fils * peerRatio
  const weeklyLiftKwd = fromFils(Math.round(((a.fils - counterfactual) * 7) / n))
  return {
    state: 'measured',
    scope,
    daysAfter,
    windowDays: n,
    before: { ...before, netKwd: fromFils(bf.fils) },
    after: { ...after, netKwd: fromFils(a.fils) },
    changePct,
    peersChangePct,
    liftPts,
    weeklyLiftKwd,
  }
}

export interface DecisionInput {
  fingerprint: string
  status: DecisionStatus
  note?: string | null
}

/** Validates a decision request body against the finding it refers to. */
export function validateDecisionInput(raw: unknown): DecisionInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const fingerprint = typeof r.fingerprint === 'string' ? r.fingerprint.trim() : ''
  const status = typeof r.status === 'string' ? (r.status as DecisionStatus) : null
  if (!/^[a-z]+:[A-Za-z0-9:._-]{1,180}$/.test(fingerprint) || !status || !DECISION_STATUSES.includes(status)) return null
  const note = typeof r.note === 'string' ? r.note.trim().slice(0, 500) || null : null
  return { fingerprint, status, note }
}

/** Builds the record for a decision on a finding (the caller supplies who / when). */
export function decisionFromFinding(
  finding: CouncilFinding,
  input: DecisionInput,
  who: { id: string; decidedBy: string; decidedAt: string; decidedDay: string },
): DecisionRecord {
  return {
    id: who.id,
    fingerprint: finding.fingerprint,
    advisorId: finding.advisorId,
    kind: finding.kind,
    branchId: finding.entities.branchId ?? null,
    titleAr: finding.titleAr,
    titleEn: finding.titleEn,
    status: input.status,
    note: input.note ?? null,
    decidedBy: who.decidedBy,
    decidedAt: who.decidedAt,
    decidedDay: who.decidedDay,
    expectedWeeklyKwd: finding.weeklyImpact?.unit === 'KWD' ? finding.weeklyImpact.value : null,
    outcome: null,
    outcomeAt: null,
  }
}
