import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createPaymentHandler, listPaymentsHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementPaymentRead, listPaymentsHandler)
export const POST = protectedRoute(permissions.procurementPaymentCreate, createPaymentHandler)
