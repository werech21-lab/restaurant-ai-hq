import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createMovementHandler, listMovementsHandler } from '@/modules/inventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryStockRead, listMovementsHandler)
export const POST = protectedRoute(permissions.inventoryStockAdjust, createMovementHandler)
