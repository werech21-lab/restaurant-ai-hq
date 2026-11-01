import { NextResponse } from 'next/server'
import { protectedRoute, type RouteArgs } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { withTransaction } from '@/lib/db'
import { globalSearch } from '@/lib/search/global-search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function searchHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const q = new URL(request.url).searchParams.get('q') ?? ''
  const data = await withTransaction((tx) => globalSearch(tx, auth.tenantId, q))
  return NextResponse.json({ data })
}

export const GET = protectedRoute(permissions.hrEmployeeRead, searchHandler)
