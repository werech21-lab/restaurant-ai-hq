import {
  dispatchExclusiveRadarAlert,
  isKuwaitPeakHours,
  type RadarAlertKind,
  type RadarAlertPayload,
} from '@/lib/alerts'
import { logger } from '@/lib/logger'
import type { GeoRankSnapshot } from '@/modules/governance/domain/types'

export type RadarAlertEvent = {
  kind: RadarAlertKind
  snapshotId: string
  brandName: string
  branchName: string
  platformName: string
}

/**
 * Detect Forced Offline / Busy / TGO switches during Kuwait peak hours.
 * platform_fleet = توصيل التطبيق (TGO ~17%); vendor_own_fleet = MP company fleet (~10%).
 */
export function detectPeakRadarIncidents(snapshots: GeoRankSnapshot[], at = new Date()): RadarAlertEvent[] {
  if (!isKuwaitPeakHours(at)) return []
  const events: RadarAlertEvent[] = []
  for (const row of snapshots) {
    const offline = row.deliveryZoneStatus === 'خارج نطاق التوصيل'
    const busy = row.deliveryZoneStatus === 'مزدحم - نطاق مقلص'
    if (offline) {
      events.push({
        kind: 'forced_offline',
        snapshotId: row.id,
        brandName: row.brandNameAr || row.ourBrandName,
        branchName: row.branchLocationAr || row.ourBranchName,
        platformName: row.platformName,
      })
    } else if (busy) {
      events.push({
        kind: 'busy_peak',
        snapshotId: row.id,
        brandName: row.brandNameAr || row.ourBrandName,
        branchName: row.branchLocationAr || row.ourBranchName,
        platformName: row.platformName,
      })
    }
    // Forced TGO (platform fleet / ~17%) during peak without Ops approval — only with degraded coverage.
    if (row.logisticsMode === 'platform_fleet' && (offline || busy)) {
      events.push({
        kind: 'tgo_forced',
        snapshotId: row.id,
        brandName: row.brandNameAr || row.ourBrandName,
        branchName: row.branchLocationAr || row.ourBranchName,
        platformName: row.platformName,
      })
    }
  }
  return events
}

function payloadFor(event: RadarAlertEvent): RadarAlertPayload {
  if (event.kind === 'forced_offline') {
    return {
      kind: event.kind,
      brandName: event.brandName,
      branchName: event.branchName,
      platformName: event.platformName,
      zoneStatus: 'خارج نطاق التوصيل',
      detailAr: `إغلاق قسري للفرع/البراند في وقت الذروة دون إذن مدير العمليات. مطلوب إعادة الفتح فوراً على ${event.platformName}.`,
    }
  }
  if (event.kind === 'busy_peak') {
    return {
      kind: event.kind,
      brandName: event.brandName,
      branchName: event.branchName,
      platformName: event.platformName,
      zoneStatus: 'مزدحم - نطاق مقلص',
      detailAr: `وضع Busy / نطاق مقلص في الذروة على ${event.platformName}. راجع السعة فوراً.`,
    }
  }
  return {
    kind: 'tgo_forced',
    brandName: event.brandName,
    branchName: event.branchName,
    platformName: event.platformName,
    logisticsMode: 'platform_fleet (TGO 17%)',
    detailAr: `تحويل قسري من توصيل الشركة MP 10% إلى توصيل التطبيق TGO 17% على ${event.platformName}. تحقق من التفويض.`,
  }
}

/** Fire exclusive alerts for detected incidents (deduped by kind+branch+platform). */
export async function fireExclusiveRadarAlerts(snapshots: GeoRankSnapshot[]) {
  const events = detectPeakRadarIncidents(snapshots)
  if (events.length === 0) return { fired: 0, kinds: [] as string[] }

  const seen = new Set<string>()
  const kinds: string[] = []
  let fired = 0
  for (const event of events) {
    const key = `${event.kind}|${event.platformName}|${event.branchName}`
    if (seen.has(key)) continue
    seen.add(key)
    try {
      await dispatchExclusiveRadarAlert(payloadFor(event))
      fired += 1
      kinds.push(event.kind)
    } catch (error) {
      logger.error('radar_exclusive_alert_failed', {
        kind: event.kind,
        branch: event.branchName,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { fired, kinds }
}
