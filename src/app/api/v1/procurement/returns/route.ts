import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createReturnHandler, listReturnsHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementReturnRead, listReturnsHandler)
export const POST = protectedRoute(permissions.procurementReturnCreate, createReturnHandler)
