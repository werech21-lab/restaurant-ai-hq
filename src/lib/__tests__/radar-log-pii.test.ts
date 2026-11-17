/**
 * Radar dispatch logs must not carry staff mobile numbers or e-mail addresses.
 * Captured output is swallowed (never printed), and assertions report booleans only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchExclusiveOperationalReport, dispatchExclusiveRadarAlert } from '@/lib/alerts'
import { EXCLUSIVE_RADAR_RECIPIENTS } from '@/lib/vf-contact-directory'
import { phoneDigits } from '@/lib/whatsapp'

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

  it('operational forensic report: one dispatch log per recipient, contacts masked', async () => {
    await dispatchExclusiveOperationalReport([])
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
