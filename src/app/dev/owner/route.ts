import { NextResponse } from 'next/server'
import { DEV_OWNER_COOKIE, devOwnerEnabled, devOwnerHostAllowed, devOwnerRedirectUrl, signDevOwnerCookie } from '@/lib/auth/dev-owner'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Signs the local browser in as the aether-demo owner. Missing outside the dev gate, including on Staging's public URL. */
export async function GET(request: Request) {
  const host = request.headers.get('host')
  if (!devOwnerEnabled() || !devOwnerHostAllowed(host)) return new NextResponse(null, { status: 404 })

  const owner = await db.query<{ user_id: string }>(
    `select m.user_id
     from tenants t
     join tenant_members m on m.tenant_id = t.id
     join roles r on r.id = m.role_id and r.tenant_id = t.id
     where t.slug = 'aether-demo' and t.status = 'active' and r.name = 'owner'
     limit 1`
  )
  const userId = owner.rows[0]?.user_id
  if (!userId) return new NextResponse(null, { status: 404 })

  const destination = devOwnerRedirectUrl(host ?? '', new URL(request.url).searchParams.get('next'))
  const response = NextResponse.redirect(destination)
  response.cookies.set(DEV_OWNER_COOKIE, await signDevOwnerCookie(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 60 * 60,
  })
  return response
}
