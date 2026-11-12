import { NextResponse, type NextRequest } from 'next/server'
import {
  EXEC_SESSION_COOKIE,
  sanitizeExecNextPath,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'

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

function withNoIndex(response: NextResponse): NextResponse {
  response.headers.set('X-Robots-Tag', ROBOTS_TAG_VALUE)
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
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix),
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
      return withNoIndex(NextResponse.redirect(canonicalUrl, { status: 301 }))
    }

    const rawToken =
      request.cookies.get(EXEC_SESSION_COOKIE)?.value ??
      request.cookies.get('aether_exec_session')?.value
    const execSession = await verifyExecSessionToken(rawToken)

    if (execSession) {
      if (path === '/') {
        const erpUrl = new URL('/erp', request.url)
        return withNoIndex(NextResponse.redirect(erpUrl, { status: 307 }))
      }
      if (path === '/login') {
        const safeNext = sanitizeExecNextPath(
          request.nextUrl.searchParams.get('next'),
          '/erp',
        )
        const destUrl = new URL(safeNext, request.url)
        return withNoIndex(NextResponse.redirect(destUrl, { status: 307 }))
      }
      return withNoIndex(NextResponse.next())
    }

    // Unauthenticated handling:
    if (path === '/') {
      const loginUrl = new URL('/login', request.url)
      return withNoIndex(NextResponse.redirect(loginUrl, { status: 307 }))
    }

    if (isPublicAssetOrRoute(path)) {
      return withNoIndex(NextResponse.next())
    }

    if (isProtectedApiPath(path)) {
      return withNoIndex(
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
      return withNoIndex(NextResponse.redirect(loginUrl, { status: 307 }))
    }

    return withNoIndex(NextResponse.redirect(new URL('/login', request.url), { status: 307 }))
  } catch {
    if (path.startsWith('/api/') && !PUBLIC_EXACT_PATHS.has(path)) {
      return withNoIndex(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      )
    }
    if (PUBLIC_EXACT_PATHS.has(path)) {
      return withNoIndex(NextResponse.next())
    }
    return withNoIndex(
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
