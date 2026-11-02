import { NextResponse } from 'next/server'
import { z } from 'zod'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getSmtpPublicStatus, saveSmtpCredentials } from '@/lib/email/server-mail'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const saveSchema = z.object({
  fromEmail: z.string().email().optional().default('sec@venturefoodskw.com'),
  smtpPass: z.string().min(8).max(128),
})

/** GET /api/aggregator-radar/smtp — public SMTP status (no secrets). */
export const GET = protectedRoute(permissions.govAggregatorRead, async () => {
  const smtp = await getSmtpPublicStatus()
  return NextResponse.json({ data: { smtp } })
})

/**
 * POST /api/aggregator-radar/smtp
 * Persist Google App Password / SMTP password in NotificationSetting for automatic sends.
 */
export const POST = protectedRoute(permissions.govAggregatorManage, async ({ request, auth }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be JSON.' } },
      { status: 400 },
    )
  }
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'fromEmail and smtpPass (App Password) are required.',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  try {
    const smtp = await saveSmtpCredentials({
      fromEmail: parsed.data.fromEmail,
      smtpPass: parsed.data.smtpPass,
    })
    logger.info('aggregator_radar_smtp_saved', { userId: auth.userId, from: smtp.from })
    return NextResponse.json({
      data: {
        smtp,
        message: 'SMTP activated — server will send reports directly to the three exclusive inboxes.',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save SMTP credentials'
    return NextResponse.json({ error: { code: 'smtp_save_failed', message } }, { status: 400 })
  }
})
