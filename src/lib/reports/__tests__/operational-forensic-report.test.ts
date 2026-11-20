import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const emailDispatchSpy = vi.fn(async () => ({
  ok: true,
  engine: 'smtp' as const,
  message: 'delivered',
}))

const whatsappSpy = vi.fn(async () => ({ ok: true }))
const systemNotificationCreateSpy = vi.fn(async () => ({ id: 'notif-1' }))

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
    systemNotification: {
      findFirst: vi.fn(async () => null),
      create: (...args: unknown[]) => {
        void args
        return systemNotificationCreateSpy()
      },
    },
  },
}))

import { dispatchExclusiveOperationalReport } from '@/lib/alerts'
import { logger } from '@/lib/logger'
import {
  buildOperationalForensicReport,
  classifyOperationalReport,
  renderOperationalReportText,
} from '@/lib/reports/operational-forensic-report'
import {
  FORENSIC_MISSING_DATA_REASON,
  buildForensicMatrix,
  type VerifiedForensicObservation,
} from '@/modules/governance/domain/forensic-radar'
import { clearForensicHistory } from '@/modules/governance/services/forensic-radar-service'
import { GET as radarAlertCronGet } from '@/app/api/aggregator-radar/alert/route'

const VERIFIED_REPORT_OBSERVATIONS: readonly VerifiedForensicObservation[] = [
  {
    verifiedFromOdoo: true,
    brandId: 'FARM-BROWN',
    branchId: 'FB-SALMIYA',
    platform: 'Talabat',
    status: 'forced_offline',
    mode: 'TGO',
    gmvMinor: 50_000,
    tmpShareBps: 0,
    tgoShareBps: 10_000,
    offlineMinutes: 150,
    prepMinutes: 25.4,
    rejectedOrders: 0,
  },
  {
    verifiedFromOdoo: true,
    brandId: 'SHAWARMA-TAHINA',
    branchId: 'ST-PROMENADE',
    platform: 'Deliveroo',
    status: 'busy_throttled',
    mode: 'TMP',
    gmvMinor: 35_000,
    tmpShareBps: 10_000,
    tgoShareBps: 0,
    offlineMinutes: 45,
    prepMinutes: 19.2,
    rejectedOrders: 1,
  },
  {
    verifiedFromOdoo: true,
    brandId: 'CHINA-GARDEN',
    branchId: 'CG-ALKOUT',
    platform: 'Talabat',
    status: 'online',
    mode: 'TMP',
    gmvMinor: 80_000,
    tmpShareBps: 10_000,
    tgoShareBps: 0,
    offlineMinutes: 0,
    prepMinutes: 14.5,
    rejectedOrders: 0,
  },
]

