/**
 * Exclusive Instant Offline / TGO alerts for aggregator radar.
 * HARD LOCK: only EXCLUSIVE_RADAR_RECIPIENTS may receive radar alerts.
 * Email is server-to-inbox only (SMTP / FormSubmit) — never mailto / never popup.
 */
import { deliverWhatsApp } from '@/services/notification.service'
import { phoneDigits } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import {
  buildOperationalForensicReport,
  type BilingualOperationalReport,
} from '@/lib/reports/operational-forensic-report'
import {
  dispatchServerEmail,
  exclusiveRecipientEmails,
  getSmtpPublicStatus,
  REPORT_SUBJECT,
  type MailEngine,
  type ServerMailResult,
} from '@/lib/email/server-mail'
import {
  EXCLUSIVE_RADAR_EMAILS,
  EXCLUSIVE_RADAR_MOBILES,
  EXCLUSIVE_RADAR_RECIPIENTS,
} from '@/lib/vf-contact-directory'
import type { ForensicSnapshot } from '@/modules/governance/domain/forensic-radar'

export type RadarAlertKind = 'forced_offline' | 'busy_peak' | 'tgo_forced' | 'test' | 'daily_report'

export type RadarAlertPayload = {
  kind: RadarAlertKind
  brandName?: string
  branchName?: string
  platformName?: string
  zoneStatus?: string
  logisticsMode?: string
  detailAr: string
}

export type RadarAlertChannelResult = {
  recipientId: string
  name: string
  email: string
  mobile: string
  whatsapp: { ok: boolean; mode: string }
  telegram: { ok: boolean }
  emailChannel: {
    ok: boolean
    engine: MailEngine
    message: string
    error?: string
  }
}

function assertExclusiveMobile(mobile: string): string {
  const digits = phoneDigits(mobile)
  const local = digits.startsWith('965') ? digits.slice(3) : digits
  if (!EXCLUSIVE_RADAR_MOBILES.has(local) && !EXCLUSIVE_RADAR_MOBILES.has(digits)) {
    throw new Error(`Radar alert blocked: mobile ${mobile} is not an exclusive recipient`)
  }
  return digits
}

function assertExclusiveEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!EXCLUSIVE_RADAR_EMAILS.has(normalized)) {
    throw new Error(`Radar alert blocked: email ${email} is not an exclusive recipient`)
  }
  return email.trim()
}

/** Kuwait peak hours: 12:00–15:00 and 18:00–23:00 Asia/Kuwait. */
export function isKuwaitPeakHours(at = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: 'numeric', hour12: false }).format(at),
  )
  return (hour >= 12 && hour < 15) || (hour >= 18 && hour < 23)
}

export function buildRadarAlertText(payload: RadarAlertPayload): string {
  const kindLabel =
    payload.kind === 'forced_offline'
      ? 'Forced Offline'
      : payload.kind === 'busy_peak'
        ? 'Busy / Reduced Coverage'
        : payload.kind === 'tgo_forced'
          ? 'TGO Forced Switch (17%)'
          : payload.kind === 'daily_report'
            ? 'Detailed Daily Operational & Forensic Report'
            : 'Test Alert'
  return [
    '🚨 AetherBI · Venture Foods Aggregator Radar',
    `النوع: ${kindLabel}`,
    payload.brandName ? `البراند: ${payload.brandName}` : null,
    payload.branchName ? `الفرع: ${payload.branchName}` : null,
    payload.platformName ? `المنصة: ${payload.platformName}` : null,
    payload.zoneStatus ? `حالة النطاق: ${payload.zoneStatus}` : null,
    payload.logisticsMode ? `اللوجستيات: ${payload.logisticsMode}` : null,
    payload.detailAr,
    'مستلم معتمد فقط — Peak Hours Instant Alert',
    new Date().toISOString(),
  ]
    .filter(Boolean)
    .join('\n')
}

