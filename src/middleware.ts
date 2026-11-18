import { NextResponse, type NextRequest } from 'next/server'
import {
  EXEC_SESSION_COOKIE,
  sanitizeExecNextPath,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import {
  canTriggerManualOdooSync,
  isAuditorForbiddenPath,
  isErpRouteAllowedForRole,
  resolveCanonicalErpAlias,
  resolvePostLoginRedirectForRole,
  resolveRoleDefaultHome,
  resolveRoleRedirectForForbiddenRoute,
} from '@/lib/auth/role-access-policy'

export type ExecRole =
  | 'admin'
  | 'gm'
  | 'dgm'
  | 'ops'
  | 'cfo'
  | 'marketing'
  | 'supply'
  | 'auditor'

export const EXEC_ROLE_WHITELIST: ReadonlySet<ExecRole> = new Set<ExecRole>([
  'admin',
  'gm',
  'dgm',
  'ops',
  'cfo',
  'marketing',
  'supply',
  'auditor',
])

export const PERMISSIONS_POLICY_VALUE =
  'camera=(self), microphone=(self), geolocation=()'
const ROBOTS_TAG_VALUE = 'noindex, nofollow, noarchive'
const HSTS_HEADER_VALUE = 'max-age=31536000; includeSubDomains'

function generateCspNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function originOfUrl(value?: string): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function buildMiddlewareCsp(nonce: string, isProduction: boolean): string {
  const supabase = originOfUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const connect = [
    "'self'",
    'https://generativelanguage.googleapis.com',
    'https://*.googleapis.com',
    'https://api.x.ai',
    'https://*.x.ai',
    'https://api.openai.com',
    'https://translate.google.com',
    'https://*.openai.com',
  ]
  if (supabase) {
    connect.push(supabase)
    connect.push(supabase.replace(/^http/, 'ws'))
  }
  const scriptSrc = isProduction
    ? ["'self'", `'nonce-${nonce}'`]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
  const parts = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob: data: https://api.openai.com https://translate.google.com",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]
  if (isProduction) parts.push('upgrade-insecure-requests')
  return parts.join('; ')
}

const PUBLIC_EXACT_PATHS = new Set([
  '/login',
  '/session-end',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/locale',
  '/api/health',
  '/robots.txt',
  '/manifest.json',
  '/favicon.ico',
  '/sw.js',
])

const STATIC_ASSET_EXT =
  /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot|css|map)$/i

const PROTECTED_API_PREFIXES = [
  '/api/erp',
  '/api/feryal',
  '/api/ai',
  '/api/executive-directive',
  '/api/aggregator-radar',
  '/api/v1',
]

const AUDITOR_BLOCKED_MUTATION_PREFIXES = [
  '/api/erp',
  '/api/feryal',
  '/api/ai',
  '/api/v1',
  '/api/odoo-sync',
  '/api/download',
  '/api/executive-directive',
  '/api/aggregator-radar',
  '/api/ingest',
  '/api/hr',
  '/api/food-safety',
  '/api/smart-dropzone',
  '/api/kds',
  '/api/odoo-ai-analysis',
]

const AUDITOR_BLOCKED_ANY_METHOD_PREFIXES = ['/api/download/backup']

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const PROTECTED_PAGE_PREFIXES = [
  '/erp',
  '/dashboard',
  '/reports',
  '/accounting',
  '/hr',
  '/sales',
  '/purchases',
  '/warehouses',
  '/crm',
  '/inventory',
  '/bi-analytics',
  '/admin',
  '/kds',
  '/pos',
  '/recipes',
]

function withSecurityHeaders(response: NextResponse, cspValue?: string): NextResponse {
  const isProd = process.env.NODE_ENV === 'production'
  if (cspValue) {
    response.headers.set('Content-Security-Policy', cspValue)
  }
  response.headers.set('X-Robots-Tag', ROBOTS_TAG_VALUE)
  response.headers.set('Permissions-Policy', PERMISSIONS_POLICY_VALUE)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  if (isProd) {
    response.headers.set('Strict-Transport-Security', HSTS_HEADER_VALUE)
  }
  return response
}

