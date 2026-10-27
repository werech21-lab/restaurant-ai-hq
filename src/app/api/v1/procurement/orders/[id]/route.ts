import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getOrderHandler, updateOrderHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementOrderRead, getOrderHandler)
export const PATCH = protectedRoute(permissions.procurementOrderUpdate, updateOrderHandler)
