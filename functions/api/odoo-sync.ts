/**
 * Cloudflare Pages Function: GET /api/odoo-sync
 *
 * Reads ODOO_URL / ODOO_DB / ODOO_LOGIN / ODOO_API_KEY from the Pages project environment
 * so credentials never reach the browser. Never falls back to any static snapshot file:
 * when credentials are missing or Odoo is unreachable, returns a strict disconnected response.
 */
import { jwtVerify } from 'jose'
import {
  fetchLiveOdooSummary,
  hasOdooCredentials,
  isSameSiteRequest,
  parseBucketKey,
  periodWindowForBucket,
  type OdooEnv,
} from '../../src/lib/odoo/live-sync-core'

interface PagesEnv extends OdooEnv {
  AUTH_SECRET?: string
}

interface PagesContext {
  request: Request
  env: PagesEnv
}

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
}
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } })

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

async function hasValidSession(request: Request, secret: string | undefined): Promise<boolean> {
  if (!secret) return false
  const token = cookieValue(request, 'erp_session')
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    })
    return Boolean(payload.sub)
  } catch {
    return false
  }
}

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  if (!isSameSiteRequest(request.headers)) return json({ error: 'cross_site_refused' }, 403)
  if (!(await hasValidSession(request, env.AUTH_SECRET))) {
    return json({ error: 'unauthorized', message: 'Sign in to view Odoo sales figures.' }, 401, {
      'www-authenticate': 'Session',
    })
  }
  const bucket = parseBucketKey(new URL(request.url).searchParams.get('period'))
  if (!hasOdooCredentials(env)) {
    return json(
      {
        ok: false,
        connected: false,
        noData: true,
        source: 'disconnected',
        messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
        messageEn: 'No data from Odoo for this period',
      },
      503,
    )
  }
  try {
    const live = await fetchLiveOdooSummary(env, periodWindowForBucket(bucket), 25_000, bucket)
    return json(live)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error'
    return json(
      {
        ok: false,
        connected: false,
        noData: true,
        source: 'disconnected',
        messageAr: 'لا توجد بيانات من Odoo لهذه الفترة',
        messageEn: `Odoo connection failed (${reason})`,
      },
      503,
    )
  }
}
