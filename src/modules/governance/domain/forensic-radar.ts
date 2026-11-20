/**
 * Deterministic forensic detector for Talabat TMP 10% vs TGO 17% and Forced Offline.
 * Strict Fail-Closed: builds rows ONLY from verified Odoo / live telemetry observations.
 */
import { VENTURE_BRANCHES, VENTURE_BRANDS, type VentureBrandId } from '@/lib/venture-hierarchy'
import { fiveMinuteBucket } from '@/modules/governance/domain/aggregator'

export const FORENSIC_PLATFORMS = ['Talabat', 'Deliveroo', 'Jahez', 'Keeta'] as const
export type ForensicPlatform = (typeof FORENSIC_PLATFORMS)[number]

export const TALABAT_MP_ACCOUNT = '101513' // Talabat MP — 10%
export const TALABAT_TGO_ACCOUNT = '101512' // Talabat Go — 17%
export const TMP_BPS = 1_000
export const TGO_BPS = 1_700
export const PENALTY_BPS = 700 // +7%
export const FORENSIC_MISSING_DATA_REASON = 'FAIL_CLOSED_MISSING_VERIFIED_ODOO_DATA' as const

export type LiveStatus = 'online' | 'forced_offline' | 'busy_throttled'
export type ActiveMode = 'TMP' | 'TGO'

export type VerifiedForensicObservation = {
  verifiedFromOdoo: true
  brandId: VentureBrandId
  branchId: string
  platform: ForensicPlatform
  status: LiveStatus
  mode: ActiveMode
  gmvMinor: number
  tmpShareBps: number
  tgoShareBps: number
  offlineMinutes: number
  offlineFromIso?: string | null
  offlineToIso?: string | null
  prepMinutes?: number | null
  rejectedOrders?: number | null
  conversionPct?: number | null
  delayRatePct?: number | null
  rank?: number | null
}

export type ForensicRow = {
  id: string
  brandId: VentureBrandId
  brandNameEn: string
  brandNameAr: string
  branchId: string
  branchNameEn: string
  branchNameAr: string
  areaEn: string
  areaAr: string
  platform: ForensicPlatform
  status: LiveStatus
  mode: ActiveMode
  commissionBps: number
  accountCode: string
  offlineFromIso: string | null
  offlineToIso: string | null
  offlineMinutes: number
  gmvMinor: number
  tmpShareBps: number
  tgoShareBps: number
  commissionPenaltyMinor: number
  lostSalesMinor: number
  financialImpactMinor: number
  bucket: string
  scannedAt: string
  verifiedFromOdoo?: boolean
  prepMinutes?: number | null
  rejectedOrders?: number | null
  conversionPct?: number | null
  delayRatePct?: number | null
  rank?: number | null
}

export type ForensicKpis = {
  onlineCount: number
  offlineCount: number
  busyCount: number
  totalGmvMinor: number
  tmpOrderShareBps: number
  tgoOrderShareBps: number
  totalOfflineMinutes: number
  commissionPenaltyMinor: number
  lostSalesMinor: number
  financialImpactMinor: number
  mpAccount: string
  tgoAccount: string
}

export type ForensicSnapshot = {
  bucket: string
  scannedAt: string
  dataAvailable: boolean
  unavailableReason?: string
  rows: ForensicRow[]
  kpis: ForensicKpis
}

export type ForensicReportPeriod = 'daily' | 'weekly' | 'monthly'

export type ForensicHourBucket = {
  hourLabel: string
  offlineMinutes: number
  tgoForcedCount: number
  impactMinor: number
}

export type ForensicDayBucket = {
  dayLabel: string
  offlineMinutes: number
  tgoForcedCount: number
  impactMinor: number
}

export type ForensicReport = {
  period: ForensicReportPeriod
  generatedAt: string
  dataAvailable: boolean
  unavailableReason?: string
  totalOfflineMinutes: number
  tmpGmvMinor: number
  tgoGmvMinor: number
  penaltyMinor: number
  lostSalesMinor: number
  claimMinor: number
  byBrand: Array<{
    brandId: string
    brandNameEn: string
    brandNameAr: string
    offlineMinutes: number
    penaltyMinor: number
    impactMinor: number
  }>
  timeline: ForensicHourBucket[]
  weekdays: ForensicDayBucket[]
}

