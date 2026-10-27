import type { NextRequest } from 'next/server'

/**
 * Cross-site protection for state-changing calls. The API is cookie-authenticated through Supabase, so a page on another
 * site could otherwise make the browser send an authenticated POST. Every such call must prove it came from our own origin.
 *
 * A browser always tells us where the call came from: `Sec-Fetch-Site` on every modern browser, and `Origin` on every
 * cross-origin request and on every POST. A request that carries neither header is not a browser request (curl, a test,
 * another server), and those are refused by authentication instead: they can never carry someone else's session cookie.
 */

/** The methods that change data. A GET is readable cross-site only if we send CORS headers, and we never do. */
const STATE_CHANGING: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** `none` is a user-initiated navigation (address bar, bookmark), which cannot be driven by another site. */
const SAME_SITE_VALUES: ReadonlySet<string> = new Set(['same-origin', 'none'])

export type OriginRefusal = 'cross_site_fetch' | 'origin_mismatch' | 'origin_unreadable'

export type OriginVerdict = { allowed: true } | { allowed: false; refusal: OriginRefusal; observed: string }

export function isStateChanging(method: string): boolean {
  return STATE_CHANGING.has(method.toUpperCase())
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * The hosts that count as ours. `Host` is set by the browser from the address it dialled and cannot be forged by a page on
 * another site; `nextUrl.host` is what the framework resolved, which behind a proxy comes from a forwarded host header.
 */
function selfHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>()
  const header = request.headers.get('host')
  if (header) hosts.add(header.toLowerCase())
  if (request.nextUrl.host) hosts.add(request.nextUrl.host.toLowerCase())
  return hosts
}

/**
 * Decides whether a state-changing request may proceed. Reads are always allowed through: they carry no side effect and
 * their body is unreadable cross-site without CORS headers.
 */
export function checkRequestOrigin(request: NextRequest): OriginVerdict {
  if (!isStateChanging(request.method)) return { allowed: true }

  const site = request.headers.get('sec-fetch-site')
  if (site !== null && !SAME_SITE_VALUES.has(site.toLowerCase())) {
    return { allowed: false, refusal: 'cross_site_fetch', observed: site }
  }

  const origin = request.headers.get('origin')
  if (origin === null) return { allowed: true }

  const host = hostOf(origin)
  if (host === null) {
    // `Origin: null` is what a sandboxed frame, a data URL or a redirected cross-origin form sends. It is never ours.
    return { allowed: false, refusal: 'origin_unreadable', observed: origin }
  }
  if (!selfHosts(request).has(host)) {
    return { allowed: false, refusal: 'origin_mismatch', observed: host }
  }
  return { allowed: true }
}