function isPublicAssetOrRoute(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true
  if (pathname.startsWith('/_next/')) return true
  if (STATIC_ASSET_EXT.test(pathname)) return true
  return false
}

function isProtectedApiPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return false
  if (
    PROTECTED_API_PREFIXES.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(`${prefix}/`) ||
        pathname.startsWith(prefix),
    )
  ) {
    return true
  }
  return pathname.startsWith('/api/')
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function isAuthorizedCronRequest(request: NextRequest, pathname: string): boolean {
  if (
    pathname !== '/api/erp/odoo-sync' &&
    pathname !== '/api/odoo-sync' &&
    pathname !== '/api/aggregator-radar/alert' &&
    pathname !== '/api/cron/ai-daily-brief' &&
    pathname !== '/api/cron/council'
  ) {
    return false
  }
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization') ?? ''
  return constantTimeStringEqual(authHeader, `Bearer ${cronSecret}`)
}

function isAuditorBlockedReadOrExportPath(pathname: string): boolean {
  if (
    AUDITOR_BLOCKED_ANY_METHOD_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true
  }
  return isAuditorForbiddenPath(pathname)
}

function isAuditorRestrictedMutationPath(pathname: string): boolean {
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/auth/locale'
  ) {
    return false
  }
  if (
    AUDITOR_BLOCKED_MUTATION_PREFIXES.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(`${prefix}/`) ||
        pathname.startsWith(prefix),
    )
  ) {
    return true
  }
  return true
}

function buildAuditorForbiddenPageResponse(): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>403 — وصول مقيّد | فنتشر فودز</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070d17;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:24px;">
  <main style="max-width:480px;width:100%;border:1px solid rgba(16,185,129,0.25);background:#0d1522;border-radius:16px;padding:28px;text-align:center;">
    <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(244,63,94,0.15);color:#fda4af;font-size:12px;font-weight:700;">403 · Read-only auditor session</div>
    <h1 style="margin:14px 0 8px;font-size:20px;font-weight:800;">هذا المسار محظور على حساب المراجع</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#94a3b8;">بيانات المستخدمين والموارد البشرية والإعدادات محجوبة من الخادم لحساب المراجعة للقراءة فقط.</p>
    <a href="/erp" style="display:inline-block;padding:10px 20px;border-radius:10px;background:#10b981;color:#020617;font-size:13px;font-weight:800;text-decoration:none;">العودة إلى لوحة القيادة التنفيذية</a>
  </main>