export function formatKwdMinor(minor: number | null | undefined, locale: 'ar' | 'en' = 'en'): string {
  const safe = Number.isFinite(Number(minor)) ? Math.round(Number(minor)) : 0
  const amount = (safe / 1000).toFixed(3)
  return locale === 'en' ? `${amount} KWD` : `${amount} د.ك`
}

export function displayBrandName(nameEn: string, nameAr: string, locale: 'ar' | 'en'): string {
  // Never render "Brand (Brand)" duplicates.
  if (locale === 'en') return nameEn
  return nameAr
}

export function cleanBranchLabel(nameEn: string, areaEn: string): string {
  // Fix historic "Farm Brown /Debit" style corruption → real area name.
  if (/debit/i.test(nameEn) || /\/\s*$/.test(nameEn.trim())) return areaEn
  const cleaned = nameEn.replace(/\s{2,}/g, ' ').trim()
  if (cleaned.includes('·')) return cleaned.split('·').pop()!.trim() || areaEn
  return cleaned || areaEn
}

export function commissionPenaltyMinor(gmvMinor: number, mode: ActiveMode): number {
  if (mode !== 'TGO') return 0
  const safeGmv = Number.isFinite(gmvMinor) && gmvMinor > 0 ? gmvMinor : 0
  return Math.round((safeGmv * PENALTY_BPS) / 10_000)
}

export function lostSalesFromOffline(gmvMinor: number, offlineMinutes: number): number {
  if (!Number.isFinite(offlineMinutes) || offlineMinutes <= 0) return 0
  const safeGmv = Number.isFinite(gmvMinor) && gmvMinor > 0 ? gmvMinor : 0
  const factor = Math.min(1, offlineMinutes / 60)
  return Math.round(safeGmv * factor)
}

function isValidNonNegativeBps(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 10_000
}

function isValidVerifiedObservation(obs: VerifiedForensicObservation): boolean {
  if (!obs || obs.verifiedFromOdoo !== true) return false
  if (!FORENSIC_PLATFORMS.includes(obs.platform)) return false
  if (obs.status !== 'online' && obs.status !== 'forced_offline' && obs.status !== 'busy_throttled') {
    return false
  }
  if (obs.mode !== 'TMP' && obs.mode !== 'TGO') return false
  if (!Number.isFinite(obs.gmvMinor) || obs.gmvMinor < 0) return false
  if (!isValidNonNegativeBps(obs.tmpShareBps) || !isValidNonNegativeBps(obs.tgoShareBps)) return false
  if (!Number.isFinite(obs.offlineMinutes) || obs.offlineMinutes < 0) return false

  const brand = VENTURE_BRANDS.find((b) => b.id === obs.brandId)
  const branch = VENTURE_BRANCHES.find((b) => b.id === obs.branchId && b.brandId === obs.brandId)
  return Boolean(brand && branch)
}

