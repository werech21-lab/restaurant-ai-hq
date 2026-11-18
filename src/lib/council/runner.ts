/**
 * Council runner: runs every advisor on its inputs, then ranks cross-advisor discoveries.
 *
 * Ranking = impact × novelty. Impact is the finding's weekly Estimate in KWD; findings sized in
 * other units (hours, counts) rank by a severity proxy. Findings whose fingerprint was already
 * shown in the last 7 days are suppressed, so "Today's Discoveries" never repeats itself.
 */
import { cfoAdvisor, type CfoInput } from './advisors/cfo'
import { deliveryAdvisor, type DeliveryInput } from './advisors/delivery'
import { hrAdvisor, type HrInput } from './advisors/hr'
import { inventoryAdvisor, type InventoryInput } from './advisors/inventory'
import { seasonsAdvisor, type SeasonsInput } from './advisors/seasons'
import { benchmarkAdvisor, type BenchmarkInput } from './advisors/benchmark'
import { driversAdvisor, type DriversInput } from './advisors/drivers'
import { forecastAdvisor, type ForecastInput } from './advisors/forecast'
import { menuAdvisor, type MenuInput } from './advisors/menu'
import type { AdvisorId, AdvisorReport, CouncilDiscovery, CouncilFinding, CouncilSnapshot } from './types'

export interface CouncilInputs {
  cfo?: CfoInput | null
  delivery?: DeliveryInput | null
  hr?: HrInput | null
  inventory?: InventoryInput | null
  seasons?: SeasonsInput | null
  drivers?: DriversInput | null
  menu?: MenuInput | null
  benchmark?: BenchmarkInput | null
  forecast?: ForecastInput | null
}

/** Severity proxy (KWD-equivalent, ranking only) for findings not sized in KWD. */
const SEVERITY_PROXY = { high: 300, medium: 150, low: 40 } as const

export function findingImpactScore(f: CouncilFinding): number {
  const impact = f.weeklyImpact?.unit === 'KWD' ? f.weeklyImpact.value : SEVERITY_PROXY[f.severity]
  return Math.round(impact * f.novelty * 1000) / 1000
}

export function rankDiscoveries(
  reports: readonly AdvisorReport[],
  seenLast7Days: ReadonlySet<string> = new Set(),
  limit = 3,
): CouncilDiscovery[] {
  const all = reports.flatMap((r) => r.findings)
  return all
    .filter((f) => !seenLast7Days.has(f.fingerprint))
    // A discovery must point at something specific or be a company-wide record-keeping fact.
    .filter((f) => Object.keys(f.entities).length > 0 || f.advisorId === 'hr' || f.advisorId === 'inventory')
    .map((finding) => {
      const linked = finding.entities.branchId
        ? [...new Set(all.filter((o) => o.advisorId !== finding.advisorId && o.entities.branchId === finding.entities.branchId).map((o) => o.advisorId))]
        : []
      return { finding, score: findingImpactScore(finding), linkedAdvisors: linked as AdvisorId[] }
    })
    .sort((a, b) => b.score - a.score || a.finding.fingerprint.localeCompare(b.finding.fingerprint))
    .slice(0, limit)
}

export function runCouncil(inputs: CouncilInputs, seenLast7Days: ReadonlySet<string> = new Set()): CouncilSnapshot {
  const reports: AdvisorReport[] = [
    cfoAdvisor.run(inputs.cfo ?? { summary: null }),
    deliveryAdvisor.run(inputs.delivery ?? {}),
    hrAdvisor.run(inputs.hr ?? { attendance: null }),
    inventoryAdvisor.run(inputs.inventory ?? { quants: null }),
    seasonsAdvisor.run(inputs.seasons ?? { summary: null, events: [] }),
    driversAdvisor.run(inputs.drivers ?? { summary: null }),
    menuAdvisor.run(inputs.menu ?? {}),
    benchmarkAdvisor.run(inputs.benchmark ?? { summary: null }),
    forecastAdvisor.run(inputs.forecast ?? { summary: null }),
  ]
  const stamps = reports.map((r) => r.generatedAt).filter((s): s is string => Boolean(s)).sort()
  return { generatedAt: stamps[stamps.length - 1] ?? null, reports, discoveries: rankDiscoveries(reports, seenLast7Days) }
}

/** Every number a report carries (evidence values, estimate values and inputs, hours). */
export function councilNumbers(reports: readonly AdvisorReport[]): number[] {
  const out: number[] = []
  for (const r of reports) {
    for (const f of r.findings) {
      for (const e of f.evidence) out.push(e.value)
      if (f.entities.hour !== undefined) out.push(f.entities.hour)
      out.push(...Object.values(f.thresholds ?? {}))
      const ests = [f.weeklyImpact, ...f.proposals.map((p) => p.expectedImpact)]
      for (const est of ests) {
        if (!est) continue
        out.push(est.value, ...Object.values(est.inputs))
      }
    }
  }
  return out
}