describe('operational-forensic-report & nightly fail-closed dispatch', () => {
  const at = new Date('2026-11-02T15:30:00.000Z') // Kuwait evening peak window

  beforeEach(() => {
    clearForensicHistory()
    emailDispatchSpy.mockClear()
    whatsappSpy.mockClear()
    systemNotificationCreateSpy.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns unavailable report (empty text, zeroed sections) when snapshots lack verified Odoo data', () => {
    const emptySnap = buildForensicMatrix(at)
    const report = buildOperationalForensicReport([emptySnap], at)
    expect(report.dataAvailable).toBe(false)
    expect(report.unavailableReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(report.en).toBe('')
    expect(report.ar).toBe('')
    expect(report.combined).toBe('')
    expect(report.sections.critical).toEqual([])
    expect(report.sections.watch).toEqual([])
    expect(report.sections.clean).toEqual([])
    expect(report.sections.penaltyMinor).toBe(0)
    expect(report.sections.recordedLostMinor).toBe(0)
  })

  it('dispatchExclusiveOperationalReport fails closed without complete real Odoo data: logs warning & sends zero emails', async () => {
    const warnSpy = vi.spyOn(logger, 'warn')
    const unverifiedSnap = buildForensicMatrix(at)

    const resEmpty = await dispatchExclusiveOperationalReport([], at)
    expect(resEmpty.dispatched).toBe(false)
    expect(resEmpty.alerted).toBe(false)
    expect(resEmpty.skippedReason).toBe(FORENSIC_MISSING_DATA_REASON)
    expect(resEmpty.channels).toEqual([])

    const resUnverified = await dispatchExclusiveOperationalReport([unverifiedSnap], at)
    expect(resUnverified.dispatched).toBe(false)
    expect(resUnverified.alerted).toBe(false)
    expect(resUnverified.skippedReason).toBe(FORENSIC_MISSING_DATA_REASON)

    // Mixed complete + incomplete snapshots must also fail closed
    const verifiedSnap = buildForensicMatrix(at, VERIFIED_REPORT_OBSERVATIONS)
    const resMixed = await dispatchExclusiveOperationalReport([verifiedSnap, unverifiedSnap], at)
    expect(resMixed.dispatched).toBe(false)
    expect(resMixed.alerted).toBe(false)

    expect(warnSpy).toHaveBeenCalledWith(
      'forensic_report_fail_closed_missing_odoo_data',
      expect.objectContaining({ reason: FORENSIC_MISSING_DATA_REASON }),
    )
    expect(emailDispatchSpy).not.toHaveBeenCalled()
    expect(whatsappSpy).not.toHaveBeenCalled()
  })

  it('nightly Vercel cron GET /api/aggregator-radar/alert fails closed when verified Odoo telemetry is unavailable', async () => {
    const prevSecret = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'test-cron-secret-boudi-3'
    const warnSpy = vi.spyOn(logger, 'warn')
    try {
      const req = new NextRequest('https://aetherbi.com/api/aggregator-radar/alert', {
        method: 'GET',
        headers: { authorization: 'Bearer test-cron-secret-boudi-3' },
      })
      const res = await radarAlertCronGet(req)
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        ok: boolean
        skipped: boolean
        alerted: boolean
        dispatched: boolean
        skippedReason: string
      }
      expect(body.ok).toBe(true)
      expect(body.skipped).toBe(true)
      expect(body.alerted).toBe(false)
      expect(body.dispatched).toBe(false)
      expect(body.skippedReason).toBe(FORENSIC_MISSING_DATA_REASON)
      expect(warnSpy).toHaveBeenCalledWith(
        'forensic_report_fail_closed_missing_odoo_data',
        expect.objectContaining({ reason: FORENSIC_MISSING_DATA_REASON }),
      )
      expect(emailDispatchSpy).not.toHaveBeenCalled()
      expect(systemNotificationCreateSpy).not.toHaveBeenCalled()
    } finally {
      process.env.CRON_SECRET = prevSecret
    }
  })

  it('is deterministic for verified Odoo snapshots and renders Growdash-style EN + AR sections without hashed numbers', () => {
    const snap = buildForensicMatrix(at, VERIFIED_REPORT_OBSERVATIONS)
    const a = buildOperationalForensicReport([snap], at)
    const b = buildOperationalForensicReport([snap], at)
    expect(a.dataAvailable).toBe(true)
    expect(a.en).toBe(b.en)
    expect(a.ar).toBe(b.ar)
    expect(a.sections.critical).toHaveLength(1)
    expect(a.sections.watch).toHaveLength(1)
    expect(a.sections.clean).toHaveLength(1)

    const sections = classifyOperationalReport([snap], at)
    const text = renderOperationalReportText(sections, 'en')
    expect(text).toContain('DAILY OPERATIONAL & FORENSIC REPORT — VENTURE FOODS')
    expect(text).toContain('1. CRITICAL ISSUES')
    expect(text).toContain('2. WATCH LIST')
    expect(text).toContain('3. TALABAT & AGGREGATORS COMMISSION AUDIT')
    expect(text).toContain('4. CLEAN BRANCHES')
    expect(text).toContain('Account 101513')
    expect(text).toContain('Account 101512')
    expect(text).toContain('Sec@venturefoodskw.com')
    expect(text).toContain('operations@venturefoodskw.com')
    expect(text).toContain('abdelrahmanm@venturefoodskw.com')
    expect(text).toContain('https://aetherbi.com/erp/aggregator-radar')
    expect(text).toContain('SUMMARY:')
    expect(text).not.toContain('Est.')

    expect(a.ar).toContain('التقرير التشغيلي والجنائي اليومي المفصل')
    expect(a.ar).toContain('Sec@venturefoodskw.com')
    expect(a.combined).toContain(a.en)
    expect(a.combined).toContain(a.ar)

    const reportSrc = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/reports/operational-forensic-report.ts'),
      'utf8',
    )
    expect(reportSrc).not.toContain('function hash(')
    expect(reportSrc).not.toContain('dailyOfflineMinutes(')
  })
})
