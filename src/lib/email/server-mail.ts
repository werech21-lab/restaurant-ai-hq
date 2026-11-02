/**
 * Zero-popup server-to-inbox email dispatch for exclusive radar reports.
 * Engine 1: nodemailer SMTP (company Gmail / App Password from DB)
 * Engine 2: FormSubmit HTTP relay (no SMTP required)
 */
import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { EXCLUSIVE_RADAR_RECIPIENTS } from '@/lib/vf-contact-directory'

export type MailEngine = 'smtp' | 'formsubmit' | 'none'

export type ServerMailResult = {
  ok: boolean
  engine: MailEngine
  message: string
  messageId?: string
  accepted?: string[]
  rejected?: string[]
  error?: string
}

export type SmtpPublicStatus = {
  configured: boolean
  enabled: boolean
  from: string
  host: string
  port: number
}

const DEFAULT_FROM = 'sec@venturefoodskw.com'
const REPORT_SUBJECT = 'DAILY OPERATIONAL & FORENSIC REPORT — VENTURE FOODS'

export function exclusiveRecipientEmails(): string[] {
  return EXCLUSIVE_RADAR_RECIPIENTS.map((r) => r.email)
}

function envSmtpPass(): string {
  return (process.env.SMTP_PASS || process.env.RADAR_SMTP_PASS || '').trim()
}

function envSmtpUser(): string {
  return (process.env.SMTP_USER || process.env.RADAR_SMTP_USER || DEFAULT_FROM).trim() || DEFAULT_FROM
}

export async function getSmtpPublicStatus(): Promise<SmtpPublicStatus> {
  const row = await prisma.notificationSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  })
  const dbPass = Boolean(row.smtpPass?.trim() && row.smtpEnabled)
  const envPass = Boolean(envSmtpPass())
  return {
    configured: dbPass || envPass,
    enabled: dbPass || envPass,
    from: (row.smtpFrom || row.smtpUser || envSmtpUser() || DEFAULT_FROM).trim() || DEFAULT_FROM,
    host: row.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: row.smtpPort || Number(process.env.SMTP_PORT || 465) || 465,
  }
}

export async function saveSmtpCredentials(input: {
  fromEmail?: string
  smtpPass: string
}): Promise<SmtpPublicStatus> {
  const from = (input.fromEmail?.trim() || DEFAULT_FROM).toLowerCase()
  const pass = input.smtpPass.trim()
  if (!pass) {
    throw new Error('SMTP password / Google App Password is required')
  }
  if (pass.length < 8) {
    throw new Error('SMTP password looks too short')
  }
  await prisma.notificationSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      smtpUser: from,
      smtpFrom: from,
      smtpPass: pass,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpEnabled: true,
    },
    update: {
      smtpUser: from,
      smtpFrom: from,
      smtpPass: pass,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      smtpEnabled: true,
    },
  })
  logger.info('radar_smtp_credentials_saved', { from })
  return getSmtpPublicStatus()
}

async function resolveSmtpAuth(): Promise<{
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
} | null> {
  const row = await prisma.notificationSetting.findUnique({ where: { id: 'default' } })
  const dbPass = row?.smtpEnabled ? row.smtpPass?.trim() : ''
  const pass = dbPass || envSmtpPass()
  if (!pass) return null
  const from = (row?.smtpFrom || row?.smtpUser || envSmtpUser() || DEFAULT_FROM).trim()
  const user = (row?.smtpUser || from || envSmtpUser()).trim()
  return {
    host: row?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: row?.smtpPort || Number(process.env.SMTP_PORT || 465) || 465,
    secure: row?.smtpSecure ?? true,
    user,
    pass,
    from,
  }
}

