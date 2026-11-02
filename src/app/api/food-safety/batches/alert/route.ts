import { NextResponse } from 'next/server'
import { AppError } from '@/lib/api/errors'
import { parseBody } from '@/lib/api/parse'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { alertExclusiveForBatch } from '@/modules/food-safety'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ batchId: z.string().min(3).max(40) })

export const POST = protectedRoute(permissions.inventoryStockAdjust, async ({ request }) => {
  const input = await parseBody(request, bodySchema)
  try {
    const dispatch = await alertExclusiveForBatch(input.batchId)
    return NextResponse.json({ data: { dispatch } })
  } catch {
    throw new AppError(404, 'not_found', 'Batch not found')
  }
})
