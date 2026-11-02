import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/parse'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { createBatchSchema } from '@/modules/food-safety/schemas/food-safety'
import { createShelfLifeBatch } from '@/modules/food-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.inventoryStockAdjust, async ({ request }) => {
  const input = await parseBody(request, createBatchSchema)
  const result = createShelfLifeBatch(input)
  return NextResponse.json({ data: result }, { status: 201 })
})
