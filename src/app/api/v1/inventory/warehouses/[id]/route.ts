import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getWarehouseHandler, updateWarehouseHandler } from '@/modules/inventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryWarehouseRead, getWarehouseHandler)
export const PATCH = protectedRoute(permissions.inventoryWarehouseUpdate, updateWarehouseHandler)
