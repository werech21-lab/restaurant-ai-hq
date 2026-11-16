import { NextRequest, NextResponse } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS, requireExecApiSession } from '@/lib/auth/api-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function disabled(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response
  return NextResponse.json(
    { ok: false, error: 'disabled', message: 'This route is disabled. It does not call a model.' },
    { status: 410, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export function GET(request: NextRequest) {
  return disabled(request)
}

export function POST(request: NextRequest) {
  return disabled(request)
}
