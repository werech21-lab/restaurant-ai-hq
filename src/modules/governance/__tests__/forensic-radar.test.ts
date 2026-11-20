import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const emailDispatchSpy = vi.fn(async () => ({
  ok: true,
  engine: 'smtp' as const,
  message: 'delivered',
}))

const whatsappSpy = vi.fn(async () => ({ ok: true }))

vi.mock('@/lib/email/server-mail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/server-mail')>()
  return {
    ...actual,
    dispatchServerEmail: (...args: Parameters<typeof actual.dispatchServerEmail>) => {
      void args
      return emailDispatchSpy()
    },
    getSmtpPublicStatus: vi.fn(async () => ({
      configured: false,
      enabled: false,
      from: 'sec@venturefoodskw.com',
      host: 'smtp.gmail.com',
      port: 465,
      provider: 'google_workspace' as const,
    })),
  }
})

vi.mock('@/services/notification.service', () => ({
  deliverWhatsApp: () => whatsappSpy(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    notificationSetting: { findUnique: vi.fn(async () => null) },
  },
}))

import type { AuthContext } from '@/lib/auth/context'
import { logger } from '@/lib/logger'
import {
  FORENSIC_MISSING_DATA_REASON,
  PENALTY_BPS,
  buildForensicMatrix,
  buildForensicReport,
  cleanBranchLabel,
  commissionPenaltyMinor,
  displayBrandName,
  filterForensicRows,
  formatKwdMinor,
  lostSalesFromOffline,
  summarizeKpis,
  type VerifiedForensicObservation,
} from '@/modules/governance/domain/forensic-radar'
import {
  clearForensicHistory,
  forensicBoard,
  runForensicScan,
} from '@/modules/governance/services/forensic-radar-service'

const VERIFIED_SAMPLE: readonly VerifiedForensicObservation[] = [
  {
    verifiedFromOdoo: true,
    brandId: 'CHINA-GARDEN',
    branchId: 'CG-ALKOUT',
    platform: 'Talabat',
    status: 'online',
    mode: 'TMP',
    gmvMinor: 60_000,
    tmpShareBps: 10_000,
    tgoShareBps: 0,
    offlineMinutes: 0,
  },
  {
    verifiedFromOdoo: true,
    brandId: 'FARM-BROWN',
    branchId: 'FB-SALMIYA',
    platform: 'Talabat',
    status: 'forced_offline',
    mode: 'TGO',
    gmvMinor: 40_000,
    tmpShareBps: 0,
    tgoShareBps: 10_000,
    offlineMinutes: 30,
  },
]

const ADMIN_AUTH: AuthContext = {
  userId: 'u-ops-1',
  tenantId: 't-vf',
  role: 'admin',
  permissions: new Set<string>(),
} as unknown as AuthContext

