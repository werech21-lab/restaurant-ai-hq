import { NextResponse } from 'next/server'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { dispatchExclusiveOperationalReport, listExclusiveRadarRecipients } from '@/lib/alerts'
import { buildForensicMatrix } from '@/modules/governance/domain/forensic-radar'
import { listForensicHistory } from '@/modules/governance/services/forensic-radar-service'
import { dispatchServerEmail, getSmtpPublicStatus } from '@/lib/email/server-mail'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/aggregator-radar/alert
 * Server-to-inbox dispatch of the Detailed Daily Operational & Forensic Report
 * or Instant Talabat Go Area Blackout Alert to the three exclusive recipients.
 */
export const POST = protectedRoute(permissions.govAggregatorManage, async ({ request, auth }) => {
  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  if (body?.kind === 'talabat_area_alert') {
    const text = body.emailText || 'Talabat Go Area Blackout Alert'
    const subject = `🚨 المناطق السكنية المغلقة أو المشغولة حالياً في توصيل طلبات (Talabat Go Busy & Hidden Areas Report) · ${new Date().toLocaleDateString('en-GB')}`
    const delivery = await dispatchServerEmail({ subject, text })

    logger.info('talabat_area_alert_api', {
      userId: auth.userId,
      ok: delivery.ok,
      engine: delivery.engine,
    })

    return NextResponse.json({
      data: {
        delivery,
        recipients: listExclusiveRadarRecipients(),
        subject,
        preview: text.slice(0, 1500),
      },
    })
  }

  const history = listForensicHistory()
  const snapshots = history.length ? history : [buildForensicMatrix()]
  const result = await dispatchExclusiveOperationalReport(snapshots)

  logger.info('aggregator_radar_alert_api', {
    userId: auth.userId,
    ok: result.delivery.ok,
    engine: result.delivery.engine,
    critical: result.report.sections.critical.length,
  })

  // Always 200 when the dispatch pipeline ran — real success/failure is in data.delivery.ok
  return NextResponse.json({
    data: {
      delivery: result.delivery,
      smtp: result.smtp,
      telegramBroadcast: result.telegramBroadcast,
      chunksSent: result.chunksSent,
      recipients: listExclusiveRadarRecipients(),
      channels: result.channels,
      summary: {
        critical: result.report.sections.critical.length,
        watch: result.report.sections.watch.length,
        clean: result.report.sections.clean.length,
        rejectedEstate: result.report.sections.rejectedEstate,
        recordedLostKwd: (result.report.sections.recordedLostMinor / 1000).toFixed(3),
        penaltyKwd: (result.report.sections.penaltyMinor / 1000).toFixed(3),
        kuwaitDate: result.report.sections.kuwaitDate,
        kuwaitTime: result.report.sections.kuwaitTime,
        dispatchedBy: auth.userId,
      },
      preview: result.report.en.slice(0, 1500),
    },
  })
})

/** GET returns SMTP activation status (never the password). */
export const GET = protectedRoute(permissions.govAggregatorRead, async () => {
  const smtp = await getSmtpPublicStatus()
  return NextResponse.json({
    data: {
      smtp,
      recipients: listExclusiveRadarRecipients(),
    },
  })
})
