import { NextRequest, NextResponse } from 'next/server'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { probeCouncilHealth } from '@/server/ai/health'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireExecApiSession(request, { allowAuditor: true })
  if (!auth.ok) return auth.response
  const health = await probeCouncilHealth({
    force: request.nextUrl.searchParams.get('refresh') === '1',
  })
  return NextResponse.json(
    { ok: true, ...health },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}
