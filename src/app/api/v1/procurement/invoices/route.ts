import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createInvoiceHandler, listInvoicesHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementInvoiceRead, listInvoicesHandler)
export const POST = protectedRoute(permissions.procurementInvoiceCreate, createInvoiceHandler)
