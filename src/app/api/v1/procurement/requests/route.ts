import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createRequestHandler, listRequestsHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementRequestRead, listRequestsHandler)
export const POST = protectedRoute(permissions.procurementRequestCreate, createRequestHandler)
