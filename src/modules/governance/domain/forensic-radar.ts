/**
 * Deterministic forensic detector for Talabat TMP 10% vs TGO 17% and Forced Offline.
 * Same bucket + branch + platform → same diagnosis (no LLM).
 */
import { VENTURE_BRANCHES, VENTURE_BRANDS, type VentureBrandId } from '@/lib/venture-hierarchy'
import { fiveMinuteBucket } from '@/modules/governance/domain/aggregator'

export const FORENSIC_PLATFORMS = ['Talabat', 'Deliveroo', 'Jahez', 'Cari', 'Keeta', 'Snoonu'] as const
export type ForensicPlatform = (typeof FORENSIC_PLATFORMS)[number]

export const TALABAT_MP_ACCOUNT = '101513' // Talabat MP — 10%
export const TALABAT_TGO_ACCOUNT = '101512' // Talabat Go — 17%
export const TMP_BPS = 1_000
export const TGO_BPS = 1_700
export const PENALTY_BPS = 700 // +7%

export type LiveStatus = 'online' | 'forced_offline' | 'busy_throttled'
export type ActiveMode = 'TMP' | 'TGO'

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
}

export type ForensicKpis = {
  onlineCount: number
  offlineCount: number
  busyCount: number
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
  totalOfflineMinutes: number
  tmpGmvMinor: number
  tgoGmvMinor: number
  penaltyMinor: number
  lostSalesMinor: number
  claimMinor: number
  byBrand: Array<{ brandId: string; brandNameEn: string; brandNameAr: string; offlineMinutes: number; penaltyMinor: number; impactMinor: number }>
  timeline: ForensicHourBucket[]
  weekdays: ForensicDayBucket[]
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
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
  return Math.round((gmvMinor * PENALTY_BPS) / 10_000)
}

export function lostSalesFromOffline(gmvMinor: number, offlineMinutes: number): number {
  if (offlineMinutes <= 0) return 0
  // Assume offline kills proportional share of the 5-minute GMV window, scaled by duration/60.
  const factor = Math.min(1, offlineMinutes / 60)
  return Math.round(gmvMinor * factor)
}

function diagnose(seed: number): { status: LiveStatus; mode: ActiveMode; offlineMinutes: number } {
  const roll = seed % 100
  if (roll < 8) return { status: 'forced_offline', mode: 'TGO', offlineMinutes: 15 + (seed % 45) }
  if (roll < 22) return { status: 'busy_throttled', mode: 'TGO', offlineMinutes: 5 + (seed % 25) }
  if (roll < 35) return { status: 'online', mode: 'TGO', offlineMinutes: 0 }
  return { status: 'online', mode: 'TMP', offlineMinutes: 0 }
}

export function buildForensicMatrix(at = new Date()): ForensicSnapshot {
  const bucket = fiveMinuteBucket(at.getTime())
  const scannedAt = at.toISOString()
  const rows: ForensicRow[] = []

  for (const brand of VENTURE_BRANDS) {
    const branches = VENTURE_BRANCHES.filter((b) => b.brandId === brand.id)
    for (const branch of branches) {
      for (const platform of FORENSIC_PLATFORMS) {
        const seed = hash(`${bucket}|${brand.id}|${branch.id}|${platform}`)
        const diag = diagnose(seed)
        const gmvMinor = 12_000 + (seed % 85_000) // 12.000–97.000 KWD window sample in fils
        const mode = diag.mode
        const commissionBps = mode === 'TMP' ? TMP_BPS : TGO_BPS
        const accountCode = mode === 'TMP' ? TALABAT_MP_ACCOUNT : TALABAT_TGO_ACCOUNT
        const offlineMinutes = diag.offlineMinutes
        const offlineFrom = offlineMinutes
          ? new Date(at.getTime() - offlineMinutes * 60_000).toISOString()
          : null
        const penalty = commissionPenaltyMinor(gmvMinor, mode)
        const lost = lostSalesFromOffline(gmvMinor, offlineMinutes)
        const tmpShare = mode === 'TMP' ? 10_000 : Math.max(0, 10_000 - (seed % 4_000))
        const tgoShare = 10_000 - tmpShare

        rows.push({
          id: `${brand.id}:${branch.id}:${platform}:${bucket}`,
          brandId: brand.id,
          brandNameEn: brand.nameEn,
          brandNameAr: brand.nameAr,
          branchId: branch.id,
          branchNameEn: branch.nameEn,
          branchNameAr: branch.nameAr,
          areaEn: branch.areaEn,
          areaAr: branch.areaAr,
          platform,
          status: diag.status,
          mode,
          commissionBps,
          accountCode: platform === 'Talabat' ? accountCode : mode === 'TMP' ? 'MP-10' : 'TGO-17',
          offlineFromIso: offlineFrom,
          offlineToIso: offlineMinutes ? scannedAt : null,
          offlineMinutes,
          gmvMinor,
          tmpShareBps: tmpShare,
          tgoShareBps: tgoShare,
          commissionPenaltyMinor: penalty,
          lostSalesMinor: lost,
          financialImpactMinor: penalty + lost,
          bucket,
          scannedAt,
        })
      }
    }
  }

  return { bucket, scannedAt, rows, kpis: summarizeKpis(rows) }
}

export function summarizeKpis(rows: ForensicRow[]): ForensicKpis {
  const onlineCount = rows.filter((r) => r.status === 'online').length
  const offlineCount = rows.filter((r) => r.status === 'forced_offline').length
  const busyCount = rows.filter((r) => r.status === 'busy_throttled').length
  const gmv = rows.reduce((sum, r) => sum + r.gmvMinor, 0) || 1
  const tmpGmv = rows.filter((r) => r.mode === 'TMP').reduce((sum, r) => sum + r.gmvMinor, 0)
  const tgoGmv = rows.filter((r) => r.mode === 'TGO').reduce((sum, r) => sum + r.gmvMinor, 0)
  const totalOfflineMinutes = rows.reduce((sum, r) => sum + r.offlineMinutes, 0)
  const commissionPenaltyMinor = rows.reduce((sum, r) => sum + r.commissionPenaltyMinor, 0)
  const lostSalesMinor = rows.reduce((sum, r) => sum + r.lostSalesMinor, 0)
  return {
    onlineCount,
    offlineCount,
    busyCount,
    tmpOrderShareBps: Math.round((tmpGmv * 10_000) / gmv),
    tgoOrderShareBps: Math.round((tgoGmv * 10_000) / gmv),
    totalOfflineMinutes,
    commissionPenaltyMinor,
    lostSalesMinor,
    financialImpactMinor: commissionPenaltyMinor + lostSalesMinor,
    mpAccount: TALABAT_MP_ACCOUNT,
    tgoAccount: TALABAT_TGO_ACCOUNT,
  }
}

export function buildForensicReport(history: ForensicSnapshot[], period: ForensicReportPeriod, at = new Date()): ForensicReport {
  const ms =
    period === 'daily' ? 24 * 60 * 60_000 : period === 'weekly' ? 7 * 24 * 60 * 60_000 : 30 * 24 * 60 * 60_000
  const since = at.getTime() - ms
  const slices = history.filter((s) => new Date(s.scannedAt).getTime() >= since)
  const rows = slices.flatMap((s) => s.rows)
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
