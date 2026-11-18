/**
 * Advisor council — shared contracts.
 *
 * Each advisor studies one Odoo domain and returns an {@link AdvisorReport}. Reports are
 * deterministic: the same inputs always give the same report (no clock reads, no randomness).
 * Every number inside a report is either an Odoo value carried in `evidence`, or an
 * {@link CouncilEstimate} whose formula and inputs are spelled out. Nothing else carries numbers.
 */

export type AdvisorId = 'cfo' | 'delivery' | 'hr' | 'inventory' | 'seasons' | 'drivers' | 'menu' | 'benchmark' | 'forecast'

export type CouncilSeverity = 'high' | 'medium' | 'low'

export interface CouncilEvidence {
  /** Odoo model the value comes from (e.g. `pos.order`). */
  odooModel: string
  /** Human-readable domain filter (branch, state, window …). */
  domain: string
  period: { from: string; to: string }
  /** The Odoo value itself (KWD, orders, count, hours …). */
  value: number
  unit: 'KWD' | 'orders' | 'count' | 'hours' | 'pct' | 'KWD/order' | 'KWD/unit'
  /** Last Odoo sync of the payload this value was read from (ISO), or null when unknown. */
  syncAt: string | null
  labelAr: string
  labelEn: string
}

export interface CouncilEstimate {
  label: 'Estimate'
  value: number
  unit: 'KWD' | 'orders' | 'hours' | 'pct'
  /** Formula with named inputs, e.g. `50% × (prior-week net − last-week net)`. */
  formula: string
  inputs: Record<string, number>
}

export interface CouncilProposal {
  who: { ar: string; en: string }
  what: { ar: string; en: string }
  when: { ar: string; en: string }
  expectedImpact: CouncilEstimate | null
}

export interface CouncilFinding {
  /** Stable identity used for the 7-day repeat suppression (advisor:kind:entity). */
  fingerprint: string
  advisorId: AdvisorId
  kind: string
  /** Branch / brand / channel ids this finding is about (for cross-advisor synthesis). */
  entities: { branchId?: string; brandId?: string; channel?: string; hour?: number; weekday?: number }
  titleAr: string
  titleEn: string
  evidence: CouncilEvidence[]
  rootCause: { ar: string; en: string }
  severity: CouncilSeverity
  /** 0..1 — how far from the normal pattern this is (deterministic from the evidence). */
  novelty: number
  /** KWD the finding is worth per week (an Estimate), used for ranking; null when not sizable. */
  weeklyImpact: CouncilEstimate | null
  proposals: CouncilProposal[]
  /** Rule parameters quoted in the text (e.g. "over 12 hours", "within 48 hours") — not Odoo data. */
  thresholds?: Record<string, number>
}

export interface CouncilDataGap {
  odooModel: string
  /** What is missing, and what must be recorded in Odoo to close the gap. */
  missingAr: string
  missingEn: string
  recordAr: string
  recordEn: string
}

export interface AdvisorReport {
  advisorId: AdvisorId
  domainAr: string
  domainEn: string
  period: { from: string; to: string } | null
  /** Sync time of the payload the report was computed from (deterministic: never `Date.now()`). */
  generatedAt: string | null
  status: 'ready' | 'partial' | 'unavailable'
  findings: CouncilFinding[]
  dataGaps: CouncilDataGap[]
}

export interface Advisor<I> {
  id: AdvisorId
  domainAr: string
  domainEn: string
  run(input: I): AdvisorReport
}

export interface CouncilDiscovery {
  finding: CouncilFinding
  score: number
  /** Other advisors whose findings point to the same branch (cross-advisor link). */
  linkedAdvisors: AdvisorId[]
}

export interface CouncilSnapshot {
  generatedAt: string | null
  reports: AdvisorReport[]
  discoveries: CouncilDiscovery[]
}
