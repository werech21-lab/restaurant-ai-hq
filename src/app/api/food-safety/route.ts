import { NextResponse } from 'next/server'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { getFoodSafetyBoard } from '@/modules/food-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryStockRead, async ({ request }) => {
  const url = request.nextUrl
  const board = getFoodSafetyBoard({
    brandId: url.searchParams.get('brandId'),
    branchId: url.searchParams.get('branchId'),
  })
  return NextResponse.json({ data: board })
})
