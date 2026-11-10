/**
 * Cloudflare Pages Function: GET /api/odoo-sync
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY from the Pages project environment
 * (Settings → Environment variables, encrypted) so credentials never reach the browser and the
 * browser never calls Odoo directly (no CORS). Falls back to the snapshot written by
 * `node scripts/sync-odoo-live.mjs` when variables are missing or Odoo is unreachable.
 */
import snapshot from '../../src/lib/odoo-live-snapshot.json'
import { fetchLiveOdooSummary, hasOdooCredentials, isSameSiteRequest, summaryFromSnapshot, type OdooEnv } from '../../src/lib/odoo/live-sync-core'

interface PagesContext {
  request: Request
  env: OdooEnv
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS })

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!isSameSiteRequest(request.headers)) return json({ error: 'cross_site_refused' }, 403)
  if (!hasOdooCredentials(env)) {
    return json(summaryFromSnapshot(snapshot, 'Odoo environment variables are not set on Cloudflare Pages; showing the last synced snapshot.'))
  }
  try {
    return json(await fetchLiveOdooSummary(env))
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return json(summaryFromSnapshot(snapshot, `Live Odoo pull failed (${reason}); showing the last synced snapshot.`))
  }
}
