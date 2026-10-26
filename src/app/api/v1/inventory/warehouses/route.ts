import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createWarehouseHandler, listWarehousesHandler } from '@/modules/inventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryWarehouseRead, listWarehousesHandler)
export const POST = protectedRoute(permissions.inventoryWarehouseCreate, createWarehouseHandler)
