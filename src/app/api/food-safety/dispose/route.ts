import { NextResponse } from 'next/server'
import { parseBody } from '@/lib/api/parse'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { disposeSchema } from '@/modules/food-safety/schemas/food-safety'
import { disposeSpoilage } from '@/modules/food-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = protectedRoute(permissions.inventoryStockAdjust, async ({ request }) => {
  const input = await parseBody(request, disposeSchema)
  const result = await disposeSpoilage(input)
  return NextResponse.json({ data: result }, { status: 201 })
})
