/**
 * Radar dispatch logs must not carry staff mobile numbers or e-mail addresses.
 * Captured output is swallowed (never printed), and assertions report booleans only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchExclusiveOperationalReport, dispatchExclusiveRadarAlert } from '@/lib/alerts'
import { EXCLUSIVE_RADAR_RECIPIENTS } from '@/lib/vf-contact-directory'
import { phoneDigits } from '@/lib/whatsapp'
import { buildForensicMatrix } from '@/modules/governance/domain/forensic-radar'

vi.mock('@/services/notification.service', () => ({
  deliverWhatsApp: vi.fn(async () => ({ ok: false })),
}))
vi.mock('@/lib/db', () => ({
  prisma: { notificationSetting: { findUnique: vi.fn(async () => null) } },
}))
vi.mock('@/lib/email/server-mail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/server-mail')>()
  return {
    ...actual,
    dispatchServerEmail: vi.fn(async () => ({ ok: false, engine: 'none', message: 'test' })),
    getSmtpPublicStatus: vi.fn(async () => ({ configured: false })),
  }
})

let captured = ''

function containsRawContact(text: string): { mobile: boolean; email: boolean } {
  return {
    mobile: EXCLUSIVE_RADAR_RECIPIENTS.some((r) => text.includes(phoneDigits(r.mobileE164))),
    email: EXCLUSIVE_RADAR_RECIPIENTS.some((r) => text.toLowerCase().includes(r.email.toLowerCase())),
  }
}

describe('radar dispatch logs mask staff contacts', () => {
  beforeEach(() => {
    captured = ''
    const swallow = (chunk: string | Uint8Array) => {
      captured += String(chunk)
      return true
    }
    vi.spyOn(process.stdout, 'write').mockImplementation(swallow as typeof process.stdout.write)
    vi.spyOn(process.stderr, 'write').mockImplementation(swallow as typeof process.stderr.write)
  })
  afterEach(() => vi.restoreAllMocks())

  it('operational forensic report: fails closed on empty input without leaking contacts', async () => {
    const res = await dispatchExclusiveOperationalReport([])
    expect(res.dispatched).toBe(false)
    expect(captured.includes('forensic_report_fail_closed_missing_odoo_data')).toBe(true)
    const leak = containsRawContact(captured)
    expect(leak.mobile, 'a raw recipient mobile reached the log').toBe(false)
    expect(leak.email, 'a raw recipient e-mail reached the log').toBe(false)
  })

  it('operational forensic report: one dispatch log per recipient when verified Odoo snapshot exists, contacts masked', async () => {
    const verifiedSnap = buildForensicMatrix(new Date('2026-11-02T15:30:00.000Z'), [
      {
        verifiedFromOdoo: true,
        brandId: 'CHINA-GARDEN',
        branchId: 'CG-ALKOUT',
        platform: 'Talabat',
        status: 'online',
        mode: 'TMP',
        gmvMinor: 45_000,
        tmpShareBps: 10_000,
        tgoShareBps: 0,
        offlineMinutes: 0,
      },
    ])
    await dispatchExclusiveOperationalReport([verifiedSnap])
    const lines = captured.split('\n').filter((l) => l.includes('operational_forensic_report_dispatched'))
    expect(lines.length).toBe(EXCLUSIVE_RADAR_RECIPIENTS.length)
    const leak = containsRawContact(captured)
    expect(leak.mobile, 'a raw recipient mobile reached the log').toBe(false)
    expect(leak.email, 'a raw recipient e-mail reached the log').toBe(false)
    for (const r of EXCLUSIVE_RADAR_RECIPIENTS) expect(captured.includes(`"recipientId":"${r.id}"`)).toBe(true)
    expect(lines.every((l) => /"mobile":"\*+\d{2}"/.test(l) && /"email":"[^"@]\*+@/.test(l))).toBe(true)
  })

  it('instant radar alert: contacts masked in the dispatch log', async () => {
    await dispatchExclusiveRadarAlert({ kind: 'test', detailAr: 'اختبار' })
    const lines = captured.split('\n').filter((l) => l.includes('radar_alert_dispatched'))
    expect(lines.length).toBe(EXCLUSIVE_RADAR_RECIPIENTS.length)
    const leak = containsRawContact(captured)
    expect(leak.mobile, 'a raw recipient mobile reached the log').toBe(false)
    expect(leak.email, 'a raw recipient e-mail reached the log').toBe(false)
  })
})
