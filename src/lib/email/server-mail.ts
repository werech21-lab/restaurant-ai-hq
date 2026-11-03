/**
 * Zero-popup server-to-inbox email dispatch for exclusive radar reports.
 * Primary engine: Google Workspace SMTP (sec@venturefoodskw.com) via nodemailer.
 * Password is NEVER hardcoded in source — loaded from NotificationSetting / SMTP_PASS env.
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
  response?: string
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
  provider: 'google_workspace'
}

const DEFAULT_FROM = 'sec@venturefoodskw.com'
const DEFAULT_HOST = 'smtp.gmail.com'
const DEFAULT_PORT = 465
const REPORT_SUBJECT = 'DAILY OPERATIONAL & FORENSIC REPORT — VENTURE FOODS'

/** Strip all whitespace from Google App Passwords (accepts "xxxx xxxx xxxx xxxx"). */
export function normalizeSmtpPass(raw: string): string {
  return String(raw || '').replace(/\s+/g, '')
}

export function exclusiveRecipientEmails(): string[] {
  return EXCLUSIVE_RADAR_RECIPIENTS.map((r) => r.email)
}

function envSmtpPass(): string {
  return normalizeSmtpPass(process.env.SMTP_PASS || process.env.RADAR_SMTP_PASS || '')
}

function envSmtpUser(): string {
  return (process.env.SMTP_USER || process.env.RADAR_SMTP_USER || DEFAULT_FROM).trim().toLowerCase() || DEFAULT_FROM
}

export async function getSmtpPublicStatus(): Promise<SmtpPublicStatus> {
  const envPass = Boolean(envSmtpPass())
  try {
    const row = await prisma.notificationSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    })
    const dbPass = Boolean(normalizeSmtpPass(row.smtpPass || '') && row.smtpEnabled)
    return {
      configured: dbPass || envPass,
      enabled: dbPass || envPass,
      from: (row.smtpFrom || row.smtpUser || envSmtpUser() || DEFAULT_FROM).trim() || DEFAULT_FROM,
      host: row.smtpHost || process.env.SMTP_HOST || DEFAULT_HOST,
      port: row.smtpPort || Number(process.env.SMTP_PORT || DEFAULT_PORT) || DEFAULT_PORT,
      provider: 'google_workspace',
    }
  } catch (error) {
    logger.warn('radar_smtp_status_db_fallback_env', {
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    return {
      configured: envPass,
      enabled: envPass,
      from: envSmtpUser(),
      host: process.env.SMTP_HOST || DEFAULT_HOST,
      port: Number(process.env.SMTP_PORT || DEFAULT_PORT) || DEFAULT_PORT,
      provider: 'google_workspace',
    }
  }
}

export async function saveSmtpCredentials(input: {
  fromEmail?: string
  smtpPass: string
  smtpHost?: string
  smtpPort?: number
}): Promise<SmtpPublicStatus> {
  const from = (input.fromEmail?.trim() || DEFAULT_FROM).toLowerCase()
  const pass = normalizeSmtpPass(input.smtpPass)
  if (!pass) {
    throw new Error('SMTP password / Google App Password is required')
  }
  if (pass.length < 8) {
    throw new Error('SMTP password looks too short')
  }
  const host = (input.smtpHost || DEFAULT_HOST).trim() || DEFAULT_HOST
  const port = input.smtpPort || DEFAULT_PORT
  await prisma.notificationSetting.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      smtpUser: from,
      smtpFrom: from,
      smtpPass: pass,
      smtpHost: host,
      smtpPort: port,
      smtpSecure: port === 465,
      smtpEnabled: true,
    },
    update: {
      smtpUser: from,
      smtpFrom: from,
      smtpPass: pass,
      smtpHost: host,
      smtpPort: port,
      smtpSecure: port === 465,
      smtpEnabled: true,
    },
  })
  logger.info('radar_smtp_credentials_saved', { from, host, port })
  return getSmtpPublicStatus()
}

