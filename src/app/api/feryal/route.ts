import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  ALL_FERYAL_BRANCHES,
  APPROVED_FERYAL_BRAND_LIST,
  askFeryalOdooAgent,
  FERYAL_COMPETITOR_REFUSAL,
  FERYAL_NO_ODOO_DATA_REPLY,
  listFeryalAuditEntries,
  UNATTRIBUTED_BRANCH_LABEL_AR,
} from '@/lib/feryal-odoo-agent'
import { sanitizeSeenFingerprints } from '@/lib/feryal-intent'
import { latestCouncilSnapshot } from '@/server/council/service'

export const dynamic = 'force-dynamic'

interface FeryalRouteBody {
  action?: string
  prompt?: string
  question?: string
  message?: string
  query?: string
  seenFingerprints?: unknown
}

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
      endpoint: '/api/feryal',
      scope: {
        brandsCount: APPROVED_FERYAL_BRAND_LIST.length,
        branchesCount: ALL_FERYAL_BRANCHES.length,
        branches: ALL_FERYAL_BRANCHES.map((b) => ({
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

  const burst = executiveAiBurstLimiter.check(`feryal:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let body: FeryalRouteBody = {}
  try {
    body = (await req.json()) as FeryalRouteBody
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  // External non-Odoo market/competitor actions have no Odoo data
  if (body.action === 'scrape_market') {
    const q = (body.query ?? '').trim()
    if (/منافس|competitor/i.test(q)) {
      return NextResponse.json(
        {
          ok: true,
          reply: FERYAL_COMPETITOR_REFUSAL,
          status: 'competitor_refusal',
          executedQueries: [],
          timestamp: new Date().toISOString(),
        },
        { headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    return NextResponse.json(
      {
        ok: true,
        reply: FERYAL_NO_ODOO_DATA_REPLY,
        status: 'no_odoo_data',
        executedQueries: [],
        timestamp: new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (body.action && body.action !== 'chat') {
    return NextResponse.json(
      {
        ok: true,
        reply: FERYAL_NO_ODOO_DATA_REPLY,
        status: 'no_odoo_data',
        executedQueries: [],
        timestamp: new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const rawQuestion =
    (typeof body.question === 'string' && body.question.trim()) ||
    (typeof body.prompt === 'string' && body.prompt.trim()) ||
    (typeof body.message === 'string' && body.message.trim()) ||
    (typeof body.query === 'string' && body.query.trim()) ||
    ''

  const result = await askFeryalOdooAgent({
    question: rawQuestion.slice(0, 2000),
    userSub: authGuard.session.sub,
    userRole: authGuard.session.role,
    userNameAr: authGuard.session.nameAr,
    council: await latestCouncilSnapshot().catch(() => null),
    seenFingerprints: sanitizeSeenFingerprints(body.seenFingerprints),
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
      usedFingerprints: result.usedFingerprints ?? [],
      timestamp: result.auditEntry.timestampIso,
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

async function disallowFeryalMutation(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function PUT(req: NextRequest) {
  return disallowFeryalMutation(req)
}

export async function PATCH(req: NextRequest) {
  return disallowFeryalMutation(req)
}

export async function DELETE(req: NextRequest) {
  return disallowFeryalMutation(req)
}
