import 'server-only'
/**
 * Runs the advisor council on live Odoo data (read-only) and stores the snapshot.
 *
 * - hourly: CFO + Delivery trend + Seasons on the latest week (7 vs 7 completed days); HR and
 *   Inventory reports are carried forward from the last nightly run.
 * - nightly: every advisor on full periods (28 vs 28 completed days, 5-week platform hour matrix,
 *   14 days of attendance, current stock, model probe).
 */
import { fetchLiveOdooPeriodCube, fetchLiveOdooSnapshot, fetchLiveOdooWarehouseChain, type OdooPeriodCube } from '@/lib/odoo-live-connector'
import { SUGGESTED_SEASON_EVENTS } from '@/lib/council/advisors/seasons'
import { kuwaitDayOf, shiftIso } from '@/lib/council/helpers'
import { rankDiscoveries, runCouncil } from '@/lib/council/runner'
import type { CouncilSnapshot } from '@/lib/council/types'
import { fetchAggregatorHourlyMatrix, fetchAttendanceInput, fetchQuantInput, probeOdooModels, type OdooModelProbe } from './odoo-reads'
import { listSeasonEvents, loadLatestCouncilSnapshot, loadShownFingerprints, saveCouncilSnapshot } from './store'

export type CouncilScope = 'hourly' | 'nightly'

function branchOfConfig(cube: OdooPeriodCube | null): Map<number, string> {
  const out = new Map<number, string>()
  for (const [branch, ids] of Object.entries(cube?.posConfigIds?.configIdsByBranch ?? {})) for (const id of ids) out.set(id, branch)
  return out
}

export function resolveHasBomsFromProbe(probe: OdooModelProbe | null | undefined): boolean | null {
  const bom = probe?.rows.find((r) => r.model === 'mrp.bom')
  if (!bom) return null
  if (!bom.installed) return false
  if (!bom.readable && bom.totalCount === null && bom.recentCount === null) return null
  return (bom.totalCount ?? bom.recentCount ?? 0) > 0
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
    const [m, att, quants, warehouse, probe] = await Promise.all([
      fetchAggregatorHourlyMatrix(shiftIso(lastComplete, -34), lastComplete, branchOfConfig(cube), cube?.lastSyncAt ?? null),
      fetchAttendanceInput(shiftIso(lastComplete, -13), lastComplete),
      fetchQuantInput(today),
      fetchLiveOdooWarehouseChain(aFrom, lastComplete, nowMs).catch(() => null),
      probeOdooModels(nowMs),
    ])
    matrix = m
    hr = { attendance: att }
    inventory = { quants, warehouse, hasBoms: resolveHasBomsFromProbe(probe) }
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
    // Carry the nightly HR and inventory reports forward instead of re-reading them every hour.
    const last = await loadLatestCouncilSnapshot()
    const carried = last?.snapshot.reports.filter((r) => r.advisorId === 'hr' || r.advisorId === 'inventory') ?? []
    if (carried.length > 0) {
      const reports = fresh.reports.map((r) => carried.find((c) => c.advisorId === r.advisorId && c.status !== 'unavailable') ?? r)
      return { snapshot: { ...fresh, reports, discoveries: rankDiscoveries(reports, seen) }, kuwaitDay: today }
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
