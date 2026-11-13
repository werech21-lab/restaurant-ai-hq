import 'server-only'

import nodemailer from 'nodemailer'
import { normalizeSmtpPass } from '@/lib/email/server-mail'

if (typeof window !== 'undefined') {
  throw new Error(
    'Security violation: src/lib/odoo-staleness-notifier.ts is strictly server-only.',
  )
}

export type StalenessAlertChannel = 'email' | 'whatsapp'

export interface OdooStalenessAdminTelemetry {
  adminAlertDispatched: boolean
  channels: ['email', 'whatsapp']
  deduplicated?: boolean
  recipientEmail?: string
  lastDispatchedAt?: string | null
}

export interface OdooStalenessDispatchInput {
  hoursSinceLatestRecord: number
  isStaleOver24h: boolean
  latestRecordAt: string
  kuwaitTimestamp?: string
  referenceNowMs?: number
  /** Used in automated tests to exercise live dispatch without real network calls. */
  dryRun?: boolean
}

const DEFAULT_ADMIN_ALERT_EMAIL = 'sec@venturefoodskw.com'
export const STALENESS_ALERT_DEDUP_MS = 24 * 60 * 60 * 1000
const WEBHOOK_TIMEOUT_MS = 4_000

let lastAlertDispatchedAtMs = 0
let lastAlertRecordIso = ''

export function resetOdooStalenessAlertDedupForTests(): void {
  lastAlertDispatchedAtMs = 0
  lastAlertRecordIso = ''
}

function resolveAdminRecipientEmail(): string {
  const envEmail = (process.env.ODOO_STALE_ADMIN_EMAIL ?? '').trim().toLowerCase()
  return envEmail || DEFAULT_ADMIN_ALERT_EMAIL
}

