import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { toErrorResponse } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { authenticate } from '@/lib/auth/context'
import { dispatchExclusiveOperationalReport, listExclusiveRadarRecipients } from '@/lib/alerts'
import { FORENSIC_MISSING_DATA_REASON, listForensicHistory } from '@/modules/governance'
import { dispatchServerEmail, getSmtpPublicStatus } from '@/lib/email/server-mail'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * In-memory registry of dispatched dates to enforce strict once-per-day lock.
 */
const sentReportDates = new Set<string>()

function getKuwaitDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date())
}

function isAuthorizedCronBearer(request: NextRequest): boolean {
  const secret = (process.env.CRON_SECRET ?? '').trim()
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const actualDigest = createHash('sha256').update(header).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualDigest, expectedDigest) && header.length === expected.length
}

/**
 * Execute daily operational & forensic report dispatch with strict once-per-day server lock
 * and strict Fail-Closed guard when verified Odoo telemetry is unavailable.
 */
async function executeDailyForensicDispatch({
  isManual,
  triggerSource,
  userId,
}: {
  isManual: boolean
  triggerSource: string
  userId?: string
}) {
  const kuwaitDate = getKuwaitDateString()

  // Strict Once-Per-Day Server Lock for automated triggers (at 11:59 PM Kuwait time)
  if (!isManual) {
    if (sentReportDates.has(kuwaitDate)) {
      logger.info('daily_forensic_report_already_sent_memory', { kuwaitDate, triggerSource })
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'Daily forensic report already sent today at 11:59 PM Kuwait time.',
      })
    }

    try {
      const existing = await prisma.systemNotification.findFirst({
        where: { title: `DAILY_FORENSIC_REPORT_${kuwaitDate}` },
      })
      if (existing) {
        sentReportDates.add(kuwaitDate)
        logger.info('daily_forensic_report_already_sent_db', { kuwaitDate, triggerSource })
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: 'Daily forensic report already sent today at 11:59 PM Kuwait time.',
        })
      }
    } catch (err) {
      logger.warn('Failed to query daily report log from DB', { error: err })
    }
  }

  const history = listForensicHistory()
  const verifiedSnapshots = history.filter((s) => s.dataAvailable && s.rows.length > 0)
  if (verifiedSnapshots.length === 0) {
    logger.warn('forensic_report_fail_closed_missing_odoo_data', {
      reason: FORENSIC_MISSING_DATA_REASON,
      triggerSource,
      kuwaitDate,
      isManual,
      userId: userId || 'system-cron',
    })
    return NextResponse.json({
      ok: true,
      skipped: true,
      alerted: false,
      dispatched: false,
      skippedReason: FORENSIC_MISSING_DATA_REASON,
      reason: 'Skipped: verified Odoo operational & forensic telemetry is unavailable (fail-closed).',
    })
  }

  const result = await dispatchExclusiveOperationalReport(verifiedSnapshots)
  if (!result.dispatched) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      alerted: false,
      dispatched: false,
      skippedReason: result.skippedReason ?? FORENSIC_MISSING_DATA_REASON,
      reason: 'Skipped: verified Odoo operational & forensic telemetry is unavailable (fail-closed).',
    })
  }

  // Mark date as sent in memory and database only when verified report was actually dispatched
  sentReportDates.add(kuwaitDate)
  try {
    await prisma.systemNotification.create({
      data: {
        title: `DAILY_FORENSIC_REPORT_${kuwaitDate}`,
        body: `Daily forensic report dispatched at 11:59 PM Kuwait time via ${triggerSource}. Engine: ${result.delivery.engine}. Status: ${result.delivery.ok ? 'SUCCESS' : 'FAILED'}.`,
      },
    })
  } catch (err) {
    logger.warn('Failed to record daily forensic report notification in DB', { error: err })
  }

  logger.info('aggregator_radar_alert_api', {
    triggerSource,
    userId: userId || 'system-cron',
    isManual,
    kuwaitDate,
    ok: result.delivery.ok,
    engine: result.delivery.engine,
    critical: result.report.sections.critical.length,
  })

  return NextResponse.json({
    ok: true,
    alerted: result.alerted,
    dispatched: result.dispatched,
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
        dispatchedBy: userId || 'system-cron',
      },
      preview: result.report.en.slice(0, 1500),
    },
  })
}

/**
 * GET /api/aggregator-radar/alert
 * 1) When triggered by Vercel Cron (59 20 * * * = 11:59 PM Kuwait time), dispatches the daily report.
 * 2) When requested by web dashboard, returns SMTP public status.
 */
export async function GET(request: NextRequest) {
  if (isAuthorizedCronBearer(request)) {
    return executeDailyForensicDispatch({
      isManual: false,
      triggerSource: 'VERCEL_CRON_GET',
      userId: 'vercel-cron',
    })
  }

  // Reject unauthenticated ?cron=true / x-vercel-cron attempts explicitly without falling through.
  if (
    request.nextUrl.searchParams.get('cron') === 'true' ||
    request.headers.get('x-vercel-cron') !== null
  ) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Valid CRON_SECRET bearer token required.' },
      { status: 401 },
    )
  }

  try {
    await authenticate(request, permissions.govAggregatorRead)
  } catch (error) {
    return toErrorResponse(error, request)
  }

  const smtp = await getSmtpPublicStatus()
  return NextResponse.json({
    data: {
      smtp,
      recipients: listExclusiveRadarRecipients(),
    },
  })
}

/**
 * POST /api/aggregator-radar/alert
 * 1) Instant Area Blackout Alert (talabat_area_alert)
 * 2) Daily Forensic Report (supports manualTrigger from UI or automated webhook)
 */
export async function POST(request: NextRequest) {
  let body: { manualTrigger?: boolean; kind?: string; emailText?: string } | null = null
  try {
    body = (await request.json()) as { manualTrigger?: boolean; kind?: string; emailText?: string }
  } catch {
    body = null
  }

  const isCron = isAuthorizedCronBearer(request)
  const isManual = body?.manualTrigger === true

  let userId = 'vercel-cron'
  if (!isCron) {
    try {
      const auth = await authenticate(request, permissions.govAggregatorManage)
      userId = auth.userId
    } catch (authError) {
      return toErrorResponse(authError, request)
    }
  }

  if (body?.kind === 'talabat_area_alert') {
    const text = (body.emailText ?? '').trim()
    if (!text) {
      logger.warn('forensic_report_fail_closed_missing_odoo_data', {
        reason: FORENSIC_MISSING_DATA_REASON,
        triggerSource: 'TALABAT_AREA_ALERT_EMPTY',
        userId,
      })
      return NextResponse.json({
        ok: true,
        skipped: true,
        alerted: false,
        dispatched: false,
        skippedReason: FORENSIC_MISSING_DATA_REASON,
      })
    }
    const subject = `🚨 المناطق السكنية المغلقة أو المشغولة حالياً في توصيل طلبات (Talabat Go Busy & Hidden Areas Report) · ${getKuwaitDateString()}`
    const delivery = await dispatchServerEmail({ subject, text })

    logger.info('talabat_area_alert_api', {
      userId,
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

  return executeDailyForensicDispatch({
    isManual,
    triggerSource: isManual ? `MANUAL_BY_${userId}` : isCron ? 'VERCEL_CRON_POST' : 'AUTOMATED',
    userId,
  })
}
