import 'server-only'
/**
 * Runs the advisor council on live Odoo data (read-only) and stores the snapshot.
 *
 * - hourly: CFO + Delivery trend + Seasons on the latest week (7 vs 7 completed days); nightly HR,
 *   Inventory, and Delivery platform-pause findings (from the 5-week matrix) are carried forward.
 * - nightly: every advisor on full periods (28 vs 28 completed days, 5-week platform hour matrix,
 *   14 days of attendance + work_location_id, current stock + Qurain transfers, model probe, and
 *   BoM theoretical usage when mrp.bom exists).
 */
import { fetchLiveOdooPeriodCube, fetchLiveOdooSnapshot, fetchLiveOdooWarehouseChain, type OdooPeriodCube } from '@/lib/odoo-live-connector'
import { SUGGESTED_SEASON_EVENTS } from '@/lib/council/advisors/seasons'
import { kuwaitDayOf, shiftIso } from '@/lib/council/helpers'
import { rankDiscoveries, runCouncil } from '@/lib/council/runner'
import type { AdvisorReport, CouncilDiscovery, CouncilSnapshot } from '@/lib/council/types'
import {
  fetchAggregatorHourlyMatrix,
  fetchAttendanceInput,
  fetchBomUsageInput,
  fetchQuantInput,
  fetchQurainTransferInput,
  probeOdooModels,
  type OdooModelProbe,
} from './odoo-reads'
import { listSeasonEvents, loadLatestCouncilSnapshot, loadShownFingerprints, saveCouncilSnapshot } from './store'

export type CouncilScope = 'hourly' | 'nightly'

function branchOfConfig(cube: OdooPeriodCube | null): Map<number, string> {
  const out = new Map<number, string>()
  for (const [branch, ids] of Object.entries(cube?.posConfigIds?.configIdsByBranch ?? {})) for (const id of ids) out.set(id, branch)
  return out
}

/**
 * Resolves whether Odoo holds active Bills of Materials (`mrp.bom`), checking `totalCount` first so
 * recipes created >30 days ago (`recentCount === 0`) are properly detected.
 */
export function resolveHasBomsFromProbe(probe: OdooModelProbe | null | undefined): boolean | null {
  const bom = probe?.rows.find((r) => r.model === 'mrp.bom')
  if (!bom) return null
  if (!bom.installed) return false
  if (!bom.readable && bom.totalCount === null && bom.recentCount === null) return null
  return (bom.totalCount ?? bom.recentCount ?? 0) > 0
}

/**
 * Merges an hourly council run with carried-forward nightly reports (`hr`, `inventory`, and
 * nightly `delivery` `platform-pause` findings computed from the 5-week `pos.payment` matrix).
 */
export function mergeHourlyCarryForwardReports(
  freshReports: readonly AdvisorReport[],
  priorSnapshot: CouncilSnapshot | null | undefined,
  seen: ReadonlySet<string>,
): { reports: AdvisorReport[]; discoveries: CouncilDiscovery[] } {
  if (!priorSnapshot) {
    const reports = [...freshReports]
    return { reports, discoveries: rankDiscoveries(reports, seen) }
  }

  const priorByAdvisor = new Map(priorSnapshot.reports.map((r) => [r.advisorId, r]))
  const reports: AdvisorReport[] = freshReports.map((r) => {
    if (r.advisorId === 'hr' || r.advisorId === 'inventory') {
      const prior = priorByAdvisor.get(r.advisorId)
      return prior && prior.status !== 'unavailable' ? prior : r
    }
    if (r.advisorId === 'delivery') {
      const prior = priorByAdvisor.get('delivery')
      if (!prior) return r
      const priorPauses = prior.findings.filter((f) => f.kind === 'platform-pause')
      const priorHadMatrix =
        priorPauses.length > 0 ||
        (prior.status !== 'unavailable' && !prior.dataGaps.some((g) => /matrix|مصفوفة/i.test(`${g.missingEn} ${g.missingAr}`)))
      if (!priorHadMatrix) return r

      const mergedFindings = [...priorPauses, ...r.findings.filter((f) => f.kind !== 'platform-pause')]
      const mergedGaps = r.dataGaps.filter((g) => !/matrix|مصفوفة/i.test(`${g.missingEn} ${g.missingAr}`))
      return {
        ...r,
        period: r.period ?? prior.period,
        generatedAt: r.generatedAt ?? prior.generatedAt,
        status: mergedFindings.length === 0 && mergedGaps.length >= 2 ? 'unavailable' : mergedGaps.length > 0 ? 'partial' : 'ready',
        findings: mergedFindings,
        dataGaps: mergedGaps,
      }
    }
    return r
  })

  return { reports, discoveries: rankDiscoveries(reports, seen) }
}