async function sendResendOrSmtpEmail(payload: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<boolean> {
  const resendKey = (process.env.RESEND_API_KEY ?? '').trim()
  if (resendKey) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
    try {
      const fromAddr =
        (process.env.RESEND_FROM_EMAIL ?? '').trim() ||
        `Aether BI Watchdog <${DEFAULT_ADMIN_ALERT_EMAIL}>`
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddr,
          to: [payload.to],
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        }),
        signal: controller.signal,
      })
      if (res.ok) return true
    } catch {
      // fall through to SMTP fallback
    } finally {
      clearTimeout(timer)
    }
  }

  const smtpPass = normalizeSmtpPass(
    process.env.SMTP_PASS || process.env.RADAR_SMTP_PASS || '',
  )
  if (!smtpPass) {
    return false
  }

  try {
    const smtpUser =
      (process.env.SMTP_USER || process.env.RADAR_SMTP_USER || DEFAULT_ADMIN_ALERT_EMAIL)
        .trim()
        .toLowerCase() || DEFAULT_ADMIN_ALERT_EMAIL
    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim()
    const port = Number(process.env.SMTP_PORT || 465) || 465
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: WEBHOOK_TIMEOUT_MS,
      socketTimeout: WEBHOOK_TIMEOUT_MS,
    })
    await transporter.sendMail({
      from: `"Aether BI Odoo Watchdog" <${smtpUser}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    })
    return true
  } catch {
    return false
  }
}

async function sendWhatsAppWebhookAlert(payload: {
  recipient: string
  hoursSinceLatestRecord: number
  latestRecordAt: string
  kuwaitTimestamp: string
  triggeredAtIso: string
}): Promise<boolean> {
  const webhookUrl = (
    process.env.ODOO_STALE_WHATSAPP_WEBHOOK_URL ||
    process.env.WHATSAPP_ALERT_WEBHOOK_URL ||
    ''
  ).trim()
  if (!webhookUrl) return false

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'whatsapp',
        event: 'odoo_data_stale_over_24h',
        recipient: payload.recipient,
        hoursSinceLatestRecord: payload.hoursSinceLatestRecord,
        latestRecordAt: payload.latestRecordAt,
        kuwaitTimestamp: payload.kuwaitTimestamp,
        triggeredAt: payload.triggeredAtIso,
        messageEn: `[Aether BI Admin Alert] Odoo 17 POS feed is ${payload.hoursSinceLatestRecord}h old (last receipt: ${payload.kuwaitTimestamp}). Automatic 15-min sync is retrying.`,
        messageAr: `[تنبيه مسؤول النظام — Aether BI] مضى ${payload.hoursSinceLatestRecord} ساعة على آخر فاتورة أودو 17 (${payload.kuwaitTimestamp}). يرجى التحقق من اتصال الخدمة.`,
      }),
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Evaluates Odoo 17 data freshness and dispatches a deduplicated (1x per 24h window)
 * structured Email + WhatsApp alert strictly to the system administrator (`sec@venturefoodskw.com`)
 * whenever `hoursSinceLatestRecord > 24`.
 */
export async function dispatchAdminStalenessAlertIfNeeded(
  input: OdooStalenessDispatchInput,
): Promise<OdooStalenessAdminTelemetry> {
  const nowMs = input.referenceNowMs ?? Date.now()
  const channels: ['email', 'whatsapp'] = ['email', 'whatsapp']
  const isStale = input.isStaleOver24h || input.hoursSinceLatestRecord > 24

  if (!isStale) {
    return {
      adminAlertDispatched: false,
      channels,
      deduplicated: false,
      lastDispatchedAt: lastAlertRecordIso || null,
    }
  }

  const recipient = resolveAdminRecipientEmail()

  // Strict 24-hour deduplication window so automated 15-min syncs never spam admin inbox/WhatsApp
  if (
    lastAlertDispatchedAtMs > 0 &&
    nowMs - lastAlertDispatchedAtMs < STALENESS_ALERT_DEDUP_MS
  ) {
    return {
      adminAlertDispatched: true,
      channels,
      deduplicated: true,
      recipientEmail: recipient,
      lastDispatchedAt: lastAlertRecordIso || new Date(lastAlertDispatchedAtMs).toISOString(),
    }
  }

  const triggeredAtIso = new Date(nowMs).toISOString()
  const kwStamp = input.kuwaitTimestamp ?? input.latestRecordAt

  lastAlertDispatchedAtMs = nowMs
  lastAlertRecordIso = triggeredAtIso

  if (!input.dryRun) {
    const subject = `[Aether BI Admin Alert] Odoo 17 Sync >24h Stale (${input.hoursSinceLatestRecord}h)`
    const text = [
      'Venture Foods — Aether BI System Administrator Staleness Watchdog',
      `Last record from Odoo: ${kwStamp} (${input.latestRecordAt})`,
      `Elapsed hours: ${input.hoursSinceLatestRecord}h (>24h threshold)`,
      `Triggered at: ${triggeredAtIso}`,
    ].join('\n')
    const html = `<div style="font-family:Inter,system-ui,sans-serif;padding:16px;color:#0f172a">
      <h2 style="margin:0 0 8px;color:#065f46">Aether BI — Odoo 17 Staleness Watchdog (&gt;24h)</h2>
      <p style="margin:4px 0"><strong>Last record from Odoo:</strong> ${kwStamp}</p>
      <p style="margin:4px 0"><strong>Elapsed hours:</strong> ${input.hoursSinceLatestRecord}h</p>
      <p style="margin:4px 0"><strong>Recipient:</strong> ${recipient}</p>
    </div>`

    await Promise.allSettled([
      sendResendOrSmtpEmail({ to: recipient, subject, text, html }),
      sendWhatsAppWebhookAlert({
        recipient,
        hoursSinceLatestRecord: input.hoursSinceLatestRecord,
        latestRecordAt: input.latestRecordAt,
        kuwaitTimestamp: kwStamp,
        triggeredAtIso,
      }),
    ])
  }

  return {
    adminAlertDispatched: true,
    channels,
    deduplicated: false,
    recipientEmail: recipient,
    lastDispatchedAt: triggeredAtIso,
  }
}
