import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  canAuditorFetchColdLiveOdoo,
  fetchLiveOdooSnapshot,
  getReadOnlyOdooSnapshotStatus,
  sanitizeOdooPublicPayload,
  triggerManualOdooSync,
} from '@/lib/odoo-live-connector'
import { ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import {
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
  type ExecSessionRole,
} from '@/lib/auth/exec-session'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export const odooSyncResponseHeaders: Record<string, string> = {
  ...ENTERPRISE_API_SECURITY_HEADERS,
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
}

export interface VerifiedSyncCaller {
  userId: string
  role: ExecSessionRole | 'cron'
  isAuditor: boolean
  isCron: boolean
}

function verifyCronBearerHeader(authHeader: string | null): boolean {
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret || !authHeader) return false
  const expected = Buffer.from(`Bearer ${cronSecret}`, 'utf8')
  const candidate = Buffer.from(authHeader.trim(), 'utf8')
  if (expected.length !== candidate.length) return false
  return timingSafeEqual(expected, candidate)
}

export async function resolveVerifiedSyncCaller(
  request: NextRequest,
): Promise<VerifiedSyncCaller | null> {
  if (verifyCronBearerHeader(request.headers.get('authorization'))) {
    return {
      userId: 'vercel-cron',
      role: 'cron',
      isAuditor: false,
      isCron: true,
    }
  }

  const execRaw =
    request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
    request.cookies.get('aether_exec_session')?.value
  if (execRaw) {
    const execPayload = await verifyExecSessionToken(execRaw)
    if (execPayload?.sub) {
      return {
        userId: execPayload.sub,
        role: execPayload.role,
        isAuditor: execPayload.role === 'auditor',
        isCron: false,
      }
    }
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    const userId = await verifySessionToken(token)
    if (userId) {
      return {
        userId,
        role: 'admin',
        isAuditor: false,
        isCron: false,
      }
    }
  }

  try {
    const supabase = await createClient()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        return {
          userId: data.user.id,
          role: 'admin',
          isAuditor: false,
          isCron: false,
        }
      }
    }
  } catch {
    // no Supabase session
  }

  return null
}

/**
 * GET `/api/odoo-sync` & `/api/erp/odoo-sync`:
 * - `200 OK` for `admin`, `gm`, `dgm`, and `auditor`, plus valid Vercel Cron bearer token.
 * - Returns clean, secret-free telemetry:
 *   `{ connected, sourceMode, latestRecordAt, hoursSinceLatestRecord, isStaleOver24h, todaySalesKwd, todayOrders, syncCooldownRemainingSec, diagnosticCode }`
 */
export async function handleOdooSyncGetRequest(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) {
    return NextResponse.json(
      { ok: false, error: 'cross_site_refused' },
      { status: 403, headers: odooSyncResponseHeaders },
    )
  }

  const caller = await resolveVerifiedSyncCaller(request)
  if (!caller) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'Sign in to view Odoo sales telemetry.',
      },
      {
        status: 401,
        headers: { ...odooSyncResponseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  const periodParam = request.nextUrl.searchParams.get('period')

  if (caller.isAuditor) {
    const nowMs = Date.now()
    const roPayload = canAuditorFetchColdLiveOdoo(nowMs)
      ? await fetchLiveOdooSnapshot({
          period: periodParam,
          forceRefresh: false,
          readOnly: true,
          referenceNowMs: nowMs,
        })
      : getReadOnlyOdooSnapshotStatus(periodParam, nowMs)
    return NextResponse.json(
      sanitizeOdooPublicPayload({
        ...roPayload,
        ok: true,
        readOnly: true,
        role: 'auditor',
      }),
      { status: 200, headers: odooSyncResponseHeaders },
    )
  }

  const payload = await fetchLiveOdooSnapshot({
    period: periodParam,
    forceRefresh: caller.isCron,
    readOnly: false,
    referenceNowMs: Date.now(),
  })

  return NextResponse.json(
    sanitizeOdooPublicPayload({
      ...payload,
      ok: true,
      readOnly: false,
      role: caller.role,
    }),
    { status: 200, headers: odooSyncResponseHeaders },
  )
}

/**
 * POST `/api/odoo-sync` & `/api/erp/odoo-sync`:
 * - Authorized ONLY for `admin`, `gm`, `dgm`, or `Authorization: Bearer ${process.env.CRON_SECRET}`.
 * - `auditor` strictly receives `403 Forbidden`.
 * - Enforces a 30-second rate-limit cooldown (`syncCooldownRemainingSec`) so rapid clicks never overload Odoo,
 *   busts cache when ready, pulls fresh live Odoo 17 `read_group` aggregates, and returns updated totals + `latestRecordAt`.
 */
export async function handleOdooSyncPostRequest(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) {
    return NextResponse.json(
      { ok: false, error: 'cross_site_refused' },
      { status: 403, headers: odooSyncResponseHeaders },
    )
  }

  const caller = await resolveVerifiedSyncCaller(request)
  if (!caller) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'Sign in to trigger Odoo live sync.',
      },
      {
        status: 401,
        headers: { ...odooSyncResponseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  if (caller.isAuditor) {
    return NextResponse.json(
      {
        ok: false,
        error: 'forbidden_auditor_readonly',
        message: 'Read-only auditor session cannot trigger live Odoo sync.',
        errorAr: 'حساب مراجعة للقراءة فقط — تحديث ربط أودو محصور بالإدارة التنفيذية.',
      },
      { status: 403, headers: odooSyncResponseHeaders },
    )
  }

  const periodParam = request.nextUrl.searchParams.get('period')
  const syncedPayload = await triggerManualOdooSync({
    period: periodParam,
    isCron: caller.isCron,
    referenceNowMs: Date.now(),
  })

  return NextResponse.json(
    sanitizeOdooPublicPayload({
      ...syncedPayload,
      ok: true,
      readOnly: false,
      role: caller.role,
      manualRefresh: true,
    }),
    { status: 200, headers: odooSyncResponseHeaders },
  )
}

export async function handleOdooSyncRequest(request: NextRequest) {
  if (request.method.toUpperCase() === 'POST') {
    return handleOdooSyncPostRequest(request)
  }
  return handleOdooSyncGetRequest(request)
}

export async function GET(request: NextRequest) {
  return handleOdooSyncGetRequest(request)
}

export async function POST(request: NextRequest) {
  return handleOdooSyncPostRequest(request)
}