export async function computeCouncilSnapshot(scope: CouncilScope, nowMs = Date.now()): Promise<{ snapshot: CouncilSnapshot; kuwaitDay: string }> {
  const today = kuwaitDayOf(new Date(nowMs).toISOString())!
  const lastComplete = shiftIso(today, -1)
  const span = scope === 'nightly' ? 28 : 7
  const aFrom = shiftIso(lastComplete, -(span - 1))
  const bTo = shiftIso(aFrom, -1)
  const bFrom = shiftIso(bTo, -(span - 1))

  const [envelope, cube, priorCube, events] = await Promise.all([
    fetchLiveOdooSnapshot({ period: 'today', readOnly: true, referenceNowMs: nowMs }).catch(() => null),
    fetchLiveOdooPeriodCube(aFrom, lastComplete, nowMs).catch(() => null),
    fetchLiveOdooPeriodCube(bFrom, bTo, nowMs).catch(() => null),
    listSeasonEvents(),
  ])
  const summary = envelope?.summary ?? null
  const seasonEvents = events && events.length > 0 ? events : [...SUGGESTED_SEASON_EVENTS]

  let hr = null
  let inventory = null
  let matrix = null
  if (scope === 'nightly') {
    const cfgMap = branchOfConfig(cube)
    const [m, att, quants, qurainTransfers, warehouse, probe] = await Promise.all([
      fetchAggregatorHourlyMatrix(shiftIso(lastComplete, -34), lastComplete, cfgMap, cube?.lastSyncAt ?? null),
      fetchAttendanceInput(shiftIso(lastComplete, -13), lastComplete),
      fetchQuantInput(today),
      fetchQurainTransferInput(aFrom, lastComplete),
      fetchLiveOdooWarehouseChain(aFrom, lastComplete, nowMs).catch(() => null),
      probeOdooModels(nowMs),
    ])
    matrix = m
    hr = { attendance: att, probe }
    const hasBoms = resolveHasBomsFromProbe(probe)
    const bomUsage = hasBoms === true ? await fetchBomUsageInput(aFrom, lastComplete, cfgMap, warehouse) : null
    inventory = { quants, warehouse, qurainTransfers, hasBoms, bomUsage }
  }

  const seen = await loadShownFingerprints(today)
  const fresh = runCouncil(
    {
      cfo: { summary, cube: cube?.connected ? cube : null, priorCube: priorCube?.connected ? priorCube : null, glClosedThrough: null },
      delivery: { cube: cube?.connected ? cube : null, priorCube: priorCube?.connected ? priorCube : null, matrix },
      hr,
      inventory,
      seasons: { summary, events: seasonEvents },
    },
    seen,
  )
  if (scope === 'hourly') {
    const last = await loadLatestCouncilSnapshot()
    if (last?.snapshot) {
      const merged = mergeHourlyCarryForwardReports(fresh.reports, last.snapshot, seen)
      return { snapshot: { ...fresh, reports: merged.reports, discoveries: merged.discoveries }, kuwaitDay: today }
    }
  }
  return { snapshot: fresh, kuwaitDay: today }
}

export async function runAndStoreCouncil(scope: CouncilScope, nowMs = Date.now()): Promise<CouncilSnapshot> {
  const { snapshot, kuwaitDay } = await computeCouncilSnapshot(scope, nowMs)
  await saveCouncilSnapshot({ scope, kuwaitDay, snapshot })
  return snapshot
}

/** Latest stored snapshot for Feryal and Home; null when no run has been stored yet. */
export async function latestCouncilSnapshot(): Promise<CouncilSnapshot | null> {
  return (await loadLatestCouncilSnapshot())?.snapshot ?? null
}