</body>
</html>`
  return new NextResponse(html, {
    status: 403,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isProd = process.env.NODE_ENV === 'production'
  const nonce = generateCspNonce()
  const csp = buildMiddlewareCsp(nonce, isProd)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const seal = (res: NextResponse) => withSecurityHeaders(res, csp)
  const passThrough = () => seal(NextResponse.next({ request: { headers: requestHeaders } }))

  try {
    const host = request.headers.get('host') || ''
    if (host.toLowerCase().startsWith('www.aetherbi.com')) {
      const canonicalUrl = request.nextUrl.clone()
      canonicalUrl.host = 'aetherbi.com'
      canonicalUrl.protocol = 'https'
      return seal(NextResponse.redirect(canonicalUrl, { status: 301 }))
    }

    const rawToken =
      request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
      request.cookies.get('aether_exec_session')?.value
    const execSession = await verifyExecSessionToken(rawToken)

    if (execSession && EXEC_ROLE_WHITELIST.has(execSession.role)) {
      const method = request.method.toUpperCase()
      if (
        (path === '/api/erp/terminal-mappings' ||
          path.startsWith('/api/erp/terminal-mappings/') ||
          path === '/api/erp/role-directory' ||
          path.startsWith('/api/erp/role-directory/')) &&
        execSession.role !== 'admin'
      ) {
        return seal(
          NextResponse.json(
            {
              ok: false,
              error: 'forbidden_admin_only',
              errorAr: 'هذه الصلاحية محصورة بمسؤول النظام فقط.',
            },
            { status: 403 },
          ),
        )
      }
      if (execSession.role === 'auditor') {
        if (MUTATION_METHODS.has(method) && isAuditorRestrictedMutationPath(path)) {
          return seal(
            NextResponse.json(
              {
                ok: false,
                error: 'Read-only auditor session',
                errorAr:
                  'حساب مراجعة للقراءة فقط — التعديل والاعتماد غير متاحين.',
              },
              { status: 403 },
            ),
          )
        }
        if (isAuditorBlockedReadOrExportPath(path)) {
          const wantsJson =
            path.startsWith('/api/') ||
            (request.headers.get('accept') || '').includes('application/json')
          return seal(
            wantsJson
              ? NextResponse.json(
                  {
                    ok: false,
                    error: 'Read-only auditor session',
                    errorAr:
                      'حساب مراجعة للقراءة فقط — هذا المسار محظور على المراجع.',
                  },
                  { status: 403 },
                )
              : buildAuditorForbiddenPageResponse(),
          )
        }
      }
      if (
        MUTATION_METHODS.has(method) &&
        !canTriggerManualOdooSync(execSession.role) &&
        (path === '/api/erp/odoo-sync' ||
          path.startsWith('/api/erp/odoo-sync/') ||
          path === '/api/odoo-sync' ||
          path.startsWith('/api/odoo-sync/'))
      ) {
        return seal(
          NextResponse.json(
            {
              ok: false,
              error: 'forbidden_sync_role_restricted',
              errorAr:
                'تحديث ربط أودو المباشر محصور بمسؤول النظام والإدارة التنفيذية والمالية والعمليات.',
            },
            { status: 403 },
          ),
        )
      }

      if (path === '/') {
        const homeUrl = new URL(resolveRoleDefaultHome(execSession.role), request.url)
        return seal(NextResponse.redirect(homeUrl, { status: 307 }))
      }
      if (path === '/login') {
        const rawNext = request.nextUrl.searchParams.get('next')
        const safeNext = rawNext ? sanitizeExecNextPath(rawNext, '/erp') : ''
        const destPath = resolvePostLoginRedirectForRole(execSession.role, safeNext)
        const destUrl = new URL(destPath, request.url)
        return seal(NextResponse.redirect(destUrl, { status: 307 }))
      }

      if (!path.startsWith('/api/') && !isPublicAssetOrRoute(path)) {
        if (!isErpRouteAllowedForRole(execSession.role, path)) {
          const fallbackUrl = new URL(
            resolveRoleRedirectForForbiddenRoute(execSession.role),
            request.url,
          )
          return seal(NextResponse.redirect(fallbackUrl, { status: 307 }))
        }

        const canonicalAlias = resolveCanonicalErpAlias(path)
        if (canonicalAlias) {
          const rewriteUrl = new URL(
            `${canonicalAlias}${request.nextUrl.search}`,
            request.url,
          )
          return seal(
            NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } }),
          )
        }
      }

      return passThrough()
    }

    // Unauthenticated handling:
    if (path === '/') {
      const loginUrl = new URL('/login', request.url)
      return seal(NextResponse.redirect(loginUrl, { status: 307 }))
    }

    if (isPublicAssetOrRoute(path) || isAuthorizedCronRequest(request, path)) {
      return passThrough()
    }

    if (isProtectedApiPath(path)) {
      return seal(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }

    // All protected ERP & panel routes (including /erp, /erp/:path*, PROTECTED_PAGE_PREFIXES, and any other internal route)
    const isErpOrPanel =
      PROTECTED_PAGE_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
      ) || !isPublicAssetOrRoute(path)

    if (isErpOrPanel) {
      const loginUrl = new URL('/login', request.url)
      const requestedPath = `${path}${request.nextUrl.search}`
      loginUrl.searchParams.set('next', requestedPath)
      return seal(NextResponse.redirect(loginUrl, { status: 307 }))
    }

    return seal(NextResponse.redirect(new URL('/login', request.url), { status: 307 }))
  } catch {
    if (path.startsWith('/api/') && !PUBLIC_EXACT_PATHS.has(path)) {
      return seal(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    if (PUBLIC_EXACT_PATHS.has(path)) {
      return passThrough()
    }
    return seal(NextResponse.redirect(new URL('/login', request.url), { status: 307 }))
  }
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
