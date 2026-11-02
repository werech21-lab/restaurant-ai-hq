import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/parse'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { shiftCheckInSchema } from '@/modules/food-safety/schemas/food-safety'
import { submitShiftCheckIn } from '@/modules/food-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.inventoryStockRead, async ({ request }) => {
  const input = await parseBody(request, shiftCheckInSchema)
  const result = await submitShiftCheckIn(input)
  return NextResponse.json({ data: result }, { status: 201 })
})
