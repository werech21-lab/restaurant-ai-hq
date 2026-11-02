import { NextResponse } from 'next/server'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { getShelfLifeMatrix } from '@/modules/food-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryStockRead, async ({ request }) => {
  const url = request.nextUrl
  const data = getShelfLifeMatrix({
    brand: url.searchParams.get('brand'),
    category: url.searchParams.get('category'),
    query: url.searchParams.get('q'),
  })
  return NextResponse.json({ data })
})