async function sendViaSmtp(subject: string, text: string, html: string): Promise<ServerMailResult> {
  const auth = await resolveSmtpAuth()
  if (!auth) {
    return { ok: false, engine: 'none', message: 'SMTP not configured', error: 'smtp_not_configured' }
  }

  const to = exclusiveRecipientEmails()
  const attempts: Array<{ port: number; secure: boolean }> = [
    { port: auth.port, secure: auth.secure },
    { port: 587, secure: false },
    { port: 465, secure: true },
  ]

  let lastError = 'smtp_failed'
  for (const attempt of attempts) {
    try {
      const transporter = nodemailer.createTransport({
        host: auth.host,
        port: attempt.port,
        secure: attempt.secure,
        auth: { user: auth.user, pass: auth.pass },
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 20_000,
      })
      const info = await transporter.sendMail({
        from: `"AetherBI · Venture Foods" <${auth.from}>`,
        to: to.join(', '),
        subject,
        text,
        html,
      })
      logger.info('radar_smtp_sent', {
        messageId: info.messageId,
        accepted: info.accepted,
        port: attempt.port,
      })
      return {
        ok: true,
        engine: 'smtp',
        message: `SMTP delivered via ${auth.host}:${attempt.port}`,
        messageId: info.messageId,
        accepted: (info.accepted || []).map(String),
        rejected: (info.rejected || []).map(String),
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      logger.warn('radar_smtp_attempt_failed', { port: attempt.port, errorMessage: lastError })
    }
  }

  return { ok: false, engine: 'smtp', message: 'SMTP delivery failed', error: lastError }
}

async function sendViaFormSubmit(subject: string, text: string): Promise<ServerMailResult> {
  const primary = 'Sec@venturefoodskw.com'
  const cc = 'operations@venturefoodskw.com,abdelrahmanm@venturefoodskw.com'
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aetherbi.com'
  const payload = {
    name: 'AetherBI Enterprise Forensic Engine',
    email: DEFAULT_FROM,
    _replyto: DEFAULT_FROM,
    _subject: subject,
    _template: 'box',
    _captcha: false,
    _cc: cc,
    message: text,
  }
  try {
    // FormSubmit rejects bare Node fetches — present as browser request from the live site.
    const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(primary)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: origin,
        Referer: `${origin}/erp/aggregator-radar`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    })
    const raw = await response.text()
    let parsed: { success?: string | boolean; message?: string } = {}
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      parsed = { message: raw.slice(0, 240) }
    }
    const successFlag = parsed.success
    const relayMessage = String(parsed.message || '')
    const needsActivation = /activation|activate form/i.test(relayMessage)
    const ok =
      response.ok &&
      !needsActivation &&
      successFlag !== false &&
      String(successFlag ?? 'true').toLowerCase() !== 'false'
    logger.info('radar_formsubmit_result', {
      status: response.status,
      ok,
      needsActivation,
      preview: String(parsed.message || parsed.success || '').slice(0, 160),
    })
    if (needsActivation) {
      return {
        ok: false,
        engine: 'formsubmit',
        message:
          'FormSubmit sent an Activate Form email to Sec@venturefoodskw.com — open that inbox, click Activate once, then press Send again. No mailto popup was used.',
        error: relayMessage,
      }
    }
    if (!ok) {
      return {
        ok: false,
        engine: 'formsubmit',
        message: 'FormSubmit relay rejected the message',
        error: parsed.message || `HTTP ${response.status}`,
      }
    }
    return {
      ok: true,
      engine: 'formsubmit',
      message:
        typeof parsed.message === 'string' && parsed.message
          ? parsed.message
          : 'FormSubmit accepted — check inboxes (and spam) for the three exclusive recipients',
      accepted: exclusiveRecipientEmails(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.warn('radar_formsubmit_failed', { errorMessage: message })
    return { ok: false, engine: 'formsubmit', message: 'FormSubmit relay failed', error: message }
  }
}

function toHtmlPre(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;line-height:1.45;color:#111">${escaped}</pre>`
}

async function sendViaResend(subject: string, text: string, html: string): Promise<ServerMailResult> {
  const key = (process.env.RESEND_API_KEY || '').trim()
  if (!key) {
    return { ok: false, engine: 'none', message: 'Resend not configured', error: 'resend_not_configured' }
  }
  const from = process.env.RESEND_FROM || `AetherBI <${DEFAULT_FROM}>`
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: exclusiveRecipientEmails(),
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const raw = await response.text()
    let parsed: { id?: string; message?: string } = {}
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      parsed = { message: raw.slice(0, 240) }
    }
    if (!response.ok) {
      return {
        ok: false,
        engine: 'smtp',
        message: 'Resend API rejected the message',
        error: parsed.message || `HTTP ${response.status}`,
      }
    }
    return {
      ok: true,
      engine: 'smtp',
      message: 'Resend API delivered to exclusive recipients',
      messageId: parsed.id,
      accepted: exclusiveRecipientEmails(),
    }
  } catch (error) {
    return {
      ok: false,
      engine: 'smtp',
      message: 'Resend API failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Multi-engine dispatch: SMTP/Resend if configured, else FormSubmit HTTP relay.
 * Never uses mailto or client popups.
 */
export async function dispatchServerEmail(input: {
  subject?: string
  text: string
}): Promise<ServerMailResult> {
  const subject = input.subject?.trim() || REPORT_SUBJECT
  const html = toHtmlPre(input.text)
  const status = await getSmtpPublicStatus()
  if (status.enabled) {
    const smtp = await sendViaSmtp(subject, input.text, html)
    if (smtp.ok) return smtp
    logger.warn('radar_smtp_fallback_chain', { error: smtp.error })
  }
  const resend = await sendViaResend(subject, input.text, html)
  if (resend.ok) return resend
  const relay = await sendViaFormSubmit(subject, input.text)
  if (relay.ok) {
    return {
      ...relay,
      message: status.enabled
        ? `SMTP failed; FormSubmit relay succeeded`
        : relay.message,
    }
  }
  if (status.enabled) {
    return {
      ok: false,
      engine: 'smtp',
      message: 'SMTP, Resend, and FormSubmit all failed',
      error: `${'smtp_failed'} | ${resend.error || 'resend'} | ${relay.error || 'formsubmit'}`,
    }
  }
  return relay
}

export { REPORT_SUBJECT }
