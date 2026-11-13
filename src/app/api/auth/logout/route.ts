import { NextResponse, type NextRequest } from 'next/server'
import { ENTERPRISE_API_SECURITY_HEADERS } from '@/lib/auth/api-guard'
import {
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  isSecureRequest,
} from '@/lib/auth/exec-session'
import { checkRequestOrigin } from '@/lib/http-origin'
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'

function clearAuthCookies(response: NextResponse, isSecure: boolean) {
  response.cookies.set(EXEC_SESSION_COOKIE, '', {
    ...execCookieOptions(isSecure),
    maxAge: 0,
    path: '/',
  })
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions,
    secure: isSecure,
    maxAge: 0,
    path: '/',
  })
}

export async function POST(request: NextRequest) {
  const hasOriginMeta =
    Boolean(request.headers.get('origin')) || Boolean(request.headers.get('sec-fetch-site'))
  if (hasOriginMeta && !checkRequestOrigin(request).allowed) {
    return NextResponse.json(
      { ok: false, error: 'Cross-origin logout refused' },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const isSecure = isSecureRequest(request)
  const secFetchMode = (request.headers.get('sec-fetch-mode') || '').toLowerCase()
  const contentType = (request.headers.get('content-type') || '').toLowerCase()
  const accept = (request.headers.get('accept') || '').toLowerCase()

  const isFormNavigation =
    secFetchMode === 'navigate' ||
    ((contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')) &&
      accept.includes('text/html'))

  if (isFormNavigation) {
    const response = NextResponse.redirect(new URL('/login', request.url), {
      status: 303,
      headers: ENTERPRISE_API_SECURITY_HEADERS,
    })
    clearAuthCookies(response, isSecure)
    return response
  }

  const response = NextResponse.json(
    { ok: true, redirectTo: '/login' },
    {
      status: 200,
      headers: ENTERPRISE_API_SECURITY_HEADERS,
    },
  )
  clearAuthCookies(response, isSecure)
  return response
}

export async function GET(request: Request) {
  const secFetchSite = (request.headers.get('sec-fetch-site') || '').toLowerCase()
  const isSecure = isSecureRequest(request)
  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 303,
    headers: ENTERPRISE_API_SECURITY_HEADERS,
  })
  // Prevent cross-site <img src="/api/auth/logout"> forced-logout CSRF
  if (secFetchSite !== 'cross-site') {
    clearAuthCookies(response, isSecure)
  }
  return response
}
