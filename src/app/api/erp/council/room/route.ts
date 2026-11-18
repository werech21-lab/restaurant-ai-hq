import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'
import { templateSummary } from '@/lib/council/executive-summary'
import { errorFields, logger } from '@/lib/logger'
import { executiveSummaryFor } from '@/server/council/executive-summary'
import { latestCouncilSnapshot } from '@/server/council/service'

export const dynamic = 'force-dynamic'

const DECISION_ROLES = ['admin', 'gm', 'dgm']

/** Decision Room: every advisor report of the latest council snapshot + the executive summary. */
export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response
  const canDecide = DECISION_ROLES.includes(authGuard.session.role)
  try {
    const snapshot = await latestCouncilSnapshot()
    if (!snapshot) {
      return NextResponse.json({ ok: true, available: false, generatedAt: null, reports: [], discoveries: [], summary: null, canDecide }, { headers: ENTERPRISE_API_SECURITY_HEADERS })
    }
    // The AI rewrite is attempted for executives only; auditors read the template.
    const summary = authGuard.session.role === 'auditor' ? templateSummary(snapshot) : await executiveSummaryFor(snapshot)
    return NextResponse.json(
      { ok: true, available: true, generatedAt: snapshot.generatedAt, reports: snapshot.reports, discoveries: snapshot.discoveries, summary, canDecide },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('decision room read failed', errorFields(error))
    return NextResponse.json({ ok: true, available: false, generatedAt: null, reports: [], discoveries: [], summary: null, canDecide }, { headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
}
