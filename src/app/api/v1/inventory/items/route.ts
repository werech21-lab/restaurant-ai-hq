import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createItemHandler, listItemsHandler } from '@/modules/inventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.inventoryItemRead, listItemsHandler)
export const POST = protectedRoute(permissions.inventoryItemCreate, createItemHandler)
