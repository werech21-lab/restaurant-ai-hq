/**
 * talabat-geo-zone-radar.ts
 * ==============================================================================
 * Venture Foods W.L.L. - Kuwait Geo-Spatial & Aggregator Radar Types & Helpers
 * ------------------------------------------------------------------------------
 * Unlinked from live aggregator polygon APIs. All static/modeled zone statuses,
 * lost-order estimates, and synthetic incidents have been purged.
 * ==============================================================================
 */
import { GLOBAL_BRAND_OPTIONS } from '@/lib/aether/global-filter-engine'

export type DeliveryZoneStatus =
  | 'ONLINE_VISIBLE'
  | 'BUSY_IN_AREA'
  | 'AREA_CLOSED_HIDDEN'
  | 'FORCED_TGO_17'

export type AccountDeliveryMode = 'Tgo' | 'M'

export type RadarPlatform = 'Talabat' | 'Deliveroo' | 'Keeta' | 'Jahez'

export type IncidentRootCause =
  | 'TALABAT_FLEET_SHORTAGE'
  | 'PEAK_RADIUS_CUT'
  | 'HIGH_KITCHEN_LOAD'
  | 'MANUAL_TABLET_STOP'

export interface RestaurantZoneAccount {
  accountId: string
  accountCode: string
  accountNameAr: string
  accountNameEn: string
  branchId: string
  branchCode: string
  branchNameAr: string
  branchNameEn: string
  brandId: string
  brandNameAr: string
  brandNameEn: string
  platform: RadarPlatform
  deliveryMode: AccountDeliveryMode
  commissionPct: number
  sectorNameAr: string
  sectorNameEn: string
  coveredAreasAr: string[]
  coveredAreasEn: string[]
  status: DeliveryZoneStatus
}

export interface AreaZoneRecord {
  id: string
  zoneNameAr: string
  zoneNameEn: string
  distanceKm: number
  deliveryMode: AccountDeliveryMode
  platform: RadarPlatform
  brandId: string
  brandNameAr: string
  brandNameEn: string
  zoneAccountId: string
  zoneAccountNameAr: string
  zoneAccountNameEn: string
  status: DeliveryZoneStatus
  startTime: string
  endTime: string | null
  isOngoing: boolean
  durationMinutes: number
  rootCause: IncidentRootCause
  rootCauseLabelAr: string
  rootCauseLabelEn: string
  estimatedLostOrders: number
  estimatedLostKwd: number
  forcedTgoPenaltyKwd: number
}

export interface BranchRadarProfile {
  branchId: string
  branchCode: string
  branchNameAr: string
  branchNameEn: string
  primaryBrandId: string
  primaryBrandNameAr: string
  primaryBrandNameEn: string
  supportedBrandIds: string[]
  tabletOnline: boolean
  batteryPct: number
  assignedFleetType: 'TALABAT_GO_17' | 'HYBRID_TMP_TGO'
  totalZonesCount: number
  onlineZonesCount: number
  busyZonesCount: number
  hiddenZonesCount: number
  openRatioPct: number
  totalLostKwdToday: number
  zoneAccounts: RestaurantZoneAccount[]
  zones: AreaZoneRecord[]
}

export interface ChronologicalIncident {
  id: string
  timestamp: string
  date: string
  brandNameAr: string
  brandNameEn: string
  branchNameAr: string
  branchNameEn: string
  zoneNameAr: string
  zoneNameEn: string
  status: DeliveryZoneStatus
  startTime: string
  endTime: string
  durationMinutes: number
  isOngoing: boolean
  rootCauseLabelAr: string
  rootCauseLabelEn: string
  faultParty: 'TALABAT' | 'BRANCH'
  lostOrders: number
  lostKwd: number
  penaltyKwd: number
  remedyActionAr: string
  remedyActionEn: string
}

export interface GeoRadarKpis {
  totalMonitoredZones: number
  onlineZonesCount: number
  onlineZonesPct: number
  busyZonesCount: number
  avgBusyDurationMinutes: number
  hiddenZonesCount: number
  forcedTgoZonesCount: number
  totalLostSalesKwd: number
  totalTgoPenaltiesKwd: number
  totalFinancialImpactKwd: number
  totalActiveAccounts: number
  tgoAccountsCount: number
  mAccountsCount: number
  issueAccountsCount: number
  lastScannedAt: string
}

