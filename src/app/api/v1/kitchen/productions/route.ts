import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listProductionsHandler, recordProductionHandler } from '@/modules/kitchen'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryItemRead, listProductionsHandler)
export const POST = protectedRoute(permissions.inventoryStockAdjust, recordProductionHandler)
