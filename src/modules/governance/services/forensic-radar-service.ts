import { dispatchExclusiveOperationalReport } from '@/lib/alerts'
import type { AuthContext } from '@/lib/auth/context'
import { logger } from '@/lib/logger'
import {
  FORENSIC_MISSING_DATA_REASON,
  buildForensicMatrix,
  buildForensicReport,
  filterForensicRows,
  summarizeKpis,
  type ForensicReport,
  type ForensicReportPeriod,
  type ForensicRow,
  type ForensicSnapshot,
  type VerifiedForensicObservation,
} from '@/modules/governance/domain/forensic-radar'

/** In-process ring buffer — ~1 day of verified 5-minute scans (288). Survives warm serverless instances. */
const MAX_HISTORY = 288
const history: ForensicSnapshot[] = []

function pushSnapshot(snap: ForensicSnapshot) {
  if (!snap.dataAvailable || snap.rows.length === 0) return
  const exists = history.findIndex((row) => row.bucket === snap.bucket)
  if (exists >= 0) history[exists] = snap
  else history.unshift(snap)
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
}

export function clearForensicHistory(): void {
  history.length = 0
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
    historyCount: history.length,
    nextScanInSec,
    autoScanIntervalSec: 300,
  }
}

export async function runForensicScan(
  auth: AuthContext,
  opts: {
    brandId?: string | null
    branchId?: string | null
    platform?: string | null
    alert?: boolean
    verifiedInputs?: readonly VerifiedForensicObservation[]
    at?: Date
  } = {},
): Promise<
  ForensicBoard & {
    recorded: number
    alerted: boolean
    dispatched: boolean
    skippedReason?: string
  }
> {
  const snapshot = buildForensicMatrix(opts.at ?? new Date(), opts.verifiedInputs)
  if (!snapshot.dataAvailable || snapshot.rows.length === 0) {
    const skippedReason = snapshot.unavailableReason ?? FORENSIC_MISSING_DATA_REASON
    logger.warn('forensic_report_fail_closed_missing_odoo_data', {
      reason: skippedReason,
      userId: auth.userId,
      bucket: snapshot.bucket,
    })
    const board = forensicBoard(opts)
    return {
      ...board,
      snapshot,
      rows: [],
      kpis: summarizeKpis([]),
      recorded: 0,
      alerted: false,
      dispatched: false,
      skippedReason,
    }
  }

  pushSnapshot(snapshot)
  let alerted = false
  let dispatched = false
  let skippedReason: string | undefined

  const incidents = snapshot.rows.filter(
    (row) => row.status === 'forced_offline' || (row.mode === 'TGO' && row.status === 'busy_throttled'),
  )
  if (opts.alert !== false && incidents.length > 0) {
    try {
      const historySnaps = listForensicHistory()
      const dispatchRes = await dispatchExclusiveOperationalReport(
        historySnaps.length ? historySnaps : [snapshot],
      )
      dispatched = dispatchRes.dispatched
      alerted = dispatchRes.alerted
      skippedReason = dispatchRes.skippedReason
      if (dispatchRes.dispatched) {
        logger.info('forensic_daily_report_dispatched', {
          userId: auth.userId,
          incidents: incidents.length,
          bucket: snapshot.bucket,
        })
      }
    } catch (error) {
      logger.warn('Forensic operational report skipped', { error: String(error) })
    }
  }
  const board = forensicBoard(opts)
  return {
    ...board,
    recorded: snapshot.rows.length,
    alerted,
    dispatched,
    ...(skippedReason ? { skippedReason } : {}),
  }
}
