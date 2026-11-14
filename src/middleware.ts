import { NextResponse, type NextRequest } from 'next/server'
import {
  EXEC_SESSION_COOKIE,
  sanitizeExecNextPath,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import {
  canTriggerManualOdooSync,
  isErpRouteAllowedForRole,
  resolveCanonicalErpAlias,
  resolvePostLoginRedirectForRole,
  resolveRoleDefaultHome,
  resolveRoleRedirectForForbiddenRoute,
} from '@/lib/auth/role-access-policy'

export const PERMISSIONS_POLICY_VALUE =
  'camera=(self), microphone=(self), geolocation=()'
const ROBOTS_TAG_VALUE = 'noindex, nofollow, noarchive'

const PUBLIC_EXACT_PATHS = new Set([
  '/login',
  '/session-end',
  '/api/auth/login',
  '/api/auth/logout',
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

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', ROBOTS_TAG_VALUE)
  response.headers.set('Permissions-Policy', PERMISSIONS_POLICY_VALUE)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000')
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
    pathname !== '/api/aggregator-radar/alert'
  ) {
    return false
  }
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization') ?? ''
  return constantTimeStringEqual(authHeader, `Bearer ${cronSecret}`)
}

function isAuditorBlockedReadOrExportPath(pathname: string): boolean {
  return AUDITOR_BLOCKED_ANY_METHOD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isAuditorRestrictedMutationPath(pathname: string): boolean {
  if (
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/v1/governance/telemetry'
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
  return pathname.startsWith('/api/')
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  try {
    const host = request.headers.get('host') || ''
    if (host.toLowerCase().startsWith('www.aetherbi.com')) {
      const canonicalUrl = request.nextUrl.clone()
      canonicalUrl.host = 'aetherbi.com'
      canonicalUrl.protocol = 'https'
      return withSecurityHeaders(
        NextResponse.redirect(canonicalUrl, { status: 301 }),
      )
    }

    const rawToken =
      request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
      request.cookies.get('aether_exec_session')?.value
    const execSession = await verifyExecSessionToken(rawToken)

    if (execSession) {
      const method = request.method.toUpperCase()
      if (
        (path === '/api/erp/terminal-mappings' ||
          path.startsWith('/api/erp/terminal-mappings/') ||
          path === '/api/erp/role-directory' ||
          path.startsWith('/api/erp/role-directory/')) &&
        execSession.role !== 'admin'
      ) {
        return withSecurityHeaders(
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
      if (
        execSession.role === 'auditor' &&
        (isAuditorBlockedReadOrExportPath(path) ||
          (MUTATION_METHODS.has(method) && isAuditorRestrictedMutationPath(path)))
      ) {
        return withSecurityHeaders(
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
      if (
        MUTATION_METHODS.has(method) &&
        !canTriggerManualOdooSync(execSession.role) &&
        (path === '/api/erp/odoo-sync' ||
          path.startsWith('/api/erp/odoo-sync/') ||
          path === '/api/odoo-sync' ||
          path.startsWith('/api/odoo-sync/'))
      ) {
        return withSecurityHeaders(
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
        return withSecurityHeaders(
          NextResponse.redirect(homeUrl, { status: 307 }),
        )
      }
      if (path === '/login') {
        const rawNext = request.nextUrl.searchParams.get('next')
        const safeNext = rawNext ? sanitizeExecNextPath(rawNext, '/erp') : ''
        const destPath = resolvePostLoginRedirectForRole(execSession.role, safeNext)
        const destUrl = new URL(destPath, request.url)
        return withSecurityHeaders(
          NextResponse.redirect(destUrl, { status: 307 }),
        )
      }

      if (!path.startsWith('/api/') && !isPublicAssetOrRoute(path)) {
        if (!isErpRouteAllowedForRole(execSession.role, path)) {
          const fallbackUrl = new URL(
            resolveRoleRedirectForForbiddenRoute(execSession.role),
            request.url,
          )
          return withSecurityHeaders(
            NextResponse.redirect(fallbackUrl, { status: 307 }),
          )
        }

        const canonicalAlias = resolveCanonicalErpAlias(path)
        if (canonicalAlias) {
          const rewriteUrl = new URL(
            `${canonicalAlias}${request.nextUrl.search}`,
            request.url,
          )
          return withSecurityHeaders(NextResponse.rewrite(rewriteUrl))
        }
      }

      return withSecurityHeaders(NextResponse.next())
    }

    // Unauthenticated handling:
    if (path === '/') {
      const loginUrl = new URL('/login', request.url)
      return withSecurityHeaders(
        NextResponse.redirect(loginUrl, { status: 307 }),
      )
    }

    if (isPublicAssetOrRoute(path) || isAuthorizedCronRequest(request, path)) {
      return withSecurityHeaders(NextResponse.next())
    }

    if (isProtectedApiPath(path)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      )
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
      return withSecurityHeaders(
        NextResponse.redirect(loginUrl, { status: 307 }),
      )
    }

    return withSecurityHeaders(
      NextResponse.redirect(new URL('/login', request.url), { status: 307 }),
    )
  } catch {
    if (path.startsWith('/api/') && !PUBLIC_EXACT_PATHS.has(path)) {
      return withSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      )
    }
    if (PUBLIC_EXACT_PATHS.has(path)) {
      return withSecurityHeaders(NextResponse.next())
    }
    return withSecurityHeaders(
      NextResponse.redirect(new URL('/login', request.url), { status: 307 }),
    )
  }
}

export const config = {
  matcher: [
    '/',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
