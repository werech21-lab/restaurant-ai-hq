import { NextResponse, type NextRequest } from 'next/server'
import { getKuwaitTodayIso } from '@/lib/aether/period-delta'
import { SALARY_WINDOW_DAYS } from '@/lib/aether/salary-window'
import {
  BOOTH_EVENT_GAP_DAYS,
  BOOTH_POS_CONFIG_IDS,
  CANTEEN_POS_CONFIG_IDS,
  CANTEEN_TERM_GAP_DAYS,
  SEASON_DETECTION_BUDGET_MS,
  SEASON_DETECTION_TIMEZONE,
  SEASON_HISTORY_START_KUWAIT,
  isValidIsoDate,
  runSeasonDetection,
  sanitizeErrorText,
  serializeSeasonDetectionCsv,
  type QueryMode,
  type SeasonDetectionError,
  type SeasonDetectionReport,
} from '@/lib/aether/season-detection'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
  type ExecApiGuardFailure,
  type ExecApiGuardSuccess,
} from '@/lib/auth/api-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function requireAdminOrAuditor(
  request: NextRequest,
): Promise<ExecApiGuardSuccess | ExecApiGuardFailure> {
  const guard = await requireExecApiSession(request, { allowAuditor: true })
  if (!guard.ok) {
    return guard
  }

  if (guard.session.role !== 'admin' && guard.session.role !== 'auditor') {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'forbidden_admin_or_auditor_only',
          message: 'Admin or Auditor role is required to access season detection.',
          errorAr: 'هذه الصلاحية محصورة بمسؤول النظام أو المراجع فقط.',
        },
        { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
      ),
    }
  }

  return guard
}

function buildBadRequestResponse(message: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: 'invalid_query_parameter',
      message,
    },
    { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

function buildFallbackPartialReport(params: {
  fromKuwaitDate: string
  toKuwaitDate: string
  startedAtMs: number
  err: unknown
}): SeasonDetectionReport {
  const systemError: SeasonDetectionError = {
    scope: 'system',
    code: 'ODOO_RPC_ERROR',
    message: sanitizeErrorText(params.err),
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    timezone: SEASON_DETECTION_TIMEZONE,
    window: {
      fromKuwaitDate: params.fromKuwaitDate,
      toKuwaitDate: params.toKuwaitDate,
    },
    budgetMs: SEASON_DETECTION_BUDGET_MS,
    elapsedMs: Math.max(0, Date.now() - params.startedAtMs),
    partial: true,
    errors: [systemError],
    salaryWindow: SALARY_WINDOW_DAYS,
    canteens: {
      configIds: [...CANTEEN_POS_CONFIG_IDS],
      gapThresholdDays: CANTEEN_TERM_GAP_DAYS,
      fromKuwaitDate: params.fromKuwaitDate,
      toKuwaitDate: params.toKuwaitDate,
      perConfig: CANTEEN_POS_CONFIG_IDS.map((configId) => ({
        configId,
        activeStatus: 'unknown',
        daily: [],
        terms: [],
        totalOrders: 0,
        totalNetKwd: 0,
        sellingDays: 0,
        partial: true,
        errors: [systemError],
      })),
      combined: {
        daily: [],
        terms: [],
        totalOrders: 0,
        totalNetKwd: 0,
        sellingDays: 0,
      },
      partial: true,
      errors: [systemError],
    },
    booths: {
      configIds: [...BOOTH_POS_CONFIG_IDS],
      gapThresholdDays: BOOTH_EVENT_GAP_DAYS,
      fromKuwaitDate: params.fromKuwaitDate,
      toKuwaitDate: params.toKuwaitDate,
      daily: [],
      events: [],
      perConfig: BOOTH_POS_CONFIG_IDS.map((configId) => ({
        configId,
        activeStatus: 'unknown',
        daily: [],
        totalOrders: 0,
        totalNetKwd: 0,
        sellingDays: 0,
        partial: true,
        errors: [systemError],
      })),
      totalOrders: 0,
      totalNetKwd: 0,
      sellingDays: 0,
      partial: true,
      errors: [systemError],
    },
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await requireAdminOrAuditor(request)
  if (!guard.ok) {
    return guard.response
  }

  const searchParams = request.nextUrl.searchParams
  const format =
    searchParams.get('format')?.trim().toLowerCase() === 'csv' ? 'csv' : 'json'

  const rawMode = searchParams.get('mode')?.trim()
  let mode: QueryMode = 'read_group'
  if (rawMode && rawMode.length > 0) {
    if (rawMode !== 'read_group' && rawMode !== 'search_read') {
      return buildBadRequestResponse(
        'Invalid mode parameter: expected "read_group" or "search_read".',
      )
    }
    mode = rawMode
  }

  const rawFrom = searchParams.get('from')?.trim()
  let fromKuwaitDate: string = SEASON_HISTORY_START_KUWAIT
  if (rawFrom && rawFrom.length > 0) {
    if (!isValidIsoDate(rawFrom)) {
      return buildBadRequestResponse(
        'Invalid from parameter: expected valid YYYY-MM-DD calendar date.',
      )
    }
    fromKuwaitDate = rawFrom
  }

  const rawTo = searchParams.get('to')?.trim()
  let toKuwaitDate: string = getKuwaitTodayIso()
  if (rawTo && rawTo.length > 0) {
    if (!isValidIsoDate(rawTo)) {
      return buildBadRequestResponse(
        'Invalid to parameter: expected valid YYYY-MM-DD calendar date.',
      )
    }
    toKuwaitDate = rawTo
  }

  if (toKuwaitDate < fromKuwaitDate) {
    return buildBadRequestResponse(
      'Invalid date range: "to" must be on or after "from".',
    )
  }

  const startedAtMs = Date.now()
  let report: SeasonDetectionReport
  try {
    report = await runSeasonDetection({
      fromKuwaitDate,
      toKuwaitDate,
      mode,
      budgetMs: SEASON_DETECTION_BUDGET_MS,
    })
  } catch (err) {
    report = buildFallbackPartialReport({
      fromKuwaitDate,
      toKuwaitDate,
      startedAtMs,
      err,
    })
  }

  const partialHeader = report.partial ? 'true' : 'false'

  if (format === 'csv') {
    return new NextResponse(serializeSeasonDetectionCsv(report), {
      status: 200,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="season-detection.csv"',
        'X-Season-Detection-Partial': partialHeader,
      },
    })
  }

  return NextResponse.json(report, {
    status: 200,
    headers: {
      ...ENTERPRISE_API_SECURITY_HEADERS,
      'X-Season-Detection-Partial': partialHeader,
    },
  })
}

function buildMethodNotAllowedResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: 'method_not_allowed',
      message: 'Season detection endpoint is strictly read-only (GET only).',
    },
    {
      status: 405,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        Allow: 'GET',
      },
    },
  )
}

export async function POST(): Promise<NextResponse> {
  return buildMethodNotAllowedResponse()
}

export async function PUT(): Promise<NextResponse> {
  return buildMethodNotAllowedResponse()
}

export async function PATCH(): Promise<NextResponse> {
  return buildMethodNotAllowedResponse()
}

export async function DELETE(): Promise<NextResponse> {
  return buildMethodNotAllowedResponse()
}