/** Ensure Google Workspace SMTP defaults exist (called on boot / before dispatch). */
export async function ensureVentureFoodsSmtpDefaults(): Promise<SmtpPublicStatus> {
  const status = await getSmtpPublicStatus()
  if (status.enabled) return status
  const envPass = envSmtpPass()
  if (!envPass) return status
  return saveSmtpCredentials({
    fromEmail: envSmtpUser(),
    smtpPass: envPass,
    smtpHost: process.env.SMTP_HOST || DEFAULT_HOST,
    smtpPort: Number(process.env.SMTP_PORT || DEFAULT_PORT) || DEFAULT_PORT,
  })
}

async function resolveSmtpAuth(): Promise<{
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
} | null> {
  try {
    await ensureVentureFoodsSmtpDefaults()
  } catch {
    // Env-only path is enough on hosts where SQLite schema lags.
  }
  let dbPass = ''
  let from = envSmtpUser()
  let user = envSmtpUser()
  let host = process.env.SMTP_HOST || DEFAULT_HOST
  let port = Number(process.env.SMTP_PORT || DEFAULT_PORT) || DEFAULT_PORT
  let secure = port === 465
  try {
    const row = await prisma.notificationSetting.findUnique({ where: { id: 'default' } })
    if (row?.smtpEnabled) dbPass = normalizeSmtpPass(row.smtpPass || '')
    if (row?.smtpFrom || row?.smtpUser) {
      from = (row.smtpFrom || row.smtpUser || from).trim().toLowerCase()
      user = (row.smtpUser || from).trim().toLowerCase()
    }
    if (row?.smtpHost) host = row.smtpHost
    if (row?.smtpPort) port = row.smtpPort
    secure = port === 465 ? true : Boolean(row?.smtpSecure ?? port === 465)
  } catch {
    // ignore schema lag
  }
  const pass = dbPass || envSmtpPass()
  if (!pass) return null
  return { host, port, secure, user, pass, from }
}

async function sendViaSmtp(
  subject: string,
  text: string,
  html: string,
  customTo?: string[],
): Promise<ServerMailResult> {
  const auth = await resolveSmtpAuth()
  if (!auth) {
    return { ok: false, engine: 'none', message: 'SMTP not configured', error: 'smtp_not_configured' }
  }

  const to = customTo && customTo.length > 0 ? customTo : exclusiveRecipientEmails()
  const attempts: Array<{ port: number; secure: boolean }> = [
    { port: 465, secure: true },
    { port: 587, secure: false },
  ]
  // Prefer configured port first.
  if (auth.port === 587) attempts.reverse()

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
      const response = typeof info.response === 'string' ? info.response : String(info.response || '')
      logger.info('radar_smtp_sent', {
        messageId: info.messageId,
        accepted: info.accepted,
        port: attempt.port,
        response: response.slice(0, 120),
      })
      return {
        ok: true,
        engine: 'smtp',
        message: `Google Workspace SMTP delivered via ${auth.host}:${attempt.port}`,
        messageId: info.messageId,
        response,
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

function toHtmlPre(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;white-space:pre-wrap;line-height:1.45;color:#111">${escaped}</pre>`
}

/**
 * Google Workspace SMTP only when credentials exist — no FormSubmit primary path.
 * Never uses mailto or client popups.
 */
export async function dispatchServerEmail(input: {
  subject?: string
  text: string
  to?: string[]
}): Promise<ServerMailResult> {
  const subject = input.subject?.trim() || REPORT_SUBJECT
  const html = toHtmlPre(input.text)
  await ensureVentureFoodsSmtpDefaults()
  const status = await getSmtpPublicStatus()
  if (!status.enabled) {
    return {
      ok: false,
      engine: 'none',
      message: 'Google Workspace SMTP is not configured (set SMTP_PASS / NotificationSetting).',
      error: 'smtp_not_configured',
    }
  }
  return sendViaSmtp(subject, input.text, html, input.to)
}

export { REPORT_SUBJECT, DEFAULT_FROM, DEFAULT_HOST, DEFAULT_PORT }
