import { NextResponse, type NextRequest } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import { EXEC_SESSION_COOKIE, verifyExecSessionToken } from '@/lib/auth/exec-session'
import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listTelemetryHandler, recordTelemetryHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const baseGet = protectedRoute(permissions.govTelemetryRead, listTelemetryHandler)
const basePost = protectedRoute(permissions.govTelemetryRecord, recordTelemetryHandler)

export const GET = baseGet

export async function POST(request: NextRequest, context: { params: Promise<Record<string, string>> }) {
  const execToken =
    request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
    request.cookies.get('aether_exec_session')?.value
  if (execToken) {
    const payload = await verifyExecSessionToken(execToken)
    if (payload?.role === 'auditor') {
      // Read-only auditor navigation pulse: acknowledge cleanly with 200 OK without DB mutation
      return NextResponse.json(
        { ok: true, readOnly: true, recorded: false },
        { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
  }
  return basePost(request, context)
}
