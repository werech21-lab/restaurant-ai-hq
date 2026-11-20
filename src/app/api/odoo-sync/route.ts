import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { stripExcludedOdooTree } from '@/lib/odoo/excluded-entities'
import { isSameSiteRequest } from '@/lib/odoo/live-sync-core'
import {
  canAuditorFetchColdLiveOdoo,
  fetchLiveOdooCustomBucket,
  fetchLiveOdooSnapshot,
  getReadOnlyOdooSnapshotStatus,
  sanitizeOdooPublicPayload,
  triggerManualOdooSync,
} from '@/lib/odoo-live-connector'
import { dispatchAdminStalenessAlertIfNeeded } from '@/lib/odoo-staleness-notifier'
import { computeTerminalMappingLedgerSnapshot } from '@/lib/odoo-terminal-mappings'
import { ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import {
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
  type ExecSessionRole,
} from '@/lib/auth/exec-session'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { resolveSupabaseExecAccess } from '@/lib/auth/supabase-access'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export const odooSyncResponseHeaders: Record<string, string> = {
  ...ENTERPRISE_API_SECURITY_HEADERS,
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
}

export const odooSyncSwrGetHeaders: Record<string, string> = {
  ...ENTERPRISE_API_SECURITY_HEADERS,
  'cache-control': 'private, max-age=30, stale-while-revalidate=300',
  vary: 'Cookie, Authorization',
  'x-content-type-options': 'nosniff',
}

export function isForceRefreshSearchParams(sp: URLSearchParams): boolean {
  const force = (sp.get('force') ?? '').trim().toLowerCase()
  const forceRefresh = (sp.get('forceRefresh') ?? '').trim().toLowerCase()
  return (
    force === '1' ||
    force === 'true' ||
    forceRefresh === '1' ||
    forceRefresh === 'true'
  )
}

export function buildOdooReadResponseHeaders(forceRefresh: boolean): Record<string, string> {
  return forceRefresh ? odooSyncResponseHeaders : odooSyncSwrGetHeaders
}

const serverReadInflightMaps = new Set<Map<string, Promise<unknown>>>()

export function createServerGetInflightMap<T>(): Map<string, Promise<T>> {
  const map = new Map<string, Promise<T>>()
  serverReadInflightMaps.add(map as Map<string, Promise<unknown>>)
  return map
}

export function clearAllServerOdooReadInflight(): void {
  for (const map of serverReadInflightMaps) {
    map.clear()
  }
}

export function deduplicateServerGet<T>(
  inflightMap: Map<string, Promise<T>>,
  key: string,
  forceRefresh: boolean,
  task: () => Promise<T>,
): Promise<T> {
  if (forceRefresh) {
    inflightMap.delete(key)
    return task()
  }
  const existing = inflightMap.get(key)
  if (existing) {
    return existing
  }
  const pending = task().finally(() => {
    if (inflightMap.get(key) === pending) {
      inflightMap.delete(key)
    }
  })
  inflightMap.set(key, pending)
  return pending
}

const odooSyncGetInflight = createServerGetInflightMap<Record<string, unknown>>()

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
    const legacy = await verifySessionToken(token)
    if (legacy) {
      return {
        userId: legacy.userId,
        role: legacy.role,
        isAuditor: legacy.role === 'auditor',
        isCron: false,
      }
    }
  }

  const access = await resolveSupabaseExecAccess()
  if (access.status === 'allowed') {
    return {
      userId: access.userId,
      role: access.role,
      isAuditor: access.role === 'auditor',
      isCron: false,
    }
  }

  return null
}

