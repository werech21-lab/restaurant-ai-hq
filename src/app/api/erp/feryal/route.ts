import { NextRequest, NextResponse } from 'next/server'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { POST as handleFeryalPost } from '@/app/api/feryal/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireExecApiSession(request, { allowAuditor: true })
  if (!auth.ok) return auth.response

  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/erp/feryal',
      role: auth.session.role,
      readOnly: auth.session.role === 'auditor',
      scope: { brands: 6, branches: 7, channels: 8 },
    },
    { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function POST(request: NextRequest) {
  const auth = await requireExecApiSession(request, { allowAuditor: false })
  if (!auth.ok) return auth.response
  return handleFeryalPost(request)
}

async function disallowMutationMethod(request: NextRequest) {
  const auth = await requireExecApiSession(request, { allowAuditor: false })
  if (!auth.ok) return auth.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function PUT(request: NextRequest) {
  return disallowMutationMethod(request)
}

export async function PATCH(request: NextRequest) {
  return disallowMutationMethod(request)
}

export async function DELETE(request: NextRequest) {
  return disallowMutationMethod(request)
}
