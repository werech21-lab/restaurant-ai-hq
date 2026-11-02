/**
 * Exclusive Instant Offline / TGO alerts for aggregator radar.
 * HARD LOCK: only EXCLUSIVE_RADAR_RECIPIENTS may receive radar alerts.
 */
import { deliverWhatsApp } from '@/services/notification.service'
import { phoneDigits, waLink } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import {
  buildOperationalForensicReport,
  type BilingualOperationalReport,
} from '@/lib/reports/operational-forensic-report'
import {
  EXCLUSIVE_RADAR_EMAILS,
  EXCLUSIVE_RADAR_MOBILES,
  EXCLUSIVE_RADAR_RECIPIENTS,
  type ExclusiveRadarRecipient,
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
  whatsapp: { ok: boolean; href: string; mode: string }
  telegram: { ok: boolean; href: string }
  emailChannel: { ok: boolean; href: string }
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

function telegramShareHref(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent('https://www.aetherbi.com/erp/aggregator-radar')}&text=${encodeURIComponent(text)}`
}

function mailtoHref(recipient: ExclusiveRadarRecipient, subject: string, body: string): string {
  const to = assertExclusiveEmail(recipient.email)
  const others = EXCLUSIVE_RADAR_RECIPIENTS.filter((r) => r.id !== recipient.id)
    .map((r) => assertExclusiveEmail(r.email))
    .join(',')
  return `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(others)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
 * Dispatches a radar alert to the three exclusive recipients only.
 * Never accepts arbitrary phone/email lists — recipients are hardcoded.
 */
export async function dispatchExclusiveRadarAlert(
  payload: RadarAlertPayload,
): Promise<{ text: string; channels: RadarAlertChannelResult[]; telegramBroadcast: boolean }> {
  const text = buildRadarAlertText(payload)
  const subject =
    payload.kind === 'test'
      ? 'AetherBI Test · Instant Radar Alert'
      : `AetherBI Radar · ${payload.kind.toUpperCase()} · ${payload.branchName || payload.brandName || 'VF'}`

  // Telegram ops channel once (mentions exclusive recipients by name)
  const mentionBlock = EXCLUSIVE_RADAR_RECIPIENTS.map((r) => `• ${r.name} (${r.mobileDisplay})`).join('\n')
  const telegramBroadcast = await sendTelegramBroadcast(`${text}\n\nالمعتمدون:\n${mentionBlock}`)

  const channels: RadarAlertChannelResult[] = []
  for (const recipient of EXCLUSIVE_RADAR_RECIPIENTS) {
    const digits = assertExclusiveMobile(recipient.mobileE164)
    const waHref = waLink(recipient.mobileE164, text)
    let waOk = false
    let waMode = 'CLICK'
    try {
      const result = await deliverWhatsApp(recipient.mobileE164, text)
      waOk = result.ok
      waMode = result.ok ? 'DELIVERED_OR_CLICK' : 'CLICK_FALLBACK'
    } catch {
      waOk = false
      waMode = 'CLICK_FALLBACK'
    }

    channels.push({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      mobile: recipient.mobileDisplay,
      whatsapp: { ok: waOk || Boolean(waHref), href: waHref, mode: waMode },
      telegram: { ok: telegramBroadcast, href: telegramShareHref(text) },
      emailChannel: { ok: true, href: mailtoHref(recipient, subject, text) },
    })

    logger.info('radar_alert_dispatched', {
      recipientId: recipient.id,
      kind: payload.kind,
      mobile: digits,
      email: recipient.email,
    })
  }

  return { text, channels, telegramBroadcast }
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
    channels: 'Active: WhatsApp + Telegram + Email' as const,
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
}

/**
 * Dispatch the full Structured Monospace Daily Operational & Forensic Report
 * to the three exclusive recipients only (WhatsApp + Telegram + Email mailto).
 */
export async function dispatchExclusiveOperationalReport(
  snapshots: ForensicSnapshot[],
  at = new Date(),
): Promise<OperationalReportDispatchResult> {
  const report = buildOperationalForensicReport(snapshots, at)
  const subject = `AetherBI · Daily Operational & Forensic Report · ${report.sections.kuwaitDate}`
  const header = [
    'AetherBI · Venture Foods — DETAILED DAILY OPERATIONAL & FORENSIC REPORT',
    `SUMMARY: ${report.sections.critical.length} CRITICAL | ${report.sections.watch.length} WATCH | ${report.sections.clean.length} CLEAN`,
    `Kuwait: ${report.sections.kuwaitDate} ${report.sections.kuwaitTime}`,
    '',
  ].join('\n')

  const payloadText = `${header}${report.en}`
  const chunks = chunkReportText(payloadText)
  const arChunks = chunkReportText(
    [
      'AetherBI · فنتشر فودز — التقرير التشغيلي والجنائي اليومي المفصل (عربي)',
      '',
      report.ar,
    ].join('\n'),
  )

  let telegramBroadcast = false
  for (const chunk of chunks) {
    const ok = await sendTelegramBroadcast(chunk)
    telegramBroadcast = telegramBroadcast || ok
  }
  // Arabic body as follow-up on Telegram when EN succeeded or settings exist.
  for (const chunk of arChunks.slice(0, 2)) {
    const ok = await sendTelegramBroadcast(chunk)
    telegramBroadcast = telegramBroadcast || ok
  }

  const channels: RadarAlertChannelResult[] = []
  let chunksSent = 0

  for (const recipient of EXCLUSIVE_RADAR_RECIPIENTS) {
    const digits = assertExclusiveMobile(recipient.mobileE164)
    const waHref = waLink(recipient.mobileE164, chunks[0] ?? payloadText)
    let waOk = false
    let waMode = 'CLICK'

    for (const chunk of [...chunks, ...arChunks.slice(0, 1)]) {
      try {
        const result = await deliverWhatsApp(recipient.mobileE164, chunk)
        waOk = waOk || result.ok
        waMode = result.ok ? 'DELIVERED_OR_CLICK' : 'CLICK_FALLBACK'
        chunksSent += 1
      } catch {
        waMode = 'CLICK_FALLBACK'
      }
    }

    channels.push({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      mobile: recipient.mobileDisplay,
      whatsapp: { ok: waOk || Boolean(waHref), href: waHref, mode: waMode },
      telegram: { ok: telegramBroadcast, href: telegramShareHref(chunks[0] ?? payloadText) },
      emailChannel: {
        ok: true,
        href: mailtoHref(recipient, subject, payloadText.slice(0, 1800)),
      },
    })

    logger.info('operational_forensic_report_dispatched', {
      recipientId: recipient.id,
      mobile: digits,
      email: recipient.email,
      critical: report.sections.critical.length,
      watch: report.sections.watch.length,
      clean: report.sections.clean.length,
      chunks: chunks.length,
    })
  }

  return { report, channels, telegramBroadcast, chunksSent }
}