/**
 * GET `/api/odoo-sync` & `/api/erp/odoo-sync`:
 * - `200 OK` for `admin`, `gm`, `dgm`, `ops`, `cfo`, and `auditor`, plus valid Vercel Cron bearer token.
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

  const sp = request.nextUrl.searchParams
  const periodParam = sp.get('period')
  const fromParam = sp.get('from')
  const toParam = sp.get('to')
  const forceRefresh = caller.isCron || isForceRefreshSearchParams(sp)
  const responseHeaders = buildOdooReadResponseHeaders(forceRefresh)

  if (caller.isAuditor) {
    const auditorKey = `auditor:${periodParam ?? 'month'}:${fromParam ?? ''}:${toParam ?? ''}`
    const auditorPayload = await deduplicateServerGet(
      odooSyncGetInflight,
      auditorKey,
      forceRefresh,
      async () => {
        const nowMs = Date.now()
        const baseRoPayload = canAuditorFetchColdLiveOdoo(nowMs)
          ? await fetchLiveOdooSnapshot({
              period: periodParam,
              customFrom: fromParam,
              customTo: toParam,
              forceRefresh: false,
              readOnly: true,
              referenceNowMs: nowMs,
            })
          : getReadOnlyOdooSnapshotStatus(periodParam, nowMs)
        const customBkt =
          baseRoPayload.connected &&
          periodParam === 'custom' &&
          fromParam &&
          toParam &&
          !baseRoPayload.customBucket
            ? await fetchLiveOdooCustomBucket(fromParam, toParam, nowMs)
            : undefined
        const roPayload = customBkt ? { ...baseRoPayload, customBucket: customBkt } : baseRoPayload
        const {
          diagnosticCode: _omitAuditorDiag,
          envConfigured: _omitAuditorEnv,
          unmappedTerminals: _omitAuditorTerms,
          ...cleanRoPayload
        } = roPayload
        void _omitAuditorDiag
        void _omitAuditorEnv
        void _omitAuditorTerms
        return sanitizeOdooPublicPayload(
          stripExcludedOdooTree({
            ...cleanRoPayload,
            ok: true,
            readOnly: true,
            role: 'auditor',
          }),
        ) as Record<string, unknown>
      },
    )
    return NextResponse.json(auditorPayload, { status: 200, headers: responseHeaders })
  }

  const execKey = `${caller.role}:${periodParam ?? 'month'}:${fromParam ?? ''}:${toParam ?? ''}`
  const execPayload = await deduplicateServerGet(
    odooSyncGetInflight,
    execKey,
    forceRefresh,
    async () => {
      const payload = await fetchLiveOdooSnapshot({
        period: periodParam,
        customFrom: fromParam,
        customTo: toParam,
        forceRefresh,
        readOnly: false,
        referenceNowMs: Date.now(),
      })

      const staleTelemetry = payload.connected
        ? await dispatchAdminStalenessAlertIfNeeded({
            hoursSinceLatestRecord: payload.hoursSinceLatestRecord,
            isStaleOver24h: payload.isStaleOver24h,
            latestRecordAt: payload.latestRecordAt,
            kuwaitTimestamp: payload.kuwaitSyncedAt,
          })
        : { adminAlertDispatched: false, channels: [] as string[] }

      const isAdminCaller = caller.role === 'admin'
      const { diagnosticCode, envConfigured, unmappedTerminals, ...restPayload } = payload

      return sanitizeOdooPublicPayload(
        stripExcludedOdooTree({
          ...restPayload,
          ...(isAdminCaller || caller.isCron ? { diagnosticCode, envConfigured } : {}),
          ...(isAdminCaller && unmappedTerminals ? { unmappedTerminals } : {}),
          ...(isAdminCaller
            ? {
                reconciliationReport: computeTerminalMappingLedgerSnapshot().reconciliationReport,
                adminAlertDispatched: staleTelemetry.adminAlertDispatched,
                alertChannels: staleTelemetry.channels,
                stalenessAlert: {
                  adminAlertDispatched: staleTelemetry.adminAlertDispatched,
                  channels: staleTelemetry.channels,
                },
              }
            : {}),
          ok: true,
          readOnly: false,
          role: caller.role,
        }),
      ) as Record<string, unknown>
    },
  )

  return NextResponse.json(execPayload, { status: 200, headers: responseHeaders })
}

/**
 * POST `/api/odoo-sync` & `/api/erp/odoo-sync`:
 * - Authorized ONLY for `admin`, `gm`, `dgm`, `ops`, `cfo`, or `Authorization: Bearer ${process.env.CRON_SECRET}`.
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

  if (!caller.isCron && !canTriggerManualOdooSync(caller.role as ExecSessionRole)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'forbidden_sync_role_restricted',
        message: 'Manual live Odoo sync is restricted to Admin, GM, DGM, Operations, and Finance.',
        errorAr: 'تحديث ربط أودو المباشر محصور بمسؤول النظام والإدارة التنفيذية والمالية والعمليات.',
      },
      { status: 403, headers: odooSyncResponseHeaders },
    )
  }

  clearAllServerOdooReadInflight()

  const periodParam = request.nextUrl.searchParams.get('period')
  const fromParam = request.nextUrl.searchParams.get('from')
  const toParam = request.nextUrl.searchParams.get('to')
  const syncedPayload = await triggerManualOdooSync({
    period: periodParam,
    customFrom: fromParam,
    customTo: toParam,
    isCron: caller.isCron,
    referenceNowMs: Date.now(),
  })

  clearAllServerOdooReadInflight()

  const staleTelemetry = syncedPayload.connected
    ? await dispatchAdminStalenessAlertIfNeeded({
        hoursSinceLatestRecord: syncedPayload.hoursSinceLatestRecord,
        isStaleOver24h: syncedPayload.isStaleOver24h,
        latestRecordAt: syncedPayload.latestRecordAt,
        kuwaitTimestamp: syncedPayload.kuwaitSyncedAt,
      })
    : { adminAlertDispatched: false, channels: [] as string[] }

  const isAdminCaller = caller.role === 'admin'
  const {
    diagnosticCode,
    envConfigured,
    unmappedTerminals,
    ...restSyncedPayload
  } = syncedPayload

  return NextResponse.json(
    sanitizeOdooPublicPayload(stripExcludedOdooTree({
      ...restSyncedPayload,
      ...(isAdminCaller || caller.isCron ? { diagnosticCode, envConfigured } : {}),
      ...(isAdminCaller && unmappedTerminals ? { unmappedTerminals } : {}),
      ...(isAdminCaller
        ? {
            reconciliationReport: computeTerminalMappingLedgerSnapshot().reconciliationReport,
            adminAlertDispatched: staleTelemetry.adminAlertDispatched,
            alertChannels: staleTelemetry.channels,
            stalenessAlert: {
              adminAlertDispatched: staleTelemetry.adminAlertDispatched,
              channels: staleTelemetry.channels,
            },
          }
        : {}),
      ok: true,
      readOnly: false,
      role: caller.role,
      manualRefresh: true,
    })),
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
