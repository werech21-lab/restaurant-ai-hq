import { NextRequest, NextResponse } from 'next/server'
import { constantTimeHexEqual, ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import { errorFields, logger } from '@/lib/logger'
import { runAndStoreCouncil, type CouncilScope } from '@/server/council/service'
import { isCouncilCronEnabled } from '@/server/council/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function cronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? ''
  if (!secret) return false
  return constantTimeHexEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

/**
 * Vercel cron: `?scope=hourly` every hour, `?scope=nightly` once a night (Kuwait). Read-only on Odoo.
 * Disabled by default unless `COUNCIL_CRON_ENABLED=true` is explicitly configured in environment variables.
 */
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
  if (!isCouncilCronEnabled()) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'COUNCIL_CRON_DISABLED' },
      { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  const scope: CouncilScope = request.nextUrl.searchParams.get('scope') === 'nightly' ? 'nightly' : 'hourly'
  try {
    const snapshot = await runAndStoreCouncil(scope)
    return NextResponse.json(
      {
        ok: true,
        scope,
        generatedAt: snapshot.generatedAt,
        reports: snapshot.reports.map((r) => ({ advisorId: r.advisorId, status: r.status, findings: r.findings.length, dataGaps: r.dataGaps.length })),
        discoveries: snapshot.discoveries.map((d) => d.finding.fingerprint),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('council run failed', errorFields(error))
    return NextResponse.json({ ok: false, error: 'COUNCIL_RUN_FAILED' }, { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS })
  }
}