/** WhatsApp / Telegram hard limit ~4096; keep margin for encoding. */
const MESSAGE_CHUNK = 3500

export function chunkReportText(text: string, max = MESSAGE_CHUNK): string[] {
  if (text.length <= max) return [text]
  const parts: string[] = []
  let rest = text
  let index = 1
  const totalHint = Math.ceil(text.length / max)
  while (rest.length > 0) {
    if (rest.length <= max) {
      parts.push(totalHint > 1 ? `(${index}/${totalHint})\n${rest}` : rest)
      break
    }
    let cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.5) cut = max
    const slice = rest.slice(0, cut)
    parts.push(`(${index}/${totalHint})\n${slice}`)
    rest = rest.slice(cut).replace(/^\n+/, '')
    index += 1
  }
  return parts
}

async function sendTelegramBroadcast(text: string): Promise<boolean> {
  try {
    const row = await prisma.notificationSetting.findUnique({ where: { id: 'default' } })
    if (!row?.telegramBotToken || !row.telegramChatId) return false
    const response = await fetch(`https://api.telegram.org/bot${row.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: row.telegramChatId, text }),
      signal: AbortSignal.timeout(12000),
    })
    return response.ok
  } catch (error) {
    logger.warn('radar_telegram_failed', { ...((error instanceof Error && { errorMessage: error.message }) || {}) })
    return false
  }
}

/**
 * Dispatches a short radar alert to the three exclusive recipients only.
 * Email uses server-to-inbox engines (never mailto).
 */
export async function dispatchExclusiveRadarAlert(
  payload: RadarAlertPayload,
): Promise<{ text: string; channels: RadarAlertChannelResult[]; telegramBroadcast: boolean; email: ServerMailResult }> {
  const text = buildRadarAlertText(payload)
  const subject =
    payload.kind === 'test'
      ? 'AetherBI Test · Instant Radar Alert'
      : `AetherBI Radar · ${payload.kind.toUpperCase()} · ${payload.branchName || payload.brandName || 'VF'}`

  const mentionBlock = EXCLUSIVE_RADAR_RECIPIENTS.map((r) => `• ${r.name} (${r.mobileDisplay})`).join('\n')
  const telegramBroadcast = await sendTelegramBroadcast(`${text}\n\nالمعتمدون:\n${mentionBlock}`)
  const email = await dispatchServerEmail({ subject, text })

  const channels: RadarAlertChannelResult[] = []
  for (const recipient of EXCLUSIVE_RADAR_RECIPIENTS) {
    const digits = assertExclusiveMobile(recipient.mobileE164)
    assertExclusiveEmail(recipient.email)
    let waOk = false
    let waMode = 'SERVER'
    try {
      const result = await deliverWhatsApp(recipient.mobileE164, text)
      waOk = result.ok
      waMode = result.ok ? 'DELIVERED' : 'FAILED'
    } catch {
      waOk = false
      waMode = 'FAILED'
    }

    channels.push({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      mobile: recipient.mobileDisplay,
      whatsapp: { ok: waOk, mode: waMode },
      telegram: { ok: telegramBroadcast },
      emailChannel: {
        ok: email.ok,
        engine: email.engine,
        message: email.message,
        error: email.error,
      },
    })

    logger.info('radar_alert_dispatched', {
      recipientId: recipient.id,
      kind: payload.kind,
      mobile: digits,
      email: recipient.email,
      emailEngine: email.engine,
      emailOk: email.ok,
    })
  }

  return { text, channels, telegramBroadcast, email }
}

export function listExclusiveRadarRecipients() {
  return EXCLUSIVE_RADAR_RECIPIENTS.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    email: r.email,
    mobile: r.mobileDisplay,
    mobileE164: r.mobileE164,
    ext: r.ext,
    direct: r.direct ?? null,
    channels: 'Active: Server Email + WhatsApp + Telegram' as const,
  }))
}

/** Guard used by any future alert fan-out — rejects non-exclusive destinations. */
export function assertRadarDestination(input: { email?: string; mobile?: string }) {
  if (input.email) assertExclusiveEmail(input.email)
  if (input.mobile) assertExclusiveMobile(input.mobile)
}

export type OperationalReportDispatchResult = {
  report: BilingualOperationalReport
  channels: RadarAlertChannelResult[]
  telegramBroadcast: boolean
  chunksSent: number
  email: ServerMailResult
  smtp: Awaited<ReturnType<typeof getSmtpPublicStatus>>
  delivery: {
    ok: boolean
    engine: MailEngine
    subject: string
    recipients: string[]
    message: string
    error?: string
    messageId?: string
    response?: string
  }
}

/**
 * Dispatch the full Structured Monospace Daily Operational & Forensic Report
 * to the three exclusive inboxes via server SMTP or FormSubmit (zero popup).
 */
export async function dispatchExclusiveOperationalReport(
  snapshots: ForensicSnapshot[],
  at = new Date(),
): Promise<OperationalReportDispatchResult> {
  const report = buildOperationalForensicReport(snapshots, at)
  const subject = `${REPORT_SUBJECT} · ${report.sections.kuwaitDate}`
  const header = [
    'AetherBI · Venture Foods — DETAILED DAILY OPERATIONAL & FORENSIC REPORT (ALL 7 BRANDS & 9 ACTIVE BRANCHES — END OF DAY SUMMARY 11:59 PM KW TIME)',
    `SUMMARY: ${report.sections.critical.length} CRITICAL | ${report.sections.watch.length} WATCH | ${report.sections.clean.length} CLEAN`,
    `Kuwait: ${report.sections.kuwaitDate} ${report.sections.kuwaitTime}`,
    '',
  ].join('\n')

  const payloadText = `${header}${report.en}\n\n==== ARABIC ====\n\n${report.ar}`
  const waChunks = chunkReportText(`${header}${report.en}`)

  const email = await dispatchServerEmail({ subject, text: payloadText })
  const smtp = await getSmtpPublicStatus()

  let telegramBroadcast = false
  for (const chunk of waChunks.slice(0, 2)) {
    const ok = await sendTelegramBroadcast(chunk)
    telegramBroadcast = telegramBroadcast || ok
  }

  const channels: RadarAlertChannelResult[] = []
  let chunksSent = 0

  for (const recipient of EXCLUSIVE_RADAR_RECIPIENTS) {
    const digits = assertExclusiveMobile(recipient.mobileE164)
    assertExclusiveEmail(recipient.email)
    // WhatsApp remains optional background channel — never opens a browser tab.
    let waOk = false
    let waMode = 'SERVER'
    for (const chunk of waChunks.slice(0, 1)) {
      try {
        const result = await deliverWhatsApp(recipient.mobileE164, chunk)
        waOk = waOk || result.ok
        waMode = result.ok ? 'DELIVERED' : 'FAILED'
        chunksSent += 1
      } catch {
        waMode = 'FAILED'
      }
    }

    channels.push({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      mobile: recipient.mobileDisplay,
      whatsapp: { ok: waOk, mode: waMode },
      telegram: { ok: telegramBroadcast },
      emailChannel: {
        ok: email.ok,
        engine: email.engine,
        message: email.message,
        error: email.error,
      },
    })

    logger.info('operational_forensic_report_dispatched', {
      recipientId: recipient.id,
      mobile: digits,
      email: recipient.email,
      critical: report.sections.critical.length,
      watch: report.sections.watch.length,
      clean: report.sections.clean.length,
      emailEngine: email.engine,
      emailOk: email.ok,
    })
  }

  return {
    report,
    channels,
    telegramBroadcast,
    chunksSent,
    email,
    smtp,
    delivery: {
      ok: email.ok,
      engine: email.engine,
      subject,
      recipients: exclusiveRecipientEmails(),
      message: email.message,
      error: email.error,
      messageId: email.messageId,
      response: email.response,
    },
  }
}
