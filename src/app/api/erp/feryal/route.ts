import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  APPROVED_FERYAL_BRANCHES,
  askFeryalOdooAgent,
  listFeryalAuditEntries,
  UNATTRIBUTED_BRANCH_LABEL_AR,
} from '@/lib/feryal-odoo-agent'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  const rawLogs = await listFeryalAuditEntries(50)
  const auditLogs =
    authGuard.session.role === 'auditor'
      ? rawLogs.map((entry) => ({
          ...entry,
          userSub: `role:${entry.userRole}`,
          userNameAr: undefined,
        }))
      : rawLogs

  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/erp/feryal',
      scope: {
        brandsCount: 6,
        branchesCount: 7,
        branches: APPROVED_FERYAL_BRANCHES.map((b) => ({
          id: b.id,
          nameAr: b.nameAr,
          nameEn: b.nameEn,
        })),
        unattributedLabelAr: UNATTRIBUTED_BRANCH_LABEL_AR,
      },
      auditLogs,
      timestamp: new Date().toISOString(),
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  const burst = executiveAiBurstLimiter.check(`erp-feryal:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let body: { prompt?: string; question?: string; message?: string } = {}
  try {
    body = (await req.json()) as { prompt?: string; question?: string; message?: string }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const rawQuestion =
    (typeof body.question === 'string' && body.question.trim()) ||
    (typeof body.prompt === 'string' && body.prompt.trim()) ||
    (typeof body.message === 'string' && body.message.trim()) ||
    ''

  const result = await askFeryalOdooAgent({
    question: rawQuestion.slice(0, 2000),
    userSub: authGuard.session.sub,
    userRole: authGuard.session.role,
    userNameAr: authGuard.session.nameAr,
  })

  return NextResponse.json(
    {
      ok: true,
      provider: 'odoo-live',
      model: result.executedQueries[0]?.model ?? 'odoo-live',
      reply: result.reply,
      status: result.status,
      executedQueries: result.executedQueries,
      verifier: result.verifier,
      period: result.period,
      auditEntry: result.auditEntry,
      timestamp: result.auditEntry.timestampIso,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

async function disallowMutation(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function PUT(req: NextRequest) {
  return disallowMutation(req)
}

export async function PATCH(req: NextRequest) {
  return disallowMutation(req)
}

export async function DELETE(req: NextRequest) {
  return disallowMutation(req)
}
