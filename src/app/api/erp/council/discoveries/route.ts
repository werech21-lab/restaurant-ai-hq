import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { errorFields, logger } from '@/lib/logger'
import { latestCouncilSnapshot } from '@/server/council/service'

export const dynamic = 'force-dynamic'

/** Latest stored council snapshot: Today's Discoveries + per-advisor status and data gaps. */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  try {
    const snapshot = await latestCouncilSnapshot()
    return NextResponse.json(
      {
        ok: true,
        available: Boolean(snapshot && snapshot.discoveries.length > 0),
        generatedAt: snapshot?.generatedAt ?? null,
        discoveries: snapshot?.discoveries ?? [],
        advisors: (snapshot?.reports ?? []).map((r) => ({ advisorId: r.advisorId, status: r.status, generatedAt: r.generatedAt, dataGaps: r.dataGaps })),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('discoveries read failed', errorFields(error))
    return NextResponse.json({ ok: true, available: false, generatedAt: null, discoveries: [], advisors: [] }, { headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
}
