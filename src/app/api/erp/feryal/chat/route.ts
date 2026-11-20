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
  resolveFeryalQuestionPeriod,
  UNATTRIBUTED_BRANCH_LABEL_AR,
  validateFeryalContextDefaults,
} from '@/lib/feryal-odoo-agent'
import {
  buildFeryalFrozenScope,
  isConfirmedSheetFollowUpQuestion,
} from '@/lib/feryal-intent'
import {
  isConfirmedPriceSheet,
  isUnconfirmedDocumentDraft,
  type ConfirmedPriceSheet,
} from '@/lib/feryal/document-intake-types'
import { UNCONFIRMED_DRAFT_REJECTED_ERROR } from '@/lib/feryal/executive-advisor'
import {
  buildFeryalChatDiagnostics,
  computeFeryalChatFrozenScope,
  inferBrandIdFromConfirmedSheet,
  runExecutivePricingChat,
  shouldRunExecutivePricingChat,
} from '@/lib/feryal/executive-chat-runner'
import { logger, errorFields } from '@/lib/logger'
import { runFeryalCouncil } from '@/server/ai/council'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export interface FeryalChatPostBody {
  prompt?: string
  question?: string
  message?: string
  period?: string
  periodLabel?: string | null
  customFrom?: string
  customTo?: string
  branch?: string
  brand?: string
  channel?: string
  confirmedPriceSheet?: unknown
  isFollowUpOnConfirmedSheet?: boolean
  activePriceSheetSummary?: string | null
  priceSheet?: unknown
  draft?: unknown
  intakeDraft?: unknown
}

function unconfirmedDraftRejectedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: 'HUMAN_CONFIRMATION_REQUIRED',
      code: UNCONFIRMED_DRAFT_REJECTED_ERROR,
      message:
        'Extracted drafts (Extracted Draft (Unconfirmed)) must be reviewed and confirmed by a human (User Input (Confirmed)) before running executive simulations.',
    },
    { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
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

  if (body.draft !== undefined || body.intakeDraft !== undefined) {
    return unconfirmedDraftRejectedResponse()
  }

  let confirmedPriceSheet: ConfirmedPriceSheet | null = null
  const sheetCandidate =
    body.confirmedPriceSheet !== undefined ? body.confirmedPriceSheet : body.priceSheet

  if (sheetCandidate !== undefined && sheetCandidate !== null) {
    if (isUnconfirmedDocumentDraft(sheetCandidate) || !isConfirmedPriceSheet(sheetCandidate)) {
      return unconfirmedDraftRejectedResponse()
    }
    if (sheetCandidate.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'EMPTY_CONFIRMED_PRICE_SHEET',
          message: 'Confirmed price sheet must contain at least one active SKU row.',
        },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    confirmedPriceSheet = sheetCandidate
  }

  const rawPeriod = typeof body.period === 'string' ? body.period : null
  const requestedPeriodLabel =
    typeof body.periodLabel === 'string' && body.periodLabel.trim()
      ? body.periodLabel.trim().slice(0, 200)
      : null
  const isFollowUpOnConfirmedSheet = body.isFollowUpOnConfirmedSheet === true
  const activePriceSheetSummaryInput =
    typeof body.activePriceSheetSummary === 'string' && body.activePriceSheetSummary.trim()
      ? body.activePriceSheetSummary.trim().slice(0, 4000)
      : null

  const validatedDefaults = validateFeryalContextDefaults({
    period: rawPeriod,
    customFrom: typeof body.customFrom === 'string' ? body.customFrom : null,
    customTo: typeof body.customTo === 'string' ? body.customTo : null,
    branch: typeof body.branch === 'string' ? body.branch : null,
    brand: typeof body.brand === 'string' ? body.brand : null,
    channel: typeof body.channel === 'string' ? body.channel : null,
  })

  const rawQuestion =
    (typeof body.question === 'string' && body.question.trim()) ||
    (typeof body.prompt === 'string' && body.prompt.trim()) ||
    (typeof body.message === 'string' && body.message.trim()) ||
    (confirmedPriceSheet
      ? `Run 3-scenario executive pricing simulation on confirmed price sheet (${confirmedPriceSheet.fileName})`
      : '')

  if (!rawQuestion) {
    const emptyResolvedPeriod = resolveFeryalQuestionPeriod('', undefined, validatedDefaults)
    const emptyFrozenScope = buildFeryalFrozenScope({
      dateFrom: emptyResolvedPeriod.from,
      dateTo: emptyResolvedPeriod.to,
      validatedPeriod: validatedDefaults.period,
      rawPeriodKey: rawPeriod,
      requestedPeriodLabel,
      hasExplicitPeriod: false,
      brandId: validatedDefaults.brandId,
      branchId: validatedDefaults.branchId,
      channelId: validatedDefaults.channelId,
    })
    return NextResponse.json(
      {
        ok: true,
        reply: FERYAL_NO_ODOO_DATA_REPLY,
        status: 'no_odoo_data',
        executedQueries: [],
        verifier: { valid: true, extractedNumbers: [], unverifiedNumbers: [] },
        frozenScope: emptyFrozenScope,
        activePriceSheetSummary: null,
        timestamp: new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const safeQuestion = rawQuestion.slice(0, 2000)
  const sheetAppliesToTurn =
    confirmedPriceSheet !== null &&
    (!isFollowUpOnConfirmedSheet || isConfirmedSheetFollowUpQuestion(safeQuestion))
  const effectiveBrandId =
    validatedDefaults.brandId ??
    (sheetAppliesToTurn ? inferBrandIdFromConfirmedSheet(confirmedPriceSheet) : null)

  try {
    const contextDefaults = {
      period: validatedDefaults.period,
      customFrom: validatedDefaults.customFrom,
      customTo: validatedDefaults.customTo,
      branch: validatedDefaults.branchId,
      brand: effectiveBrandId,
      channel: validatedDefaults.channelId,
    }

    if (
      shouldRunExecutivePricingChat(safeQuestion, {
        confirmedPriceSheet,
        isFollowUpOnConfirmedSheet,
      })
    ) {
      const execResult = await runExecutivePricingChat({
        question: safeQuestion,
        userId: authGuard.session.sub,
        userRole: authGuard.session.role,
        userNameAr: authGuard.session.nameAr,
        periodLabel: requestedPeriodLabel,
        isFollowUpOnConfirmedSheet,
        activePriceSheetSummary: activePriceSheetSummaryInput,
        context: contextDefaults,
        ...(confirmedPriceSheet ? { confirmedPriceSheet } : {}),
      })
      const execAgreedLabel = execResult.agreed
        .map((item) => `${item.provider}/${item.modelId}`)
        .join(' · ')
      return NextResponse.json(
        {
          ok: true,
          reply: execResult.reply,
          status: execResult.status,
          provider: 'odoo-council',
          model: execAgreedLabel,
          participants: execResult.participants,
          agreed: execResult.agreed,
          executedQueries: execResult.executedQueries,
          verifier: execResult.verifier,
          period: execResult.period,
          frozenScope: execResult.frozenScope,
          activePriceSheetSummary: execResult.activePriceSheetSummary,
          diagnostics: execResult.diagnostics,
          auditEntry: execResult.auditEntry,
          timestamp: new Date().toISOString(),
        },
        { headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }

    const result = await runFeryalCouncil({
      question: safeQuestion,
      userId: authGuard.session.sub,
      userRole: authGuard.session.role,
      userNameAr: authGuard.session.nameAr,
      context: contextDefaults,
    })
    const frozenScope = computeFeryalChatFrozenScope({
      question: safeQuestion,
      period: result.period,
      rawPeriodInput: rawPeriod,
      requestedPeriodLabel,
      context: contextDefaults,
    })
    const diagnostics = buildFeryalChatDiagnostics(
      'odoo_council',
      result.participants,
      result.agreed.length >= 2,
      result.status === 'answered' && result.agreed.length < 2,
    )
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
        frozenScope,
        activePriceSheetSummary: null,
        diagnostics,
        auditEntry: result.auditEntry,
        timestamp: result.auditEntry?.timestampIso ?? new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch (error) {
    if (error instanceof Error && error.message === UNCONFIRMED_DRAFT_REJECTED_ERROR) {
      return unconfirmedDraftRejectedResponse()
    }
    logger.error('feryal council failed', errorFields(error))
    const fallbackPeriod = resolveFeryalQuestionPeriod(safeQuestion, undefined, validatedDefaults)
    const fallbackFrozenScope = buildFeryalFrozenScope({
      dateFrom: fallbackPeriod.from,
      dateTo: fallbackPeriod.to,
      validatedPeriod: validatedDefaults.period,
      rawPeriodKey: rawPeriod,
      requestedPeriodLabel,
      hasExplicitPeriod: fallbackPeriod.hasExplicitPeriod,
      brandId: effectiveBrandId,
      branchId: validatedDefaults.branchId,
      channelId: validatedDefaults.channelId,
    })
    return NextResponse.json(
      {
        ok: false,
        error: 'COUNCIL_FAILED',
        reply: 'تعذّر التحليل. لم تكتمل قراءة Odoo أو اتصال النماذج.',
        status: 'council_failed',
        participants: [],
        agreed: [],
        frozenScope: fallbackFrozenScope,
        activePriceSheetSummary: null,
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
