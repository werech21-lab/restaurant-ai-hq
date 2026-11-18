import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireAdminOnlyApiSession, requireExecApiSession } from '@/lib/auth/api-guard'
import { mergeSeasonEvents } from '@/lib/council/advisors/seasons'
import { errorFields, logger } from '@/lib/logger'
import { latestCouncilSnapshot } from '@/server/council/service'
import { deleteSeasonEvent, listSeasonEvents, upsertSeasonEvent, validateSeasonEvent } from '@/server/council/store'

export const dynamic = 'force-dynamic'

/** Seasons calendar + the latest Seasons-advisor report (comparisons, prep plans, data gaps). */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  const stored = await listSeasonEvents()
  const snapshot = await latestCouncilSnapshot().catch(() => null)
  return NextResponse.json(
    {
      ok: true,
      events: mergeSeasonEvents(stored),
      suggested: !stored || stored.length === 0,
      report: snapshot?.reports.find((r) => r.advisorId === 'seasons') ?? null,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

/** Owner edit: create or replace one event. */
export async function POST(req: NextRequest) {
  const authGuard = await requireAdminOnlyApiSession(req)
  if (!authGuard.ok) return authGuard.response
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
  const ev = validateSeasonEvent(body)
  if (!ev) return NextResponse.json({ ok: false, error: 'INVALID_EVENT' }, { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS })
  try {
    await upsertSeasonEvent(ev, authGuard.session.sub)
    return NextResponse.json({ ok: true, event: ev }, { headers: ENTERPRISE_API_SECURITY_HEADERS })
  } catch (error) {
    logger.error('season event save failed', errorFields(error))
    return NextResponse.json({ ok: false, error: 'SAVE_FAILED' }, { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
}

export async function DELETE(req: NextRequest) {
  const authGuard = await requireAdminOnlyApiSession(req)
  if (!authGuard.ok) return authGuard.response
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS })
  try {
    await deleteSeasonEvent(id)
    return NextResponse.json({ ok: true }, { headers: ENTERPRISE_API_SECURITY_HEADERS })
  } catch (error) {
    logger.error('season event delete failed', errorFields(error))
    return NextResponse.json({ ok: false, error: 'DELETE_FAILED' }, { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
}