const BRAND_COLORS: Record<string, string> = {
  'china-garden': '#f97316',
  franks: '#ef4444',
  tahina: '#eab308',
  'farm-brown': '#22c55e',
  'noodle-bar': '#3b82f6',
  'karak-cafeteria': '#a855f7',
}

export const VENTURE_BRANDS = GLOBAL_BRAND_OPTIONS.filter((b) => b.id !== 'all').map((b) => ({
  id: b.id,
  nameAr: b.ar,
  nameEn: b.en,
  color: BRAND_COLORS[b.id] ?? '#10b981',
}))

export const PERMANENTLY_CLOSED_BRANCHES: BranchRadarProfile[] = []

export const INITIAL_BRANCH_PROFILES: BranchRadarProfile[] = []

export const HISTORICAL_CHRONOLOGICAL_INCIDENTS: ChronologicalIncident[] = []

export function calculateGeoRadarKpis(branches: BranchRadarProfile[]): GeoRadarKpis {
  let totalMonitoredZones = 0
  let onlineZonesCount = 0
  let busyZonesCount = 0
  let hiddenZonesCount = 0
  let forcedTgoZonesCount = 0
  let totalLostSalesKwd = 0
  let totalTgoPenaltiesKwd = 0
  let totalBusyMinutes = 0
  let totalActiveAccounts = 0
  let tgoAccountsCount = 0
  let mAccountsCount = 0
  let issueAccountsCount = 0

  for (const branch of branches) {
    for (const acc of branch.zoneAccounts) {
      totalActiveAccounts += 1
      if (acc.deliveryMode === 'Tgo') tgoAccountsCount += 1
      else mAccountsCount += 1
      if (acc.status !== 'ONLINE_VISIBLE') issueAccountsCount += 1
    }
    for (const zone of branch.zones) {
      totalMonitoredZones += 1
      if (zone.status === 'ONLINE_VISIBLE') {
        onlineZonesCount += 1
      } else if (zone.status === 'BUSY_IN_AREA') {
        busyZonesCount += 1
        totalBusyMinutes += zone.durationMinutes
      } else if (zone.status === 'AREA_CLOSED_HIDDEN') {
        hiddenZonesCount += 1
        totalBusyMinutes += zone.durationMinutes
      } else if (zone.status === 'FORCED_TGO_17') {
        forcedTgoZonesCount += 1
      }
      totalLostSalesKwd += zone.estimatedLostKwd
      totalTgoPenaltiesKwd += zone.forcedTgoPenaltyKwd
    }
  }

  const onlineZonesPct =
    totalMonitoredZones > 0 ? Number(((onlineZonesCount / totalMonitoredZones) * 100).toFixed(1)) : 0

  const avgBusyDurationMinutes =
    busyZonesCount + hiddenZonesCount > 0
      ? Math.round(totalBusyMinutes / (busyZonesCount + hiddenZonesCount))
      : 0

  return {
    totalMonitoredZones,
    onlineZonesCount,
    onlineZonesPct,
    busyZonesCount,
    avgBusyDurationMinutes,
    hiddenZonesCount,
    forcedTgoZonesCount,
    totalLostSalesKwd: Number(totalLostSalesKwd.toFixed(3)),
    totalTgoPenaltiesKwd: Number(totalTgoPenaltiesKwd.toFixed(3)),
    totalFinancialImpactKwd: Number((totalLostSalesKwd + totalTgoPenaltiesKwd).toFixed(3)),
    totalActiveAccounts,
    tgoAccountsCount,
    mAccountsCount,
    issueAccountsCount,
    lastScannedAt: '',
  }
}

export function formatTalabatAreaAlertEmail(branches: BranchRadarProfile[], kpis: GeoRadarKpis): string {
  if (branches.length === 0) {
    return 'غير مربوط بمصدر — لا توجد بيانات تغطية جغرافية من منصات التوصيل.'
  }

  const lines: string[] = [
    'AetherBI · VENTURE FOODS W.L.L. — AGGREGATOR AREA ALERT',
    `Active Accounts: ${kpis.totalActiveAccounts} (Tgo: ${kpis.tgoAccountsCount} | M: ${kpis.mAccountsCount})`,
  ]

  for (const b of branches) {
    const affected = b.zones.filter((z) => z.status !== 'ONLINE_VISIBLE')
    if (affected.length === 0) continue
    lines.push(`[${b.branchCode}] ${b.branchNameAr}:`)
    for (const z of affected) {
      lines.push(` - [${z.deliveryMode}] ${z.zoneNameAr}: ${z.rootCauseLabelAr}`)
    }
  }

  return lines.join('\n')
}
