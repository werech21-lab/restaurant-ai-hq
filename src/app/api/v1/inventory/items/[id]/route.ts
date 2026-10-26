import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getItemHandler, updateItemHandler } from '@/modules/inventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryItemRead, getItemHandler)
export const PATCH = protectedRoute(permissions.inventoryItemUpdate, updateItemHandler)
