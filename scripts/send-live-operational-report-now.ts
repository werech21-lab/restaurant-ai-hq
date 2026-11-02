/**
 * Immediate live Google Workspace SMTP dispatch of the Detailed Daily
 * Operational & Forensic Report to the three exclusive recipients.
 *
 *   npx tsx scripts/send-live-operational-report-now.ts
 *
 * Credentials: SMTP_PASS / NotificationSetting (never commit the App Password).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { normalizeSmtpPass, saveSmtpCredentials, exclusiveRecipientEmails } from '../src/lib/email/server-mail'
import { dispatchExclusiveOperationalReport } from '../src/lib/alerts'
import { buildForensicMatrix } from '../src/modules/governance/domain/forensic-radar'

const FROM = 'sec@venturefoodskw.com'
const HOST = 'smtp.gmail.com'
const PORT = 465

function loadDotEnvLocal() {
  const file = path.join(process.cwd(), '.env.local')
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i <= 0) continue
    const key = trimmed.slice(0, i).trim()
    const value = trimmed.slice(i + 1).trim()
    if (!(key in process.env) || !process.env[key]) process.env[key] = value
  }
}

function loadPass(): string {
  loadDotEnvLocal()
  const fromEnv = normalizeSmtpPass(process.env.SMTP_PASS || process.env.RADAR_SMTP_PASS || '')
  if (fromEnv) return fromEnv
  // One-shot bootstrap from argv only (not committed): --pass=xxxx
  const arg = process.argv.find((a) => a.startsWith('--pass='))
  if (arg) return normalizeSmtpPass(arg.slice('--pass='.length))
  throw new Error('SMTP_PASS is required (env or --pass=...)')
}

function upsertEnvLocal(pass: string) {
  const file = path.join(process.cwd(), '.env.local')
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split(/\r?\n/) : []
  const map = new Map<string, string>()
  for (const line of lines) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m) map.set(m[1]!, m[2]!)
  }
  map.set('SMTP_USER', FROM)
  map.set('SMTP_FROM', FROM)
  map.set('SMTP_HOST', HOST)
  map.set('SMTP_PORT', String(PORT))
  map.set('SMTP_PASS', pass)
  map.set('RADAR_SMTP_USER', FROM)
  map.set('RADAR_SMTP_PASS', pass)
  const body = [...map.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  writeFileSync(file, body, 'utf8')
  process.env.SMTP_USER = FROM
  process.env.SMTP_PASS = pass
  process.env.SMTP_HOST = HOST
  process.env.SMTP_PORT = String(PORT)
}

async function main() {
  const pass = loadPass()
  upsertEnvLocal(pass)
  const smtp = await saveSmtpCredentials({
    fromEmail: FROM,
    smtpPass: pass,
    smtpHost: HOST,
    smtpPort: PORT,
  })
  console.log('SMTP configured:', JSON.stringify(smtp))
  console.log('Recipients:', exclusiveRecipientEmails().join(', '))

  const at = new Date()
  const snapshot = buildForensicMatrix(at)
  const result = await dispatchExclusiveOperationalReport([snapshot], at)

  console.log('\n========== LIVE SMTP DISPATCH RESULT ==========')
  console.log('ok:', result.delivery.ok)
  console.log('engine:', result.delivery.engine)
  console.log('Message ID:', result.delivery.messageId || result.email.messageId || '(none)')
  console.log('SMTP response:', result.delivery.response || result.email.response || '(none)')
  console.log('message:', result.delivery.message)
  if (result.delivery.error) console.log('error:', result.delivery.error)
  console.log('subject:', result.delivery.subject)
  console.log('to:', result.delivery.recipients.join(', '))
  console.log(
    'summary:',
    `${result.report.sections.critical.length} CRITICAL | ${result.report.sections.watch.length} WATCH | ${result.report.sections.clean.length} CLEAN`,
  )
  console.log('================================================\n')

  if (!result.delivery.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
