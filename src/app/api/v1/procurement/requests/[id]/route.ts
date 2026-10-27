import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { getRequestHandler, updateRequestHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementRequestRead, getRequestHandler)
export const PATCH = protectedRoute(permissions.procurementRequestCreate, updateRequestHandler)
