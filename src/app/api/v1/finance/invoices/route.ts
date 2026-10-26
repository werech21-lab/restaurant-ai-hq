import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createInvoiceHandler, listInvoicesHandler } from '@/modules/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.financeInvoiceRead, listInvoicesHandler)
export const POST = protectedRoute(permissions.financeInvoiceCreate, createInvoiceHandler)
