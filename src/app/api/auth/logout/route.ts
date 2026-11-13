import { NextResponse } from 'next/server'
import {
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  isSecureRequest,
} from '@/lib/auth/exec-session'
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session'

const ROBOTS_HEADER = 'noindex, nofollow, noarchive'
const PERMISSIONS_POLICY_HEADER =
  'camera=(self), microphone=(self), geolocation=(), browsing-topics=()'

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

export async function POST(request: Request) {
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
      headers: {
        'X-Robots-Tag': ROBOTS_HEADER,
        'Permissions-Policy': PERMISSIONS_POLICY_HEADER,
        'Cache-Control': 'no-store',
      },
    })
    clearAuthCookies(response, isSecure)
    return response
  }

  const response = NextResponse.json(
    { ok: true, redirectTo: '/login' },
    {
      status: 200,
      headers: {
        'X-Robots-Tag': ROBOTS_HEADER,
        'Permissions-Policy': PERMISSIONS_POLICY_HEADER,
        'Cache-Control': 'no-store',
      },
    },
  )
  clearAuthCookies(response, isSecure)
  return response
}

export async function GET(request: Request) {
  const isSecure = isSecureRequest(request)
  const response = NextResponse.redirect(new URL('/login', request.url), {
    status: 303,
    headers: {
      'X-Robots-Tag': ROBOTS_HEADER,
      'Permissions-Policy': PERMISSIONS_POLICY_HEADER,
      'Cache-Control': 'no-store',
    },
  })
  clearAuthCookies(response, isSecure)
  return response
}
