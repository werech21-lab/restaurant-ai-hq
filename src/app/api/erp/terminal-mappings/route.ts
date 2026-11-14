import { NextResponse, type NextRequest } from 'next/server'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireAdminOnlyApiSession,
} from '@/lib/auth/api-guard'
import { checkRequestOrigin } from '@/lib/http-origin'
import {
  bustOdooLiveCache,
  fetchLiveOdooSnapshot,
  sanitizeOdooPublicPayload,
} from '@/lib/odoo-live-connector'
import {
  computeTerminalMappingLedgerSnapshot,
  normalizeTargetBranchInput,
  setAdminPosTerminalMapping,
  type ActiveVentureBranchId,
} from '@/lib/odoo-terminal-mappings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function enforceSameOriginIfBrowser(request: NextRequest): NextResponse | null {
  const hasOriginMeta =
    Boolean(request.headers.get('origin')) ||
    Boolean(request.headers.get('sec-fetch-site'))
  if (!hasOriginMeta) return null
  const verdict = checkRequestOrigin(request)
  if (!verdict.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'cross_origin_refused',
        errorAr: 'تم رفض الطلب من مصدر خارجي غير مصرح به.',
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
  return null
}

/**
 * GET `/api/erp/terminal-mappings`
 * Strictly Admin-Only (`role === 'admin'`).
 * Auto-discovers every unmapped Odoo 17 `pos.config` terminal (`terminal_id`, `terminal_name`,
 * `orders_count`, `net_sales_kwd`) alongside the 7 active Venture Foods branches and reconciled company totals.
 */
export async function GET(request: NextRequest) {
  const guard = await requireAdminOnlyApiSession(request)
  if (!guard.ok) return guard.response

  // Ensure live Odoo discovery cache is warm when Odoo 17 env is configured
  await fetchLiveOdooSnapshot({ period: 'month', forceRefresh: false }).catch(() => null)
  const snapshot = computeTerminalMappingLedgerSnapshot()

  return NextResponse.json(
    {
      ok: true,
      role: guard.session.role,
      ...snapshot,
    },
    { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

interface ParsedTerminalMappingItem {
  terminal_id: number
  branch_id: ActiveVentureBranchId | null
}

async function handleUpsertMappings(request: NextRequest) {
  const csrfDenied = enforceSameOriginIfBrowser(request)
  if (csrfDenied) return csrfDenied

  const guard = await requireAdminOnlyApiSession(request)
  if (!guard.ok) return guard.response

  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_json',
        errorAr: 'بيانات الطلب غير صالحة.',
      },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const rawItems: unknown[] = Array.isArray(body.mappings)
    ? body.mappings
    : [body]

  if (rawItems.length === 0 || rawItems.length > 100) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_mappings_payload',
        errorAr: 'يرجى تحديد جهاز كاشير واحد على الأقل للربط.',
      },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const parsedItems: ParsedTerminalMappingItem[] = []
  for (const entry of rawItems) {
    const obj = (entry ?? {}) as Record<string, unknown>
    const rawTid = obj.terminal_id ?? obj.terminalId
    const tid = Number(rawTid)
    if (!Number.isInteger(tid) || tid <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_terminal_id',
          errorAr: 'معرّف جهاز الكاشير غير صالح.',
        },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    const rawBranch = obj.branch_id ?? obj.branchId
    const normalizedBranch = normalizeTargetBranchInput(rawBranch)
    if (normalizedBranch === 'invalid') {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_branch_id',
          message:
            'branch_id must be one of the 7 active Venture Foods branches (salmiya, ardiya, al-kout, promenade, 360-mall, avenues, assima) or null.',
          errorAr: 'يرجى اختيار أحد فروع فنتشر فودز السبعة النشطة.',
        },
        { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    parsedItems.push({ terminal_id: tid, branch_id: normalizedBranch })
  }

  for (const item of parsedItems) {
    setAdminPosTerminalMapping({
      terminalId: item.terminal_id,
      branchId: item.branch_id,
      updatedBy: guard.session.sub,
    })
  }

  // Bust Odoo live/baseline snapshot cache so `/api/erp/odoo-sync` reflects the reallocation immediately
  bustOdooLiveCache({ clearLastKnownGood: true })
  const freshLive = await fetchLiveOdooSnapshot({
    period: 'month',
    forceRefresh: true,
  }).catch(() => null)

  const updatedSnapshot = computeTerminalMappingLedgerSnapshot()

  return NextResponse.json(
    {
      ok: true,
      role: guard.session.role,
      ...updatedSnapshot,
      ...(freshLive
        ? { liveSummary: sanitizeOdooPublicPayload(freshLive) }
        : {}),
    },
    { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function POST(request: NextRequest) {
  return handleUpsertMappings(request)
}

export async function PUT(request: NextRequest) {
  return handleUpsertMappings(request)
}

export async function DELETE(request: NextRequest) {
  const csrfDenied = enforceSameOriginIfBrowser(request)
  if (csrfDenied) return csrfDenied

  const guard = await requireAdminOnlyApiSession(request)
  if (!guard.ok) return guard.response

  const tidParam =
    request.nextUrl.searchParams.get('terminal_id') ??
    request.nextUrl.searchParams.get('terminalId')
  let tid = tidParam ? Number(tidParam) : NaN
  if (!Number.isInteger(tid) || tid <= 0) {
    try {
      const body = (await request.json()) as Record<string, unknown>
      tid = Number(body.terminal_id ?? body.terminalId)
    } catch {
      // ignore empty body
    }
  }

  if (!Number.isInteger(tid) || tid <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_terminal_id',
        errorAr: 'معرّف جهاز الكاشير غير صالح.',
      },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  setAdminPosTerminalMapping({
    terminalId: tid,
    branchId: null,
    updatedBy: guard.session.sub,
  })
  bustOdooLiveCache({ clearLastKnownGood: true })
  const freshLive = await fetchLiveOdooSnapshot({
    period: 'month',
    forceRefresh: true,
  }).catch(() => null)
  const updatedSnapshot = computeTerminalMappingLedgerSnapshot()

  return NextResponse.json(
    {
      ok: true,
      role: guard.session.role,
      ...updatedSnapshot,
      ...(freshLive
        ? { liveSummary: sanitizeOdooPublicPayload(freshLive) }
        : {}),
    },
    { status: 200, headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}
