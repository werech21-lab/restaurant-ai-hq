/**
 * Executive summary of a council snapshot — the deterministic version (always available) and the
 * fact set an AI rewrite must stay inside. Numbers only come from evidence and Estimates.
 */
import { councilNumbers, findingImpactScore } from './runner'
import type { CouncilFinding, CouncilSnapshot } from './types'

export interface ExecutiveSummary {
  source: 'template' | 'ai'
  ar: string[]
  en: string[]
  /** Fingerprints of the findings the summary is built on (for links into the Decision Room). */
  basis: string[]
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

/** The findings worth a manager's attention, ranked by weekly KWD × novelty (company headlines first). */
export function summaryFindings(snapshot: CouncilSnapshot, limit = 4): CouncilFinding[] {
  const all = snapshot.reports.flatMap((r) => r.findings)
  const headline = all.filter((f) => f.kind === 'company-split' || f.kind === 'forecast-next7' || f.kind.startsWith('market-wide'))
  const actions = all
    .filter((f) => !headline.includes(f) && f.proposals.length > 0)
    .sort((a, b) => findingImpactScore(b) - findingImpactScore(a) || a.fingerprint.localeCompare(b.fingerprint))
  return [...headline.slice(0, 2), ...actions].slice(0, limit)
}

export function templateSummary(snapshot: CouncilSnapshot): ExecutiveSummary {
  const picks = summaryFindings(snapshot)
  const ar: string[] = []
  const en: string[] = []
  for (const f of picks) {
    const p = f.proposals[0]
    const impact = f.weeklyImpact?.unit === 'KWD' ? f.weeklyImpact.value : null
    ar.push(`${f.titleAr}${impact !== null ? ` — أثر تقديري ${fmt(impact)} د.ك أسبوعياً` : ''}${p ? `. المقترح: ${p.who.ar} — ${p.what.ar} (${p.when.ar}).` : '.'}`)
    en.push(`${f.titleEn}${impact !== null ? ` — estimated ${fmt(impact)} KWD a week` : ''}${p ? `. Proposal: ${p.who.en} — ${p.what.en} (${p.when.en}).` : '.'}`)
  }
  return { source: 'template', ar, en, basis: picks.map((f) => f.fingerprint) }
}

/** Every council number (evidence, Estimate values and inputs, thresholds, hours) — never date parts. */
export function summaryFactNumbers(snapshot: CouncilSnapshot): number[] {
  const nums = councilNumbers(snapshot.reports)
  return [...new Set([...nums, ...nums.map((n) => Math.abs(n))])]
}
