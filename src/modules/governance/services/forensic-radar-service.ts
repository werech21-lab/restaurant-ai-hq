import { dispatchExclusiveRadarAlert } from '@/lib/alerts'
import type { AuthContext } from '@/lib/auth/context'
import { logger } from '@/lib/logger'
import {
  buildForensicMatrix,
  buildForensicReport,
  filterForensicRows,
  summarizeKpis,
  type ForensicReport,
  type ForensicReportPeriod,
  type ForensicRow,
  type ForensicSnapshot,
} from '@/modules/governance/domain/forensic-radar'

/** In-process ring buffer — ~1 day of 5-minute scans (288). Survives warm serverless instances. */
const MAX_HISTORY = 288
const history: ForensicSnapshot[] = []

function pushSnapshot(snap: ForensicSnapshot) {
  const exists = history.findIndex((row) => row.bucket === snap.bucket)
  if (exists >= 0) history[exists] = snap
  else history.unshift(snap)
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
}

export function listForensicHistory(): ForensicSnapshot[] {
  return [...history]
}

export function latestForensicSnapshot(): ForensicSnapshot | null {
  return history[0] ?? null
}

export type ForensicBoardQuery = {
  brandId?: string | null
  branchId?: string | null
  platform?: string | null
  period?: ForensicReportPeriod
}

export type ForensicBoard = {
  snapshot: ForensicSnapshot
  rows: ForensicRow[]
  kpis: ReturnType<typeof summarizeKpis>
  report: ForensicReport
  historyCount: number
  nextScanInSec: number
  autoScanIntervalSec: number
}

export function forensicBoard(query: ForensicBoardQuery = {}): ForensicBoard {
  const snapshot = latestForensicSnapshot() ?? buildForensicMatrix()
  if (!latestForensicSnapshot()) pushSnapshot(snapshot)
  const rows = filterForensicRows(snapshot.rows, query)
  const kpis = summarizeKpis(rows)
  const period = query.period ?? 'daily'
  const report = buildForensicReport(history.length ? history : [snapshot], period)
  const bucketMs = 5 * 60 * 1000
  const bucketStart = new Date(snapshot.bucket).getTime()
  const nextScanInSec = Math.max(0, Math.ceil((bucketStart + bucketMs - Date.now()) / 1000))
  return {
    snapshot,
    rows,
    kpis,
    report,
    historyCount: Math.max(history.length, 1),
    nextScanInSec,
    autoScanIntervalSec: 300,
  }
}

export async function runForensicScan(
  auth: AuthContext,
  opts: { brandId?: string | null; branchId?: string | null; platform?: string | null; alert?: boolean } = {},
): Promise<ForensicBoard & { recorded: number; alerted: boolean }> {
  const snapshot = buildForensicMatrix()
  pushSnapshot(snapshot)
  let alerted = false
  const incidents = snapshot.rows.filter(
    (row) => row.status === 'forced_offline' || (row.mode === 'TGO' && row.status === 'busy_throttled'),
  )
  if (opts.alert !== false && incidents.length > 0) {
    const sample = incidents[0]
    try {
      await dispatchExclusiveRadarAlert({
        kind: sample.status === 'forced_offline' ? 'forced_offline' : 'tgo_forced',
        brandName: sample.brandNameEn,
        branchName: sample.areaEn,
        platformName: sample.platform,
        zoneStatus: sample.status,
        logisticsMode: sample.mode === 'TGO' ? 'platform_fleet (TGO 17%)' : 'vendor_own_fleet (TMP 10%)',
        detailAr: `فحص جنائي لحظي بواسطة ${auth.userId}: ${incidents.length} حادثة Offline/TGO خلال ${snapshot.bucket}.`,
      })
      alerted = true
    } catch (error) {
      logger.warn('Forensic radar alert skipped', { error: String(error) })
    }
  }
  const board = forensicBoard(opts)
  return { ...board, recorded: snapshot.rows.length, alerted }
}
