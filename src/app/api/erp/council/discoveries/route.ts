import { NextRequest, NextResponse } from 'next/server'
import {
  buildLiveDecisionSnapshotFromSummary,
  type LiveDecisionGeneratorResult,
} from '@/lib/aether/live-decision-generator'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { errorFields, logger } from '@/lib/logger'
import { fetchLiveOdooSnapshot } from '@/lib/odoo-live-connector'
import type { OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { latestCouncilSnapshot } from '@/server/council/service'

export const dynamic = 'force-dynamic'

const g = globalThis as unknown as {
  __aetherLiveDecisionRoomCache?: {
    at: number
    result: LiveDecisionGeneratorResult
    liveSummary: OdooLiveSummary | null
  }
}

/** Latest council snapshot or live Odoo-derived Today's Discoveries when DB table is empty. */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  try {
    const snapshot = await latestCouncilSnapshot().catch(() => null)
    if (snapshot && snapshot.discoveries.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          available: true,
          generatedAt: snapshot.generatedAt,
          discoveries: snapshot.discoveries,
          advisors: snapshot.reports.map((r) => ({
            advisorId: r.advisorId,
            status: r.status,
            generatedAt: r.generatedAt,
            dataGaps: r.dataGaps,
          })),
        },
        { headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const cached = g.__aetherLiveDecisionRoomCache
    if (cached && Date.now() - cached.at < 120_000 && cached.result.discoveries.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          available: true,
          generatedAt: cached.result.generatedAt,
          discoveries: cached.result.discoveries,
          advisors: cached.result.reports.map((r) => ({
            advisorId: r.advisorId,
            status: r.status,
            generatedAt: r.generatedAt,
            dataGaps: r.dataGaps,
          })),
        },
        { headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const envelope = await fetchLiveOdooSnapshot({ period: 'month', readOnly: true }).catch(
      () => null,
    )
    const liveSummary: OdooLiveSummary | null =
      envelope?.summary ?? (envelope?.connected ? envelope : null)
    const generated = buildLiveDecisionSnapshotFromSummary(liveSummary, null, snapshot)

    return NextResponse.json(
      {
        ok: true,
        available: generated.discoveries.length > 0,
        generatedAt: generated.generatedAt,
        discoveries: generated.discoveries,
        advisors: generated.reports.map((r) => ({
          advisorId: r.advisorId,
          status: r.status,
          generatedAt: r.generatedAt,
          dataGaps: r.dataGaps,
        })),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('discoveries read failed', errorFields(error))
    return NextResponse.json(
      { ok: true, available: false, generatedAt: null, discoveries: [], advisors: [] },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
