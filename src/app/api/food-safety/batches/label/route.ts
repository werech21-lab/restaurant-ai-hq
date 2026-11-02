import { NextResponse } from 'next/server'
import { AppError } from '@/lib/api/errors'
import { protectedRoute } from '@/lib/api/route'
import { permissions } from '@/lib/auth/permissions'
import { printBatchLabel } from '@/modules/food-safety'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({ batchId: z.string().min(3).max(40) })

export const GET = protectedRoute(permissions.inventoryStockRead, async ({ request }) => {
  const parsed = querySchema.safeParse({ batchId: request.nextUrl.searchParams.get('batchId') })
  if (!parsed.success) throw new AppError(400, 'bad_request', 'batchId is required')
  try {
    const result = printBatchLabel(parsed.data.batchId)
    return NextResponse.json({ data: result })
  } catch {
    throw new AppError(404, 'not_found', 'Batch not found')
  }
})