export function buildForensicMatrix(
  at = new Date(),
  verifiedInputs?: readonly VerifiedForensicObservation[],
): ForensicSnapshot {
  const bucket = fiveMinuteBucket(at.getTime())
  const scannedAt = at.toISOString()

  if (!verifiedInputs || verifiedInputs.length === 0) {
    return {
      bucket,
      scannedAt,
      dataAvailable: false,
      unavailableReason: FORENSIC_MISSING_DATA_REASON,
      rows: [],
      kpis: summarizeKpis([]),
    }
  }

  // Fail-closed: if any supplied observation is unverified, incomplete, or malformed, reject the snapshot.
  if (verifiedInputs.some((obs) => !isValidVerifiedObservation(obs))) {
    return {
      bucket,
      scannedAt,
      dataAvailable: false,
      unavailableReason: FORENSIC_MISSING_DATA_REASON,
      rows: [],
      kpis: summarizeKpis([]),
    }
  }

  const rows: ForensicRow[] = []
  for (const obs of verifiedInputs) {
    const brand = VENTURE_BRANDS.find((b) => b.id === obs.brandId)!
    const branch = VENTURE_BRANCHES.find((b) => b.id === obs.branchId && b.brandId === obs.brandId)!
    const gmvMinor = Math.round(obs.gmvMinor)
    const offlineMinutes = Math.round(obs.offlineMinutes)
    const tmpShareBps = Math.round(obs.tmpShareBps)
    const tgoShareBps = Math.round(obs.tgoShareBps)
    const mode = obs.mode
    const commissionBps = mode === 'TMP' ? TMP_BPS : TGO_BPS
    const talabatAccount = mode === 'TMP' ? TALABAT_MP_ACCOUNT : TALABAT_TGO_ACCOUNT
    const offlineFromIso =
      obs.offlineFromIso !== undefined
        ? obs.offlineFromIso
        : offlineMinutes > 0
          ? new Date(at.getTime() - offlineMinutes * 60_000).toISOString()
          : null
    const offlineToIso =
      obs.offlineToIso !== undefined ? obs.offlineToIso : offlineMinutes > 0 ? scannedAt : null
    const penalty = commissionPenaltyMinor(gmvMinor, mode)
    const lost = lostSalesFromOffline(gmvMinor, offlineMinutes)

    rows.push({
      id: `${brand.id}:${branch.id}:${obs.platform}:${bucket}`,
      brandId: brand.id,
      brandNameEn: brand.nameEn,
      brandNameAr: brand.nameAr,
      branchId: branch.id,
      branchNameEn: branch.nameEn,
      branchNameAr: branch.nameAr,
      areaEn: branch.areaEn,
      areaAr: branch.areaAr,
      platform: obs.platform,
      status: obs.status,
      mode,
      commissionBps,
      accountCode: obs.platform === 'Talabat' ? talabatAccount : mode === 'TMP' ? 'MP-10' : 'TGO-17',
      offlineFromIso,
      offlineToIso,
      offlineMinutes,
      gmvMinor,
      tmpShareBps,
      tgoShareBps,
      commissionPenaltyMinor: penalty,
      lostSalesMinor: lost,
      financialImpactMinor: penalty + lost,
      bucket,
      scannedAt,
      verifiedFromOdoo: true,
      prepMinutes: obs.prepMinutes ?? null,
      rejectedOrders: obs.rejectedOrders ?? null,
      conversionPct: obs.conversionPct ?? null,
      delayRatePct: obs.delayRatePct ?? null,
      rank: obs.rank ?? null,
    })
  }

  return {
    bucket,
    scannedAt,
    dataAvailable: true,
    rows,
    kpis: summarizeKpis(rows),
  }
}

export function summarizeKpis(rows: ForensicRow[]): ForensicKpis {
  const onlineCount = rows.filter((r) => r.status === 'online').length
  const offlineCount = rows.filter((r) => r.status === 'forced_offline').length
  const busyCount = rows.filter((r) => r.status === 'busy_throttled').length
  const totalGmvMinor = rows.reduce((sum, r) => sum + r.gmvMinor, 0)
  const tmpGmv = rows.filter((r) => r.mode === 'TMP').reduce((sum, r) => sum + r.gmvMinor, 0)
  const tgoGmv = rows.filter((r) => r.mode === 'TGO').reduce((sum, r) => sum + r.gmvMinor, 0)
  const totalOfflineMinutes = rows.reduce((sum, r) => sum + r.offlineMinutes, 0)
  const commissionPenaltyMinor = rows.reduce((sum, r) => sum + r.commissionPenaltyMinor, 0)
  const lostSalesMinor = rows.reduce((sum, r) => sum + r.lostSalesMinor, 0)
  return {
    onlineCount,
    offlineCount,
    busyCount,
    totalGmvMinor,
    tmpOrderShareBps: totalGmvMinor > 0 ? Math.round((tmpGmv * 10_000) / totalGmvMinor) : 0,
    tgoOrderShareBps: totalGmvMinor > 0 ? Math.round((tgoGmv * 10_000) / totalGmvMinor) : 0,
    totalOfflineMinutes,
    commissionPenaltyMinor,
    lostSalesMinor,
    financialImpactMinor: commissionPenaltyMinor + lostSalesMinor,
    mpAccount: TALABAT_MP_ACCOUNT,
    tgoAccount: TALABAT_TGO_ACCOUNT,
  }
}

