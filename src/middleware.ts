import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { E2E_COOKIE, e2eEnabled, e2eUserId } from '@/lib/auth/e2e-session'
import { safeNextPath } from '@/lib/safe-next'
import { supabaseEnv } from '@/lib/supabase/env'

export async function middleware(request: NextRequest) {
  const env = supabaseEnv()
  const path = request.nextUrl.pathname
  if (e2eEnabled() && (await e2eUserId(request.cookies.get(E2E_COOKIE)?.value))) return NextResponse.next()
  if (!env) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && (path.startsWith('/admin') || path.startsWith('/erp'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (user && path === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = safeNextPath(request.nextUrl.searchParams.get('next'))
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*', '/erp/:path*', '/login'],
}