describe('forensic-radar domain & fail-closed service', () => {
  beforeEach(() => {
    clearForensicHistory()
    emailDispatchSpy.mockClear()
    whatsappSpy.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('produces zero invented GMV, zero incidents, and dataAvailable=false when called without verified Odoo observations', () => {
    const at = new Date('2026-11-02T10:00:00.000Z')
    const snap = buildForensicMatrix(at)
    expect(snap.dataAvailable).toBe(false)
    expect(snap.unavailableReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(snap.rows).toEqual([])
    expect(snap.kpis).toMatchObject({
      onlineCount: 0,
      offlineCount: 0,
      busyCount: 0,
      totalGmvMinor: 0,
      tmpOrderShareBps: 0,
      tgoOrderShareBps: 0,
      totalOfflineMinutes: 0,
      commissionPenaltyMinor: 0,
      lostSalesMinor: 0,
      financialImpactMinor: 0,
    })

    const report = buildForensicReport([snap], 'daily', at)
    expect(report.dataAvailable).toBe(false)
    expect(report.unavailableReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(report.tmpGmvMinor).toBe(0)
    expect(report.tgoGmvMinor).toBe(0)
    expect(report.penaltyMinor).toBe(0)
    expect(report.lostSalesMinor).toBe(0)
    expect(report.claimMinor).toBe(0)
    expect(report.byBrand).toEqual([])
  })

  it('fails closed if any observation is unverified, negative, NaN, or mismatched with Venture Foods hierarchy', () => {
    const at = new Date('2026-11-02T10:00:00.000Z')
    const unverified = [
      {
        ...VERIFIED_SAMPLE[0]!,
        verifiedFromOdoo: false as unknown as true,
      },
    ]
    expect(buildForensicMatrix(at, unverified).dataAvailable).toBe(false)
    expect(buildForensicMatrix(at, unverified).rows).toEqual([])

    const negativeGmv: VerifiedForensicObservation[] = [
      { ...VERIFIED_SAMPLE[0]!, gmvMinor: -500 },
    ]
    expect(buildForensicMatrix(at, negativeGmv).dataAvailable).toBe(false)

    const wrongBrandBranch: VerifiedForensicObservation[] = [
      { ...VERIFIED_SAMPLE[0]!, brandId: 'FARM-BROWN', branchId: 'CG-ALKOUT' },
    ]
    expect(buildForensicMatrix(at, wrongBrandBranch).dataAvailable).toBe(false)
  })

  it('is deterministic and exact when supplied real verified Odoo observations', () => {
    const at = new Date('2026-11-02T10:00:00.000Z')
    const a = buildForensicMatrix(at, VERIFIED_SAMPLE)
    const b = buildForensicMatrix(at, VERIFIED_SAMPLE)
    expect(a.dataAvailable).toBe(true)
    expect(a.bucket).toBe(b.bucket)
    expect(a.rows).toHaveLength(2)
    expect(a.rows[0]?.id).toBe(b.rows[0]?.id)
    expect(a.kpis.totalGmvMinor).toBe(100_000)
    expect(a.kpis.tmpOrderShareBps).toBe(6_000)
    expect(a.kpis.tgoOrderShareBps).toBe(4_000)
    expect(a.kpis.commissionPenaltyMinor).toBe(commissionPenaltyMinor(40_000, 'TGO'))
    expect(a.kpis.lostSalesMinor).toBe(lostSalesFromOffline(40_000, 30))
    expect(a.kpis.financialImpactMinor).toBe(b.kpis.financialImpactMinor)
  })

  it('charges +7% penalty on TGO GMV, computes proportional offline loss, and summarizes KPIs cleanly', () => {
    expect(commissionPenaltyMinor(100_000, 'TGO')).toBe(Math.round((100_000 * PENALTY_BPS) / 10_000))
    expect(commissionPenaltyMinor(100_000, 'TMP')).toBe(0)
    expect(lostSalesFromOffline(60_000, 30)).toBe(30_000)
    expect(lostSalesFromOffline(60_000, 0)).toBe(0)
    expect(summarizeKpis([]).tmpOrderShareBps).toBe(0)
    expect(summarizeKpis([]).tgoOrderShareBps).toBe(0)
  })

  it('formats KWD with three decimals, cleans branch labels, and filters verified rows by brand scope', () => {
    expect(formatKwdMinor(1234)).toBe('1.234 KWD')
    expect(cleanBranchLabel('Farm Brown /Debit', 'Al-Kout Mall')).toBe('Al-Kout Mall')
    expect(displayBrandName('Karak Cafeteria', 'كرك كافتيريا', 'en')).toBe('Karak Cafeteria')

    const snap = buildForensicMatrix(new Date('2026-11-02T12:00:00.000Z'), VERIFIED_SAMPLE)
    const china = filterForensicRows(snap.rows, { brandId: 'CHINA-GARDEN' })
    expect(china).toHaveLength(1)
    expect(china[0]?.brandId).toBe('CHINA-GARDEN')
  })

  it('runForensicScan fails closed without verified Odoo data: logs warning and sends zero emails/WhatsApp', async () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    const result = await runForensicScan(ADMIN_AUTH, { alert: true })

    expect(result.alerted).toBe(false)
    expect(result.dispatched).toBe(false)
    expect(result.recorded).toBe(0)
    expect(result.skippedReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(result.snapshot.dataAvailable).toBe(false)
    expect(result.rows).toEqual([])
    expect(warnSpy).toHaveBeenCalledWith(
      'forensic_report_fail_closed_missing_odoo_data',
      expect.objectContaining({ reason: FORENSIC_MISSING_DATA_REASON }),
    )
    expect(emailDispatchSpy).not.toHaveBeenCalled()
    expect(whatsappSpy).not.toHaveBeenCalled()
    expect(forensicBoard().snapshot.dataAvailable).toBe(false)
  })

  it('purges hash/diagnose/synthetic GMV generators from forensic-radar.ts source', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/modules/governance/domain/forensic-radar.ts'),
      'utf8',
    )
    expect(src).not.toContain('function diagnose(')
    expect(src).not.toContain('function hash(')
    expect(src).not.toContain('12_000 +')
    expect(src).not.toContain('85_000')
    expect(src).not.toMatch(/reduce\([^)]*\)\s*\|\|\s*1/)
  })
})
