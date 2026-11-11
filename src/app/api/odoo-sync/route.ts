import { NextResponse, type NextRequest } from 'next/server'
import snapshot from '@/lib/odoo-live-snapshot.json'
import { fetchLiveOdooSummary, hasOdooCredentials, isSameSiteRequest, parseBucketKey, periodWindowForBucket, summaryFromSnapshot, type OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/** Live pulls are throttled per period bucket so the topbar pill can never hammer Odoo. */
const MIN_INTERVAL_MS = 60_000
const cacheByBucket = new Map<string, { at: number; data: OdooLiveSummary }>()

const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

/**
 * Sales figures are only served to a signed-in session: a valid signed `erp_session` cookie
 * or a Supabase session. The executive fallback user used by pages does NOT apply here.
 */
async function signedInUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    const userId = await verifySessionToken(token)
    if (userId) return userId
  }
  try {
    const supabase = await createClient()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      if (data.user) return data.user.id
    }
  } catch {
    // no Supabase session
  }
  return null
}

export async function GET(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) return NextResponse.json({ error: 'cross_site_refused' }, { status: 403, headers })
  if (!(await signedInUserId(request))) {
    return NextResponse.json({ error: 'unauthorized', message: 'Sign in to view Odoo sales figures.' }, { status: 401, headers: { ...headers, 'www-authenticate': 'Session' } })
  }

  const bucket = parseBucketKey(request.nextUrl.searchParams.get('period'))
  const cached = cacheByBucket.get(bucket)
  if (cached && Date.now() - cached.at < MIN_INTERVAL_MS) return NextResponse.json({ ...cached.data, cached: true }, { headers })

  const env = {
    ODOO_URL: process.env.ODOO_URL,
    ODOO_DB: process.env.ODOO_DB,
    ODOO_LOGIN: process.env.ODOO_LOGIN,
    ODOO_API_KEY: process.env.ODOO_API_KEY,
  }
  if (!hasOdooCredentials(env)) {
    return NextResponse.json(summaryFromSnapshot(snapshot, 'Odoo credentials are not configured on this server; showing the last synced snapshot.', bucket), { headers })
  }
  try {
    const live = await fetchLiveOdooSummary(env, periodWindowForBucket(bucket), 25_000, bucket)
    const snapSummary = summaryFromSnapshot(snapshot, undefined, bucket)
    const mergedBuckets = snapSummary.buckets || live.buckets ? { ...(snapSummary.buckets ?? {}), ...(live.buckets ?? {}) } : undefined
    const data: OdooLiveSummary = { ...live, ...(mergedBuckets ? { buckets: mergedBuckets } : {}) }
    cacheByBucket.set(bucket, { at: Date.now(), data })
    return NextResponse.json(data, { headers })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return NextResponse.json(summaryFromSnapshot(snapshot, `Live Odoo pull failed (${reason}); showing the last synced snapshot.`, bucket), { headers })
  }
}
