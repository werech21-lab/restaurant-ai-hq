import { NextResponse, type NextRequest } from 'next/server'
import snapshot from '@/lib/odoo-live-snapshot.json'
import {
  computeOdooFreshnessStatus,
  fetchLiveOdooSummary,
  hasOdooCredentials,
  isSameSiteRequest,
  parseBucketKey,
  periodWindowForBucket,
  summaryFromSnapshot,
  type OdooLiveSummary,
} from '@/lib/odoo/live-sync-core'
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

/** Live pulls are throttled per period bucket so the topbar/footer never hammers Odoo. */
const MIN_INTERVAL_MS = 60_000
const cacheByBucket = new Map<string, { at: number; data: OdooLiveSummary }>()

const responseHeaders: Record<string, string> = {
  ...ENTERPRISE_API_SECURITY_HEADERS,
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
}

function formatKuwaitSyncStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return `${formatted.replace(',', '')} UTC+3`
  } catch {
    return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
  }
}

interface VerifiedSyncCaller {
  userId: string
  role: ExecSessionRole
  isAuditor: boolean
}

async function resolveVerifiedSyncCaller(
  request: NextRequest,
): Promise<VerifiedSyncCaller | null> {
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
        }
      }
    }
  } catch {
    // no Supabase session
  }

  return null
}

export async function handleOdooSyncRequest(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) {
    return NextResponse.json(
      { ok: false, error: 'cross_site_refused' },
      { status: 403, headers: responseHeaders },
    )
  }

  const caller = await resolveVerifiedSyncCaller(request)
  if (!caller) {
    return NextResponse.json(
      {
        ok: false,
        error: 'unauthorized',
        message: 'Sign in to view Odoo sales figures.',
      },
      {
        status: 401,
        headers: { ...responseHeaders, 'www-authenticate': 'Session' },
      },
    )
  }

  const bucket = parseBucketKey(request.nextUrl.searchParams.get('period'))
  const referenceNowMs = Date.now()

  // Read-only auditor sessions receive a clean 200 OK status snapshot with zero live write/RPC calls
  if (caller.isAuditor) {
    const cached = cacheByBucket.get(bucket)
    const base =
      cached?.data ??
      summaryFromSnapshot(
        snapshot,
        'Read-only auditor session: displaying verified Odoo 17 ledger snapshot.',
        bucket,
      )
    const honestIso = base.latestRecordAt ?? base.syncedAt
    const freshness = computeOdooFreshnessStatus(honestIso, referenceNowMs)
    return NextResponse.json(
      {
        ...base,
        ok: true,
        readOnly: true,
        role: 'auditor',
        syncedAt: freshness.latestRecordIso,
        latestRecordAt: freshness.latestRecordIso,
        kuwaitSyncedAt: formatKuwaitSyncStamp(freshness.latestRecordIso),
        hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
        isStaleOver24h: freshness.isStaleOver24h,
      },
      { status: 200, headers: responseHeaders },
    )
  }

  const cached = cacheByBucket.get(bucket)
  if (cached && referenceNowMs - cached.at < MIN_INTERVAL_MS) {
    const honestIso = cached.data.latestRecordAt ?? cached.data.syncedAt
    const freshness = computeOdooFreshnessStatus(honestIso, referenceNowMs)
    return NextResponse.json(
      {
        ...cached.data,
        ok: true,
        readOnly: false,
        role: caller.role,
        cached: true,
        syncedAt: freshness.latestRecordIso,
        latestRecordAt: freshness.latestRecordIso,
        kuwaitSyncedAt: formatKuwaitSyncStamp(freshness.latestRecordIso),
        hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
        isStaleOver24h: freshness.isStaleOver24h,
      },
      { status: 200, headers: responseHeaders },
    )
  }

  const env = {
    ODOO_URL: process.env.ODOO_URL,
    ODOO_DB: process.env.ODOO_DB,
    ODOO_LOGIN: process.env.ODOO_LOGIN,
    ODOO_API_KEY: process.env.ODOO_API_KEY,
  }

  if (!hasOdooCredentials(env)) {
    const snap = summaryFromSnapshot(
      snapshot,
      'Verified Odoo 17 General Ledger & POS snapshot.',
      bucket,
    )
    const honestIso = snap.latestRecordAt ?? snap.syncedAt
    const freshness = computeOdooFreshnessStatus(honestIso, referenceNowMs)
    const honestSnap: OdooLiveSummary = {
      ...snap,
      syncedAt: freshness.latestRecordIso,
      latestRecordAt: freshness.latestRecordIso,
    }
    cacheByBucket.set(bucket, { at: referenceNowMs, data: honestSnap })
    return NextResponse.json(
      {
        ...honestSnap,
        ok: true,
        readOnly: false,
        role: caller.role,
        kuwaitSyncedAt: formatKuwaitSyncStamp(freshness.latestRecordIso),
        hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
        isStaleOver24h: freshness.isStaleOver24h,
      },
      { status: 200, headers: responseHeaders },
    )
  }

  try {
    const live = await fetchLiveOdooSummary(
      env,
      periodWindowForBucket(bucket),
      25_000,
      bucket,
    )
    const snapSummary = summaryFromSnapshot(snapshot, undefined, bucket)
    const mergedBuckets =
      snapSummary.buckets || live.buckets
        ? { ...(snapSummary.buckets ?? {}), ...(live.buckets ?? {}) }
        : undefined
    const honestIso = live.latestRecordAt ?? live.syncedAt
    const freshness = computeOdooFreshnessStatus(honestIso, Date.now())
    const data: OdooLiveSummary = {
      ...live,
      syncedAt: freshness.latestRecordIso,
      latestRecordAt: freshness.latestRecordIso,
      ...(mergedBuckets ? { buckets: mergedBuckets } : {}),
    }
    cacheByBucket.set(bucket, { at: Date.now(), data })
    return NextResponse.json(
      {
        ...data,
        ok: true,
        readOnly: false,
        role: caller.role,
        kuwaitSyncedAt: formatKuwaitSyncStamp(freshness.latestRecordIso),
        hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
        isStaleOver24h: freshness.isStaleOver24h,
      },
      { status: 200, headers: responseHeaders },
    )
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    const fallback = summaryFromSnapshot(
      snapshot,
      `Live Odoo pull fallback (${reason}); showing verified Odoo 17 ledger snapshot.`,
      bucket,
    )
    const honestIso = fallback.latestRecordAt ?? fallback.syncedAt
    const freshness = computeOdooFreshnessStatus(honestIso, Date.now())
    const honestFallback: OdooLiveSummary = {
      ...fallback,
      syncedAt: freshness.latestRecordIso,
      latestRecordAt: freshness.latestRecordIso,
    }
    return NextResponse.json(
      {
        ...honestFallback,
        ok: true,
        readOnly: false,
        role: caller.role,
        kuwaitSyncedAt: formatKuwaitSyncStamp(freshness.latestRecordIso),
        hoursSinceLatestOdooRecord: freshness.hoursSinceLatestOdooRecord,
        isStaleOver24h: freshness.isStaleOver24h,
      },
      { status: 200, headers: responseHeaders },
    )
  }
}

export async function GET(request: NextRequest) {
  return handleOdooSyncRequest(request)
}

export async function POST(request: NextRequest) {
  return handleOdooSyncRequest(request)
}