export function buildForensicReport(
  history: ForensicSnapshot[],
  period: ForensicReportPeriod,
  at = new Date(),
): ForensicReport {
  const ms =
    period === 'daily' ? 24 * 60 * 60_000 : period === 'weekly' ? 7 * 24 * 60 * 60_000 : 30 * 24 * 60 * 60_000
  const since = at.getTime() - ms
  const slices = history.filter((s) => new Date(s.scannedAt).getTime() >= since)
  const verifiedSlices = slices.filter((s) => s.dataAvailable && s.rows.length > 0)

  if (verifiedSlices.length === 0 || verifiedSlices.length !== slices.length) {
    return {
      period,
      generatedAt: at.toISOString(),
      dataAvailable: false,
      unavailableReason: FORENSIC_MISSING_DATA_REASON,
      totalOfflineMinutes: 0,
      tmpGmvMinor: 0,
      tgoGmvMinor: 0,
      penaltyMinor: 0,
      lostSalesMinor: 0,
      claimMinor: 0,
      byBrand: [],
      timeline: [],
      weekdays: [],
    }
  }

  const rows = verifiedSlices.flatMap((s) => s.rows)
  const tmpGmvMinor = rows.filter((r) => r.mode === 'TMP').reduce((sum, r) => sum + r.gmvMinor, 0)
  const tgoGmvMinor = rows.filter((r) => r.mode === 'TGO').reduce((sum, r) => sum + r.gmvMinor, 0)
  const penaltyMinor = rows.reduce((sum, r) => sum + r.commissionPenaltyMinor, 0)
  const lostSalesMinor = rows.reduce((sum, r) => sum + r.lostSalesMinor, 0)
  const totalOfflineMinutes = rows.reduce((sum, r) => sum + r.offlineMinutes, 0)

  const byBrandMap = new Map<string, ForensicReport['byBrand'][number]>()
  for (const row of rows) {
    const cur = byBrandMap.get(row.brandId) ?? {
      brandId: row.brandId,
      brandNameEn: row.brandNameEn,
      brandNameAr: row.brandNameAr,
      offlineMinutes: 0,
      penaltyMinor: 0,
      impactMinor: 0,
    }
    cur.offlineMinutes += row.offlineMinutes
    cur.penaltyMinor += row.commissionPenaltyMinor
    cur.impactMinor += row.financialImpactMinor
    byBrandMap.set(row.brandId, cur)
  }

  const hourMap = new Map<string, ForensicHourBucket>()
  for (const row of rows) {
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(row.scannedAt))
    const label = `${hour}:00`
    const cur = hourMap.get(label) ?? { hourLabel: label, offlineMinutes: 0, tgoForcedCount: 0, impactMinor: 0 }
    cur.offlineMinutes += row.offlineMinutes
    if (row.mode === 'TGO' && row.status !== 'online') cur.tgoForcedCount += 1
    cur.impactMinor += row.financialImpactMinor
    hourMap.set(label, cur)
  }

  const dayMap = new Map<string, ForensicDayBucket>()
  for (const row of rows) {
    const dayLabel = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(new Date(row.scannedAt))
    const cur = dayMap.get(dayLabel) ?? { dayLabel, offlineMinutes: 0, tgoForcedCount: 0, impactMinor: 0 }
    cur.offlineMinutes += row.offlineMinutes
    if (row.mode === 'TGO') cur.tgoForcedCount += 1
    cur.impactMinor += row.financialImpactMinor
    dayMap.set(dayLabel, cur)
  }

  return {
    period,
    generatedAt: at.toISOString(),
    dataAvailable: true,
    totalOfflineMinutes,
    tmpGmvMinor,
    tgoGmvMinor,
    penaltyMinor,
    lostSalesMinor,
    claimMinor: penaltyMinor + lostSalesMinor,
    byBrand: [...byBrandMap.values()].sort((a, b) => b.impactMinor - a.impactMinor),
    timeline: [...hourMap.values()].sort((a, b) => a.hourLabel.localeCompare(b.hourLabel)),
    weekdays: [...dayMap.values()],
  }
}

export function filterForensicRows(
  rows: ForensicRow[],
  scope: { brandId?: string | null; branchId?: string | null; platform?: string | null },
): ForensicRow[] {
  return rows.filter((row) => {
    if (scope.brandId && row.brandId !== scope.brandId) return false
    if (scope.branchId && row.branchId !== scope.branchId) return false
    if (scope.platform && row.platform !== scope.platform) return false
    return true
  })
}
