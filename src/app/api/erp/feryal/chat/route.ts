import { NextRequest, NextResponse } from 'next/server'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  executiveAiBurstLimiter,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import {
  APPROVED_FERYAL_BRANCHES,
  FERYAL_NO_ODOO_DATA_REPLY,
  listFeryalAuditEntries,
  UNATTRIBUTED_BRANCH_LABEL_AR,
} from '@/lib/feryal-odoo-agent'
import { logger, errorFields } from '@/lib/logger'
import { runFeryalCouncil } from '@/server/ai/council'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface FeryalChatPostBody {
  prompt?: string
  question?: string
  message?: string
}

export async function GET(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: true })
  if (!authGuard.ok) return authGuard.response

  const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.round(rawLimit))) : 50
  const rawLogs = await listFeryalAuditEntries(limit)
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
      endpoint: '/api/erp/feryal/chat',
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

  const burst = executiveAiBurstLimiter.check(`feryal-chat:${authGuard.session.sub}`)
  if (!burst.allowed) {
    return buildRateLimitedJsonResponse(burst.retryAfterSeconds)
  }

  let body: FeryalChatPostBody = {}
  try {
    body = (await req.json()) as FeryalChatPostBody
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

  if (!rawQuestion) {
    return NextResponse.json(
      {
        ok: true,
        reply: FERYAL_NO_ODOO_DATA_REPLY,
        status: 'no_odoo_data',
        executedQueries: [],
        verifier: { valid: true, extractedNumbers: [], unverifiedNumbers: [] },
        timestamp: new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const safeQuestion = rawQuestion.slice(0, 2000)

  try {
    const result = await runFeryalCouncil({
      question: safeQuestion,
      userId: authGuard.session.sub,
      userRole: authGuard.session.role,
      userNameAr: authGuard.session.nameAr,
    })
    const agreedLabel = result.agreed.map((item) => `${item.provider}/${item.modelId}`).join(' · ')
    return NextResponse.json(
      {
        ok: true,
        reply: result.reply,
        status: result.status,
        provider: 'odoo-council',
        model: agreedLabel,
        participants: result.participants,
        agreed: result.agreed,
        executedQueries: result.executedQueries,
        verifier: result.verifier,
        period: result.period,
        auditEntry: result.auditEntry,
        timestamp: result.auditEntry?.timestampIso ?? new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    logger.error('feryal council failed', errorFields(error))
    return NextResponse.json(
      {
        ok: false,
        error: 'COUNCIL_FAILED',
        reply: 'تعذّر التحليل. لم تكتمل قراءة Odoo أو اتصال النماذج.',
        status: 'council_failed',
        participants: [],
        agreed: [],
      },
      { status: 500, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
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
