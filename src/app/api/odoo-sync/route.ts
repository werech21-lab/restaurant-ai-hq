import { NextResponse, type NextRequest } from 'next/server'
import snapshot from '@/lib/odoo-live-snapshot.json'
import { fetchLiveOdooSummary, hasOdooCredentials, isSameSiteRequest, summaryFromSnapshot, type OdooLiveSummary } from '@/lib/odoo/live-sync-core'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/** Live pulls are throttled so the topbar pill can never hammer Odoo. */
const MIN_INTERVAL_MS = 60_000
let cache: { at: number; data: OdooLiveSummary } | null = null

const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

export async function GET(request: NextRequest) {
  if (!isSameSiteRequest(request.headers)) return NextResponse.json({ error: 'cross_site_refused' }, { status: 403, headers })

  if (cache && Date.now() - cache.at < MIN_INTERVAL_MS) return NextResponse.json({ ...cache.data, cached: true }, { headers })

  const env = {
    ODOO_URL: process.env.ODOO_URL,
    ODOO_DB: process.env.ODOO_DB,
    ODOO_LOGIN: process.env.ODOO_LOGIN,
    ODOO_API_KEY: process.env.ODOO_API_KEY,
  }
  if (!hasOdooCredentials(env)) {
    return NextResponse.json(summaryFromSnapshot(snapshot, 'Odoo credentials are not configured on this server; showing the last synced snapshot.'), { headers })
  }
  try {
    const data = await fetchLiveOdooSummary(env)
    cache = { at: Date.now(), data }
    return NextResponse.json(data, { headers })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return NextResponse.json(summaryFromSnapshot(snapshot, `Live Odoo pull failed (${reason}); showing the last synced snapshot.`), { headers })
  }
}
