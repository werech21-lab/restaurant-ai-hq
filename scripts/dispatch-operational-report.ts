/**
 * One-shot local dispatch of the Detailed Daily Operational & Forensic Report
 * to Sec / operations / abdelrahmanm only.
 *
 *   npx tsx scripts/dispatch-operational-report.ts
 */
import { dispatchExclusiveOperationalReport } from '../src/lib/alerts'
import { buildForensicMatrix } from '../src/modules/governance/domain/forensic-radar'
import { logger } from '../src/lib/logger'

async function main() {
  const at = new Date()
  const snapshot = buildForensicMatrix(at)
  const result = await dispatchExclusiveOperationalReport([snapshot], at)
  const summary = {
    kuwaitDate: result.report.sections.kuwaitDate,
    kuwaitTime: result.report.sections.kuwaitTime,
    critical: result.report.sections.critical.length,
    watch: result.report.sections.watch.length,
    clean: result.report.sections.clean.length,
    rejectedEstate: result.report.sections.rejectedEstate,
    penaltyKwd: (result.report.sections.penaltyMinor / 1000).toFixed(3),
    telegramBroadcast: result.telegramBroadcast,
    chunksSent: result.chunksSent,
    recipients: result.channels.map((c) => ({
      name: c.name,
      email: c.email,
      mobile: c.mobile,
      whatsapp: c.whatsapp.mode,
      telegram: c.telegram.ok,
      emailHref: Boolean(c.emailChannel.href),
    })),
    previewChars: result.report.en.length,
  }
  logger.info('dispatch_operational_report_complete', summary)
  console.log(JSON.stringify(summary, null, 2))
  console.log('\n--- EN PREVIEW (first 1200 chars) ---\n')
  console.log(result.report.en.slice(0, 1200))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
