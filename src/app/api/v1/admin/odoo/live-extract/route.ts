import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBody } from '@/lib/api/parse'
import { protectedRoute } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import { permissions } from '@/lib/auth/permissions'
import { extractAndBackupOdooLive, listLocalOdooDumpSummary } from '@/services/odoo-live-extractor.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const liveSchema = z
  .object({
    database: z.string().trim().min(1).max(80).optional(),
    login: z.string().trim().min(3).max(200).optional(),
    secret: z.string().min(1).max(200).optional(),
    sessionId: z
      .string()
      .regex(/^[A-Za-z0-9._-]{8,128}$/)
      .optional(),
  })
  .superRefine((value, ctx) => {
    const password = Boolean(value.database && value.login && value.secret)
    const session = Boolean(value.sessionId)
    if (password === session) {
      ctx.addIssue({ code: 'custom', message: 'Provide either the database login or the session id.' })
    }
  })

export const GET = protectedRoute(permissions.adminOdooRead, async () => {
  return NextResponse.json({ data: listLocalOdooDumpSummary() })
})

export const POST = protectedRoute(permissions.adminOdooSync, async ({ request, auth }) => {
  const input = await parseBody(request, liveSchema)
  const key = requireIdempotencyKey(request)
  const report = await extractAndBackupOdooLive(
    auth,
    key,
    input.sessionId
      ? { mode: 'session', sessionId: input.sessionId }
      : { mode: 'password', database: input.database!, login: input.login!, secret: input.secret! },
  )
  return NextResponse.json({ data: report }, { status: 201 })
})
