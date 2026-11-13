import { NextResponse, type NextRequest } from 'next/server'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { GET as getGovernanceEnvelope } from '@/app/api/erp/governance/route'
import type { PersistedGovernanceStore } from '@/lib/governance-compliance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireExecApiSession(request, { allowAuditor: true })
  if (!auth.ok) return auth.response

  const upstream = await getGovernanceEnvelope(request)
  if (!upstream.ok) return upstream

  const data = (await upstream.json()) as {
    ok?: boolean
    store?: PersistedGovernanceStore
    updatedAtIso?: string
    backend?: string
  }
  const approvals = data.store?.approvals ?? []
  const issuedCircularsCount = Object.keys(data.store?.issuedCirculars ?? {}).length
  const frozenBreachesCount = Object.keys(data.store?.frozenBreachIds ?? {}).length
  const resolvedBreachesCount = Object.keys(data.store?.resolvedBreachIds ?? {}).length

  return NextResponse.json(
    {
      ok: true,
      readOnly: auth.session.role === 'auditor',
      role: auth.session.role,
      updatedAtIso: data.updatedAtIso ?? new Date().toISOString(),
      backend: data.backend ?? 'server-cache',
      metrics: {
        totalApprovals: approvals.length,
        pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
        approvedCount: approvals.filter((a) => a.status === 'approved').length,
        rejectedCount: approvals.filter((a) => a.status === 'rejected').length,
        issuedCircularsCount,
        frozenBreachesCount,
        resolvedBreachesCount,
      },
    },
    { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

function disallowAuditorMutation(request: NextRequest) {
  return requireExecApiSession(request, { allowAuditor: false }).then((auth) => {
    if (!auth.ok) return auth.response
    return NextResponse.json(
      { ok: false, error: 'Use /api/erp/governance for state mutations' },
      { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  })
}

export async function POST(request: NextRequest) {
  return disallowAuditorMutation(request)
}

export async function PUT(request: NextRequest) {
  return disallowAuditorMutation(request)
}

export async function PATCH(request: NextRequest) {
  return disallowAuditorMutation(request)
}

export async function DELETE(request: NextRequest) {
  return disallowAuditorMutation(request)
}
